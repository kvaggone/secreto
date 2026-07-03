import { buildUnsubscribeUrl } from './unsubscribe.token';

export { sendOtpEmail, sendNoAccessEmail };

async function sendNoAccessEmail({ to }: { to: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? 'Secret Manager <noreply@mail.aggone.net>';

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const unsubscribeUrl = buildUnsubscribeUrl(to);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'You don\'t have access to this note',
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      html: `
        <div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:24px">
          <h2 style="margin:0 0 8px">No access</h2>
          <p style="color:#555;margin:0 0 16px">
            Someone tried to open a private note on Secret Manager using this
            email address, but it isn't on the list of allowed recipients —
            so access was denied. No note content was shared.
          </p>
          <p style="color:#888;font-size:13px;margin:0 0 16px">
            If you weren't expecting a note, you can ignore this message.
          </p>
          <hr style="border:none;border-top:1px solid #eee;margin:16px 0" />
          <p style="color:#999;font-size:12px;margin:0">
            Don't want to receive these emails?
            <a href="${unsubscribeUrl}" style="color:#666">
              I didn't request this — stop emailing me
            </a>.
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Resend API error ${response.status}: ${body}`);
  }
}

async function sendOtpEmail({
  to,
  code,
}: {
  to: string;
  code: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? 'Secret Manager <noreply@mail.aggone.net>';

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const unsubscribeUrl = buildUnsubscribeUrl(to);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Your one-time access code',
      // Standard one-click unsubscribe header — helps inbox providers and reputation.
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      html: `
        <div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:24px">
          <h2 style="margin:0 0 8px">Access code</h2>
          <p style="color:#555;margin:0 0 20px">
            Someone shared a private note with you on Secret Manager.
            Use the code below to view it.
          </p>
          <div style="font-size:36px;font-weight:700;letter-spacing:10px;
                      text-align:center;padding:24px;background:#f4f4f5;
                      border-radius:8px;margin:0 0 20px">
            ${code}
          </div>
          <p style="color:#888;font-size:13px;margin:0 0 16px">
            This code expires in 10 minutes and can only be used once.
          </p>
          <hr style="border:none;border-top:1px solid #eee;margin:16px 0" />
          <p style="color:#999;font-size:12px;margin:0">
            Didn't request this and don't want to receive these emails?
            <a href="${unsubscribeUrl}" style="color:#666">
              I didn't request this — stop emailing me
            </a>.
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Resend API error ${response.status}: ${body}`);
  }
}
