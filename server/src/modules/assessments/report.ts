import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Browser, LaunchOptions } from 'puppeteer';
import puppeteer from 'puppeteer';
import { requirePermission } from '../../lib/rbac.js';
import {
  AssessmentNotFoundError,
  buildReportData,
  renderReportHtml,
  type ReportVariant,
} from './report/index.js';

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
    userDataDir: '/tmp/csmp-chromium',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-crash-reporter',
      '--disable-breakpad',
      '--no-crash-upload',
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

const variantSchema = z.enum(['analyst']).default('analyst');

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
        querystring: z.object({ variant: variantSchema.optional() }),
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const variant: ReportVariant = req.query.variant ?? 'analyst';

      let data;
      try {
        data = await buildReportData(req.params.id, tenantId);
      } catch (err) {
        if (err instanceof AssessmentNotFoundError) {
          return reply.code(404).send({ error: 'Assessment not found' });
        }
        throw err;
      }

      const html = renderReportHtml(data, { variant });

      let pdf: Buffer;
      try {
        pdf = await renderPdf(html);
      } catch (err) {
        req.log.error({ err }, 'PDF render failed');
        return reply.code(500).send({ error: 'PDF render failed' });
      }

      const filename = `${slugify(data.assessment.title)}-${data.assessment.id.slice(0, 8)}.pdf`;
      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `inline; filename="${filename}"`)
        .header('Content-Length', String(pdf.length))
        .header('Cache-Control', 'private, no-store');
      return reply.send(pdf);
    },
  );
}
