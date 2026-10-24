import { beforeAll, describe, expect, it } from "vitest";
import { col, COLLECTIONS } from "@/lib/db/mongo";
import { scopedCollection, tenant } from "@/lib/db/tenant";
import { getStudentProfile, updateStudentProfile, listInterests } from "@/lib/services/profile";
import { getConnections, getRecommendations, respondToRequest, sendConnectionRequest, blockStudent } from "@/lib/services/connect";
import { getHistory, submitCheckin, requestCounselorContact } from "@/lib/services/wellbeing";
import { getStudentAcademics, loadStudentAcademics } from "@/lib/services/academics";
import { setOwnConsent } from "@/lib/services/consent";
import { exportMyData } from "@/lib/services/account";
import { actorFor, DEMO } from "./helpers";

type A = Awaited<ReturnType<typeof actorFor>>;
let maria: A, alex: A, sofia: A, vlad: A, sara: A, other: A, teacher: A;

beforeAll(async () => {
  [maria, alex, sofia, vlad, sara, other, teacher] = await Promise.all(
    [DEMO.maria, DEMO.alex, DEMO.sofia, DEMO.vlad, DEMO.sara, DEMO.otherStudent, DEMO.mathTeacher].map(actorFor),
  );
});

describe("student profile", () => {
  it("creates and updates a profile with interests", async () => {
    const interests = await listInterests(maria);
    const chosen = interests.filter((i) => ["programming", "chess", "music"].includes(i.slug)).map((i) => i.id);
    await updateStudentProfile(maria, {
      displayName: "Maria G.", avatarColor: "teal", avatarEmoji: "🎸", bio: "Hi!", learningStyle: "visual",
      goals: ["learn_coding"], clubs: ["Choir"], openTo: ["study_partner"], discoverable: true, showClass: true, interestIds: chosen,
    });
    const p = await getStudentProfile(maria);
    expect(p.displayName).toBe("Maria G.");
    expect(p.interestIds.sort()).toEqual(chosen.sort());
    expect(p.clubs).toEqual(["Choir"]);
  });

  it("the tenant guard refuses to move data to another school", async () => {
    await expect(tenant(maria).profiles.updateOne({ _id: maria.id }, { $set: { school_id: other.schoolId } })).rejects.toThrow(/school_id/);
    await expect(tenant(maria).checkins.insertOne({ school_id: other.schoolId, student_id: maria.id, date: "2026-01-01", mood: 5 })).rejects.toThrow(/another school/);
  });
});

describe("matchmaking & connections", () => {
  it("recommends compatible students from the same school only", async () => {
    const recs = await getRecommendations(maria, 20);
    expect(recs.length).toBeGreaterThan(0);
    const ids = recs.map((r) => r.id);
    expect(ids).not.toContain(maria.id);
    expect(ids).not.toContain(other.id); // other school
    expect(ids).not.toContain(vlad.id); // not discoverable
    expect(ids).not.toContain(sofia.id); // already connected
    for (const r of recs) expect(r.match.reasons.length).toBeGreaterThan(0);
  });

  it("never exposes private data in recommendations", async () => {
    const recs = await getRecommendations(maria, 20);
    const json = JSON.stringify(recs);
    expect(json).not.toMatch(/mood|grade_score|email|note/i);
  });

  it("supports accepting and declining requests", async () => {
    const incoming = (await getConnections(maria)).incoming;
    const fromAlex = incoming.find((r) => r.id === alex.id)!;
    expect(fromAlex).toBeDefined();
    await respondToRequest(maria, fromAlex.connectionId, true);
    expect((await getConnections(maria)).connected.map((c) => c.id)).toContain(alex.id);
    expect((await getConnections(alex)).connected.map((c) => c.id)).toContain(maria.id);

    const bianca = await actorFor("bianca.niculescu@aurora.demo");
    await sendConnectionRequest(bianca, { addresseeId: maria.id, message: "Hi" });
    const req = (await getConnections(maria)).incoming.find((r) => r.id === bianca.id)!;
    await respondToRequest(maria, req.connectionId, false);
    expect((await getConnections(maria)).incoming.map((r) => r.id)).not.toContain(bianca.id);
    // The declined student can't immediately re-send.
    await expect(sendConnectionRequest(bianca, { addresseeId: maria.id, message: null })).rejects.toThrow(/isn't accepting/);
    // A student can't respond to a request addressed to someone else.
    await expect(respondToRequest(alex, req.connectionId, true)).rejects.toThrow();
  });

  it("blocks prevent contact and cross-school requests are rejected", async () => {
    const tudor = await actorFor(DEMO.tudor);
    await blockStudent(tudor, maria.id);
    await expect(sendConnectionRequest(maria, { addresseeId: tudor.id, message: null })).rejects.toThrow();
    expect((await getRecommendations(maria, 50)).map((r) => r.id)).not.toContain(tudor.id);
    await expect(sendConnectionRequest(maria, { addresseeId: other.id, message: null })).rejects.toThrow();
  });

  it("students cannot message adults (teachers)", async () => {
    await expect(sendConnectionRequest(maria, { addresseeId: teacher.id, message: null })).rejects.toThrow();
  });
});

describe("wellbeing check-ins", () => {
  it("submits a check-in and sees it in the history", async () => {
    const res = await submitCheckin(maria, { mood: 3, experience: "hard", factors: ["tests"], note: "Rough test day", shareNote: false });
    expect(res.suggestions.length).toBeGreaterThan(0);
    const h = await getHistory(maria);
    const today = h.rows.find((r) => r.date === res.date)!;
    expect(today.mood).toBe(3);
    expect(today.note).toBe("Rough test day");
  });

  it("private notes are encrypted at rest and only returned to their owner", async () => {
    const raw = await (await col(COLLECTIONS.checkins)).findOne({ student_id: maria.id, note_enc: { $ne: null } });
    expect(String(raw!.note_enc)).toMatch(/^enc:v1:/);
    expect(JSON.stringify(raw)).not.toContain("Rough test day");
    const alexHistory = await getHistory(alex);
    expect(alexHistory.rows.every((r) => r.note === null || !r.note.includes("Rough test day"))).toBe(true);
  });

  it("students only ever get their own wellbeing data", async () => {
    const h = await getHistory(alex);
    const ids = new Set((await (await col(COLLECTIONS.checkins)).find({ student_id: alex.id }).toArray()).map((c) => String(c._id)));
    expect(h.rows.every((r) => ids.has(r.id))).toBe(true);
  });

  it("students never see rule-generated alerts about themselves", async () => {
    const tudor = await actorFor(DEMO.tudor);
    const { getSupportOverview } = await import("@/lib/services/wellbeing");
    expect((await getSupportOverview(tudor)).request).toBeNull();
  });

  it("a self-referral reaches counselors", async () => {
    await requestCounselorContact(sofia, "Can we talk?", false);
    const alerts = await (await col(COLLECTIONS.alerts)).find({ student_id: sofia.id }).toArray();
    expect(alerts.map((a) => a.source)).toContain("self_referral");
    expect(JSON.stringify(alerts)).not.toContain("Can we talk?"); // message stored encrypted
    const counselor = await actorFor(DEMO.counselor);
    expect(await (await col(COLLECTIONS.notifications)).countDocuments({ user_id: counselor.id, type: "counselor_alert" })).toBeGreaterThan(0);
    await expect(requestCounselorContact(sofia, null, false)).rejects.toThrow(/already been sent/);
  });

  it("withdrawing consent switches check-ins off; under-16s can't re-grant themselves", async () => {
    await setOwnConsent(maria, "wellbeing_checkins", false);
    await expect(submitCheckin(maria, { mood: 7, experience: null, factors: [], note: null, shareNote: false })).rejects.toThrow(/switched off/);
    await expect(setOwnConsent(maria, "wellbeing_checkins", true)).rejects.toThrow(/under 16/);
  });

  it("pending-consent students can't use check-ins", async () => {
    await expect(submitCheckin(sara, { mood: 7, experience: null, factors: [], note: null, shareNote: false })).rejects.toThrow();
  });
});

describe("academics & data isolation", () => {
  it("shows the student's own grades, averages and upcoming assessments", async () => {
    const a = await getStudentAcademics(alex);
    expect(a.grades.length).toBeGreaterThan(0);
    expect(a.overall).not.toBeNull();
    expect(a.upcoming.length).toBeGreaterThan(0);
    expect(new Set(a.grades.map((g) => g.id)).size).toBe(a.grades.length);
  });

  it("changing IDs never leaks another student's or school's records", async () => {
    await expect(loadStudentAcademics(alex, maria.id, "2026-10-24")).rejects.toThrow(/permission/);
    await expect(loadStudentAcademics(other, maria.id, "2026-10-24")).rejects.toThrow(/permission/);
    expect(await tenant(other).profiles.find({ _id: maria.id })).toHaveLength(0);
    // A forged school_id filter is overridden by the caller's own school.
    const forged = await tenant(other).profiles.find({ school_id: alex.schoolId });
    expect(forged.every((p) => p.school_id === other.schoolId)).toBe(true);
    expect(await tenant(other).grades.find({ student_id: maria.id })).toHaveLength(0);
    expect((await tenant(alex).classes.find({ school_id: other.schoolId })).every((c) => c.school_id === alex.schoolId)).toBe(true);
  });

  it("credential collections are unreachable through tenant access", () => {
    expect(() => scopedCollection(alex.schoolId, COLLECTIONS.users)).toThrow();
    expect(() => scopedCollection(alex.schoolId, COLLECTIONS.sessions)).toThrow();
  });

  it("data export contains only the requester's data", async () => {
    const data = await exportMyData(alex);
    const json = JSON.stringify(data);
    expect(json).toContain(DEMO.alex);
    expect(json).not.toContain(DEMO.maria);
    expect(json).not.toContain("password");
  });
});
