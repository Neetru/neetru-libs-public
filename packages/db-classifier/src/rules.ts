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
export type RuleKey =
  | 'CREATE_TABLE'
  | 'CREATE_TYPE'
  | 'CREATE_SCHEMA'
  | 'CREATE_SEQUENCE'
  | 'CREATE_DOMAIN'
  | 'ADD_COLUMN_NULLABLE'
  | 'ADD_COLUMN_NOT_NULL_WITH_DEFAULT'
  | 'ADD_CONSTRAINT'
  | 'CREATE_INDEX_CONCURRENTLY'
  | 'CREATE_INDEX'
  | 'DROP_COLUMN'
  | 'DROP_TABLE'
  | 'ALTER_COLUMN_TYPE'
  | 'ADD_COLUMN_NOT_NULL_WITHOUT_DEFAULT'
  | 'RENAME_COLUMN'
  | 'DROP_CONSTRAINT'
  | 'UNKNOWN';

/**
 * Mapa congelado chave de regra → severidade. NÃO editar sem revisão de
 * segurança: o CLI e o Core dependem desta tabela ser idêntica nos dois lados.
 */
export const STATEMENT_RULES: Readonly<Record<RuleKey, StatementSeverity>> =
  Object.freeze({
    CREATE_TABLE: 'aditiva',
    // CREATE de objeto nomeado NOVO — sem impacto em dados existentes, igual
    // CREATE TABLE (bug_59ee92b8). drizzle-kit emite CREATE TYPE ... AS ENUM
    // pra enums. VIEW/FUNCTION/EXTENSION/MAT-VIEW ficam de fora de proposito
    // (scripts de install / corpos de funcao sao codigo arbitrario).
    CREATE_TYPE: 'aditiva',
    CREATE_SCHEMA: 'aditiva',
    CREATE_SEQUENCE: 'aditiva',
    CREATE_DOMAIN: 'aditiva',
    ADD_COLUMN_NULLABLE: 'aditiva',
    ADD_COLUMN_NOT_NULL_WITH_DEFAULT: 'aditiva',
    // ADD CONSTRAINT (FK/CHECK/UNIQUE/PK) — estrutural, sem perda de dados.
    // ON DELETE/UPDATE são comportamento referencial futuro (bug_0e89270321).
    ADD_CONSTRAINT: 'aditiva',
    CREATE_INDEX_CONCURRENTLY: 'aditiva',
    CREATE_INDEX: 'aditiva',
    DROP_COLUMN: 'destrutiva',
    DROP_TABLE: 'destrutiva',
    ALTER_COLUMN_TYPE: 'destrutiva',
    ADD_COLUMN_NOT_NULL_WITHOUT_DEFAULT: 'destrutiva',
    RENAME_COLUMN: 'destrutiva',
    DROP_CONSTRAINT: 'destrutiva',
    UNKNOWN: 'destrutiva',
  } as const);
