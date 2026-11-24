---
name: neetru-sdk-troubleshooting
description: Use quando um Claude de produto SaaS relata ERRO ou comportamento inesperado consumindo `@neetru/sdk` — build quebrando (`client.usage.track is not a function`, `Module not found: @neetru/sdk/next|/server|/middleware`, `initNeetru is not exported`), runtime divergindo dev vs prod (`missing_api_key`/`unauthorized` só em produção), `list()` retornando objeto em vez de array (DbListResult), `db.collection` com `forbidden`, assinatura de namespace que não bate, ou código pinado em SDK 2.x quando o publicado é 3.x. Diagnóstico sintoma→causa→correção, ciente do que o 3.0 REMOVEU. Para o caminho de deploy que descarta a credencial veja `neetru-deploy`; para a mecânica das assinaturas veja `neetru`.
---

# neetru-sdk-troubleshooting — erro de `@neetru/sdk`, sintoma → causa → correção

> **Antes de afirmar versão:** `npm view @neetru/sdk version`. A skill `neetru` (referência) pode estar numa major antiga e listar métodos REMOVIDOS: não confie nela para a superfície do SDK 3.x. **Fonte da superfície, em ordem:** (1) o pacote instalado: `exports` do `package.json` e os tipos em `node_modules/@neetru/sdk`; (2) a referência por namespace em `docs/sistema/manuais/devex/sdk-reference/` do Core, que se acha pelos metadados (`grep -rlE '^etiquetas:.*repo:sdk' docs`, método em `neetru-docs`) e é datada: o front matter diz quando foi conferida.

## Tabela sintoma → causa → correção
| Sintoma | Causa | Correção |
|---|---|---|
| `client.usage.track is not a function` / `usage.getQuota` | **Removidos no SDK 3.0** (eram vaporware; o Core nunca aceitou) | `usage.report(metric, qty)` + `usage.check(metric)` |
| `initNeetru is not exported` / `NeetruConfig` ausente | Removidos no 3.0 | `createNeetruClient(...)` + tipo `NeetruClientConfig` |
| `Module not found: @neetru/sdk/next`, `/server`, `/middleware` | **Subpaths fantasma** (nunca existiram) | Use os que existem; a lista de verdade é o campo `exports` do `package.json` do SDK. Hoje: `auth`, `catalog`, `entitlements`, `telemetry`, `usage`, `support`, `mocks`, `db`, `db/react`, `build-guard`, `errors`, `checkout`, `firestore-compat`, `react`, `react/ui`, `webhooks`, `notifications`, `ai`, `mobile`, `validators` |
| `missing_api_key` / `unauthorized` **só em produção** | O deploy em VM descartou a chave `*SECRET*`/`*KEY*` (em dev passa, por causa dos mocks) | `neetru-deploy`, «injeção pelo servidor» (`bug_5b6bb0d7`). Não é defeito do SDK |
| Botão de login não faz nada (sem popup, sem redirect) **só em produção** | `.env.local` venceu `.env.production` para `NEXT_PUBLIC_NEETRU_ENV` no build: o bundle compilou com `env=dev` e o SDK ativou o `MockAuth` (finge o login em memória, nunca navega para o IdP real). Incidente do pdv-agiliza, 22/07/2026 | `neetru build` já força `NEXT_PUBLIC_NEETRU_ENV`; envolver o `next.config.mjs` com `withNeetruBuildGuard` (`@neetru/sdk/build-guard`) faz o build recusar o pacote se divergir. `neetru-deploy`, armadilha 3 |
| `list()` «não é array» | v2 devolve **`DbListResult`** (envelope), não `T[]` | Use `.docs` (cada item `{id,data}`), ou o hook `useCollection`, que devolve `.data` |
| `db.*` com `forbidden` | o `tenantId` do token não bate, ou `db.*` está rodando no client | `db.*` é **só de servidor**; confira `NEETRU_TENANT_ID` |
| `entitlements.check(...)` sempre nega ou dá erro | falta o `productSlug` | `entitlements.check(productSlug, feature)`: pede os dois |
| `support.create is not a function` | o nome é `createTicket` | `support.createTicket({subject, message, severity})` e `listMyTickets()` |

## O que o 3.0 removeu
`usage.track`, `usage.getQuota`, `initNeetru`, `NeetruConfig` e o código de erro `invalid_input`. Substitutos: `usage.report` e `usage.check`, `createNeetruClient`, `NeetruClientConfig`, `validation_failed`. Quebra de contrato só em major (semver estrito).

## Ciclo de vida das variáveis de ambiente
- `NEXT_PUBLIC_NEETRU_*` (seguras no navegador: auth, catálogo, checkout, notificações) **×** `NEETRU_API_KEY`, `NEETRU_PRODUCT_ID`, `NEETRU_TENANT_ID` (**só de servidor**: usage, db, escrita).
- **Nunca** chave de escrita em `NEXT_PUBLIC_*`.
- Em **produção** a chave é **injetada no runtime pelo Core**: não se digita no `.env.local` de deploy em VM (`neetru-deploy`).
- **Precedência do Next.js no BUILD (não no runtime):** o `.env.local` carrega ANTES do `.env.production` e vence em qualquer chave em comum. O `NEXT_PUBLIC_NEETRU_ENV` errado nunca é sobrescrito em silêncio pelo arquivo certo. O `neetru build` neutraliza isso pelo ambiente do processo, e o `withNeetruBuildGuard` confirma depois do build.

## `NeetruError`: discrimine por `.code`, NUNCA por `.message`
A lista canônica está em `sdk-reference/errors.md` e na fonte do SDK (`src/errors.ts`): `unauthorized`, `forbidden`, `validation_failed`, `rate_limited`, `server_error`, `network_error`, `missing_api_key`, `invalid_config`, `conflict`… (confirme os demais na fonte). `.message` é traduzida e instável. Os transitórios (`rate_limited`, `server_error`, `network_error`) **já têm retry com backoff embutido**: não escreva laço de retry por fora.

## Modo dev e mocks
`NEETRU_ENV=dev` liga mocks em memória (auth de fixture, usage zerado, support vazio, `entitlements.check` sempre `true`). Para negar uma feature no teste: `MockEntitlements.__deny(slug, feature)`. É por isso que erro de credencial **passa em dev e quebra em produção**.

## Quando escalar
Doc errado ou velho, ou conflito real entre fontes (a referência do SDK contra o `saas-do-zero`): reporte no `neetru-chat` (core-team) em vez de repetir o erro. Escopo de bug Neetru: só SDK, Core, CLI e libs (`neetru-regras`).
