import type { EmailGateEnv } from './email-gate.env';
import { buildUnsubscribeUrl } from './unsubscribe.token';

export { sendNoAccessEmail, sendOtpEmail };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getSiteHost(publicSiteUrl: string): string {
  try {
    return new URL(publicSiteUrl).host;
  } catch {
    return publicSiteUrl;
  }
}

// Wraps the message body in a complete HTML document with a consistent footer
// (why the email was sent, who operates the service, and the opt-out link).
function renderHtmlLayout({
  title,
  preheader,
  bodyHtml,
  reasonHtml,
  unsubscribeUrl,
  siteUrl,
  siteHost,
}: {
  title: string;
  preheader: string;
  bodyHtml: string;
  reasonHtml: string;
  unsubscribeUrl: string;
  siteUrl: string;
  siteHost: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff">
<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</div>
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:460px;margin:0 auto;padding:24px;color:#111">
  <p style="font-size:14px;font-weight:600;letter-spacing:0.5px;margin:0 0 24px">
    <a href="${siteUrl}" style="color:#111;text-decoration:none">Secreto</a>
  </p>
  ${bodyHtml}
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0 16px" />
  <p style="color:#777;font-size:12px;line-height:1.5;margin:0 0 8px">${reasonHtml}</p>
  <p style="color:#777;font-size:12px;line-height:1.5;margin:0 0 8px">
    Secreto is an end-to-end encrypted note sharing service operated by AGG at
    <a href="${siteUrl}" style="color:#555">${escapeHtml(siteHost)}</a>.
  </p>
  <p style="color:#777;font-size:12px;line-height:1.5;margin:0">
    Don't want to receive these emails?
    <a href="${unsubscribeUrl}" style="color:#555">Unsubscribe</a>.
  </p>
</div>
</body>
</html>`;
}

function renderTextFooter({
  reasonText,
  unsubscribeUrl,
  siteHost,
}: {
  reasonText: string;
  unsubscribeUrl: string;
  siteHost: string;
}): string {
  return [
    '--',
    reasonText,
    `Secreto is an end-to-end encrypted note sharing service operated by AGG at ${siteHost}.`,
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n');
}

async function sendEmail({
  env,
  to,
  subject,
  html,
  text,
  unsubscribeUrl,
}: {
  env: EmailGateEnv;
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl: string;
}): Promise<void> {
  const { resendApiKey: apiKey, emailFrom: from, emailReplyTo: replyTo } = env;

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject,
      // Standard one-click unsubscribe header — helps inbox providers and reputation.
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      html,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Resend API error ${response.status}: ${body}`);
  }
}

async function sendNoAccessEmail({ to, env }: { to: string; env: EmailGateEnv }): Promise<void> {
  const unsubscribeUrl = buildUnsubscribeUrl(to, env);
  const siteUrl = env.publicSiteUrl;
  const siteHost = getSiteHost(siteUrl);

  const reasonText = `You're receiving this because ${to} was entered to open a note on ${siteHost}.`;
  const reasonHtml = `You're receiving this because <strong>${escapeHtml(to)}</strong> was entered to open a note on ${escapeHtml(siteHost)}.`;

  const html = renderHtmlLayout({
    title: 'Secreto: this address can\'t open the note',
    preheader: 'This email address is not on the note\'s recipient list.',
    bodyHtml: `
  <h1 style="font-size:20px;margin:0 0 12px">This address can't open the note</h1>
  <p style="color:#444;font-size:15px;line-height:1.5;margin:0 0 12px">
    A private note on ${escapeHtml(siteHost)} was requested with this email address,
    but the address is not on the note's recipient list, so no access code was sent
    and no note content was shared.
  </p>
  <p style="color:#444;font-size:15px;line-height:1.5;margin:0">
    If you weren't expecting a note, you can safely ignore this email.
  </p>`,
    reasonHtml,
    unsubscribeUrl,
    siteUrl,
    siteHost,
  });

  const text = [
    'This address can\'t open the note',
    '',
    `A private note on ${siteHost} was requested with this email address, but the address is not on the note's recipient list, so no access code was sent and no note content was shared.`,
    '',
    'If you weren\'t expecting a note, you can safely ignore this email.',
    '',
    renderTextFooter({ reasonText, unsubscribeUrl, siteHost }),
  ].join('\n');

  await sendEmail({
    env,
    to,
    subject: 'Secreto: this address can\'t open the note',
    html,
    text,
    unsubscribeUrl,
  });
}

async function sendOtpEmail({
  to,
  code,
  env,
}: {
  to: string;
  code: string;
  env: EmailGateEnv;
}): Promise<void> {
  const unsubscribeUrl = buildUnsubscribeUrl(to, env);
  const siteUrl = env.publicSiteUrl;
  const siteHost = getSiteHost(siteUrl);

  const reasonText = `You're receiving this because ${to} was added as a recipient of a note on ${siteHost} and an access code was requested.`;
  const reasonHtml = `You're receiving this because <strong>${escapeHtml(to)}</strong> was added as a recipient of a note on ${escapeHtml(siteHost)} and an access code was requested.`;

  const html = renderHtmlLayout({
    title: 'Your Secreto access code',
    preheader: `Your access code is ${code}. It expires in 10 minutes.`,
    bodyHtml: `
  <h1 style="font-size:20px;margin:0 0 12px">Your access code</h1>
  <p style="color:#444;font-size:15px;line-height:1.5;margin:0 0 20px">
    Enter this code on ${escapeHtml(siteHost)} to open the note that was shared with you.
  </p>
  <div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;padding:20px;background:#f4f4f5;border-radius:8px;margin:0 0 20px">
    ${escapeHtml(code)}
  </div>
  <p style="color:#666;font-size:14px;line-height:1.5;margin:0">
    The code expires in 10 minutes and can be used once. If you didn't request it,
    you can safely ignore this email.
  </p>`,
    reasonHtml,
    unsubscribeUrl,
    siteUrl,
    siteHost,
  });

  const text = [
    'Your access code',
    '',
    `Enter this code on ${siteHost} to open the note that was shared with you:`,
    '',
    code,
    '',
    'The code expires in 10 minutes and can be used once. If you didn\'t request it, you can safely ignore this email.',
    '',
    renderTextFooter({ reasonText, unsubscribeUrl, siteHost }),
  ].join('\n');

  await sendEmail({
    env,
    to,
    subject: 'Your Secreto access code',
    html,
    text,
    unsubscribeUrl,
  });
}
