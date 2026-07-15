/**
 * Tipos canonicos do `@neetru/sql-guard`.
 */
/**
 * Veredito da classificacao de um statement SQL.
 */
export interface SqlVerdict {
    /** `true` SOMENTE quando o statement foi provado seguro (read-only). */
    safe: boolean;
    /**
     * Tipo do statement, em minusculas. Ex.: `'select'`, `'explain'`, `'with'`,
     * `'update'`, `'delete'`, `'insert'`, `'copy'`, `'multiple'`, `'unknown'`.
     * `'unknown'` cobre erro de parse e AST nao reconhecido.
     */
    statementType: string;
    /** Motivo em PT-BR — por que recebeu este veredito. */
    reason: string;
    /**
     * Funcoes da blocklist encontradas no statement (minusculas, deduplicadas,
     * ordenadas). Presente apenas quando ha ao menos uma.
     */
    dangerousFunctions?: string[];
}
