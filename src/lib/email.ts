import "server-only";

// Provider-independent email sending. Without configuration, messages are
// written to the server log in development only, so no real email is sent and
// nothing sensitive is printed in production.

export interface Email {
  to: string;
  subject: string;
  text: string;
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(email: Email): Promise<void> {
  if (emailConfigured()) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: email.to, subject: email.subject, text: email.text }),
    });
    if (!res.ok) console.error("[email] provider responded", res.status);
    return;
  }
  if (process.env.NODE_ENV !== "production") {
    console.info(`\n[email:dev] To: ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n`);
  } else {
    console.warn("[email] No email provider configured; message not sent.");
  }
}

export function appUrl(path = ""): string {
  return `${process.env.APP_URL ?? "http://localhost:3000"}${path}`;
}
