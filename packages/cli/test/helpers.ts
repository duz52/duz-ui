/**
 * Test helper — materialises a temporary project directory with the structure
 * `duz-ui migrate` expects: a `package.json` declaring `react`, a
 * `tsconfig.json` with an `@/*` path mapping, and the given component files.
 * Cleans up on exit, even if the test throws.
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { dirname, join } from "node:path"
import { tmpdir } from "node:os"

export async function withTempProject<T>(
  files: Record<string, string>,
  fn: (dir: string) => Promise<T>,
): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "duz-ui-test-"))
  try {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify(
        {
          name: "test-app",
          private: true,
          dependencies: { react: "^19.0.0" },
        },
        null,
        2,
      ) + "\n",
    )

    writeFileSync(
      join(dir, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            baseUrl: ".",
            paths: { "@/*": ["./*"] },
          },
        },
        null,
        2,
      ) + "\n",
    )

    for (const [relPath, content] of Object.entries(files)) {
      const fullPath = join(dir, relPath)
      mkdirSync(dirname(fullPath), { recursive: true })
      writeFileSync(fullPath, content)
    }

    return await fn(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
