/**
 * Nucleo do `@neetru/pii-mask`.
 *
 * Mascara dados pessoais (PII) num result set, no servidor, antes de a UI staff
 * do visualizador de banco em producao ve-los. Salvaguarda LGPD.
 *
 * FAIL-CLOSED em duas camadas:
 *  1. Uma coluna AUSENTE do mapa de politicas e tratada como `'generic'` —
 *     uma coluna nao classificada nunca pode vazar.
 *  2. Dentro de uma politica tipada (`email`/`cpf`/`phone`/`card`), um valor
 *     que nao e string ou nao casa com a forma esperada cai pra mascaramento
 *     `'generic'` — nunca se deixa passar um valor que nao parseou.
 *
 * `maskResultSet` e PURA: nao muta o array de entrada nem os objetos linha.
 */
import type { MaskOptions, MaskedResultSet } from './types.js';
/**
 * Mascara um result set inteiro, coluna a coluna (com recursao aninhada),
 * segundo o mapa de politicas por dot-path.
 *
 * Funcao PURA — devolve linhas novas, sem mutar a entrada.
 *
 * Profundidade de mascaramento:
 *  - Top-level: politica declarada pelo nome da coluna (`email`, `cpf`, …).
 *  - Aninhado: politica declarada pelo dot-path (`address.cpf`,
 *    `contacts.*.phone`). Um campo ausente do mapa em QUALQUER nivel cai
 *    para `'generic'` (fail-closed).
 *
 * @param rows  As linhas vindas do banco.
 * @param opts  O mapa coluna/dot-path → politica. Ausente = `'generic'`.
 * @returns     As linhas mascaradas e a lista de paths mascarados.
 */
export declare function maskResultSet(rows: Record<string, unknown>[], opts: MaskOptions): MaskedResultSet;
