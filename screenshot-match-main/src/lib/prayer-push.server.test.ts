import { describe, expect, it } from "vitest";
import { validatePushRecord } from "./prayer-push.server";

const basic = {
  endpoint: "https://web.push.apple.com/abc123",
  keys: {p256dh: "A".repeat(86), auth: "B".repeat(22)},
  latitude: 11.05123, longitude: 76.07111,
  method: 1, school: 0, language: "en",
};

describe("secure prayer push subscription validation", () => {
  it("accepts normal Apple Web Push subscriptions and removes GPS precision", () => {
    const r = validatePushRecord(basic);
    expect(r?.latitude).toBe(11.05);
    expect(r?.longitude).toBe(76.07);
  });
  it("rejects private network endpoints and unrecognized hosts", () => {
    expect(validatePushRecord({...basic, endpoint:"http://localhost:80/"})).toBeNull();
    expect(validatePushRecord({...basic, endpoint:"https://127.0.0.1/internal"})).toBeNull();
    expect(validatePushRecord({...basic, endpoint:"https://web.push.apple.com.evil.test/push"})).toBeNull();
  });
  it("rejects missing encryption keys and out-of-India locations", () => {
    expect(validatePushRecord({...basic, keys: {p256dh:"bad", auth:"bad"}})).toBeNull();
    expect(validatePushRecord({...basic, latitude: 48})).toBeNull();
    expect(validatePushRecord({...basic, longitude: -82})).toBeNull();
  });
  it("rejects unsupported prayer methods and invalid schools", () => {
    expect(validatePushRecord({...basic, method: -1})).toBeNull();
    expect(validatePushRecord({...basic, school: 3})).toBeNull();
  });
});
