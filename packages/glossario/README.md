# neetru-glossario

O **vocabulário plain PT-BR do ecossistema Neetru como código**. É a fonte única
de verdade da terminologia: importado pelo `@neetru/cli` e pelo Neetru Core, e a
base do **lint anti-jargão**.

## Por que existe

A UI staff do Core fala **português brasileiro claro**. Jargão estrangeiro
(`tenant`, `workspace`, `provisioning`, `entitlement`, `tier`…) é ruído
cognitivo — o owner opera sozinho e parte do vocabulário não é técnica.

Um arquivo `.md` de glossário **apodrece**: ninguém o atualiza, ninguém o lê na
hora certa. Um módulo **tipado** força a tradução a ficar correta — se o CLI e o
Core divergirem, o build quebra. Por isso o glossário é código, não documento.

## O que faz

Expõe um `Record` congelado de traduções (jargão → PT-BR), o mapa de estados de
banco por produto, o conjunto de termos técnicos isentos do lint, e helpers
puros para rotular engines de banco. **Zero dependências de runtime**,
isomórfico, determinístico.

## API

```ts
import {
  VOCABULARY,
  DB_STATE,
  ALLOWED_FOREIGN,
  humanize,
  engineLabel,
  engineSeal,
} from 'neetru-glossario';
```

### `VOCABULARY: Readonly<Record<string, string>>`

Mapa congelado jargão estrangeiro → tradução plain PT-BR. Chaves em minúsculas.

| Termo | PT-BR |
|---|---|
| `tenant` | Ambiente |
| `workspace` | Ambiente do produto |
| `provisioning` | Configurando |
| `entitlement` | Permissão |
| `tier` | Tamanho |
| `subscription` | Assinatura |
| `deployment` | Lançamento |
| `deploy` | Lançamento |
| `provider` | Fornecedor |
| `customer` | Cliente |
| `staff` | Equipe |
| `account` | Conta |
| `organization` | Empresa |
| `resource` | Recurso |
| `dunning` | Cobrança em atraso |

### `DB_STATE: Readonly<Record<string, string>>`

Mapa congelado de estados de `product_databases` (status do banco por produto) →
rótulo PT-BR.

| Status | PT-BR |
|---|---|
| `requested` | Solicitado |
| `provisioning` | Configurando |
| `active` | Ativo |
| `degraded` | Degradado |
| `failed` | Falhou |
| `archived` | Arquivado |
| `pending_manual_provisioning` | Aguardando configuração manual |

### `ALLOWED_FOREIGN: ReadonlySet<string>`

Conjunto de termos técnicos e nomes próprios em minúsculas que o lint
anti-jargão **NÃO deve sinalizar** — siglas, protocolos e produtos sem tradução
PT-BR razoável (`api`, `json`, `sql`, `postgres`, `cloud run`, `cron`…).

`tenant`, `workspace` e `entitlement` **não** estão aqui: são jargão a traduzir,
não termo isento.

### `humanize(term: string): string`

Traduz um termo do `VOCABULARY` para plain PT-BR. Busca **case-insensitive**
(`'Workspace'` e `'DEPLOY'` encontram a entrada). Termo desconhecido →
devolvido **inalterado** (sem lançar, sem minuscular). Defensivo: entrada
não-string é coagida — nunca lança.

```ts
humanize('tenant');      // 'Ambiente'
humanize('Workspace');   // 'Ambiente do produto'
humanize('DEPLOY');      // 'Lançamento'
humanize('frobnicate');  // 'frobnicate' (inalterado)
```

### `engineLabel(engine: string): string`

Mapeia um `DatabaseEngine` para um rótulo plain PT-BR. Engine desconhecido →
entrada inalterada.

| Engine | Rótulo |
|---|---|
| `vm-postgres-single`, `vm-postgres-cluster` | Postgres |
| `vm-mysql-single`, `vm-mysql-cluster` | MySQL |
| `cloud-sql-postgres` | Postgres (gerenciado) |
| `cloud-sql-mysql` | MySQL (gerenciado) |
| `firestore-instance` | Documentos |

### `engineSeal(engine: string): string`

Selo curto de qualificação de um engine de banco.

| Engine | Selo |
|---|---|
| `vm-*` | Econômico |
| `cloud-sql-*` | Gerenciado |
| `firestore-instance` | Padrão |
| desconhecido | `""` |

## Estado

Implementado. Suíte vitest cobrindo as traduções cravadas, imutabilidade dos
mapas congelados, busca case-insensitive, fallback defensivo de `humanize`,
rótulos e selos de engine, e determinismo.
