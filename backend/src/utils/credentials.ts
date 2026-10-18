import crypto from "crypto";
import User from "../models/User";

// No 0/O, 1/l/I -- these get read out loud and copied off printed sheets.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function generatePassword(length = 8): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return out;
}

function slug(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function usernameBase(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = slug(parts[0] || "");
  const last = parts.length > 1 ? slug(parts[parts.length - 1]) : "";
  return (last ? `${first}.${last}` : first) || "user";
}

// Usernames are global (login has no school field), so uniqueness is checked
// against the whole collection, plus names already reserved in this batch.
export async function reserveUsername(base: string, takenInBatch: Set<string>): Promise<string> {
  let candidate = base;
  let n = 1;
  while (takenInBatch.has(candidate) || (await User.exists({ username: candidate }))) {
    n++;
    candidate = `${base}${n}`;
  }
  takenInBatch.add(candidate);
  return candidate;
}

export function syntheticEmail(username: string): string {
  return `${username}@users.benchmark.local`;
}
