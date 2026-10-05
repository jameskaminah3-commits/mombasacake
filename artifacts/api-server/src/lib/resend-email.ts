const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "";
// Changeable so a local test server can stand in for Resend.
const RESEND_API_URL = (process.env.RESEND_API_URL || "https://api.resend.com").replace(/\/+$/, "");

export interface ResendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendResendEmail(params: ResendEmailParams): Promise<void> {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    throw new Error("Resend is not configured.");
  }

  const response = await fetch(`${RESEND_API_URL}/emails`, {
    method: "POST",
    // An email service that doesn't answer is given up on rather than waited for.
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to send email");
  }
}
