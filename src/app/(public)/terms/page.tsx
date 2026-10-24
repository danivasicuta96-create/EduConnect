import type { Metadata } from "next";
import Link from "next/link";
import { FileWarning } from "lucide-react";
import { Notice } from "@/components/ui";
import { Container, PageHero, Prose, Toc } from "../_components/blocks";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The rules for using EduConnect AI as a student, staff member, parent or school. Template pending legal review.",
};

const SECTIONS = [
  { id: "about", label: "About these terms" },
  { id: "accounts", label: "Accounts & eligibility" },
  { id: "community", label: "Community guidelines" },
  { id: "wellbeing", label: "Wellbeing features are not a medical service" },
  { id: "ai", label: "AI tutor & assistant" },
  { id: "content", label: "Your content" },
  { id: "schools", label: "Schools & subscriptions" },
  { id: "availability", label: "Availability & changes" },
  { id: "liability", label: "Liability" },
  { id: "ending", label: "Suspension & closing accounts" },
  { id: "law", label: "Governing law & contact" },
];

export default function TermsPage() {
  return (
    <>
      <PageHero eyebrow="Terms of use" title="The ground rules">
        <p>How EduConnect AI works, what we expect from everyone who uses it, and what you can expect from us.</p>
      </PageHero>

      <Container className="py-12 sm:py-16">
        <div className="mb-10 max-w-3xl">
          <Notice tone="amber" icon={FileWarning} title="Template — requires legal review">
            These terms are a working template and not legal advice. They must be reviewed by a qualified lawyer and adapted before use. Items in [square brackets]
            must be completed. Schools will also sign a separate subscription agreement and data processing agreement.
          </Notice>
        </div>

        <div className="grid gap-10 lg:grid-cols-[16rem_1fr] lg:gap-14">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Toc items={SECTIONS} />
          </aside>

          <Prose>
            <p className="!mt-0 text-sm text-ink-500">Last updated: [date] · Version: [x.y]</p>

            <h2 id="about" className="!mt-6">1. About these terms</h2>
            <p>
              These terms apply to everyone who uses EduConnect AI (&ldquo;the platform&rdquo;), provided by [legal entity, address] (&ldquo;we&rdquo;). By using the platform you agree
              to them. How we handle personal data is explained in our <Link href="/privacy">privacy notice</Link>.
            </p>

            <h2 id="accounts">2. Accounts &amp; eligibility</h2>
            <ul>
              <li>The platform is for students aged 13–19 and staff at participating schools, and for parents or guardians the school invites.</li>
              <li>You need an invitation or school code from your school. Students under 16 may need a parent or guardian&apos;s consent for some features.</li>
              <li>Keep your password private and don&apos;t let anyone else use your account. Tell your school if you think your account has been misused.</li>
              <li>Give accurate information about who you are and your role.</li>
            </ul>

            <h2 id="community">3. Community guidelines</h2>
            <p>EduConnect should feel safe for everyone. You agree not to:</p>
            <ul>
              <li>bully, harass, threaten or humiliate anyone, or share hateful or sexual content;</li>
              <li>share someone else&apos;s personal information, photos or private messages without permission;</li>
              <li>pretend to be someone else, or try to access data or accounts that aren&apos;t yours;</li>
              <li>use the platform for advertising, spam or anything illegal;</li>
              <li>try to break, overload or get around the platform&apos;s security.</li>
            </ul>
            <p>You can block and report people at any time. Reports are reviewed by school staff.</p>

            <h2 id="wellbeing">4. Wellbeing features are not a medical service</h2>
            <p>
              Check-ins, trends, suggestions and support alerts are there to help you reflect and to help your school offer support. They are <strong>not</strong> a diagnosis,
              therapy or an emergency service, and nobody monitors them around the clock.
            </p>
            <p>
              <strong>If you or someone else is in danger, call 112.</strong> For free, confidential support you can call Telefonul Copilului on 116 111. To report child abuse,
              call 119. (Romania — numbers should be verified by each school.)
            </p>

            <h2 id="ai">5. AI tutor &amp; assistant</h2>
            <ul>
              <li>The AI tutor is meant to help you understand, not to do your homework. Follow your school&apos;s rules on academic honesty.</li>
              <li>AI answers can be wrong or incomplete. Check important information with a teacher.</li>
              <li>Don&apos;t share names, addresses or other identifying details in AI chats.</li>
              <li>We may limit how often AI features can be used to keep the service fair and reliable.</li>
            </ul>

            <h2 id="content">6. Your content</h2>
            <p>
              You keep ownership of what you write, such as notes, profile text and messages. You give us permission to store and display it only as needed to run the
              platform for you and your school. Private notes are visible only to you unless you choose to share one with a counselor.
            </p>

            <h2 id="schools">7. Schools &amp; subscriptions</h2>
            <ul>
              <li>Schools subscribe on a plan (Pilot — free for 3 months; School — €149/month or €1,490/year; School Plus — €299/month or €2,990/year). Prices exclude VAT where applicable. [Confirm.]</li>
              <li>The school is responsible for inviting the right people, assigning staff permissions, recording consent and configuring support rules.</li>
              <li>Using the platform is free for students and parents. There is no advertising.</li>
              <li>Detailed commercial terms are set out in the school&apos;s subscription agreement. [Link or reference.]</li>
            </ul>

            <h2 id="availability">8. Availability &amp; changes</h2>
            <p>
              We work to keep the platform available and secure, but can&apos;t promise it will always be uninterrupted. We may update features over time; if we make a change
              that significantly affects you, we&apos;ll let you know in advance.
            </p>

            <h2 id="liability">9. Liability</h2>
            <p>
              [Limitation of liability clause to be drafted. Nothing in these terms limits liability that cannot be limited by law, or your rights as a consumer.]
            </p>

            <h2 id="ending">10. Suspension &amp; closing accounts</h2>
            <p>
              Your school or we may suspend an account that breaks these terms or puts others at risk. You can ask your school to close your account at any time; what
              happens to your data is explained in the <Link href="/privacy#retention">privacy notice</Link>.
            </p>

            <h2 id="law">11. Governing law &amp; contact</h2>
            <p>
              These terms are governed by the laws of [Romania — to be confirmed]. Questions: [contact email — to be replaced].
            </p>
          </Prose>
        </div>
      </Container>
    </>
  );
}
