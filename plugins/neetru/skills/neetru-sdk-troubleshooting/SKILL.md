---
name: neetru-sdk-troubleshooting
description: Use quando um Claude de produto SaaS relata ERRO ou comportamento inesperado consumindo `@neetru/sdk` — build quebrando (`client.usage.track is not a function`, `Module not found: @neetru/sdk/next|/server|/middleware`, `initNeetru is not exported`), runtime divergindo dev vs prod (`missing_api_key`/`unauthorized` só em produção), `list()` retornando objeto em vez de array (DbListResult), `db.collection` com `forbidden`, assinatura de namespace que não bate, ou código pinado em SDK 2.x quando o publicado é 3.1.x. Diagnóstico sintoma→causa→correção, ciente do que o 3.0 REMOVEU. Para o caminho de deploy que dropa a credencial veja `neetru-deploy`; para a mecânica das assinaturas veja `neetru`.
---

# neetru-sdk-troubleshooting — erro de `@neetru/sdk`, sintoma → causa → fix

> **Antes de afirmar versão:** `npm view @neetru/sdk version`. A skill `neetru` (referência) está pinada numa major antiga e lista métodos REMOVIDOS — não confie nela pra superfície do SDK 3.x. Fonte autoritativa quando docs conflitam: `sdk-reference/*.md` (datados) via `neetru-docs`.

## Tabela sintoma → causa → correção
| Sintoma | Causa | Fix |
|---|---|---|
| `client.usage.track is not a function` / `usage.getQuota` | **Removidos no SDK 3.0** (eram vaporware; o Core nunca aceitou) | `usage.report(metric, qty)` + `usage.check(metric)` |
| `initNeetru is not exported` / `NeetruConfig` ausente | Removidos no 3.0 | `createNeetruClient(...)` + type `NeetruClientConfig` |
| `Module not found: @neetru/sdk/next` `/server` `/middleware` | **Subpaths fantasma** (nunca existiram) | Use os reais: `/auth /catalog /entitlements /telemetry /usage /support /db /db/react /errors /checkout /react /webhooks /notifications /mocks /firestore-compat /ai /build-guard` |
| `missing_api_key` / `unauthorized` **só em prod** | Deploy VM dropou a chave `*SECRET*`/`*KEY*` (passa em dev por mocks) | Ver `neetru-deploy` › injeção server-side (`bug_5b6bb0d7`) — não é bug do SDK |
| Botão de login não faz nada (sem popup, sem redirect) **só em prod** | `.env.local` venceu `.env.production` pra `NEXT_PUBLIC_NEETRU_ENV` no build — bundle compilou com `env=dev`, SDK ativou `MockAuth` (que só finge login em memória, nunca navega pro IdP real) — incidente pdv-agiliza 2026-07-22 | `neetru build >= 2.26.2` já força `NEXT_PUBLIC_NEETRU_ENV` via spawn-env; envolver `next.config.mjs` com `withNeetruBuildGuard` (`@neetru/sdk/build-guard`, >= 3.1.15) faz o build recusar empacotar se divergir. Ver `neetru-deploy` › Armadilha #3 |
| `list()` "não é array" | v2 retorna **`DbListResult`** (envelope), não `T[]` | Desempacote `.docs` (cada `{id,data}`); ou hook `useCollection` devolve `.data` |
| `db.*` com `forbidden` | `tenantId` do token não bate / `db.*` rodando no client | `db.*` é **server-only**; confira `NEETRU_TENANT_ID` |
| `entitlements.check(...)` sempre nega/erra | Falta `productSlug` | `entitlements.check(productSlug, feature)` — exige os dois |
| `support.create is not a function` | É `createTicket` | `support.createTicket({subject, message, severity})` / `listMyTickets()` |

## Realidade de versão 3.x
3.0 **removeu**: `usage.track`, `usage.getQuota`, `initNeetru`, `NeetruConfig`, código de erro `invalid_input`. Substitutos: `usage.report`/`check`, `createNeetruClient`, `NeetruClientConfig`, `validation_failed`. Breaking só em major (semver estrito).

## Ciclo de vida de env var
- `NEXT_PUBLIC_NEETRU_*` (browser-safe: auth/catalog/checkout/notifications) **vs** `NEETRU_API_KEY`/`NEETRU_PRODUCT_ID`/`NEETRU_TENANT_ID` (**server-only**: usage/db/write).
- **NUNCA** chave de escrita em `NEXT_PUBLIC_*`.
- Em **prod**, a chave é **injetada no runtime pelo Core** (não se digita em `.env.local` de deploy VM — ver `neetru-deploy`).
- **Precedência do Next.js no BUILD (não runtime)**: `.env.local` carrega ANTES de `.env.production` e vence pra qualquer chave em comum — `NEXT_PUBLIC_NEETRU_ENV` errado nunca é sobrescrito silenciosamente pelo arquivo certo. `neetru build >= 2.26.2` já neutraliza isso via spawn-env; `withNeetruBuildGuard` (`@neetru/sdk/build-guard`) confirma pós-build.

## `NeetruError` — discrimine por `.code`, NUNCA por `.message`
lista canônica em `src/errors.ts` / `errors.md` do SDK (incl. `unauthorized`, `forbidden`, `validation_failed`, `rate_limited`, `server_error`, `network_error`, `missing_api_key`, `invalid_config`, `conflict` — confirme os demais na fonte). `.message` é i18n/instável. Transientes (`rate_limited`/`server_error`/`network_error`) **já têm retry+backoff embutido** — não escreva retry-loop por fora.

## Modo dev / mocks
`NEETRU_ENV=dev` → mocks in-memory (auth fixture, usage zerado, support vazio, `entitlements.check` sempre `true`). Negue feature em teste com `MockEntitlements.__deny(slug, feature)`. Por isso erro de credencial **passa em dev e quebra em prod**.

## Quando escalar
Doc canônico stale/errado OU conflito real entre fontes (`sdk-reference` vs `saas-do-zero`) → reporte no `neetru-chat` (core-team) em vez de propagar. Escopo de bug Neetru: só SDK/Core/CLI/libs (`neetru-regras`).
