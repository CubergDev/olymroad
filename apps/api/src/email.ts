import { CONFIG } from "./config";

const RESEND_API_URL = "https://api.resend.com/emails";

const trim = (value: string): string => value.trim();

const otpTtlMinutes = (): number =>
  Math.max(1, Math.ceil(CONFIG.email.otpTtlSeconds / 60));

export const isEmailServiceConfigured = (): boolean =>
  trim(CONFIG.email.resendApiKey).length > 0 &&
  trim(CONFIG.email.resendFromEmail).length > 0;

const sendEmail = async (payload: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) => {
  if (!isEmailServiceConfigured()) {
    throw new Error("email_service_not_configured");
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CONFIG.email.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: CONFIG.email.resendFromEmail,
      to: [payload.to],
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    }),
  });

  if (!response.ok) {
    throw new Error("email_send_failed");
  }
};

export const sendRegistrationOtpEmail = async (input: {
  email: string;
  otpCode: string;
}) => {
  const expiresInMinutes = otpTtlMinutes();
  const text = `Your OlymRoad verification code is ${input.otpCode}. It expires in ${expiresInMinutes} minutes.`;
  const html = `<p>Your OlymRoad verification code is <strong>${input.otpCode}</strong>.</p><p>It expires in ${expiresInMinutes} minutes.</p>`;

  await sendEmail({
    to: input.email,
    subject: "OlymRoad email verification code",
    text,
    html,
  });
};

export const sendPasswordResetOtpEmail = async (input: {
  email: string;
  otpCode: string;
}) => {
  const expiresInMinutes = otpTtlMinutes();
  const text = `Your OlymRoad password reset code is ${input.otpCode}. It expires in ${expiresInMinutes} minutes.`;
  const html = `<p>Your OlymRoad password reset code is <strong>${input.otpCode}</strong>.</p><p>It expires in ${expiresInMinutes} minutes.</p>`;

  await sendEmail({
    to: input.email,
    subject: "OlymRoad password reset code",
    text,
    html,
  });
};
