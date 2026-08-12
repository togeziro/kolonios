import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import ts from 'typescript';

const WRITE_BASELINE = process.argv.includes('--write-baseline');

const ROOTS = ['src/routes', 'src/features'];
const IGNORED_DIRS = new Set(['api', 'validation', 'schemas', 'lib', 'types']);
const IGNORED_ATTRS = new Set([
  'aria-hidden',
  'className',
  'id',
  'name',
  'type',
  'value',
  'href',
  'target',
  'role',
  'tabIndex',
  'autoComplete',
  'dir',
  'alt',
  'src',
  'variant',
  'size',
  'step',
  'side',
  'to',
  'form',
  'asChild',
  'htmlFor',
  'mode'
]);
const SKIP_DIRECTIVE = '// i18n:skip';
const BASELINE = join(process.cwd(), 'scripts/i18n-hardcoded-baseline.txt');

const files: string[] = [];
function walk(dir: string) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (!IGNORED_DIRS.has(entry) && !entry.startsWith('.')) walk(p);
    } else if (extname(p) === '.tsx') {
      files.push(p);
    }
  }
}
for (const root of ROOTS) walk(root);

const baseline = existsSync(BASELINE)
  ? new Set(readFileSync(BASELINE, 'utf8').split('\n').filter(Boolean))
  : new Set<string>();
const found = new Map<string, string>(); // "file:line" -> message

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  if (source.includes(SKIP_DIRECTIVE)) continue;
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const walkAst = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      const text = node.text.trim();
      if (text.length > 0 && !/^[\d\s,.%+-]+$/.test(text)) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
        found.set(`${file}:${line + 1}`, `hardcoded JSX text "${text}" — use useTranslation()`);
      }
    }
    if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const name = ts.isJsxNamespacedName(node.name) ? node.name.name.text : node.name.text;
      const value = node.initializer.text.trim();
      if (
        value.length > 0 &&
        !IGNORED_ATTRS.has(name) &&
        !name.startsWith('data-') &&
        !/^[\d\s,.%+-]+$/.test(value)
      ) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
        found.set(
          `${file}:${line + 1}`,
          `hardcoded string in ${name}="..." — use useTranslation()`
        );
      }
    }
    ts.forEachChild(node, walkAst);
  };
  walkAst(sf);
}

if (WRITE_BASELINE) {
  writeFileSync(BASELINE, [...found.keys()].sort().join('\n') + '\n');
  console.log(`Baseline written: ${found.size} entries -> ${BASELINE}`);
  process.exit(0);
}

const newViolations = [...found.entries()].filter(([loc]) => !baseline.has(loc));

if (newViolations.length > 0) {
  console.error('Hardcoded-string check FAILED (new violations):');
  for (const [loc, msg] of newViolations) console.error(`  ${loc}: ${msg}`);
  console.error('Fix the strings or (if pre-existing) run: bun run i18n:baseline');
  process.exit(1);
}
console.log(`Hardcoded-string check OK (${baseline.size} baseline, ${found.size} total)`);
