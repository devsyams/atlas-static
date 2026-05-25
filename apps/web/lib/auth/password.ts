import { hash, verify } from "@node-rs/argon2";

/** Argon2id hash (library defaults: argon2id, sensible memory/time cost). */
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

/** Verify a password against a stored Argon2 hash; false (never throws) on mismatch/garbage. */
export async function verifyPassword(stored: string, password: string): Promise<boolean> {
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}
