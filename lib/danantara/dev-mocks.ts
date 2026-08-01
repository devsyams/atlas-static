import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_DIR = join(process.cwd(), ".local-dev-mocks");

function mockDir() {
  return process.env.DANANTARA_LOCAL_MOCK_DIR || DEFAULT_DIR;
}

export function readDevMockJson(filename: string): string | null {
  if (process.env.NODE_ENV === "production") return null;
  const file = join(mockDir(), filename);
  return existsSync(file) ? readFileSync(file, "utf8") : null;
}
