/**
 * Aritmetica de dimensionamento do pool do PgBouncer.
 *
 * Uma VM Postgres densa hospeda N bancos logicos atras de um unico PgBouncer.
 * `max_connections` do Postgres e um teto rigido. Se os tamanhos de pool sao
 * cravados na mao, o 5o-10o produto satura o teto e conexoes comecam a falhar.
 * Este modulo deriva o dimensionamento do PgBouncer a partir de
 * `max_connections` e da contagem viva de bancos, e protege a invariante
 * critica de autoscaling.
 */
import type { PoolSizing } from './types.js';
/**
 * Dimensiona o pool do PgBouncer para uma VM Postgres densa.
 *
 * @param nBancos        Contagem viva real de bancos logicos na VM. Precisa
 *                       ser um inteiro 1..10000; lixo LANCA (nao ha fallback —
 *                       cair para 1 seria fail-open e poderia estourar o teto).
 * @param maxConnections `max_connections` do Postgres da VM. Default 100 se
 *                       omitido; lixo (NaN/Infinity/<1) LANCA; fracionario
 *                       sofre `Math.floor`.
 * @returns Dimensionamento puro e deterministico do pool.
 * @throws {Error} se `nBancos` ou `maxConnections` forem invalidos.
 */
export declare function computePoolSizing(nBancos: number, maxConnections?: number): PoolSizing;
/**
 * Protege a invariante critica de autoscaling:
 *
 *   sdkPoolMax * maxInstances <= defaultPoolSize
 *
 * Cada instancia do Cloud Run roda um `pg.Pool` com ate `sdkPoolMax` conexoes.
 * Sob autoscaling ate `maxInstances` instancias podem subir ao mesmo tempo. O
 * total de conexoes que o produto pode demandar do PgBouncer e
 * `sdkPoolMax * maxInstances`, e isso NAO pode exceder `default_pool_size`, ou
 * o produto satura o pool e conexoes comecam a falhar.
 *
 * FAIL-CLOSED: qualquer um dos tres valores que nao seja inteiro positivo
 * finito faz LANCAR — uma entrada lixo nunca passa silenciosa.
 *
 * @throws {Error} se algum input for invalido, ou se a invariante for violada.
 */
export declare function assertConnectionInvariant(input: {
    sdkPoolMax: number;
    maxInstances: number;
    defaultPoolSize: number;
}): void;
