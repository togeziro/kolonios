import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Json = Record<string, unknown>;

function flattenKeys(obj: Json, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Json, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

const en = JSON.parse(
  readFileSync(join(process.cwd(), 'src/i18n/locales/en/translation.json'), 'utf8')
) as Json;
const id = JSON.parse(
  readFileSync(join(process.cwd(), 'src/i18n/locales/id/translation.json'), 'utf8')
) as Json;

const enKeys = flattenKeys(en).sort();
const idKeys = flattenKeys(id).sort();

const enOnly = enKeys.filter((k) => !idKeys.includes(k));
const idOnly = idKeys.filter((k) => !enKeys.includes(k));

if (enOnly.length > 0 || idOnly.length > 0) {
  console.error('i18n key parity check FAILED:');
  for (const k of enOnly) console.error(`  EN-only: ${k}`);
  for (const k of idOnly) console.error(`  ID-only: ${k}`);
  console.error('Add every new key to BOTH src/i18n/locales/en and id/translation.json.');
  process.exit(1);
}

console.log(`i18n key parity OK (${enKeys.length} keys in both locales)`);
