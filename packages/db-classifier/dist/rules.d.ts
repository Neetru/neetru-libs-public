/**
 * Tabela de regras CONGELADA do classificador de migração SQL.
 *
 * Esta é a fonte única de verdade da severidade. Cada chave é um padrão
 * canônico de statement DDL; o valor é a severidade que o Neetru Core DB
 * atribui a ele.
 *
 * REGRA SAGRADA — fail-closed: `UNKNOWN` é SEMPRE `destrutiva`. Qualquer
 * statement que o classificador não consiga mapear com confiança a uma das
 * outras chaves cai em `UNKNOWN`. Nunca relaxar isso.
 */
export type StatementSeverity = 'aditiva' | 'destrutiva';
/**
 * Chaves de regra reconhecidas pelo classificador.
 */
export type RuleKey = 'CREATE_TABLE' | 'CREATE_TYPE' | 'CREATE_SCHEMA' | 'CREATE_SEQUENCE' | 'CREATE_DOMAIN' | 'ADD_COLUMN_NULLABLE' | 'ADD_COLUMN_NOT_NULL_WITH_DEFAULT' | 'ADD_CONSTRAINT' | 'CREATE_INDEX_CONCURRENTLY' | 'CREATE_INDEX' | 'DROP_COLUMN' | 'DROP_TABLE' | 'ALTER_COLUMN_TYPE' | 'ADD_COLUMN_NOT_NULL_WITHOUT_DEFAULT' | 'RENAME_COLUMN' | 'DROP_CONSTRAINT' | 'UNKNOWN';
/**
 * Mapa congelado chave de regra → severidade. NÃO editar sem revisão de
 * segurança: o CLI e o Core dependem desta tabela ser idêntica nos dois lados.
 */
export declare const STATEMENT_RULES: Readonly<Record<RuleKey, StatementSeverity>>;
