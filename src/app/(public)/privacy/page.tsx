import type { Metadata } from "next";
import Link from "next/link";
import { FileWarning } from "lucide-react";
import { Notice } from "@/components/ui";
import { AccessTable } from "../_components/access-table";
import { Container, PageHero, Prose, Toc } from "../_components/blocks";

export const metadata: Metadata = {
  title: "Privacy notice",
  description:
    "What data EduConnect AI processes, why, who can see it, how long it is kept, how AI is used, consent for students under 16, and your rights. Template pending legal review.",
};

const SECTIONS = [
  { id: "summary", label: "The short version" },
  { id: "who", label: "Who is responsible" },
  { id: "data", label: "What data we process" },
  { id: "why", label: "Why we use it" },
  { id: "access", label: "Who can see what" },
  { id: "wellbeing", label: "Wellbeing data & support alerts" },
  { id: "ai", label: "AI features" },
  { id: "children", label: "Students under 16 & consent" },
  { id: "retention", label: "How long we keep data" },
  { id: "security", label: "How we protect data" },
  { id: "sharing", label: "Sharing & service providers" },
  { id: "rights", label: "Your rights" },
  { id: "contact", label: "Contact & complaints" },
  { id: "changes", label: "Changes to this notice" },
];

export default function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Privacy notice" title="Your data, explained plainly">
        <p>What EduConnect AI collects, why, who can see it and what you can do about it — written so students can understand it too.</p>
      </PageHero>

      <Container className="py-12 sm:py-16">
        <div className="mb-10 max-w-3xl">
          <Notice tone="amber" icon={FileWarning} title="Template — requires legal review">
            This notice is a working template describing how the platform is designed. It is not legal advice and must be reviewed by a qualified data protection
            professional and adapted by each school before use. Items in [square brackets] must be completed. EduConnect AI is designed to support GDPR compliance,
            subject to legal review.
          </Notice>
        </div>

        <div className="grid gap-10 lg:grid-cols-[16rem_1fr] lg:gap-14">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Toc items={SECTIONS} />
          </aside>

          <div className="min-w-0">
          <Prose>
            <p className="!mt-0 text-sm text-ink-500">Last updated: [date] · Version: [x.y]</p>

            <h2 id="summary" className="!mt-6">1. The short version</h2>
            <ul>
              <li><strong>Your check-ins are yours.</strong> Teachers only see class averages for groups of 5 or more. Your private notes are never shown to teachers, parents or administrators.</li>
              <li><strong>No advertising, no data selling.</strong> Wellbeing data is never used for matchmaking, advertising or monetisation.</li>
              <li><strong>Only what&apos;s needed.</strong> Most fields are optional, and each role can only see what it needs.</li>
              <li><strong>Under 16?</strong> Some features need a parent or guardian&apos;s consent first.</li>
              <li><strong>You have rights.</strong> You can ask to see, correct, download or delete your data.</li>
            </ul>

            <h2 id="who">2. Who is responsible</h2>
            <p>
              When a school uses EduConnect AI, the <strong>school</strong> is usually the <em>data controller</em>: it decides why and how student data is used.
              <strong> EduConnect AI</strong> usually acts as a <em>data processor</em> on the school&apos;s behalf, under a data processing agreement. [Confirm roles and
              each party&apos;s legal name and address.]
            </p>
            <p>School: [school name, address, data protection officer contact]. Provider: [EduConnect AI legal entity, address].</p>

            <h2 id="data">3. What data we process</h2>
            <h3>Account &amp; school records</h3>
            <ul>
              <li>Name, school email, role (student, teacher, counselor, administrator, parent), class and grade level, preferred language and time zone.</li>
              <li>Academic records entered by teachers: grades, assessments, attendance, timetable.</li>
              <li>Learning goals and target grades you choose to set.</li>
            </ul>
            <h3>Social &amp; matchmaking profile</h3>
            <ul>
              <li>Interests, goals and a short bio you choose to add, whether you are discoverable, your connections, study groups, blocks and reports.</li>
            </ul>
            <h3>Wellbeing data (extra-sensitive)</h3>
            <ul>
              <li>Daily check-ins: a mood score from 1 to 10, an optional description of your day and optional factor tags (for example tests, workload, friendships).</li>
              <li>Private notes, stored separately from check-in scores.</li>
              <li>Support alerts, neutral follow-up records and support sessions created by counselors or requested by you.</li>
            </ul>
            <p>
              Wellbeing information can be considered <strong>data concerning health</strong>, a special category under the GDPR. It gets the strictest access rules on the
              platform. [Legal basis for special-category processing to be confirmed.]
            </p>
            <h3>AI conversations</h3>
            <ul>
              <li>Messages you send to the AI tutor or the AI wellbeing assistant, and the replies.</li>
            </ul>
            <h3>Technical &amp; security data</h3>
            <ul>
              <li>Sign-in sessions (stored as hashed tokens), security logs, consent records and an audit log of sensitive views and privileged changes.</li>
            </ul>
            <p>We do <strong>not</strong> use advertising trackers or sell data, and we do not ask for home addresses or national ID numbers.</p>

            <h2 id="why">4. Why we use it</h2>
            <ul>
              <li><strong>Running the platform</strong> for your school: accounts, classes, grades, timetable and attendance. [Legal basis: e.g. public task / contract — to be confirmed.]</li>
              <li><strong>Matchmaking and groups</strong>, only when you choose to take part. [Legal basis: e.g. consent.]</li>
              <li><strong>Wellbeing tools</strong>: showing you your trends and supportive suggestions, and — under school-configured rules — suggesting a supportive follow-up by a counselor. [Legal basis to be confirmed.]</li>
              <li><strong>Safety and security</strong>: preventing misuse, investigating reports and keeping audit logs. [Legal basis: e.g. legitimate interests / legal obligation.]</li>
            </ul>

            <h2 id="access">5. Who can see what</h2>
            <p>Access rules are enforced inside the database (row-level security), so a screen cannot show data the role isn&apos;t allowed to read.</p>
          </Prose>

          <div className="my-8">
            <AccessTable />
          </div>

          <Prose>
            <ul>
              <li><strong>Students</strong> see their own records, check-ins, notes and profile.</li>
              <li><strong>Teachers</strong> see grades and attendance for the classes and subjects they teach (homeroom teachers: their class). Wellbeing appears only as aggregated summaries; groups under 5 students are hidden.</li>
              <li><strong>Counselors</strong> (staff given the support permission) see check-in scores only for students with a recent support alert, and a note only if the student chose to share it.</li>
              <li><strong>Administrators</strong> manage school records and permissions. They do not automatically see wellbeing content.</li>
              <li><strong>Parents and guardians</strong> can see a linked child&apos;s academic information only where the required consent is recorded. They never see check-ins or notes.</li>
            </ul>

            <h2 id="wellbeing">6. Wellbeing data &amp; support alerts</h2>
            <p>
              A school can turn on early-warning rules — for example &ldquo;7-day average below 5&rdquo; or &ldquo;five low check-ins in a row&rdquo;. When a rule matches, the platform
              suggests that a counselor offers a <strong>supportive conversation</strong>. It is <strong>not</strong> a diagnosis or a risk assessment, and it does not lead to any
              decision about you on its own: a person always decides what to do. Alert notifications use neutral wording.
            </p>
            <p>Wellbeing data is never used for matchmaking, grading, discipline, advertising or monetisation.</p>

            <h2 id="ai">7. AI features</h2>
            <ul>
              <li>The <strong>AI tutor</strong> explains concepts and asks guiding questions in Romanian or English. It is designed not to complete homework for you.</li>
              <li>The <strong>AI wellbeing assistant</strong> offers supportive, non-clinical ideas. Before any AI model is involved, a separate safety check looks for signs of immediate danger and shows emergency resources straight away.</li>
              <li>Messages are processed by an AI service provider: [provider name, region, and whether data is used for model training — to be confirmed in the data processing agreement]. Don&apos;t share names, addresses or other identifying details in AI chats.</li>
              <li>AI output can be wrong. It is not medical, psychological or professional advice.</li>
              <li>No decisions with legal or similarly significant effects are made by AI alone.</li>
            </ul>

            <h2 id="children">8. Students under 16 &amp; consent</h2>
            <p>
              In Romania, the age of digital consent is <strong>16</strong>. For students under 16, features that rely on consent (for example matchmaking or the AI assistants)
              require consent from a parent or guardian. Schools can record consent online or from a paper form. Students aged 16 and over can give consent themselves.
            </p>
            <p>Consent can be withdrawn at any time; this doesn&apos;t affect processing that happened before. [Confirm which features require consent per school.]</p>

            <h2 id="retention">9. How long we keep data</h2>
            <ul>
              <li><strong>Wellbeing data</strong> (check-ins, notes, alerts): set by the school, by default 365 days. [Confirm.]</li>
              <li><strong>Audit logs</strong>: set by the school, by default 730 days (minimum 180). [Confirm.]</li>
              <li><strong>Academic records</strong>: as required by the school&apos;s legal obligations. [Period to be set.]</li>
              <li><strong>Accounts</strong>: deleted or anonymised [x days] after a student leaves the school or the school ends its subscription.</li>
            </ul>

            <h2 id="security">10. How we protect data</h2>
            <ul>
              <li>Database-level row-level security and strict separation between schools.</li>
              <li>Credentials and wellbeing data held in separate areas of the database; passwords and session tokens stored only as hashes.</li>
              <li>Least-privilege staff permissions, audit logging of sensitive access, and encrypted connections (HTTPS).</li>
              <li>Hosting in an EU data region. [Hosting provider and location to be confirmed.]</li>
            </ul>
            <p>No system is perfectly secure. If a personal data breach occurs, we will notify the school, which will notify the authorities and affected people where required.</p>

            <h2 id="sharing">11. Sharing &amp; service providers</h2>
            <p>
              We don&apos;t sell personal data and we don&apos;t show advertising. We use a small number of service providers (sub-processors) under contract, such as hosting,
              email delivery and the AI service. [List of sub-processors, their location and transfer safeguards.] Any transfer outside the EU/EEA must use an approved
              safeguard. [To be confirmed.]
            </p>

            <h2 id="rights">12. Your rights</h2>
            <p>Under the GDPR you (or your parent or guardian, where appropriate) have the right to:</p>
            <ul>
              <li>access your data and get a copy of it;</li>
              <li>correct inaccurate data;</li>
              <li>ask for data to be deleted or its use restricted;</li>
              <li>receive your data in a portable format;</li>
              <li>object to certain processing;</li>
              <li>withdraw consent at any time.</li>
            </ul>
            <p>Contact your school or us using the details below. We aim to respond within one month.</p>

            <h2 id="contact">13. Contact &amp; complaints</h2>
            <p>
              Privacy questions: [privacy@example — to be replaced]. School data protection officer: [contact]. You can also complain to the Romanian data protection
              authority, ANSPDCP (Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal), or the authority in your EU country.
            </p>
            <p>
              <strong>If you are in danger or need urgent help, don&apos;t wait for an email reply:</strong> call 112 (emergency) or 116 111 (Telefonul Copilului,
              free child helpline). To report child abuse, call 119. Numbers should be verified by each school.
            </p>

            <h2 id="changes">14. Changes to this notice</h2>
            <p>
              If we make important changes, we&apos;ll tell users in the app before they take effect. See also our <Link href="/terms">terms of use</Link>.
            </p>
          </Prose>
          </div>
        </div>
      </Container>
    </>
  );
}
