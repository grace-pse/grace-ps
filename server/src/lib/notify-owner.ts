import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !port || !user || !pass) return null;
  transporter = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Number(port) === 465,
    auth: { user, pass },
  });
  return transporter;
}

export async function notifyOwner(subject: string, text: string): Promise<void> {
  const to = process.env.OWNER_NOTIFY_EMAIL;
  if (!to) return;
  const t = getTransporter();
  if (!t) return;
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  try {
    await t.sendMail({ from, to, subject, text });
  } catch (err) {
    console.error('[notify-owner] failed to send email:', err);
  }
}
