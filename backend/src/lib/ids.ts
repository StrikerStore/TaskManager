import { customAlphabet } from "nanoid";

/** URL-safe, lowercase ids that fit varchar(36). */
const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const generate = customAlphabet(alphabet, 21);

export function newId(): string {
  return generate();
}

/** "Design Team" -> "design-team" */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "team";
}

/** No 0/O or 1/I/L: a team code gets read aloud and typed from a phone screen. */
const teamCodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const generateTeamCode = customAlphabet(teamCodeAlphabet, 8);

export function newTeamCode(): string {
  return generateTeamCode();
}

/** "k7qp-4m2x" -> "K7QP4M2X", so people can type it however they like. */
export function normalizeTeamCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
