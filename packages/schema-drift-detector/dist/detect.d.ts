import type { DriftReport, SchemaSnapshot } from './types.js';
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
export declare function detectSchemaDrift(input: {
    expected: SchemaSnapshot;
    live: SchemaSnapshot;
}): DriftReport;
