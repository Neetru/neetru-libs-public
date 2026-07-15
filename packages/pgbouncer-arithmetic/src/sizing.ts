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
 * Conexoes que NUNCA pertencem aos pools dos produtos: superusuario,
 * monitoring, sondas (probes) do agente. Subtraidas do teto antes do rateio.
 */
const RESERVED_CONNECTIONS = 8;

/**
 * Teto fixo de conexoes de CLIENTE que o PgBouncer aceita. Conexoes de cliente
 * sao baratas (nao consomem conexao de servidor enquanto ociosas no pooling
 * em modo transaction), por isso o valor e generoso e constante.
 */
const MAX_CLIENT_CONN = 500;

/** Default de `max_connections` quando o chamador nao informa um valor. */
const DEFAULT_MAX_CONNECTIONS = 100;

/**
 * Teto sano para a contagem de bancos numa VM. Acima disso a entrada e
 * quase certamente lixo (nenhuma VM Postgres hospeda 10 mil bancos logicos
 * atras de um unico PgBouncer) — melhor falhar alto do que dimensionar.
 */
const MAX_N_BANCOS = 10000;

/**
 * Valida e saneia `maxConnections`.
 *
 * - `undefined` → default 100.
 * - Numero finito >= 1 → aceito. Fracionario sofre `Math.floor` (um
 *   `max_connections` fracionario nao faz sentido; truncar e inofensivo e
 *   leniente). Um inteiro pequeno legitimo (ex.: 20) e aceito — e um Postgres
 *   pequeno, nao lixo.
 * - Qualquer outra coisa (NaN, Infinity, negativo, zero, nao-numero) →
 *   LANCA. Uma config de Postgres lixo nunca passa silenciosa (fail-loud).
 *
 * @throws {Error} se `maxConnections` for fornecido e nao for finito ou < 1.
 */
function sanitizeMaxConnections(maxConnections: number | undefined): number {
  if (maxConnections === undefined) {
    return DEFAULT_MAX_CONNECTIONS;
  }
  if (typeof maxConnections !== 'number' || !Number.isFinite(maxConnections) || maxConnections < 1) {
    throw new Error(
      `computePoolSizing: maxConnections invalido — precisa ser um numero finito >= 1 ` +
        `(o max_connections real do Postgres), recebeu ${String(maxConnections)}.`,
    );
  }
  return Math.floor(maxConnections);
}

/**
 * Valida `nBancos`. NAO ha fallback: dimensionar um pool de conexao sem a
 * contagem real de bancos e fail-OPEN — cair para 1 produz o MAIOR pool por
 * banco e, se a VM hospeda muitos bancos, o total estoura o `max_connections`
 * do Postgres. Por isso uma contagem lixo LANCA.
 *
 * `nBancos` precisa ser um inteiro finito no intervalo `1 <= nBancos <= 10000`.
 *
 * @throws {Error} se `nBancos` nao for um inteiro positivo no intervalo sano.
 */
function validateNBancos(nBancos: number): number {
  if (
    typeof nBancos !== 'number' ||
    !Number.isInteger(nBancos) ||
    nBancos < 1 ||
    nBancos > MAX_N_BANCOS
  ) {
    throw new Error(
      `computePoolSizing: nBancos invalido — precisa ser um inteiro 1..${MAX_N_BANCOS} ` +
        `(a contagem real de bancos na VM); nao da pra dimensionar um pool sem a ` +
        `contagem real, recebeu ${String(nBancos)}.`,
    );
  }
  return nBancos;
}

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
export function computePoolSizing(
  nBancos: number,
  maxConnections?: number,
): PoolSizing {
  const safeMaxConn = sanitizeMaxConnections(maxConnections);
  const safeNBancos = validateNBancos(nBancos);

  // `usable` = conexoes disponiveis para os pools dos produtos, depois de
  // tirar as reservadas. O `Math.max` com `safeNBancos` garante ao menos 1
  // conexao por banco mesmo numa VM minuscula (floor(usable/nBancos) >= 1).
  const usable = Math.max(safeMaxConn - RESERVED_CONNECTIONS, safeNBancos);

  // `floor(usable / nBancos)` garante a propriedade central de seguranca:
  //   nBancos * defaultPoolSize <= usable
  // ou seja, a soma das conexoes reais ao Postgres NUNCA estoura o teto.
  //
  // EDGE DE OVER-DENSIDADE: o `Math.max(2, ...)` impoe um floor de viabilidade
  // — um pool com tamanho 1 e inutil. Quando ha bancos demais numa VM pequena,
  // `floor(usable/nBancos)` pode dar 0 ou 1 e o floor-de-2 entra. Nesse caso
  // `nBancos * 2` PODE exceder `usable` — a propriedade de seguranca e
  // ROMPIDA. Isso NAO e silenciado por capricho: e o sinal de uma VM
  // genuinamente over-densa. A correcao real e operacional — hospedar menos
  // bancos ou subir para uma VM maior (mais `max_connections`). `computePoolSizing`
  // ainda devolve `defaultPoolSize: 2` (o minimo viavel) porque um pool menor
  // que 2 nao funciona; mas o valor NAO finge ser seguro nessa regiao. O
  // chamador que opera VMs densas deve cruzar `nBancos * 2 <= usable` e alertar.
  const defaultPoolSize = Math.max(2, Math.floor(usable / safeNBancos));

  // Folga de burst — um quarto do pool base, no minimo 1.
  const reservePoolSize = Math.max(1, Math.floor(defaultPoolSize / 4));

  return {
    defaultPoolSize,
    reservePoolSize,
    maxClientConn: MAX_CLIENT_CONN,
  };
}

/** Verdadeiro sse `n` e um inteiro finito estritamente positivo. */
function isPositiveInteger(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n > 0;
}

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
export function assertConnectionInvariant(input: {
  sdkPoolMax: number;
  maxInstances: number;
  defaultPoolSize: number;
}): void {
  const { sdkPoolMax, maxInstances, defaultPoolSize } = input;

  if (!isPositiveInteger(sdkPoolMax)) {
    throw new Error(
      `assertConnectionInvariant: sdkPoolMax deve ser um inteiro positivo, recebeu ${String(sdkPoolMax)}.`,
    );
  }
  if (!isPositiveInteger(maxInstances)) {
    throw new Error(
      `assertConnectionInvariant: maxInstances deve ser um inteiro positivo, recebeu ${String(maxInstances)}.`,
    );
  }
  if (!isPositiveInteger(defaultPoolSize)) {
    throw new Error(
      `assertConnectionInvariant: defaultPoolSize deve ser um inteiro positivo, recebeu ${String(defaultPoolSize)}.`,
    );
  }

  const demanded = sdkPoolMax * maxInstances;
  if (demanded > defaultPoolSize) {
    throw new Error(
      `Invariante de conexao violada: sdkPoolMax (${sdkPoolMax}) x maxInstances ` +
        `(${maxInstances}) = ${demanded}, que excede defaultPoolSize (${defaultPoolSize}). ` +
        `Sob autoscaling esse produto satura o pool do PgBouncer e conexoes vao ` +
        `falhar. Corrija de uma destas formas: reduza pg.Pool.max (sdkPoolMax), ` +
        `reduza o maxInstances do Cloud Run, ou aumente o default_pool_size ` +
        `hospedando menos bancos na VM / usando uma VM maior (mais max_connections).`,
    );
  }
}
