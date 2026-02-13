import { describe, expect, it } from "vitest";
import {
  normalizeActivationCode,
  normalizeNonEmpty,
  resolveScopeIdentity
} from "./index";

describe("resolveScopeIdentity", () => {
  it("uses activation scope with priority", () => {
    const result = resolveScopeIdentity({
      activationCode: " test-1111-2222-3333 ",
      deviceId: "device-1"
    });

    expect(result.scopeType).toBe("activation");
    expect(result.scopeKey).toBe("ac:TEST-1111-2222-3333");
    expect(result.activationCode).toBe("TEST-1111-2222-3333");
  });

  it("falls back to device scope", () => {
    const result = resolveScopeIdentity({
      activationCode: "   ",
      deviceId: "device-1"
    });

    expect(result.scopeType).toBe("device");
    expect(result.scopeKey).toBe("device:device-1");
    expect(result.deviceId).toBe("device-1");
  });

  it("uses anonymous seed when no identity provided", () => {
    const result = resolveScopeIdentity({
      anonymousSeed: "seed-1"
    });

    expect(result.scopeType).toBe("anonymous");
    expect(result.scopeKey).toBe("anon:seed-1");
  });
});

describe("normalizers", () => {
  it("normalizes activation code to upper-case", () => {
    expect(normalizeActivationCode(" pro-xxxx-yyyy-zzzz ")).toBe("PRO-XXXX-YYYY-ZZZZ");
  });

  it("returns undefined for empty text", () => {
    expect(normalizeNonEmpty("   ")).toBeUndefined();
  });
});
