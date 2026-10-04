import { describe, expect, it } from "vitest";
import { unlockSchema } from "./unlock";

describe("unlockSchema door", () => {
  it("defaults to the room door so existing single-door callers are unchanged", () => {
    expect(unlockSchema.parse({ bookingId: 1 }).door).toBe("room");
  });

  it("accepts the main entrance", () => {
    expect(unlockSchema.parse({ bookingId: 1, door: "entrance" }).door).toBe("entrance");
  });

  it("rejects any other door", () => {
    expect(unlockSchema.safeParse({ bookingId: 1, door: "back" }).success).toBe(false);
  });
});
