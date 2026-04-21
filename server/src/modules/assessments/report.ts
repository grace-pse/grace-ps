import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Browser, LaunchOptions } from 'puppeteer';
import puppeteer from 'puppeteer';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import { renderReportHtml, type ReportData } from './report-template.js';

const uuid = z.string().uuid();
type JwtPayload = { sub: string; tenantId: string; role: string };

// ── Singleton browser (lazy, reused across requests) ─────────
let browserPromise: Promise<Browser> | null = null;

function launchBrowser(): Promise<Browser> {
  const opts: LaunchOptions = {
    // 'shell' = legacy headless-shell mode. The "new" headless mode
    // (`headless: true` in Puppeteer 22+) spawns chrome_crashpad_handler
    // unconditionally, and the Debian chromium package launches it without
    // a --database path → launch fails with
    //   "chrome_crashpad_handler: --database is required".
    // headless-shell doesn't have the crashpad path at all.
    headless: 'shell',
    // /tmp is writable for the non-root node user inside the api container.
    userDataDir: '/tmp/csmp-chromium',
    // NOTE: we intentionally do NOT set `pipe: true` — the pipe transport
    // emits an unhandled 'error' on the child stdio socket when chromium
    // exits unexpectedly, which crashes the whole Node process. The default
    // websocket transport surfaces those as rejected promises instead.
    args: [
      // Sandbox: non-root user inside the Docker runner, no seccomp profile.
      '--no-sandbox',
      '--disable-setuid-sandbox',
      // /dev/shm in the container is only 64 MB by default.
      '--disable-dev-shm-usage',
      // Headless has no GPU anyway.
      '--disable-gpu',
      // Belt-and-braces crash-reporter disable in case anything else tries
      // to wire up crashpad/breakpad.
      '--disable-crash-reporter',
      '--disable-breakpad',
      '--no-crash-upload',
      // Chromium still spawns chrome_crashpad_handler at startup; give it a
      // writable dir so it doesn't abort with "--database is required".
      '--crash-dumps-dir=/tmp/csmp-crashpad',
    ],
  };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    opts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  return puppeteer.launch(opts);
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launchBrowser().catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  const browser = await browserPromise;
  if (!browser.connected) {
    browserPromise = null;
    return getBrowser();
  }
  return browser;
}

async function renderPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '14mm', right: '12mm', bottom: '14mm', left: '12mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'report'
  );
}

export default async function reportRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  app.addHook('onClose', async () => {
    if (browserPromise) {
      const b = await browserPromise.catch(() => null);
      browserPromise = null;
      if (b) await b.close().catch(() => {});
    }
  });

  router.get(
    '/:id/report.pdf',
    {
      onRequest: [app.authenticate, requirePermission('assessments:read')],
      schema: {
        tags: ['assessments'],
        summary: 'Download assessment as PDF report',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        // Response body is a raw PDF Buffer; we don't declare a JSON response
        // schema so the Zod serializer doesn't touch it.
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;

      const a = await prisma.assessment.findFirst({
        where: { id: req.params.id, tenantId },
        include: {
          organization: { select: { name: true } },
          asset: { select: { id: true, name: true, assetType: true, criticality: true } },
          cluster: {
            select: {
              id: true, name: true, clusterType: true, statusPropagation: true,
              memberships: { select: { assetId: true } },
            },
          },
          leadAssessor: { select: { firstName: true, lastName: true, email: true } },
          reviewedBy: { select: { firstName: true, lastName: true, email: true } },
          threats: {
            include: { targetAsset: { select: { id: true, name: true, assetType: true } } },
            orderBy: [{ createdAt: 'asc' }],
          },
          actionPlans: { orderBy: [{ createdAt: 'asc' }] },
        },
      });
      if (!a) return reply.code(404).send({ error: 'Assessment not found' });

      // Resolve scope assets (direct asset OR cluster members + cascade).
      const scopeAssetIds = new Set<string>();
      if (a.asset) scopeAssetIds.add(a.asset.id);
      if (a.cluster) {
        const seedIds = a.cluster.memberships.map((m) => m.assetId);
        for (const id of seedIds) scopeAssetIds.add(id);
        if (
          (a.cluster.statusPropagation === 'CASCADE_DOWN' ||
            a.cluster.statusPropagation === 'BIDIRECTIONAL') &&
          seedIds.length > 0
        ) {
          let frontier = seedIds;
          while (frontier.length > 0) {
            const children = await prisma.asset.findMany({
              where: { tenantId, parentId: { in: frontier } },
              select: { id: true },
            });
            const next: string[] = [];
            for (const c of children) {
              if (!scopeAssetIds.has(c.id)) {
                scopeAssetIds.add(c.id);
                next.push(c.id);
              }
            }
            frontier = next;
          }
        }
      }
      const scopeAssets =
        scopeAssetIds.size === 0
          ? []
          : await prisma.asset.findMany({
              where: { tenantId, id: { in: Array.from(scopeAssetIds) } },
              select: { id: true, name: true, assetType: true, criticality: true },
              orderBy: [{ name: 'asc' }],
            });

      const data: ReportData = {
        organization: a.organization,
        assessment: a,
        asset: a.asset,
        cluster: a.cluster ? { id: a.cluster.id, name: a.cluster.name, clusterType: a.cluster.clusterType } : null,
        leadAssessor: a.leadAssessor,
        reviewer: a.reviewedBy,
        scopeAssets,
        threats: a.threats,
        actionPlans: a.actionPlans,
        generatedAt: new Date(),
      };

      const html = renderReportHtml(data);

      let pdf: Buffer;
      try {
        pdf = await renderPdf(html);
      } catch (err) {
        req.log.error({ err }, 'PDF render failed');
        return reply.code(500).send({ error: 'PDF render failed' });
      }

      const filename = `${slugify(a.title)}-${a.id.slice(0, 8)}.pdf`;
      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `inline; filename="${filename}"`)
        .header('Content-Length', String(pdf.length))
        .header('Cache-Control', 'private, no-store');
      return reply.send(pdf);
    },
  );
}
