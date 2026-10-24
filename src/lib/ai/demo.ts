// Deterministic demo provider used when no AI key is configured. It follows
// the same teaching rules as the real tutor (concept → example → hint → your
// turn) using a small built-in topic library, so the full flow can be tried
// offline. Responses are clearly marked as demo responses in the UI.

import type { ChatProvider, ChatRequest } from "./types";

interface Topic {
  match: RegExp;
  en: { concept: string; example: string; hint: string; check: string; quiz: string[] };
  ro: { concept: string; example: string; hint: string; check: string; quiz: string[] };
}

const TOPICS: Topic[] = [
  {
    match: /(equation|ecuați|ecuati|solve for|find x|află x|afla x|\d\s*x\s*[-+=−]|\bx\s*[-+=−])/i,
    en: {
      concept: "A linear equation is like a balanced scale: whatever you do to one side, you must do to the other, so it stays balanced. The goal is to get x alone on one side.",
      example: "Example (not your exercise): 3x + 4 = 19. Subtract 4 from both sides → 3x = 15. Divide both sides by 3 → x = 5. Check: 3·5 + 4 = 19 ✓",
      hint: "Hint for yours: first move the number that is added or subtracted next to the x-term to the other side (do the opposite operation on both sides).",
      check: "What do you get after that first step? Write it down and tell me.",
      quiz: ["Solve 2x + 6 = 14.", "Solve 5x − 3 = 2x + 9.", "Why do we do the same operation on both sides?"],
    },
    ro: {
      concept: "O ecuație de gradul I e ca o balanță: ce faci într-o parte, faci și în cealaltă, ca să rămână în echilibru. Scopul este să-l lași pe x singur într-o parte.",
      example: "Exemplu (nu exercițiul tău): 3x + 4 = 19. Scădem 4 din ambele părți → 3x = 15. Împărțim la 3 → x = 5. Verificare: 3·5 + 4 = 19 ✓",
      hint: "Indiciu pentru exercițiul tău: mută mai întâi numărul adunat sau scăzut lângă x în cealaltă parte (fă operația inversă în ambele părți).",
      check: "Ce obții după primul pas? Scrie-l și spune-mi.",
      quiz: ["Rezolvă 2x + 6 = 14.", "Rezolvă 5x − 3 = 2x + 9.", "De ce facem aceeași operație în ambele părți?"],
    },
  },
  {
    match: /(fraction|fracti|numerator|denominator|numărător|numitor)/i,
    en: {
      concept: "A fraction describes parts of a whole: the denominator (bottom) says how many equal parts the whole is cut into, the numerator (top) how many you have. To add fractions, the parts must be the same size — so you need a common denominator.",
      example: "Example: 1/3 + 1/4. A common denominator is 12. 1/3 = 4/12 and 1/4 = 3/12, so the sum is 7/12.",
      hint: "Hint: find the smallest number both denominators divide into, then rewrite each fraction with it.",
      check: "What common denominator would you use for your fractions?",
      quiz: ["What is 1/2 + 1/3?", "Simplify 6/8.", "Which is bigger: 3/5 or 2/3? How do you know?"],
    },
    ro: {
      concept: "O fracție descrie părți dintr-un întreg: numitorul (jos) spune în câte părți egale e împărțit întregul, numărătorul (sus) câte părți ai. Ca să aduni fracții, părțile trebuie să fie de aceeași mărime — ai nevoie de un numitor comun.",
      example: "Exemplu: 1/3 + 1/4. Un numitor comun este 12. 1/3 = 4/12 și 1/4 = 3/12, deci suma este 7/12.",
      hint: "Indiciu: găsește cel mai mic număr care se împarte la ambii numitori, apoi rescrie fiecare fracție.",
      check: "Ce numitor comun ai folosi pentru fracțiile tale?",
      quiz: ["Cât face 1/2 + 1/3?", "Simplifică 6/8.", "Care e mai mare: 3/5 sau 2/3? De unde știi?"],
    },
  },
  {
    match: /(pythag|pitagora|hypotenuse|ipotenuz|right triangle|triunghi dreptunghic)/i,
    en: {
      concept: "In a right triangle, the square on the longest side (the hypotenuse, opposite the right angle) has the same area as the squares on the other two sides together: a² + b² = c².",
      example: "Example: legs 6 and 8. 6² + 8² = 36 + 64 = 100, so c = √100 = 10.",
      hint: "Hint: first decide which side is the hypotenuse — is it the one you're looking for, or one you already know?",
      check: "Which side is the hypotenuse in your problem?",
      quiz: ["Legs 3 and 4 — what is the hypotenuse?", "Hypotenuse 13, one leg 5 — find the other leg.", "Can the hypotenuse ever be shorter than a leg? Why?"],
    },
    ro: {
      concept: "Într-un triunghi dreptunghic, pătratul ipotenuzei (latura opusă unghiului drept) este egal cu suma pătratelor catetelor: a² + b² = c².",
      example: "Exemplu: catetele 6 și 8. 6² + 8² = 36 + 64 = 100, deci c = √100 = 10.",
      hint: "Indiciu: stabilește mai întâi care latură este ipotenuza — o cauți sau o știi deja?",
      check: "Care latură este ipotenuza în problema ta?",
      quiz: ["Catete 3 și 4 — cât e ipotenuza?", "Ipotenuza 13, o catetă 5 — află cealaltă catetă.", "Poate ipotenuza să fie mai scurtă decât o catetă? De ce?"],
    },
  },
  {
    match: /(photosynth|fotosint|chlorophyll|clorofil)/i,
    en: {
      concept: "Photosynthesis is how plants make their own food. Using light energy (captured by chlorophyll), they turn carbon dioxide and water into glucose and release oxygen: 6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂.",
      example: "Think of a leaf as a small solar-powered kitchen: ingredients (CO₂ from air, water from roots), energy (sunlight), product (sugar), and a by-product (oxygen) released through stomata.",
      hint: "Hint: for your question, list the inputs and outputs first — that usually unlocks the answer.",
      check: "Can you name the two inputs and the two outputs?",
      quiz: ["Where in the cell does photosynthesis happen?", "Why do plants need light?", "What gas do plants release?"],
    },
    ro: {
      concept: "Fotosinteza este procesul prin care plantele își produc hrana. Folosind energia luminii (captată de clorofilă), transformă dioxidul de carbon și apa în glucoză și eliberează oxigen: 6CO₂ + 6H₂O + lumină → C₆H₁₂O₆ + 6O₂.",
      example: "Gândește-te la frunză ca la o bucătărie solară: ingrediente (CO₂ din aer, apă din rădăcini), energie (lumina), produs (zahăr) și un produs secundar (oxigen) eliberat prin stomate.",
      hint: "Indiciu: pentru întrebarea ta, scrie întâi ce intră și ce iese — de obicei asta deblochează răspunsul.",
      check: "Poți numi cele două substanțe care intră și cele două care ies?",
      quiz: ["În ce parte a celulei are loc fotosinteza?", "De ce au plantele nevoie de lumină?", "Ce gaz eliberează plantele?"],
    },
  },
  {
    match: /(newton|force|forț|acceleration|accelerați|inertia|inerți)/i,
    en: {
      concept: "Newton's second law: the acceleration of an object depends on the net force on it and its mass: F = m·a. A bigger force → more acceleration; a bigger mass → less acceleration for the same force.",
      example: "Example: pushing a 2 kg cart with a net force of 10 N gives a = F/m = 10/2 = 5 m/s².",
      hint: "Hint: write down what you know (F, m or a), with units, and which one you need. Then rearrange F = m·a.",
      check: "Which two quantities does your problem give you?",
      quiz: ["What force gives a 4 kg box an acceleration of 3 m/s²?", "Why is it harder to push a full trolley than an empty one?", "State Newton's first law in your own words."],
    },
    ro: {
      concept: "Legea a doua a lui Newton: accelerația unui corp depinde de forța rezultantă și de masa lui: F = m·a. Forță mai mare → accelerație mai mare; masă mai mare → accelerație mai mică pentru aceeași forță.",
      example: "Exemplu: împingi un cărucior de 2 kg cu o forță rezultantă de 10 N: a = F/m = 10/2 = 5 m/s².",
      hint: "Indiciu: scrie ce știi (F, m sau a) cu unități și ce trebuie aflat. Apoi rearanjează F = m·a.",
      check: "Ce două mărimi îți dă problema?",
      quiz: ["Ce forță dă unei cutii de 4 kg o accelerație de 3 m/s²?", "De ce e mai greu să împingi un cărucior plin decât unul gol?", "Spune legea întâi a lui Newton cu cuvintele tale."],
    },
  },
  {
    match: /(percent|procent|%)/i,
    en: {
      concept: "A percentage means 'out of 100'. To find p% of a number, multiply the number by p/100.",
      example: "Example: 15% of 80 = 80 × 15/100 = 12.",
      hint: "Hint: turn the percentage into a decimal first (e.g. 25% → 0.25).",
      check: "What decimal is your percentage?",
      quiz: ["What is 20% of 150?", "A €40 jacket is 25% off. What's the new price?", "What percentage is 18 out of 24?"],
    },
    ro: {
      concept: "Procentul înseamnă „din 100”. Ca să afli p% dintr-un număr, înmulțește numărul cu p/100.",
      example: "Exemplu: 15% din 80 = 80 × 15/100 = 12.",
      hint: "Indiciu: transformă întâi procentul în număr zecimal (de ex. 25% → 0,25).",
      check: "Ce număr zecimal corespunde procentului tău?",
      quiz: ["Cât este 20% din 150?", "O geacă de 40 € are reducere 25%. Care e noul preț?", "Ce procent reprezintă 18 din 24?"],
    },
  },
];

function detectLang(system: string): "en" | "ro" {
  return /Reply in Romanian/.test(system) ? "ro" : "en";
}

function tutorReply(req: ChatRequest): string {
  const lang = detectLang(req.system);
  const last = [...req.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const mode = /Current mode: (\w+)/.exec(req.system)?.[1] ?? "explain";
  const style = /learning style: ([^.\n]+)/.exec(req.system)?.[1] ?? "";
  const topic = TOPICS.find((t) => t.match.test(last)) ?? TOPICS.find((t) => req.messages.some((m) => t.match.test(m.content)));
  const L = (en: string, ro: string) => (lang === "ro" ? ro : en);
  const prefix = L("*(Demo tutor — connect an AI provider for full answers.)*\n\n", "*(Tutor demo — conectează un furnizor AI pentru răspunsuri complete.)*\n\n");

  if (!topic) {
    return (
      prefix +
      L(
        `Good question! Let's work through it together rather than me just giving the answer.\n\n**1. What is being asked?** Try to say it in one sentence.\n**2. What do you already know?** List the facts or formulas that seem related.\n**3. First small step:** pick the piece you're most confident about and start there.\n\n${style.startsWith("Visual") ? "Tip for you: sketch a quick diagram or table of the information.\n\n" : ""}Tell me what you've got for step 1 and I'll guide you from there. (In demo mode I know a few topics well: equations, fractions, percentages, Pythagoras, photosynthesis and Newton's laws.)`,
        `Bună întrebare! Hai să o rezolvăm împreună, nu să-ți dau direct răspunsul.\n\n**1. Ce se cere?** Spune într-o propoziție.\n**2. Ce știi deja?** Scrie datele sau formulele care par legate.\n**3. Primul pas mic:** alege partea de care ești cel mai sigur și începe de acolo.\n\n${style.startsWith("Visual") ? "Sfat pentru tine: fă o schiță sau un tabel cu datele.\n\n" : ""}Spune-mi ce ai obținut la pasul 1 și te ghidez mai departe. (În modul demo cunosc bine câteva subiecte: ecuații, fracții, procente, Pitagora, fotosinteză și legile lui Newton.)`,
      )
    );
  }
  const t = topic[lang];
  if (mode === "hint") return prefix + `${t.hint}\n\n${t.check}`;
  if (mode === "quiz") {
    const asked = req.messages.filter((m) => m.role === "assistant").length;
    const q = t.quiz[asked % t.quiz.length];
    return prefix + L(`Quiz time! Question ${(asked % t.quiz.length) + 1}:\n\n**${q}**\n\nTake your time and write your answer.`, `Test rapid! Întrebarea ${(asked % t.quiz.length) + 1}:\n\n**${q}**\n\nIa-ți timp și scrie răspunsul.`);
  }
  if (mode === "summary") return prefix + L(`**Revision summary**\n\n${t.concept}\n\n${t.example}\n\nKey check: ${t.check}`, `**Rezumat pentru recapitulare**\n\n${t.concept}\n\n${t.example}\n\nVerificare: ${t.check}`);
  return prefix + `**${L("The idea", "Ideea")}**\n${t.concept}\n\n**${L("Worked example", "Exemplu rezolvat")}**\n${t.example}\n\n**${L("Your turn", "Rândul tău")}**\n${t.hint}\n\n${t.check}`;
}

function wellbeingReply(req: ChatRequest): string {
  const lang = detectLang(req.system);
  const last = ([...req.messages].reverse().find((m) => m.role === "user")?.content ?? "").toLowerCase();
  const L = (en: string, ro: string) => (lang === "ro" ? ro : en);
  const tail = L(
    "\n\nIf this keeps weighing on you, it can really help to talk to a trusted adult or the school counselor — you can ask them to reach out from the **Get support** page.",
    "\n\nDacă asta continuă să te apese, chiar ajută să vorbești cu un adult de încredere sau cu consilierul școlar — îi poți cere să te contacteze din pagina **Primește sprijin**.",
  );
  const prefix = L("*(Demo assistant — scripted responses.)*\n\n", "*(Asistent demo — răspunsuri predefinite.)*\n\n");
  if (/(exam|test|examen|teza|lucrare|study|învăț|invat)/.test(last)) {
    return prefix + L(
      "Exams can feel like a lot — that pressure is really common. Two things that help many students:\n\n1. **Shrink the task**: pick one topic, set a 25-minute timer, then take a 5-minute break.\n2. **Calm your body first**: try box breathing — in for 4, hold for 4, out for 4, hold for 4 — three rounds.\n\nWhat's the one subject worrying you most?",
      "Examenele pot părea copleșitoare — presiunea asta e foarte des întâlnită. Două lucruri care ajută mulți elevi:\n\n1. **Micșorează sarcina**: alege un subiect, pune un cronometru de 25 de minute, apoi 5 minute pauză.\n2. **Calmează-ți corpul întâi**: respirație în pătrat — inspiri 4, ții 4, expiri 4, ții 4 — de trei ori.\n\nCare e materia care te îngrijorează cel mai mult?",
    ) + tail;
  }
  if (/(sleep|tired|somn|obosit)/.test(last)) {
    return prefix + L(
      "Being tired makes everything harder. Tonight you could try: screens off 30 minutes before bed, a regular bedtime, and writing tomorrow's to-do list so your mind can rest. Teenagers usually need 8–10 hours.",
      "Oboseala face totul mai greu. Diseară poți încerca: fără ecrane cu 30 de minute înainte de culcare, o oră fixă de somn și o listă cu ce ai de făcut mâine, ca mintea să se poată odihni. Adolescenții au nevoie de obicei de 8–10 ore.",
    ) + tail;
  }
  if (/(friend|prieten|lonely|singur|left out|exclus)/.test(last)) {
    return prefix + L(
      "Friendship stuff can really hurt. It makes sense to feel this way. Would it help to think about one person you feel comfortable with, or a club where people share your interests? The Connect page can suggest classmates with similar hobbies.",
      "Problemele cu prietenii pot durea. E normal să te simți așa. Te-ar ajuta să te gândești la o persoană cu care te simți bine, sau la un club unde oamenii au aceleași interese? Pagina Conectare îți poate sugera colegi cu hobby-uri asemănătoare.",
    ) + tail;
  }
  if (/(breath|respir|calm|panic|panică|panica|anxious|anxios|anxioasă)/.test(last)) {
    return prefix + L(
      "Let's slow things down together. Try box breathing: **breathe in** for 4… **hold** for 4… **breathe out** for 4… **hold** for 4. Repeat three times. You can also open the guided breathing exercise on this page.\n\nHow do you feel after a few rounds?",
      "Hai să încetinim împreună. Încearcă respirația în pătrat: **inspiră** 4… **ține** 4… **expiră** 4… **ține** 4. Repetă de trei ori. Poți deschide și exercițiul ghidat de pe această pagină.\n\nCum te simți după câteva runde?",
    ) + tail;
  }
  if (/(time|timp|organi|procrastin|amân)/.test(last)) {
    return prefix + L(
      "A simple plan helps: write everything down, pick the 3 most important things, and give each one a time slot. Start with the smallest task to build momentum. Short breaks count as part of the plan!",
      "Un plan simplu ajută: scrie totul, alege cele mai importante 3 lucruri și dă-i fiecăruia un interval de timp. Începe cu cea mai mică sarcină ca să prinzi avânt. Pauzele scurte fac parte din plan!",
    ) + tail;
  }
  return prefix + L(
    "Thanks for sharing that with me. It sounds like today has been a lot. Sometimes it helps to name the feeling and notice where you feel it in your body. Would you like to try a quick grounding exercise — 5 things you can see, 4 you can hear, 3 you can touch, 2 you can smell, 1 you can taste?",
    "Mulțumesc că mi-ai spus. Pare că a fost mult azi. Uneori ajută să numești emoția și să observi unde o simți în corp. Vrei să încercăm un exercițiu scurt de ancorare — 5 lucruri pe care le vezi, 4 pe care le auzi, 3 pe care le atingi, 2 pe care le miroși, 1 pe care îl guști?",
  ) + tail;
}

export class DemoProvider implements ChatProvider {
  readonly name = "demo";
  readonly isDemo = true;

  async *stream(req: ChatRequest, signal?: AbortSignal): AsyncIterable<string> {
    const text = req.system.includes("wellbeing assistant") ? wellbeingReply(req) : tutorReply(req);
    for (const chunk of text.match(/\S+\s*/g) ?? []) {
      if (signal?.aborted) return;
      await new Promise((r) => setTimeout(r, 12));
      yield chunk;
    }
  }
}
