import { readRuntimeEnv } from '../../shared/env/runtime-env';

export { getEmailGateEnv };
export type { EmailGateEnv };

type EmailGateEnv = {
  resendApiKey?: string;
  emailFrom: string;
  emailReplyTo?: string;
  unsubscribeSecret?: string;
  publicSiteUrl: string;
};

function getEmailGateEnv(c: any): EmailGateEnv {
  const env = readRuntimeEnv(c);

  return {
    resendApiKey: env.RESEND_API_KEY || undefined,
    emailFrom: env.EMAIL_FROM || 'SECRETO.INFO <noreply@secreto.info>',
    // 'none' omits the Reply-To header entirely.
    emailReplyTo: env.EMAIL_REPLY_TO === 'none' ? undefined : (env.EMAIL_REPLY_TO || 'support@agg.one'),
    // Falls back to the Resend key so no extra config is required, but never to a hardcoded value.
    unsubscribeSecret: env.UNSUBSCRIBE_SECRET || env.RESEND_API_KEY || undefined,
    publicSiteUrl: (env.PUBLIC_SITE_URL || 'https://secreto.info').replace(/\/$/, ''),
  };
}
