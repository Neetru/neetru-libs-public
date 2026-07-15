# @neetru/coredb-pgbouncer-arithmetic

Aritmética pura de **dimensionamento do pool do PgBouncer** para as VMs
Postgres densas do Neetru Core DB. Função pura, determinística,
**zero dependências de runtime**.

## O problema — o teto de conexões (P0-4)

Uma VM Postgres densa hospeda **N bancos logicos** atrás de um único PgBouncer.
O `max_connections` do Postgres é um **teto rígido**: se o servidor recebe mais
conexões que isso, elas começam a **falhar**.

Se os tamanhos de pool do PgBouncer são cravados na mão, o problema é silencioso
até crescer: o 1º, 2º, 3º produto cabem; o **5º–10º produto satura o teto** e a
partir daí qualquer conexão nova falha — para todos os bancos da VM, não só o
último.

Este pacote remove o número mágico. Ele **deriva** o dimensionamento do
PgBouncer a partir de duas grandezas reais — `max_connections` da VM e a
**contagem viva de bancos** — de modo que a soma das conexões reais ao Postgres
nunca estoure o teto.

## API

```ts
import {
  computePoolSizing,
  assertConnectionInvariant,
  type PoolSizing,
} from '@neetru/coredb-pgbouncer-arithmetic';
```

### `computePoolSizing(nBancos, maxConnections?): PoolSizing`

Dimensiona o pool do PgBouncer para uma VM.

```ts
computePoolSizing(4);        // 4 bancos, max_connections default 100
// { defaultPoolSize: 23, reservePoolSize: 5, maxClientConn: 500 }

computePoolSizing(10, 100);  // 10 bancos
// { defaultPoolSize: 9, reservePoolSize: 2, maxClientConn: 500 }
```

| Campo | Significado |
|---|---|
| `defaultPoolSize` | `default_pool_size` — conexões de **servidor** por banco. |
| `reservePoolSize` | `reserve_pool_size` — folga de burst (¼ do `defaultPoolSize`). |
| `maxClientConn` | `max_client_conn` — conexões de **cliente** aceitas. Fixo em `500`. |

A derivação:

- `RESERVED_CONNECTIONS = 8` — superusuário + monitoring + sondas do agente,
  tiradas do teto antes do rateio.
- `usable = max(maxConnections - 8, nBancos)` — conexões disponíveis para os
  pools dos produtos; nunca menos de 1 por banco.
- `defaultPoolSize = max(2, floor(usable / nBancos))` — o `floor` garante a
  **propriedade central de segurança**:

  ```
  nBancos × defaultPoolSize ≤ usable
  ```

  ou seja, a soma das conexões reais ao Postgres nunca estoura o teto. O
  `max(2, …)` é um **floor de viabilidade** — um pool de tamanho 1 é inútil.
- `reservePoolSize = max(1, floor(defaultPoolSize / 4))`.
- `maxClientConn = 500`.

**Sanitização (fail-safe):**

- `maxConnections` — não-finito / `< 1` / ausente → cai para `100`.
- `nBancos` — coagido a inteiro positivo (`floor`); NaN / `Infinity` / `≤ 0`
  caem para `1`. O chamador **deve** passar a contagem viva real — o fallback
  para 1 é a última linha de defesa contra lixo, não algo em que se apoiar.

**Edge de over-densidade:** quando há bancos demais numa VM pequena,
`floor(usable / nBancos)` pode dar 0 ou 1 e o **floor-de-2** entra. Nessa
região `nBancos × 2` *pode* exceder `usable` — a propriedade de segurança é
rompida. Isso não é um bug do cálculo: é o **sinal de uma VM genuinamente
over-densa**. `computePoolSizing` ainda devolve `defaultPoolSize: 2` (o mínimo
viável — um pool menor não funciona), mas o valor **não finge ser seguro**
nessa região. A correção é operacional: hospedar menos bancos ou usar uma VM
maior (mais `max_connections`). O chamador que opera VMs densas deve cruzar
`nBancos × 2 ≤ usable` e alertar. `computePoolSizing` **não lança** — é
aritmética pura.

### `assertConnectionInvariant({ sdkPoolMax, maxInstances, defaultPoolSize }): void`

Protege a invariante crítica de **autoscaling**:

```
sdkPoolMax × maxInstances ≤ defaultPoolSize
```

Cada instância do Cloud Run roda um `pg.Pool` com até `sdkPoolMax` conexões.
Sob autoscaling até `maxInstances` instâncias sobem ao mesmo tempo. O total que
o produto pode demandar do PgBouncer é `sdkPoolMax × maxInstances` — e isso não
pode exceder o `default_pool_size`, ou o produto satura o pool e as conexões
falham.

```ts
assertConnectionInvariant({ sdkPoolMax: 2, maxInstances: 4, defaultPoolSize: 8 });
// ok — 2 × 4 = 8 ≤ 8

assertConnectionInvariant({ sdkPoolMax: 2, maxInstances: 5, defaultPoolSize: 8 });
// throws — 2 × 5 = 10 > 8
```

**Fail-closed:** qualquer um dos três valores que não seja inteiro positivo
finito **lança** — uma entrada lixo nunca passa silenciosa. Se a invariante for
violada, o erro nomeia os três números e diz o que fazer: reduzir `pg.Pool.max`,
reduzir o `maxInstances` do Cloud Run, ou aumentar o `default_pool_size`
hospedando menos bancos / usando uma VM maior.

## Estado

Implementado (M0 — P0-4). Suíte vitest cobrindo a derivação default, a
propriedade de segurança no regime normal, a região do floor-de-2, sanitização
de ambos os argumentos, determinismo e a invariante de autoscaling fail-closed.
