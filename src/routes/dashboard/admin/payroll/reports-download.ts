export type PayrollExportEncoding = 'identity' | 'base64';

export function decodePayrollExport(content: string, encoding: PayrollExportEncoding) {
  if (encoding === 'identity') return new TextEncoder().encode(content);
  return Uint8Array.from(atob(content), (character) => character.charCodeAt(0));
}
