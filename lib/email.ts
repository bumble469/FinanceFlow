const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "notifications@financeflow.app";
const SENDER_NAME = process.env.BREVO_SENDER_NAME || "FinanceFlow";

export async function sendEmail({
  to,
  toName,
  subject,
  htmlContent,
}: {
  to: string;
  toName?: string | null;
  subject: string;
  htmlContent: string;
}): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error("[email] BREVO_API_KEY not set, skipping email send");
    return false;
  }

  try {
    const res = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: to, name: toName || undefined }],
        subject,
        htmlContent,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[email] Brevo send failed:", res.status, text);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] Brevo send error:", err);
    return false;
  }
}

export function notificationEmailHtml({
  title,
  message,
  planName,
  appUrl,
}: {
  title: string;
  message: string;
  planName?: string | null;
  appUrl: string;
}) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="margin-bottom: 4px;">${title}</h2>
      ${planName ? `<p style="color: #666; margin-top: 0;">${planName}</p>` : ""}
      <p>${message}</p>
      <a href="${appUrl}" style="display:inline-block;margin-top:16px;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">
        Open FinanceFlow
      </a>
    </div>
  `;
}