import { describe, it, expect } from "vitest";
import { col, COLLECTIONS } from "@/lib/db/mongo";

describe("mongo bootstrap", () => {
  it("seeds the demo and runs the alert engine", async () => {
    const alerts = await (await col(COLLECTIONS.alerts)).find({}).toArray();
    console.log(alerts.map((a) => `${a.severity} ${a.status} ${a.summary}`));
    expect(await (await col(COLLECTIONS.profiles)).countDocuments()).toBeGreaterThan(25);
    expect(alerts.length).toBeGreaterThanOrEqual(3);
  });
});
