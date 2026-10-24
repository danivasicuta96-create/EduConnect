import { describe, it, expect } from "vitest";
import { col, COLLECTIONS, system } from "@/lib/db/mongo";
import { seedIfEmpty } from "@/lib/db/seed";

describe("mongo bootstrap", () => {
  it("seeds the demo and runs the alert engine", async () => {
    const alerts = await (await col(COLLECTIONS.alerts)).find({}).toArray();
    expect(await (await col(COLLECTIONS.profiles)).countDocuments()).toBeGreaterThan(25);
    expect(alerts.length).toBeGreaterThanOrEqual(3);
  });

  it("seeds only once, and redoes an interrupted seed cleanly", async () => {
    const db = await system();
    expect(await seedIfEmpty(db)).toBe("present");
    // Simulate a seed that stopped half-way: marker missing, partial demo data present.
    await db.collection("app_meta").deleteOne({ _id: "demo_seed" as never });
    await (await col(COLLECTIONS.alerts)).deleteMany({});
    expect(await seedIfEmpty(db)).toBe("seeded");
    expect(await (await col(COLLECTIONS.schools)).countDocuments({ is_demo: true })).toBe(2);
    expect(await (await col(COLLECTIONS.users)).countDocuments({ email: "maria.georgescu@aurora.demo" })).toBe(1);
    expect(await (await col(COLLECTIONS.alerts)).countDocuments({ status: "open" })).toBeGreaterThanOrEqual(3);
  });
});
