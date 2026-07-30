---
name: neetru
description: Operar `@neetru/cli` (control plane do Neetru Core via terminal — comando `neetru …`) e `@neetru/sdk` (lib runtime que produtos SaaS Neetru consomem — `createNeetruClient`). Use sempre que o pedido envolver, mesmo de leve — comandos `neetru …`, scaffold/`add` de produto novo, deploy via Core, listar/criar tenants/workspaces/servers/deployments, audit tail, billing summary, DR restore, support tickets via CLI, banco por produto (`neetru db apply`, `neetru db init`), OU código de produto que importa `@neetru/sdk` (qualquer subpath: `/auth /catalog /entitlements /telemetry /usage /support /db /errors /checkout /react /webhooks /notifications /mocks`). Cobre install, login OAuth Device Code, padrões `--json`/`--yes`/`--mfa-token`/`--dry-run`, env vars do SDK, namespaces reais (com signatures corretas), modo dev com mocks automáticos via `NEETRU_ENV=dev`, templates gerados por `neetru add`, e libs de apoio (`@neetru/db-classifier`, `@neetru/sql-guard`, `@neetru/pii-mask`, `neetru-glossario`).
---

# /neetru — CLI control plane + SDK runtime

Dois pacotes publicados no npm, cada um em repo próprio:

- **`@neetru/cli`** — bin `neetru`. Control plane do Core via terminal. ~55 comandos. Repo: `Neetru/neetru-cli`.
- **`@neetru/sdk`** — runtime que produtos SaaS Neetru consomem. `createNeetruClient(...)` + 13 namespaces + subpaths. Universal (browser, Node ≥18, Edge), ESM-first, tree-shakable, sem side effects. Repo: `Neetru/neetru-sdk`.

> **Versões (última verificação 2026-07-23):** CLI `2.26.2` · SDK `3.1.15` · agente Linux `1.6.51` · Core CalVer `2026.07.x`. **Não hardcode** em código — confirme em runtime: `npm view @neetru/cli version`, `npm view @neetru/sdk version`, `neetru servers list` (agente por VM), `/api/health` (`.sha`/`.revision` do Core). Números em texto envelhecem; o header aqui é só "por onde andava".

Libs de apoio publicadas em `Neetru/neetru-libs` (todas `0.1.0`):
- **`@neetru/db-classifier`** — avalia se uma migration SQL é aditiva ou destrutiva. Função pura, parser AST, isomórfica Node.
- **`@neetru/sql-guard`** — classificador read-only + gate de hardening de SQL. Barra tautologia WHERE, impõe LIMIT em SELECTs, fail-closed.
- **`@neetru/pii-mask`** — mascaramento de PII em result-set antes de exibir na UI staff. Salvaguarda LGPD, fail-closed, zero dependências.
- **`neetru-glossario`** — vocabulário plain PT-BR do ecossistema como código. Fonte única de terminologia importada pelo CLI e pelo Core; base do lint anti-jargão.

**Antes de afirmar versão**: rode `npm view @neetru/cli version` / `npm view @neetru/sdk version`. Versões em memória apodrecem.

## Quando essa skill bate

Trigger forte:
- Mensagem cita `neetru <subcomando>`, `@neetru/cli`, `@neetru/sdk`, "scaffold neetru", "deploy neetru", "audit tail", "publish catalog".
- Arquivo aberto importa `@neetru/sdk` (qualquer subpath).
- Tarefa fala em "criar produto SaaS novo" no ecossistema Neetru.
- Pedido menciona `neetru db apply`, `neetru db init`, migration de schema por produto.
- Código usa `@neetru/db-classifier`, `@neetru/sql-guard`, `@neetru/pii-mask`, `neetru-glossario`.

Trigger fraco (mas vale puxar):
- "Como faço login no Core", "rodar comando no Core", "ver últimos audits".

NÃO use quando:
- Chamada REST direta ao Core sem passar pelo CLI/SDK → doc do endpoint (`docs/sistema/ARCHITECTURE.md` / `src/app/api/`).
- Infra GCP crua (`gcloud …`) sem envolver o CLI.

---

# CLI

## Zero-to-working
```bash
npm install -g @neetru/cli        # bin: neetru
neetru bootstrap                  # Node/gcloud/Docker/Firebase + npm ci + gcloud ADC
neetru login                      # OAuth Device Code Flow (RFC 8628) — abre browser
neetru whoami                     # confirma identidade da chave
neetru doctor                     # health checks (token, core, schema, env)
```

`bootstrap` é idempotente; `--check` só lista o que falta. CI usa `neetru login --token nrt_<keyId>_<secret>` pra pular browser.

## Padrões de flag presentes em quase todos os comandos

| Flag | Quando |
|---|---|
| `--json` | Saída machine-readable (NDJSON em comandos stream-like como `logs`/`audit tail -f`). |
| `--yes` (`--force`) | Pula confirmação interativa (modo script/CI). |
| `--dry-run` | Valida e mostra efeito **sem aplicar**. Usar SEMPRE em destrutivos antes do real. |
| `--mfa-token <TOTP>` | Step-up MFA — exigido em destrutivos top-tier (lista abaixo). |
| `--non-interactive` | (`deploy`, `init`) falha se faltar input em vez de perguntar. |

Token CI `nrt_<keyId>_<secret>` autentica via `Authorization: Bearer …` contra `cli_api_keys/{keyId}` (sha256 + timingSafeEqual). Operador disabled → 401 imediato (introspection em runtime P-35).

## Destrutivos top-tier (MFA obrigatório — sempre `--dry-run` antes)
```bash
neetru servers deactivate <id>            --mfa-token=…  [--dry-run]
neetru deployments rollback <id>          --mfa-token=…  [--dry-run]
neetru cloud-run delete <service>         --mfa-token=…  [--dry-run]
neetru agent yank <ver>     --reason=…    --mfa-token=…  [--dry-run]
neetru agent canary rollback <ver>        --mfa-token=…  [--dry-run]
neetru env set --service=<svc> --set K=V  --mfa-token=…  [--dry-run]
neetru api-catalog delete <slug>          --mfa-token=…  [--dry-run]
neetru hosting create-mapping --service=<svc> --domain=<d> --mfa-token=…
neetru dr restore --gcs-path=gs://… --target-project=neetru-dr-staging --mfa-token=…
neetru db migrations confirm <id>         --mfa-token=…  [--dry-run]
```
`dr restore` **força** target=staging (guard hard-coded). Apontar pra LIVE explode com erro.
`db migrations confirm` confirma migration destrutiva — só depois de rodar `db apply --dry-run` e ler o relatório de impacto gerado por `@neetru/db-classifier`.

## Catálogo de comandos (por intenção)

Detalhes em `cli/src/commands/<nome>.ts` do repo `Neetru/neetru-cli` e em `docs/sistema/manuais/devex/cli-reference/`.

| Intenção | Comandos |
|---|---|
| **Bootstrap dev** | `bootstrap`, `doctor`, `upgrade`, `validate`, `autocomplete <bash\|zsh\|pwsh>` |
| **Auth operador** | `login [--token]`, `logout`, `whoami`; `auth status/setup/pull` (creds de Claude/Codex/Gemini) |
| **Config CLI** | `config set/get/path` |
| **Criar produto** | `new <slug>` (macro: registry + workspace + scaffold + browser), `init <name>` (só scaffold), `add <auth\|billing\|usage\|support\|users>` (templates) |
| **Build / Deploy / Promote** | `build [--stack node\|docker\|php-apache\|static] [--target-env dev\|workspace\|prod] [--no-cache]`, `deploy [--target cloud-run\|vm] [--server <id>] [--domain <d>] [--artifact-url …] [--local-artifact]`, `promote --from <env> --to <env>` |
| **Catálogo público** | `publish [--draft] [--unpublish]` (Firestore `public_products/`) |
| **Clientes (tenants)** | `tenants list/get/create/update/suspend/reactivate` |
| **Workspaces** | `workspaces create/list/get/advance/open` — `create` devolve `oauthClientSecret` **uma vez só** |
| **Servidores (VMs)** | `servers list/provision/deactivate/dispatch` — provision = **GCP-only** (decisão owner 2026-05-14) |
| **Deploys** | `deployments create`, `deployments rollback <id>` (destrutivo) |
| **Cloud Run** | `cloud-run pause/resume/delete` (delete IRREVERSÍVEL) |
| **Catálogo de API** | `api-catalog create/update/archive/delete` |
| **Produtos (registro interno)** | `products list/create/publish/unpublish` |
| **Banco por produto** | `db list`, `db init`, `db apply [--dry-run]`, `db status <dbId>`, `db migrations list [--db <id>]`, `db migrations confirm <id>` — 7 engines: `firestore-instance`, `cloud-sql-{postgres,mysql}`, `vm-{postgres,mysql}-{single,cluster}` |
| **Banco por produto (plano de controle)** | `products db list/engines/create/get/status/retry/rotate/delete` — registro staff; fase de provisionamento real (Phase B) separada |
| **Schema (produto)** | dentro de `neetru db`: `db init` scaffolda `db/schema.ts` + `db/client.ts`; `db apply` faz pipeline completo (classificar → confirmar se destrutivo → enviar ao Core) |
| **Functions/versão de API** | `fn deploy --version <v> --channel <stable\|beta\|alpha>` |
| **Variáveis de ambiente** | `env switch <dev\|workspace\|production>` (`.env.local`), `env set --service=<svc> --set K=V --secret K=secretName --unset K` |
| **Artifact Registry** | `artifact-registry create <name>` (alias `ar`) |
| **DNS + Hosting** | `dns zones list`, `hosting list`, `hosting create-mapping` |
| **Audit + Billing + Logs** | `audit tail -n 200 --action billing --severity warning --json`, `billing summary --year=2026 --month=5`, `logs --follow --product=<slug> --channel=<stdout\|stderr\|app>` |
| **Caixa de suporte staff** | `support tickets list/describe/reply/assign/status` |
| **DR** | `dr exports list`, `dr restore --gcs-path=… --target-project=…` (staging-only) |
| **Agente Linux** | `agent release --version=<semver> --binary=arch=path`, `agent yank <v>`, `agent canary start/rollback` — versão do agente por VM via `neetru servers list` (não hardcode; ver header) |
| **Status global** | `status` (saúde das 5 superfícies públicas) |
| **Cloud Build** | `builds list` |
| **Browser/painel** | `open [produto] [--client-id <id>]` |
| **IA + UI** | `ai [-m claude\|openai\|gemini\|auto]` (REPL Neetru-aware), `ui` (menu interativo TUI) |
| **Ops scripts** | `ops heartbeat`, `ops smoke notification`, `ops smoke observability`, `ops reg-token <serverId>`, `ops resolve-errors`, `ops openapi-diff` |
| **VM** | `vm list/describe` |
| **Dev local** | `dev [--port]` — inicia emulators Firebase + servidor Next.js |
| **Mocks** | `mocks serve` — servidor mock local do SDK pra desenvolver sem conta Neetru |

## Pegadinhas operacionais
- **VMs são multipropósito**: rodam vários bancos/produtos juntos. Wizards (`new`, `servers provision`) NÃO devem criar VM nova quando uma existe — confirmar antes.
- **`new` ≠ `init`**: `new` é macro end-to-end (registry + workspace + scaffold + abre browser). `init` só faz scaffold local Next.js.
- **OAuth secret one-time**: `workspaces create` devolve `oauthClientSecret` UMA VEZ. Perdeu = rotacionar via painel.
- **Prefixo canônico**: `https://api.neetru.com/cli/v1/*`. Legado `/api/oauth/*` **depreciado 2026-05-15, some 2026-07-01** → migrar pra `/api/v1/oauth/*`.
- **`neetru db` vs `neetru products db`**: `neetru db` é developer-facing (schema, migrations, pipeline local). `neetru products db` é staff/plano de controle (fleet-wide, registro Core). Não confundir.
- **`db apply` sem `--dry-run` em migração destrutiva**: o pipeline pausa e pede `db migrations confirm <id> --mfa-token=…`. Não tem como pular — `@neetru/db-classifier` detecta DROP/ALTER COLUMN/TRUNCATE/etc automaticamente.
- **`.env.local` vs `.env.production` no build**: o Next.js carrega `.env.local` (disco do dev) ANTES de `.env.production`, e não sobrescreve valores já definidos — um `.env.local` esquecido com `NEETRU_ENV=dev` fazia builds de PRODUÇÃO compilarem com o SDK em modo mock (login real desativado silenciosamente, incidente pdv-agiliza 2026-07-22). `neetru build` (>= 2.26.2) já força `NEXT_PUBLIC_NEETRU_ENV=<targetEnv>` (default `prod`) via spawn-env pra stacks `node`/`static` — automático, sem ação do dev. Envolver `next.config.mjs` com `withNeetruBuildGuard` (`@neetru/sdk/build-guard`, >= 3.1.15) faz o `neetru build` conferir pós-build e recusar empacotar se divergir.

---

# SDK

## Install + cliente
```bash
npm install @neetru/sdk
# Componentes React:
npm install @neetru/sdk react react-dom
```

```ts
import { createNeetruClient, NeetruError, VERSION } from '@neetru/sdk';

const client = createNeetruClient({
  apiKey: process.env.NEXT_PUBLIC_NEETRU_API_KEY,  // nrt_{clientId}_{secret}
  productId: process.env.NEXT_PUBLIC_NEETRU_PRODUCT_ID,
  // baseUrl?: 'https://api.neetru.com',
  // env?: 'dev' | 'workspace' | 'prod',            // ou via NEETRU_ENV
  // db?: { engine: 'rest' | 'firestore' | 'nosql-vm', dbId: '...' }
});

console.log(VERSION); // versão instalada — NÃO hardcode um valor aqui, sempre leia em runtime
```

## Variáveis de ambiente

| Variável | Onde | Para quê |
|---|---|---|
| `NEXT_PUBLIC_NEETRU_API_KEY` | client+server | auth/catalog/checkout/notifications no browser |
| `NEXT_PUBLIC_NEETRU_PRODUCT_ID` | client+server | identifica o produto SaaS |
| `NEETRU_API_KEY` | **só server** | usage/db/admin (write-side) — nunca em `NEXT_PUBLIC_*` |
| `NEETRU_PRODUCT_ID` | **só server** | par com acima |
| `NEETRU_TENANT_ID` | **só server** | escopo de cliente para writes |
| `NEETRU_ENV=dev` | dev/test | **ativa mocks in-memory automáticos** — auth com usuário fixture, usage zerado, support lista vazia, db in-memory. Útil pra rodar produto SaaS sem provisionar conta Neetru. |

`apiKey` no formato `nrt_{client_id}_{secret}` corresponde a um **SDK client vinculado a um produto** (`products/{id}/sdk`). Criação/revogação no painel staff em `/products/{id}/sdk`. Secret aparece **uma vez** — perdeu, revoga e cria outro.

## Namespaces — surface + assinaturas

| Namespace | Métodos | Notas |
|---|---|---|
| `client.auth` | `signIn(opts?)` / `signOut()` / `getUser()` / `onAuthStateChanged(listener)` | OIDC PKCE via `auth.neetru.com`. Sem `window` (Node/Edge sem mocks) → `NeetruError('invalid_config')`. |
| `client.catalog` | `list(opts?)` → `{ products }` / `get(slug)` → `Product` | Produtos públicos do `public_products/`. |
| `client.entitlements` | `check(productSlug, feature)` → `boolean` / `checkDetailed(...)` → `EntitlementCheck` | NÃO é `check(feature)` sozinho — exige productSlug. |
| `client.telemetry` | `event(name, props?)` / `log(level, msg, ctx?)` | Por produto. Eventos analíticos (≠ usage cobrado). |
| `client.usage` | `report(metric, qty?)` / `check(metric)` | Metering canônico. **`track`/`getQuota` foram REMOVIDOS na v3.0** — não existem mais, use `report`/`check`. |
| `client.support` | `createTicket({subject, message, severity?})` / `listMyTickets({productSlug?})` | **NÃO é `create`** — é `createTicket`/`listMyTickets`. |
| `client.db` | ver seção abaixo | Namespace reestruturado em v2.0 — breaking change intencional. |
| `client.checkout` | `start({productId, planId, callbackUrl, tenantType?, tenantId?, autoRedirect?})` → `CheckoutStartResult` / `getIntent(intentId)` | POSTa em `/api/v1/checkout/intents`. Browser default redireciona automático. |
| `client.webhooks` | `register({url, events, secret?})` / `list()` / `unregister(id)` / `test(id)` | Eventos: `subscription.{activated,cancelled,payment_failed,trial_ending}`, `usage.quota_exceeded`, `account.{suspended,reactivated}`, `support.ticket_replied`. Verifica HMAC com `verifyWebhookSignature(payload, signature, secret)`. |
| `client.notifications` | `send({userId, kind, title, severity?, body?, link?, metadata?, fingerprint?})` / `list(userId, opts?)` / `markRead(id)` / `dismiss(id)` | Notificações in-app dos produtos para os próprios usuários. `fingerprint` deduplica 24h. Schema isolado por produto (`product_user_notifications/{productId}/`). |

**`NeetruError`** (importado do root): props `.code` (`unauthorized`, `forbidden`, `not_found`, `validation_failed`, `rate_limited`, `server_error`, `network_error`, `invalid_response`, `invalid_config`, `missing_api_key`, `unknown`), `.status`, `.requestId`. Use pra `try/catch` tipado.

## `client.db` — v2.0 (breaking change vs v1.x)

v2.0 é uma reestruturação deliberada do namespace db. Se você mantém código v1.x, consulte o CHANGELOG.md §2.0.0.

**Métodos:**
- `client.db.collection(name)` → `DbCollectionRef` — offline-first, engine-aware. `list()` agora retorna `DbListResult<T>` (com `fromCache`, `stale`) em vez de `T[]`.
- `client.db.sql(schema, opts?)` → `Promise<NeetruSqlClient>` — acesso SQL com leasing gerenciado pelo Core.
- `client.db.syncState` → `NeetruSyncState` — estado atual de sincronização.
- `client.db.onSyncStateChanged(cb)` / `flush()` / `clearCache()` / `getConflicts()`

**Engines (configurado no `createNeetruClient`):**
```ts
const client = createNeetruClient({
  apiKey: '...',
  productId: '...',
  db: {
    dbId: '...',           // vindo do .neetru/db.json gerado por `neetru db init`
    engine: 'rest',        // 'rest' | 'firestore' | 'nosql-vm'
  }
});
```
- `'rest'` — default MVP, funciona com todos os engines SQL e documentos, sem realtime nativo.
- `'firestore'` — Firestore Web SDK como transporte (memoryLocalCache), para bancos `firestore-instance`.
- `'nosql-vm'` — WebSocket via gateway `neetru-realtime`, para bancos `nosql-vm` em VMs.

**v1.x pra v2.0 — mudanças que quebram:**
- `list()` retorna `DbListResult<T>` não mais `T[]`. Acesse via `.data`.
- `db_unavailable` não significa mais "sem rede" (offline é transparente agora).
- `batch()`, `onDoc()`, `onSnapshot()`, `doc()`, `sql()` são novos — código que não usa não quebra.

## Retry/backoff (embutido)
HTTP interno já tem retry exponencial com jitter ±20% em `rate_limited`/`server_error`/`network_error`. Default 2 retries (3 tentativas total). Honra `Retry-After` (RFC 9110). Opt-out por chamada: passa `retries: 0` (útil em operação não-idempotente). Não escreva sua própria retry loop em torno do SDK.

## Subpaths (exports map real do npm)
```ts
import { createNeetruClient } from '@neetru/sdk';        // root — universal (browser/Node/Edge)
import { signIn } from '@neetru/sdk/auth';
import { CheckoutLink, EntitlementGate,
         useEntitlementContext } from '@neetru/sdk/react';
import { verifyWebhookSignature } from '@neetru/sdk/webhooks';
import { MockAuth, MockUsage, MockSupport,
         DEV_FIXTURE_USER } from '@neetru/sdk/mocks';
// db com React:
import { useCollection, useDoc } from '@neetru/sdk/db/react';
// Guard de build (Node-only, next.config.mjs — ver "Build — env do bundle" abaixo):
import { withNeetruBuildGuard } from '@neetru/sdk/build-guard';
```

18 subpaths reais: `.` `/auth /catalog /entitlements /telemetry /usage /support /mocks /db /db/react /errors /checkout /react /webhooks /notifications /firestore-compat /ai /build-guard`. `/build-guard` é o único Node-only (importa `node:fs`/`node:path`) — fora do barrel `.` de propósito.

## Build — env do bundle (`NEXT_PUBLIC_NEETRU_ENV`)

O Next.js carrega `.env.local` (disco do dev) ANTES de `.env.production` e não sobrescreve valores já definidos — um `.env.local` esquecido com `NEETRU_ENV=dev` fazia builds de PRODUÇÃO compilarem com o SDK em modo `MockAuth` (login real desativado silenciosamente — incidente pdv-agiliza, 2026-07-22, `@neetru/cli@2.26.2` + `@neetru/sdk@3.1.15`).

`neetru build` (stacks `node`/`static`) já força `NEXT_PUBLIC_NEETRU_ENV=<targetEnv>` (default `prod`) via spawn-env — automático, sem ação do dev. Recomendado também envolver `next.config.mjs`:

```js
import { withNeetruBuildGuard } from '@neetru/sdk/build-guard';
export default withNeetruBuildGuard({ /* ...seu nextConfig */ });
```

Isso grava `.next/neetru-build-manifest.json` com o env realmente compilado — `neetru build` confere pós-build e **recusa empacotar o tarball** se divergir do esperado, em vez de deployar um bundle silenciosamente quebrado.

**Subpaths que NÃO existem** (cuidado em templates/AI): `/middleware` e `/server`. Desconsidere se aparecer — use os reais acima.

## React subpath — componentes

### `<CheckoutLink>` (props obrigatórias: `client` + `productId` + `planId` + `callbackUrl`)
```tsx
import { CheckoutLink } from '@neetru/sdk/react';

<CheckoutLink
  client={client}
  productId="meu-saas"
  planId="pro_monthly"
  callbackUrl="https://meu-saas.com/billing/success"
  onIntentCreated={(r) => console.log('intent:', r.intentId)}
  onError={(err) => console.error(err)}
>
  Assinar Pro
</CheckoutLink>
```
Browser: clica → `client.checkout.start(...)` → `window.location.href = redirectUrl`. `noAutoRedirect={true}` deixa o caller controlar via `onIntentCreated`.

### `<EntitlementGate>` (modos `block` / `hide` / `readonly`)
```tsx
import { EntitlementGate, useEntitlementContext } from '@neetru/sdk/react';

<EntitlementGate
  client={client}
  productSlug="meu-saas"
  feature="export-csv"
  mode="readonly"           // 'block' | 'hide' | 'readonly'
  fallback={<UpgradePrompt />}
>
  <ExportButton />
</EntitlementGate>

// Dentro de children, leia o estado readonly:
function ExportButton() {
  const { isReadonly } = useEntitlementContext();
  return <button disabled={isReadonly}>Exportar CSV</button>;
}
```
`mode='readonly'` é a decisão CEO §5 — mostra a feature mas inerte em vez de esconder ou bloquear.

### `useCollection` / `useDoc` (via `/db/react`)
```tsx
import { useCollection, useDoc } from '@neetru/sdk/db/react';

// Hook para lista reativa offline-first:
const { data, isLoading, syncState } = useCollection(client.db.collection('pedidos'), {
  where: [{ field: 'status', op: '==', value: 'aberto' }],
  limit: 20,
});

// data é T[] — o fromCache/stale fica no syncState
```

## Modo dev (`NEETRU_ENV=dev`)
Setar `NEETRU_ENV=dev` faz o factory devolver **mocks in-memory** pra todos os namespaces stateful (`auth` → `DEV_FIXTURE_USER` previsível, `usage` zera quota, `support` lista vazia, `db` mapa interno, `notifications` in-memory). Permite rodar o produto SaaS local sem provisionar conta Neetru. Mocks também exportáveis manualmente do `/mocks` pra testes: `MockAuth`, `MockUsage`, `MockSupport`, `MockEntitlements`, `MockDb`, `MockCheckout`, `MockWebhooks`, `MockNotifications`.

## Templates `neetru add` — o que o scaffold gera

`neetru add <funcionalidade>` copia template pra `src/lib/neetru/<funcionalidade>/`. Editar esses arquivos é caso típico desta skill.

| `neetru add` | Arquivos | Função real chamada |
|---|---|---|
| `auth` | `sign-in.tsx`, `callback.ts` | `client.auth.signIn()` |
| `billing` | `page.tsx`, `checkout.ts` | `client.catalog.list()` + `client.checkout.start(...)` |
| `usage` | `track.ts` | `client.usage.report(metric, qty)` + `client.usage.check(metric)` |
| `support` | `ticket-form.tsx` | `client.support.createTicket({subject, message, severity})` |
| `users` | `profile.tsx` | `client.auth.onAuthStateChanged(setUser)` + `client.auth.signOut()` |

Templates usam Next.js 15 App Router + `'use client'` quando interativos.

## Estabilidade de API
- v2.0.0 quebrou a superfície pública do `client.db` (breaking intencional — major). Resto estável.
- `initNeetru(...)` removido em v2.0. Use `createNeetruClient`.
- `NeetruConfig` (type) removido em v2.0. Use `NeetruClientConfig`.
- **Breaking changes só em majors** (semver estrito) a partir de agora.

---

# Libs de apoio (`@neetru/db-classifier`, `@neetru/sql-guard`, `@neetru/pii-mask`, `neetru-glossario`)

Todas em `0.1.0`, publicadas no npm, repo `Neetru/neetru-libs`.

## `@neetru/db-classifier`
Avalia se uma migration SQL é aditiva (safe) ou destrutiva (exige confirmação humana). Função pura, parser AST, sem dependências pesadas.

```ts
import { classifyMigration } from '@neetru/db-classifier';

const result = classifyMigration(sqlText);
// result.severity: 'additive' | 'destructive'
// result.reasons: string[]  — explica o que foi detectado
```

O CLI (`neetru db apply`) usa internamente. Você usa nos testes de migration do produto.

## `@neetru/sql-guard`
Classificador read-only + gate de hardening. Decide se um statement é seguro pro visualizador de banco staff.

```ts
import { guard } from '@neetru/sql-guard';

const result = guard(sqlText);
// result.safe: boolean
// result.normalized: string  — com LIMIT injetado se SELECT sem LIMIT
// result.reasons: string[]   — descreve o que barrou
```

Fail-closed: qualquer falha de parse → `safe: false`. Não passa DDL (CREATE/DROP/ALTER), DML de mutação (INSERT/UPDATE/DELETE), nem SELECT com WHERE tautológico (`1=1`).

## `@neetru/pii-mask`
Mascara dados pessoais num result-set antes de exibir na UI staff em produção.

```ts
import { maskResultSet } from '@neetru/pii-mask';

const rows = await db.query(sql);
const safe = maskResultSet(rows, { strict: true });
// Campos como cpf, email, telefone, nome aparecem mascarados
// strict: true → falha se encontrar campo não mapeado (fail-closed)
```

## `neetru-glossario`
Vocabulário plain PT-BR do ecossistema como código. Fonte única da terminologia.

```ts
import { translate, validateVocab } from 'neetru-glossario';

translate('tenant');     // → 'cliente'
translate('workspace');  // → 'ambiente'
translate('entitlement');// → 'permissão'
validateVocab('tenant'); // → false (jargão proibido na UI)
```

Use nos testes de lint anti-jargão e no CLI (`neetru ops` valida strings de UI contra este vocabulário).

Tabela de tradução canônica (amostra):

| Termo técnico | Equivalente plain PT-BR |
|---|---|
| tenant | cliente |
| workspace | ambiente |
| entitlement | permissão |
| provisioning | criação / provisionamento |
| tier | plano |
| billing | cobrança |
| deployment | publicação |
| server | servidor |

---

# Padrões do ecossistema (relevantes pro CLI/SDK)

- **CalVer**: respostas do Core carimbam `X-Neetru-Version: 2026.07.x+<revision>` + `X-Neetru-Sha` (formato ilustrativo — leia o valor real em runtime). SDK loga aviso se versão lida divergir muito do pacote.
- **Stripe = conta única, BRL apenas** (decisão CEO). Sem Connect, sem multi-moeda. Namespace `checkout` assume isso.
- **Vocabulário plain PT-BR** na UI staff — API mantém termos técnicos (`tenant`/`workspace`/`entitlement`) por contrato. Não traduzir no SDK client.
- **MFA TOTP step-up** obrigatório nos destrutivos do CLI (lista acima). Sempre `--dry-run` antes do real.
- **Agente Linux** — repo `Neetru/neetru-agent-service-vm`. Contrato Core↔agente via message bus Firestore. Binários em `gs://neetru-agent-releases/v<versao>/` (versão corrente por VM via `neetru servers list`; ver header). Self-update pode ser cosmético — confira `binaryHash`, não só o número (`neetru-release-gates`).

## Quando o trigger é ambíguo

| Pedido | Skill ajuda? |
|---|---|
| "Como faço X" via CLI | Sim — usar esta skill |
| Chamada REST direta sem CLI | Não — ver `docs/sistema/ARCHITECTURE.md` ou `src/app/api/` |
| Operação só no painel staff (`core.neetru.com`) | Parcial — diga isso + sugere `neetru open <produto>` |
| Script `gcloud` cru | Não — se faltar comando CLI equivalente, abrir issue no roadmap |
| `@neetru/db-classifier` / `sql-guard` / `pii-mask` | Sim — esta skill cobre |
| Planning de schema migration / análise de impacto destrutivo | Sim — `neetru db apply --dry-run` + `@neetru/db-classifier` |
