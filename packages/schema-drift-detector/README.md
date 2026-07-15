# @neetru/schema-drift-detector

Detector de **deriva de schema** do Neetru Core DB. Compara o schema **vivo** de
um banco de produto com o schema **esperado** pelo ORM e aponta exatamente o que
divergiu.

## Por que existe

O Neetru Core opera bancos de produto. Em incidente, um operador pode usar o
acesso **break-glass** para alterar o schema de produção à mão — adicionar uma
coluna, mudar um tipo, derrubar um `NOT NULL`. Essa mudança é invisível ao ORM:
o código continua esperando o schema antigo, e a divergência fica silenciosa até
quebrar em runtime ou virar um buraco de dados.

Este pacote é a defesa: tira um **snapshot** do schema vivo, compara com o que o
ORM espera, e devolve um relatório determinístico de deriva. Roda como check
periódico — se algo mudou fora do fluxo de migração, aparece aqui.

## O que faz

Função pura, isomórfica, **zero dependências de runtime** (`node:crypto` é
builtin). Não faz I/O — você passa os dois snapshots já coletados.

## Princípio fail-safe

A decisão de segurança cravada: **deriva desconhecida conta como deriva.** Um
spec de coluna malformado — não é objeto, `dataType` não é string, `nullable`
não é boolean — nunca resolve para "sem deriva". Uma coluna assim, presente nos
dois lados, vai para `changed`. Nunca se deixa um spec que não dá para comparar
passar como idêntico.

## API

```ts
import {
  computeSchemaFingerprint,
  detectSchemaDrift,
  type ColumnSpec,
  type SchemaSnapshot,
  type DriftReport,
} from '@neetru/schema-drift-detector';

const expected: SchemaSnapshot = {
  'users.id':    { dataType: 'uuid', nullable: false },
  'users.email': { dataType: 'text', nullable: false },
};

const live: SchemaSnapshot = {
  'users.id':       { dataType: 'uuid', nullable: false },
  'users.email':    { dataType: 'text', nullable: true },   // alterada a mao
  'users.api_key':  { dataType: 'text', nullable: true },   // adicionada a mao
};

const report = detectSchemaDrift({ expected, live });
// {
//   drifted: true,
//   added:   ['users.api_key'],
//   removed: [],
//   changed: [{ column: 'users.email', expected: {...}, live: {...} }],
// }

computeSchemaFingerprint(expected);
// 'a3f1...'  — SHA-256 hex, deterministico, independente de ordem de chaves
```

### `ColumnSpec` / `SchemaSnapshot`

```ts
interface ColumnSpec {
  dataType: string;
  nullable: boolean;
}
// Snapshot — chave 'table.column', valor a spec da coluna.
type SchemaSnapshot = Record<string, ColumnSpec>;
```

### `computeSchemaFingerprint(snapshot)`

Hash **determinístico** do schema. Não depende da ordem de inserção das chaves
nem do SO. Útil para detectar deriva barata (comparar dois hashes) e para gravar
um carimbo de schema no audit.

- Algoritmo: ordena as chaves próprias lexicograficamente; para cada chave monta
  uma linha canônica `chave|dataType|nullable`; junta com `\n`; SHA-256 hex.
- Snapshot vazio → hash da string vazia (estável).
- Spec malformado → ainda produz algo determinístico (coage via `String(...)`),
  nunca lança.

### `detectSchemaDrift({ expected, live })`

Devolve um `DriftReport`:

- `added` — colunas no `live`, ausentes no `expected` (ordenado).
- `removed` — colunas no `expected`, ausentes no `live` (ordenado).
- `changed` — colunas nos dois lados cujo `ColumnSpec` difere — `dataType` ou
  `nullable` — ou cujo spec é malformado em qualquer lado (ordenado por
  `column`).
- `drifted` — `true` se qualquer um dos três tem entrada.

Função **pura** — não muta as entradas, sem I/O, determinística. `expected` ou
`live` `null`/`undefined` são tratados como snapshot vazio. Checagens de
presença usam `Object.prototype.hasOwnProperty.call` — chaves de protótipo como
`__proto__` ou `constructor` são tratadas como colunas normais.

## Estado

Implementado (M0). Suíte vitest cobrindo determinismo do fingerprint,
add/remove/change, ordenação, fail-safe de spec malformado, defesa de chave de
protótipo e pureza.
