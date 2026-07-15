import type { ColumnSpec, DriftReport, SchemaSnapshot } from './types.js';

/** Acesso seguro a uma propriedade propria — ignora chaves do prototipo. */
function ownKeys(snapshot: SchemaSnapshot | null | undefined): string[] {
  if (!snapshot || typeof snapshot !== 'object') return [];
  return Object.keys(snapshot);
}

/** `true` quando uma chave esta como propriedade propria do snapshot. */
function has(
  snapshot: SchemaSnapshot | null | undefined,
  key: string,
): boolean {
  if (!snapshot || typeof snapshot !== 'object') return false;
  return Object.prototype.hasOwnProperty.call(snapshot, key);
}

/** Le uma spec como propriedade propria, sem cair no prototipo. */
function getSpec(
  snapshot: SchemaSnapshot,
  key: string,
): unknown {
  return (snapshot as Record<string, unknown>)[key];
}

/**
 * Um spec e bem-formado quando e um objeto com `dataType` string e `nullable`
 * boolean. Qualquer outra coisa e malformada — e malformado conta como deriva.
 */
function isWellFormedSpec(spec: unknown): spec is ColumnSpec {
  return (
    typeof spec === 'object' &&
    spec !== null &&
    typeof (spec as Record<string, unknown>).dataType === 'string' &&
    typeof (spec as Record<string, unknown>).nullable === 'boolean'
  );
}

/**
 * Detecta deriva de schema entre o schema esperado pelo ORM e o schema vivo do
 * banco.
 *
 * - `added` — colunas no `live`, ausentes no `expected`.
 * - `removed` — colunas no `expected`, ausentes no `live`.
 * - `changed` — colunas nos dois lados cuja `ColumnSpec` difere (`dataType` ou
 *   `nullable`), OU cuja spec e malformada em qualquer lado.
 *
 * Fail-safe: deriva desconhecida conta como deriva. Um spec malformado — nao e
 * objeto, `dataType` nao string, `nullable` nao boolean — nunca resolve para
 * "sem deriva"; a coluna vai para `changed`.
 *
 * Funcao pura: nao muta as entradas, sem I/O, deterministica. `expected` ou
 * `live` `null`/`undefined` sao tratados como snapshot vazio. Presenca checada
 * com `Object.prototype.hasOwnProperty.call` — chaves de prototipo sao tratadas
 * como colunas normais.
 */
export function detectSchemaDrift(input: {
  expected: SchemaSnapshot;
  live: SchemaSnapshot;
}): DriftReport {
  const expected: SchemaSnapshot =
    input && input.expected && typeof input.expected === 'object'
      ? input.expected
      : ({} as SchemaSnapshot);
  const live: SchemaSnapshot =
    input && input.live && typeof input.live === 'object'
      ? input.live
      : ({} as SchemaSnapshot);

  const added: string[] = [];
  const removed: string[] = [];
  const changed: Array<{
    column: string;
    expected: ColumnSpec;
    live: ColumnSpec;
  }> = [];

  for (const key of ownKeys(live)) {
    if (!has(expected, key)) {
      added.push(key);
    }
  }

  for (const key of ownKeys(expected)) {
    if (!has(live, key)) {
      removed.push(key);
      continue;
    }

    // Coluna presente nos dois lados — compara as specs.
    const expectedSpec = getSpec(expected, key);
    const liveSpec = getSpec(live, key);

    const expectedOk = isWellFormedSpec(expectedSpec);
    const liveOk = isWellFormedSpec(liveSpec);

    let isChanged: boolean;
    if (!expectedOk || !liveOk) {
      // Fail-safe: spec malformado em qualquer lado conta como deriva.
      // Nunca resolve para "sem deriva".
      isChanged = true;
    } else {
      isChanged =
        expectedSpec.dataType !== liveSpec.dataType ||
        expectedSpec.nullable !== liveSpec.nullable;
    }

    if (isChanged) {
      // Devolve copias defensivas das specs para nao vazar referencias
      // das entradas e para que o relatorio seja inerte.
      changed.push({
        column: key,
        expected: normalizeSpec(expectedSpec),
        live: normalizeSpec(liveSpec),
      });
    }
  }

  added.sort();
  removed.sort();
  changed.sort((a, b) => (a.column < b.column ? -1 : a.column > b.column ? 1 : 0));

  return {
    drifted: added.length > 0 || removed.length > 0 || changed.length > 0,
    added,
    removed,
    changed,
  };
}

/**
 * Normaliza uma spec (possivelmente malformada) num `ColumnSpec` inerte para o
 * relatorio. Spec bem-formado e copiado; spec malformado vira uma copia
 * coagida — `dataType` via `String`, `nullable` via `Boolean` — para que o
 * relatorio seja util e nunca exponha valores crus inesperados.
 */
function normalizeSpec(spec: unknown): ColumnSpec {
  if (isWellFormedSpec(spec)) {
    return { dataType: spec.dataType, nullable: spec.nullable };
  }
  if (spec && typeof spec === 'object') {
    const rec = spec as Record<string, unknown>;
    return {
      dataType: String(rec.dataType),
      nullable: Boolean(rec.nullable),
    };
  }
  return { dataType: String(spec), nullable: Boolean(spec) };
}
