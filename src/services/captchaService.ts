import { parseBooleanEnv } from '../utils/envUtils';

type CaptchaVerificationResult = {
  success: boolean;
  reason?: string;
};

const DEFAULT_CAPTCHA_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const isProduction = () => process.env.NODE_ENV === 'production';

export const isCaptchaEnabled = () => {
  const hasSecret = Boolean(process.env.CAPTCHA_SECRET_KEY);
  if (!hasSecret) {
    return false;
  }

  return parseBooleanEnv(process.env.CAPTCHA_ENABLED, isProduction());
};

export const verifyCaptchaToken = async (
  token: string | undefined,
  remoteIp: string | undefined,
): Promise<CaptchaVerificationResult> => {
  if (!isCaptchaEnabled()) {
    return { success: true };
  }

  const secret = process.env.CAPTCHA_SECRET_KEY;
  if (!secret) {
    return { success: false, reason: 'Captcha secret key is not configured' };
  }

  if (!token || !token.trim()) {
    return { success: false, reason: 'Captcha token is required' };
  }

  const verifyUrl = process.env.CAPTCHA_VERIFY_URL || DEFAULT_CAPTCHA_VERIFY_URL;
  const body = new URLSearchParams({
    secret,
    response: token,
  });

  if (remoteIp) {
    body.set('remoteip', remoteIp);
  }

  try {
    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      return { success: false, reason: `Captcha provider returned ${response.status}` };
    }

    const data = (await response.json()) as { success?: boolean; ['error-codes']?: string[] };
    if (!data.success) {
      const providerError = data['error-codes']?.join(', ');
      return {
        success: false,
        reason: providerError ? `Captcha rejected: ${providerError}` : 'Captcha validation failed',
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      reason: error instanceof Error ? error.message : 'Captcha verification failed',
    };
  }
};
