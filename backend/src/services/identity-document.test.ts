import { describe, expect, it } from "vitest";
import {
  isValidIdentityDocument,
  normalizeIdentityDocument,
} from "./identity-document.js";

describe("identity-document", () => {
  it("accepts Zambia NRC numbers", () => {
    expect(isValidIdentityDocument("123456/12/1")).toBe(true);
    expect(normalizeIdentityDocument(" 123456 / 12 / 1 ")).toBe(
      "123456/12/1",
    );
  });

  it("accepts passport-style identifiers used across southern Africa", () => {
    expect(isValidIdentityDocument("BN 1234567")).toBe(true);
    expect(isValidIdentityDocument("A01234567")).toBe(true);
    expect(normalizeIdentityDocument("bn-1234567")).toBe("BN1234567");
  });

  it("rejects malformed values", () => {
    expect(isValidIdentityDocument("12345/12/1")).toBe(false);
    expect(isValidIdentityDocument("ABC")).toBe(false);
    expect(isValidIdentityDocument("///////")).toBe(false);
  });
});
