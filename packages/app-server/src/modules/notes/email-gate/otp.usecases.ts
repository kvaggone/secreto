import * as crypto from 'node:crypto';
import { createOtpRepository, verifyCode } from './otp.repository';

export { issueOtp, verifyOtp };
export const MAX_OTP_ATTEMPTS = 5;

type OtpRepository = ReturnType<typeof createOtpRepository>;

const OTP_TTL_SECONDS = 600;

function generateCode(): string {
  // Cryptographically random 6-digit code (000000–999999)
  const bytes = crypto.randomBytes(4);
  const num = bytes.readUInt32BE(0) % 1_000_000;
  return num.toString().padStart(6, '0');
}

async function issueOtp({
  otpRepository,
  noteId,
  email,
}: {
  otpRepository: OtpRepository;
  noteId: string;
  email: string;
}): Promise<{ code: string }> {
  const code = generateCode();
  await otpRepository.saveOtp({ noteId, email, code, ttlInSeconds: OTP_TTL_SECONDS });
  return { code };
}

async function verifyOtp({
  otpRepository,
  noteId,
  email,
  code,
}: {
  otpRepository: OtpRepository;
  noteId: string;
  email: string;
  code: string;
}): Promise<{ isValid: boolean; attemptsExceeded: boolean }> {
  const record = await otpRepository.getOtp({ noteId, email });

  if (!record) {
    return { isValid: false, attemptsExceeded: false };
  }

  if (new Date(record.expiresAt) < new Date()) {
    await otpRepository.deleteOtp({ noteId, email });
    return { isValid: false, attemptsExceeded: false };
  }

  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    await otpRepository.deleteOtp({ noteId, email });
    return { isValid: false, attemptsExceeded: true };
  }

  const isValid = verifyCode(code, record.codeHash);

  if (!isValid) {
    await otpRepository.incrementAttempts({ noteId, email, record });
    return { isValid: false, attemptsExceeded: false };
  }

  await otpRepository.deleteOtp({ noteId, email });
  return { isValid: true, attemptsExceeded: false };
}
