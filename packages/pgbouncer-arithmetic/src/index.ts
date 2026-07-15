/**
 * @neetru/coredb-pgbouncer-arithmetic
 *
 * Aritmetica pura de dimensionamento do pool do PgBouncer. Uma VM Postgres
 * densa hospeda N bancos logicos atras de um unico PgBouncer; `max_connections`
 * e um teto rigido. Este pacote deriva o dimensionamento do PgBouncer a partir
 * de `max_connections` e da contagem viva de bancos, e protege a invariante
 * critica de autoscaling `sdkPoolMax * maxInstances <= defaultPoolSize`.
 *
 * Funcao pura, deterministica, zero dependencias de runtime. Fecha o teto de
 * conexoes (P0-4).
 */

export { computePoolSizing, assertConnectionInvariant } from './sizing.js';
export type { PoolSizing } from './types.js';
