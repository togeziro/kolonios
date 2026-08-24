import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

// Enforces ADR-0001 (docs/adr/0001-lib-must-not-import-from-features.md):
// code under src/lib must not import from src/features. Dependency direction
// is one-way: routes -> features -> lib -> db/schema.
//
// A line carrying an explicit `layering-allow: <reason>` marker is skipped,
// so a future justified exception can be documented inline instead of
// silently weakening the rule.

const ROOT = 'src/lib';
const ALLOW_MARKER = 'layering-allow:';
const PATTERNS = [
  /from\s+['"]@\/features\//,
  /import\(\s*['"]@\/features\//,
  /from\s+['"](\.\.\/)+features\//,
  /import\(\s*['"](\.\.\/)+features\//
];

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

const all = walk(ROOT).filter((f) => ['.ts', '.tsx'].includes(extname(f)));

const violations: string[] = [];

for (const file of all) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.includes(ALLOW_MARKER)) return;
    if (PATTERNS.some((p) => p.test(line))) {
      violations.push(`${relative(process.cwd(), file)}:${i + 1}: ${line.trim()}`);
    }
  });
}

if (violations.length > 0) {
  console.error(`Layering violation: src/lib must not import from src/features (ADR-0001).`);
  for (const v of violations) console.error(`  ${v}`);
  console.error(
    `\nFound ${violations.length} violation(s). If truly unavoidable, mark the line with` +
      ` "${ALLOW_MARKER} <reason>" and record it in docs/adr/0001-lib-must-not-import-from-features.md.`
  );
  process.exit(1);
}

console.log(`Layering check OK (${all.length} files under ${ROOT}, 0 lib->features imports)`);
