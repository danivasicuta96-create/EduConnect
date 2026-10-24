import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { ArrowRight, CircleCheck, Download, Globe, PackageOpen, QrCode, Share, ShieldCheck, Smartphone } from "lucide-react";
import { Badge, LinkButton, Notice, buttonClass } from "@/components/ui";
import { IconTile, PageHero, Section } from "../_components/blocks";
import { formatBytes, getApkInfo, requestOrigin } from "./apk";

export const metadata: Metadata = {
  title: "Install the app",
  description: "Install EduConnect AI on your Android phone: scan the QR code, download the app and open it.",
};

const STEPS = [
  {
    icon: QrCode,
    title: "Scan the code",
    text: "Open your phone's camera and point it at the QR code — or open this page on your phone.",
  },
  {
    icon: Download,
    title: "Download the app",
    text: "Tap “Download for Android”. Your browser may warn that the file can harm your device — EduConnect is safe to install from this page, so choose “Download anyway”.",
  },
  {
    icon: ShieldCheck,
    title: "Allow the install",
    text: "When you open the file, Android asks for permission: tap Settings → turn on “Allow from this source” for your browser (Chrome), then go back. You only need to do this once.",
  },
  {
    icon: PackageOpen,
    title: "Install and open",
    text: "Tap Install, then Open. Sign in with your school account — the same one you use on the website.",
  },
] as const;

export default async function InstallPage() {
  const h = await headers();
  const origin = requestOrigin(h);
  const installUrl = `${origin}/install`;
  const ua = h.get("user-agent") ?? "";
  const inApp = ua.includes("EduConnectApp");
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const apk = await getApkInfo(origin);

  // The QR leads to this page: on a phone it shows the one-tap download button
  // first, and it never points at a missing file.
  const qrSvg = await QRCode.toString(installUrl, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: "#1b1f36", light: "#ffffff" },
  });

  return (
    <>
      <PageHero eyebrow="Android app" title="EduConnect in your pocket">
        <p>
          Install the EduConnect AI app on your Android phone in under a minute. It&apos;s the same EduConnect you know from the web —
          your account, your classes and your check-ins — in an app on your home screen.
        </p>
      </PageHero>

      <Section labelledBy="install-heading">
        <h2 id="install-heading" className="sr-only">Install</h2>

        {inApp && (
          <div className="mb-8">
            <Notice tone="green" icon={CircleCheck} title="You're already using the app">
              Nothing more to install. <Link href="/login">Go to EduConnect</Link>.
            </Notice>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-12">
          {/* Download card */}
          <div className="rounded-3xl bg-white p-6 shadow-[var(--shadow-card)] ring-1 ring-ink-100 sm:p-8">
            <div className="flex items-start gap-3">
              <IconTile icon={Smartphone} />
              <div>
                <h3 className="text-xl font-extrabold tracking-tight text-ink-900">EduConnect AI for Android</h3>
                <p className="mt-1 text-sm text-ink-500">Android 7.0 or newer</p>
              </div>
            </div>

            {apk.available ? (
              <div className="mt-6">
                <a href={apk.href} download="educonnect.apk" className={buttonClass("primary", "lg", "w-full")}>
                  <Download className="size-5" aria-hidden />
                  Download for Android
                </a>
                <p className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm text-ink-500">
                  <span>APK file{apk.size ? ` · ${formatBytes(apk.size)}` : ""}</span>
                  {apk.version && <Badge tone="brand">Version {apk.version}</Badge>}
                </p>
              </div>
            ) : (
              <div className="mt-6">
                <Notice tone="amber" title="The Android build hasn't been uploaded yet">
                  Your school will share the app soon. Until then, use EduConnect in your phone&apos;s browser — it works the same way.
                </Notice>
              </div>
            )}

            <div className="mt-8 hidden flex-col items-center border-t border-ink-100 pt-8 sm:flex">
              <div
                className="w-56 rounded-2xl bg-white p-2 ring-1 ring-ink-100 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
                role="img"
                aria-label={`QR code linking to ${installUrl}`}
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <p className="mt-3 text-center text-sm text-ink-600">Scan with your phone&apos;s camera</p>
              <p className="mt-0.5 break-all text-center text-xs text-ink-400">{installUrl}</p>
            </div>

            <div className="mt-8 border-t border-ink-100 pt-6 text-center">
              <LinkButton href="/login" variant="secondary" className="w-full">
                <Globe className="size-4" aria-hidden />
                Use EduConnect in the browser instead
              </LinkButton>
            </div>
          </div>

          {/* Steps */}
          <div>
            <h3 className="text-2xl font-extrabold tracking-tight text-ink-900">How to install</h3>
            <ol className="mt-6 space-y-5">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="relative">
                    <IconTile icon={step.icon} tone={i % 2 ? "pink" : "brand"} />
                    <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-ink-900 text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-ink-900">{step.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-600">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-8 space-y-4">
              <Notice tone="blue" icon={ShieldCheck} title="Is this safe?">
                The app only opens EduConnect&apos;s own website — your data stays on EduConnect&apos;s servers, not in the app. Only download
                it from this page (check the address bar shows <strong>{new URL(origin).host}</strong>). Updates appear here — download and
                install the new version over the old one.
              </Notice>
              <Notice tone={isIOS ? "violet" : "neutral"} icon={Share} title="On an iPhone or iPad?">
                There&apos;s no app to download yet. Open EduConnect in Safari, tap <strong>Share</strong>, then{" "}
                <strong>Add to Home Screen</strong> — it opens full-screen like an app.
              </Notice>
            </div>

            <p className="mt-8">
              <Link href="/login" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
                Already installed? Sign in <ArrowRight className="size-4" aria-hidden />
              </Link>
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
