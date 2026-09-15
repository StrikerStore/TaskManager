import { describe, expect, it } from "vitest";
import { isGuessablePasscode } from "./passcode-plugin.js";

describe("isGuessablePasscode", () => {
  it("rejects a digit repeated six times", () => {
    for (const d of "0123456789") {
      expect(isGuessablePasscode(d.repeat(6))).toBe(true);
    }
  });

  it("rejects straight runs in either direction", () => {
    expect(isGuessablePasscode("123456")).toBe(true);
    expect(isGuessablePasscode("234567")).toBe(true);
    expect(isGuessablePasscode("987654")).toBe(true);
    expect(isGuessablePasscode("654321")).toBe(true);
  });

  it("allows passcodes that are merely memorable", () => {
    expect(isGuessablePasscode("482913")).toBe(false);
    expect(isGuessablePasscode("112233")).toBe(false);
    expect(isGuessablePasscode("135790")).toBe(false);
  });

  it("does not treat a wrap-around as a run", () => {
    // 890123 is not a straight run: 9 -> 0 is a step of -9, not +1.
    expect(isGuessablePasscode("890123")).toBe(false);
  });
});
