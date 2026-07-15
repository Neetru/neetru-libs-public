/**
 * Tipos canonicos do detector de deriva de schema.
 */
/** A especificacao de uma unica coluna do banco. */
export interface ColumnSpec {
    dataType: string;
    nullable: boolean;
}
/**
 * Snapshot de schema — chave 'table.column', valor a spec da coluna.
 *
 * As chaves sao opacas; o detector nao interpreta a estrutura `table.column`,
 * so usa a chave como identificador estavel da coluna.
 */
export type SchemaSnapshot = Record<string, ColumnSpec>;
/** Relatorio de deriva entre o schema esperado e o vivo. */
export interface DriftReport {
    /** `true` se ha qualquer coluna adicionada, removida ou alterada. */
    drifted: boolean;
    /** Colunas presentes no live, ausentes no expected. Ordenado. */
    added: string[];
    /** Colunas presentes no expected, ausentes no live. Ordenado. */
    removed: string[];
    /** Colunas nos dois lados cuja spec difere (ou e malformada). Ordenado por column. */
    changed: Array<{
        column: string;
        expected: ColumnSpec;
        live: ColumnSpec;
    }>;
}
