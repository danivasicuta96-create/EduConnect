// Deterministic safety screen for free text sent to the AI assistants.
//
// This is a *first line* safeguard that runs before and independently of any
// AI model: if a message may describe self-harm or immediate danger, the app
// shows crisis resources straight away, whatever the model says. It is
// intentionally over-inclusive. It is not a risk assessment and does not
// alert anyone automatically.

export type SafetyLevel = "none" | "concern" | "crisis";

export interface SafetyResult {
  level: SafetyLevel;
  matched: string[];
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics: ă→a, ș→s, ț→t, î→i
    .replace(/[’'`]/g, "'")
    .replace(/\s+/g, " ");
}

// Immediate-risk phrases (English + Romanian, diacritics removed).
const CRISIS_PATTERNS: RegExp[] = [
  /\bkill(ing)? my ?self\b/,
  /\bsuicid/,
  /\bend (it all|my life)\b/,
  /\b(want|wanna|going) to die\b/,
  /\bdon'?t want to (live|be alive|exist)\b/,
  /\bno (reason|point) (to|in) (live|living)\b/,
  /\bnot worth living\b/,
  /\bself[- ]?harm/,
  /\b(hurt|cut|harm)(ing)? my ?self\b/,
  /\boverdose\b/,
  /\bbetter off (dead|without me)\b/,
  /\bsinucid/,
  /\bsa ma (omor|sinucid)/,
  /\bvreau sa mor\b/,
  /\bnu (mai )?vreau sa (traiesc|mai traiesc|exist)\b/,
  /\bsa-?mi (iau|curm) viata\b/,
  /\bma (tai|ranesc)\b/,
  /\bimi fac rau\b/,
  /\bsa-?mi fac rau\b/,
  /\b(cineva|el|ea|ei) ma (bate|loveste|ameninta)\b/,
  /\b(someone|he|she|they) (is|are|keeps?) (hurting|hitting|abusing|threatening) me\b/,
  /\bi'?m not safe\b/,
  /\bnu sunt in siguranta\b/,
];

// Distress that deserves a gentle nudge towards a trusted adult.
const CONCERN_PATTERNS: RegExp[] = [
  /\bhopeless\b/,
  /\bworthless\b/,
  /\bnobody (cares|likes me|loves me)\b/,
  /\bcan'?t (go on|take (it|this) anymore|cope)\b/,
  /\b(being )?bullied\b/,
  /\bpanic attack/,
  /\bso alone\b/,
  /\bfara (speranta|rost)\b/,
  /\bnu ma (iubeste|place) nimeni\b/,
  /\bnu mai pot\b/,
  /\bma (agreseaza|hartuieste)\b/,
  /\bsunt singur(a)?\b/,
  /\batac de panica\b/,
];

export function screenText(text: string): SafetyResult {
  const t = normalise(text);
  const crisis = CRISIS_PATTERNS.filter((p) => p.test(t)).map((p) => p.source);
  if (crisis.length > 0) return { level: "crisis", matched: crisis };
  const concern = CONCERN_PATTERNS.filter((p) => p.test(t)).map((p) => p.source);
  if (concern.length > 0) return { level: "concern", matched: concern };
  return { level: "none", matched: [] };
}

export const CRISIS_MESSAGE = {
  en: "It sounds like you might be going through something really serious. You deserve support right now. If you are in danger or might hurt yourself, call 112 now. You can also call Telefonul Copilului on 116 111 (free), or talk to a trusted adult or your school counselor today. You don't have to handle this alone.",
  ro: "Se pare că treci prin ceva foarte greu. Meriți sprijin chiar acum. Dacă ești în pericol sau te-ai putea răni, sună acum la 112. Poți suna și la Telefonul Copilului, 116 111 (gratuit), sau vorbește azi cu un adult de încredere ori cu consilierul școlar. Nu trebuie să treci prin asta singur(ă).",
} as const;

export const CONCERN_MESSAGE = {
  en: "That sounds hard. Talking to someone you trust — a friend, family member, teacher or the school counselor — can really help. You can also ask the counselor to reach out to you from the Wellbeing page.",
  ro: "Sună greu. Să vorbești cu cineva în care ai încredere — un prieten, un membru al familiei, un profesor sau consilierul școlar — chiar poate ajuta. Poți cere consilierului să te contacteze din pagina Stare de bine.",
} as const;
