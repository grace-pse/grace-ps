import pg from 'pg';
import { randomUUID, randomBytes } from 'node:crypto';

const { Pool } = pg;

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (pool) return pool;
  const url = process.env.FEEDBACK_DATABASE_URL;
  if (!url) {
    throw new Error('FEEDBACK_DATABASE_URL is required when SANDBOX_MODE=true');
  }
  pool = new Pool({ connectionString: url, max: 5 });
  return pool;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS reviewer_invites (
  id            UUID PRIMARY KEY,
  token         VARCHAR(64) UNIQUE NOT NULL,
  label         VARCHAR(255) NOT NULL,
  email         VARCHAR(255),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  first_used_at TIMESTAMPTZ,
  last_used_at  TIMESTAMPTZ,
  use_count     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS feedback (
  id          UUID PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invite_id   UUID REFERENCES reviewer_invites(id) ON DELETE SET NULL,
  message     TEXT NOT NULL,
  category    VARCHAR(40),
  page        VARCHAR(255),
  user_email  VARCHAR(255) NOT NULL,
  user_role   VARCHAR(40),
  ip          VARCHAR(64) NOT NULL,
  user_agent  TEXT
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_invite_id ON feedback(invite_id);
`;

export async function ensureFeedbackSchema(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query(SCHEMA_SQL);
  } finally {
    client.release();
  }
}

export interface ReviewerInvite {
  id: string;
  token: string;
  label: string;
  email: string | null;
  notes: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  firstUsedAt: Date | null;
  lastUsedAt: Date | null;
  useCount: number;
}

export interface FeedbackRow {
  id: string;
  createdAt: Date;
  inviteId: string | null;
  message: string;
  category: string | null;
  page: string | null;
  userEmail: string;
  userRole: string | null;
  ip: string;
  userAgent: string | null;
}

function rowToInvite(row: Record<string, unknown>): ReviewerInvite {
  return {
    id: row.id as string,
    token: row.token as string,
    label: row.label as string,
    email: (row.email as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as Date,
    expiresAt: (row.expires_at as Date | null) ?? null,
    revokedAt: (row.revoked_at as Date | null) ?? null,
    firstUsedAt: (row.first_used_at as Date | null) ?? null,
    lastUsedAt: (row.last_used_at as Date | null) ?? null,
    useCount: Number(row.use_count),
  };
}

function rowToFeedback(row: Record<string, unknown>): FeedbackRow {
  return {
    id: row.id as string,
    createdAt: row.created_at as Date,
    inviteId: (row.invite_id as string | null) ?? null,
    message: row.message as string,
    category: (row.category as string | null) ?? null,
    page: (row.page as string | null) ?? null,
    userEmail: row.user_email as string,
    userRole: (row.user_role as string | null) ?? null,
    ip: row.ip as string,
    userAgent: (row.user_agent as string | null) ?? null,
  };
}

export function generateInviteToken(): string {
  return randomBytes(24).toString('base64url');
}

export async function findInviteByToken(token: string): Promise<ReviewerInvite | null> {
  const r = await getPool().query('SELECT * FROM reviewer_invites WHERE token = $1', [token]);
  return r.rowCount ? rowToInvite(r.rows[0] as Record<string, unknown>) : null;
}

export async function recordInviteUse(id: string): Promise<void> {
  await getPool().query(
    `UPDATE reviewer_invites
       SET use_count = use_count + 1,
           last_used_at = NOW(),
           first_used_at = COALESCE(first_used_at, NOW())
     WHERE id = $1`,
    [id],
  );
}

export function isInviteValid(invite: ReviewerInvite): boolean {
  if (invite.revokedAt) return false;
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) return false;
  return true;
}

export async function createInvite(input: {
  label: string;
  email?: string | null;
  notes?: string | null;
  expiresInDays?: number | null;
}): Promise<ReviewerInvite> {
  const id = randomUUID();
  const token = generateInviteToken();
  const expiresAt =
    input.expiresInDays && input.expiresInDays > 0
      ? new Date(Date.now() + input.expiresInDays * 86400_000)
      : null;
  const r = await getPool().query(
    `INSERT INTO reviewer_invites (id, token, label, email, notes, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [id, token, input.label, input.email ?? null, input.notes ?? null, expiresAt],
  );
  return rowToInvite(r.rows[0] as Record<string, unknown>);
}

export async function listInvites(): Promise<ReviewerInvite[]> {
  const r = await getPool().query('SELECT * FROM reviewer_invites ORDER BY created_at DESC');
  return r.rows.map((row) => rowToInvite(row as Record<string, unknown>));
}

export async function revokeInvite(id: string): Promise<void> {
  await getPool().query('UPDATE reviewer_invites SET revoked_at = NOW() WHERE id = $1', [id]);
}

export async function insertFeedback(input: {
  inviteId: string | null;
  message: string;
  category: string | null;
  page: string | null;
  userEmail: string;
  userRole: string | null;
  ip: string;
  userAgent: string | null;
}): Promise<FeedbackRow> {
  const id = randomUUID();
  const r = await getPool().query(
    `INSERT INTO feedback (id, invite_id, message, category, page, user_email, user_role, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      id,
      input.inviteId,
      input.message,
      input.category,
      input.page,
      input.userEmail,
      input.userRole,
      input.ip,
      input.userAgent,
    ],
  );
  return rowToFeedback(r.rows[0] as Record<string, unknown>);
}

export async function listFeedback(limit = 200): Promise<Array<FeedbackRow & { inviteLabel: string | null }>> {
  const r = await getPool().query(
    `SELECT f.*, ri.label AS invite_label
       FROM feedback f
  LEFT JOIN reviewer_invites ri ON ri.id = f.invite_id
   ORDER BY f.created_at DESC
      LIMIT $1`,
    [limit],
  );
  return r.rows.map((row) => {
    const fb = rowToFeedback(row as Record<string, unknown>);
    return { ...fb, inviteLabel: ((row as Record<string, unknown>).invite_label as string | null) ?? null };
  });
}

export async function closeFeedbackPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
