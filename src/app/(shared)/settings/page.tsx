import type { Metadata } from "next";
import { ShieldCheck, Bell, KeyRound, Download, Trash2, Languages, Info, LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { studentAccess } from "@/lib/services/consent";
import { getNotificationPrefs, hasUsablePassword } from "@/lib/services/account";
import { emailConfigured } from "@/lib/email";
import { CONSENT_LABELS, ROLE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { Badge, Card, CardHeader, Notice, PageHeader, buttonClass } from "@/components/ui";
import { ConsentToggle, DangerForm, LocaleForm, NotificationPrefsForm, PasswordForm, SignOutEverywhere } from "./forms";

export const metadata: Metadata = { title: "Settings & privacy" };

const CONSENT_HELP: Record<string, string> = {
  wellbeing_checkins: "Daily check-ins and your personal trends. If you switch this off, no new check-ins are collected.",
  matchmaking: "Suggestions, connection requests and study groups. Switching off hides you from suggestions.",
  ai_features: "The AI tutor and wellbeing assistant. Chats aren't stored by EduConnect.",
};

export default async function SettingsPage() {
  const user = await requireUser();
  const [prefs, usablePassword, access] = await Promise.all([
    getNotificationPrefs(user),
    hasUsablePassword(user),
    user.role === "student" ? studentAccess(user, user.id) : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-fade-up">
      <PageHeader title="Settings & privacy" description={`${user.displayName} · ${ROLE_LABELS[user.role]} · ${user.schoolName}`} />

      {access && (
        <Card id="privacy">
          <CardHeader title="Privacy & consent" icon={ShieldCheck} subtitle="You're in control of the optional features." />
          {!access.canSelfConsent && (
            <div className="mb-4">
              <Notice tone="blue" icon={Info}>
                Because you&apos;re under 16, a parent or guardian gives consent through your school. You can always <strong>switch features off</strong> yourself.
              </Notice>
            </div>
          )}
          <ul className="divide-y divide-ink-50">
            {(["wellbeing_checkins", "matchmaking", "ai_features"] as const).map((t) => {
              const c = access.consents[t];
              return (
                <li key={t} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {CONSENT_LABELS[t]}
                      <Badge tone={c.granted ? "green" : "neutral"}>{c.granted ? "On" : "Off"}</Badge>
                    </p>
                    <p className="text-sm text-ink-500">{CONSENT_HELP[t]}</p>
                    {c.recordedAt && (
                      <p className="mt-0.5 text-xs text-ink-400">
                        Last changed {formatDate(c.recordedAt, { day: "numeric", month: "short", year: "numeric" })} by {c.givenByRole === "guardian" ? "your guardian (via school)" : c.givenByRole === "admin" ? "your school" : "you"}
                      </p>
                    )}
                  </div>
                  <ConsentToggle type={t} granted={c.granted} canGrant={access.canSelfConsent && access.active} />
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-ink-500">
            Read the full <a href="/privacy" className="font-semibold text-brand-700 underline">privacy notice</a> to see who can see what.
          </p>
        </Card>
      )}

      <Card id="notifications">
        <CardHeader title="Notifications" icon={Bell} subtitle={emailConfigured() ? undefined : "Email delivery isn't configured on this deployment — in-app only."} />
        <NotificationPrefsForm prefs={prefs} emailAvailable={emailConfigured()} />
        <p className="mt-3 text-xs text-ink-500">Support and safety notifications always use neutral wording, and never include wellbeing details in emails or previews.</p>
      </Card>

      <Card>
        <CardHeader title="Language" icon={Languages} subtitle="Default language for the AI tutor and assistant" />
        <LocaleForm locale={user.locale} />
      </Card>

      <Card>
        <CardHeader title="Sign-in & security" icon={KeyRound} />
        <p className="mb-4 text-sm text-ink-600">Signed in as <strong>{user.email}</strong></p>
        {usablePassword ? (
          <PasswordForm />
        ) : (
          <Notice tone="violet">This demo account signs in through the demo panel and has no password.</Notice>
        )}
        <div className="mt-5 border-t border-ink-100 pt-4">
          <SignOutEverywhere />
        </div>
      </Card>

      <Card>
        <CardHeader title="Your data" icon={Download} />
        <p className="text-sm text-ink-600">Download a copy of the personal data EduConnect AI holds about you (JSON).</p>
        <a href="/api/account/export" className={buttonClass("secondary", "md", "mt-3")} download>
          <Download className="size-4" aria-hidden /> Download my data
        </a>
      </Card>

      <Card className="ring-red-100">
        <CardHeader title="Delete data" icon={Trash2} />
        <div className="space-y-6">
          {user.role === "student" && (
            <DangerForm
              kind="wellbeing"
              title="Delete my wellbeing history"
              description="Permanently deletes all your check-ins and private notes. Support requests already sent to a counselor are kept by the school."
            />
          )}
          <DangerForm
            kind="account"
            title="Delete my account"
            description="Your account is disabled immediately and you're signed out. Your school's administrator completes the deletion — the school may have to keep some academic records by law."
          />
        </div>
      </Card>
      <p className="flex items-center gap-2 text-xs text-ink-500"><LogOut className="size-3.5" aria-hidden /> Use the sign-out button in the menu to end this session.</p>
    </div>
  );
}
