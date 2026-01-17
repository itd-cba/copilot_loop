import { promises as fs } from 'node:fs';
import path from 'node:path';

const SHEBANG = '#!/usr/bin/env node\n';

async function main() {
  const distDir = path.resolve(process.cwd(), 'dist');

  // Ensure entrypoint has a shebang so it can be executed by npm bin shims / POSIX shells.
  // (TypeScript does not preserve shebangs prior to TS 5.9.)
  try {
    const entryPath = path.join(distDir, 'index.js');
    const current = await fs.readFile(entryPath, 'utf8');
    if (!current.startsWith('#!')) {
      await fs.writeFile(entryPath, SHEBANG + current, 'utf8');
    }
  } catch {
    // Best-effort; do not fail build.
  }

  if (process.platform === 'win32') return;

  let entries;
  try {
    entries = await fs.readdir(distDir, { withFileTypes: true });
  } catch {
    return;
  }

  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
      .map(async (entry) => {
        const filePath = path.join(distDir, entry.name);
        try {
          await fs.chmod(filePath, 0o755);
        } catch {
          // Best-effort; do not fail build.
        }
      }),
  );
}

await main();
