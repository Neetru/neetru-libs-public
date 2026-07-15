/**
 * @neetru/schema-drift-detector
 *
 * Detector de deriva de schema do Neetru Core DB. Compara o schema vivo de um
 * banco de produto com o schema esperado pelo ORM e aponta colunas
 * adicionadas, removidas e alteradas. Pega mudancas silenciosas feitas a mao
 * via break-glass.
 *
 * A decisao de seguranca cravada: FAIL-SAFE. Deriva desconhecida conta como
 * deriva — um spec de coluna malformado nunca resolve para "sem deriva".
 *
 * Funcao pura, deterministica, isomorfica, zero dependencias de runtime
 * (`node:crypto` e builtin).
 */

export { computeSchemaFingerprint } from './fingerprint.js';
export { detectSchemaDrift } from './detect.js';
export type { ColumnSpec, SchemaSnapshot, DriftReport } from './types.js';
