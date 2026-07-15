import { createHash } from 'node:crypto';
import type { SchemaSnapshot } from './types.js';

/**
 * Computa um fingerprint deterministico de um snapshot de schema.
 *
 * O hash NAO depende da ordem de insercao das chaves nem do SO. Util para
 * detectar deriva barata (comparar dois hashes) e para carimbar o schema no
 * audit.
 *
 * Algoritmo:
 *  1. Coleta as chaves proprias (`Object.keys`) e ordena lexicograficamente.
 *  2. Para cada chave monta uma linha canonica `chave|dataType|nullable`,
 *     coagindo via `String(...)` defensivamente — um spec malformado nao lanca,
 *     so produz uma linha estavel diferente.
 *  3. Junta as linhas com `\n` e devolve o SHA-256 hex.
 *
 * Snapshot vazio → hash da string vazia (estavel, deterministico).
 *
 * Funcao pura, deterministica: mesmo snapshot (qualquer ordem de chaves) →
 * mesmo hash.
 */
export function computeSchemaFingerprint(snapshot: SchemaSnapshot): string {
  const source: SchemaSnapshot =
    snapshot && typeof snapshot === 'object'
      ? snapshot
      : ({} as SchemaSnapshot);

  const keys = Object.keys(source).sort();

  const lines = keys.map((key) => {
    const spec = (source as Record<string, unknown>)[key];
    const dataType =
      spec && typeof spec === 'object'
        ? String((spec as Record<string, unknown>).dataType)
        : String(undefined);
    const nullable =
      spec && typeof spec === 'object'
        ? String(Boolean((spec as Record<string, unknown>).nullable))
        : String(Boolean(undefined));
    return `${key}|${dataType}|${nullable}`;
  });

  return createHash('sha256').update(lines.join('\n')).digest('hex');
}
