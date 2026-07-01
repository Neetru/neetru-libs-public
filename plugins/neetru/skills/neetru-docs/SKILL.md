---
name: neetru-docs
description: Use when an AI (Claude) building a Neetru product (pdv-agiliza, gestovendas, …) or working on the Core needs the AUTHORITATIVE zero-to-PRODUCTION roadmap AND the canonical Neetru docs — bootstrap/login/doctor → READ the canonical docs via the docs control plane (`neetru docs` / live endpoints) → wire `@neetru/sdk` as the ONLY data conduit → deploy `--target vm` → environments/tenant → credential/OIDC via the server-side injector (NEVER `--env-file`) → schema migration → prove login+sale end-to-end. Read the real doc instead of guessing commands/endpoints/schemas that don't exist; MANY published docs are stale (SDK frozen at 2.x, CLI commands renamed) — this skill flags them and points to the 2026-07-01 credential/impediments/FAQ guides written this round.
---

# neetru-docs — ler a doc canônica + roteiro zero→PRODUÇÃO

Neetru publica a doc por um **docs control plane**. Antes de responder "como o Neetru faz X" / "qual o comando de Y" / "que campos Z tem", **leia o doc** — não infira de memória. Vários comandos plausíveis (`neetru secret set`, `@neetru/sdk/next`) **não existem**.

> **Ordem de verdade:** owner-decision/CLAUDE.md > memória antiga; **CÓDIGO > doc**. E cuidado: **muita doc publicada está DEFASADA** (SDK congelado em 2.x, comandos CLI renomeados) — a seção "Docs que MENTEM" abaixo lista quais. Sempre cheque versão real: `npm view @neetru/cli version` · `npm view @neetru/sdk version` · `/api/health` (`.sha`/`.revision`).

## Ler a doc (mecânica)
```bash
neetru docs list                 # registry: GET /api/cli/v1/docs → { ok, count, docs:[{slug,title,category}] }
neetru docs get <slug>           # GET /api/cli/v1/docs/<slug> → { ok, doc:{slug, content(md), frontmatter} }
neetru docs open [topic]         # atalho por tópico
```
Bearer `nrt_…` carimba o audit; o conteúdo em si é público.

## Roteiro passo-a-passo zero→prod (cada passo: doc canônica + skill)
1. **Bootstrap / login / doctor** — `neetru bootstrap → login → whoami → doctor` (5/5 verde). **Não escreva código antes do `doctor` verde.** Ordem completa + fronteira de responsabilidade → skill **`neetru-onboarding`**; docs `saas-do-zero/01-conceitos`, `02-pre-requisitos`.
2. **Ler docs + entrar no chat** — o mapa abaixo + skill **`neetru-chat`** (canal com Suporte/Dev Core, apelido inerente ao token).
3. **SDK como conduíte** — o **`@neetru/sdk` é o ÚNICO caminho de dados** de todo produto (nenhum bypassa; skill **`neetru-regras`**). Doc de **CONFIANÇA**: `saas-do-zero/04-integrando-sdk` (reflete 3.1 real: `createNeetruClient`, helpers em `@neetru/sdk/react`, **sem** `/next`/`NeetruProvider`). Login OIDC: sete `config.oidcClientId` = o client_id do login-client (a audience do `verifyToken` é `oidcClientId`, fallback keyId), fluxo `authorization_code` PKCE (`signIn`/`handleRedirectCallback`, o backend do produto troca `code`→tokens). Erro de superfície (`usage.track is not a function`, `Module not found @neetru/sdk/next`, `list()` não é array) → skill **`neetru-sdk-troubleshooting`**.
4. **Deploy → VM** — `saas-do-zero/07-deploy` + skill **`neetru-deploy`** (caminho ordenado + armadilhas). Use **VM existente** (`neetru servers list`); **VM nova = custo, owner-gated** — nunca em silêncio.
5. **Ambientes / tenant** — deploy cria o *environment* mas produto deployado **DIRETO** (sem workspace provisionado antes) pode ficar **sem tenant prod** (precisa backfill) e sofrer **serverId drift** (env aponta pra VM deletada). Isso é do **motor de ambientes do Core**, não do teu produto → triagem em **`neetru-troubleshooting`** (§"app roda mas fora do ambiente").
6. **Credencial / OIDC via injetor** — **o produto NÃO vê, NÃO segura, NÃO põe secret no `--env-file`.** O **injetor server-side** entrega `NEETRU_OIDC_CLIENT_ID/SECRET` + `NEETRU_API_KEY` do SecretManager como `EnvironmentFile` 600; o app só LÊ do env. `--env-file` **dropa** `*SECRET*/*KEY*/*TOKEN*/*PASSWORD*/DATABASE_URL` fail-closed → app sobe sem credencial → `missing_api_key`/`unauthorized` **só em prod**. **Mint de credencial = owner-direct-only** (relay não destrava). Doc canônica desta rodada: `GUIA_CREDENCIAL_SECRET_PRODUTOS_2026-07-01` (abaixo) + skills **`neetru-deploy`** (`--env-file` drop) / **`neetru-regras`** (owner-direct).
7. **Migração de schema** — `neetru db apply --dry-run` → lê o `@neetru/db-classifier`: **aditiva** (gate leve) aplica; **destrutiva** PAUSA e exige `db migrations confirm --mfa-token`. Redundante `type already exists` (ME1) é do **motor do Core** — **não reescreva o schema** → skill **`neetru-migrations`**.
8. **Prova login+venda E2E** — **só declare LIVE com o fluxo end-to-end (login + venda) provado**; `resolved` só após **deploy LIVE + smoke** (`/api/health` 200, `neetru status`, `neetru logs -f --json`). **`merged ≠ live`**: fix de SDK só vale publicado no npm; handler do agente só vale canariado na frota (versão reportada pode mentir — cheque `binaryHash`) → skill **`neetru-release-gates`**.

## Docs desta rodada (2026-07-01) — leia estes ANTES de chutar credencial/secret
Vivem em `docs/_review/` (Suporte; product-facing, publicáveis no docs control plane — se não achar via `neetru docs get`, peça ao Suporte no `neetru-chat`):
- **`GUIA_CREDENCIAL_SECRET_PRODUTOS_2026-07-01.md`** — as 3 credenciais (OIDC login-client · `NEETRU_API_KEY` · SDK M2M), por que o produto nunca vê o raw, como o secret chega na VM pelo injetor, a matriz **owner-direct-only × relay-ok**, e o go-live limpo do login.
- **`FAQ_MATERIAL_PDV_2026-07-01.md`** — 10 P&R da jornada real pdv→prod: Q1 "app 200/TLS mas login não fecha" (secret não chegou), Q3 "owner deu go mas mint não veio" (owner-direct-only), Q7 "app roda mas fora do ambiente" (drift/tenant), Q8/Q10 "merged ≠ live".
- **`MELHORIAS_IMPEDIMENTOS_2026-07-01.md`** — ranking de impedimentos → causa-raiz → melhoria → status (o que já é LIVE vs pendente).
- **`ONDA_MELHORIAS_TEAMB_2026-07-01.md`** — backlog buildável (útil pra saber o que **ainda NÃO está LIVE**: injetor permanente, CLI self-service de credencial, `--no-cache`).

## Docs que MENTEM (stale) — NÃO copie comando/método sem verificar a versão
- `devex/sdk-reference/auth.md` — 2.x; **omite todo o fluxo PKCE** (`handleRedirectCallback`/`getIdToken`/`verifyToken`) e descreve `signIn` errado. SDK real = **3.1.9**.
- `devex/GUIA_SDK_2_0.md` + `devex/sdk-reference/db.md` + `devex/INDEX.md` — chamam `initNeetru` de "stub" (**REMOVIDO no 3.0** → use `createNeetruClient`), listam `usage.track`/`getQuota` (**removidos** → `usage.report`/`check`), dizem "SDK 1.0 / 7 namespaces" (real: **10**).
- `saas-do-zero/06-monitoramento.md` (usa `usage.track`), `09-troubleshooting.md` + `03-criando-produto.md` (citam `initNeetru`) — quebram o build do consumer.
- `devex/cli-reference/marketplace.md` (comando virou **`neetru archive`** em 2.10.0), `products-db.md` (virou **`neetru admin database`**), `GUIA_CLI_2_x.md` (**`neetru fn deploy`** foi deletado; **`neetru changelog`** não existe).
- `infra/AGENT_HANDLERS.md` — "Agent v1.0 / 5 handlers" e ponteiro SSoT quebrado; a frota real roda ~28 handlers (1.6.x).
- `docs/index.md` + `INDEX_MESTRE.md` — revision/versões congelados em maio.

## Disciplina
- Doc vence memória; **código vence doc**. Em conflito de superfície do SDK/CLI: a skill de domínio (`neetru-sdk-troubleshooting`, `neetru-deploy`) + version-check vencem a doc datada.
- Achou doc stale/errada (promete comando inexistente, versão velha)? **Conserte no `neetru-chat` (core-team)** em vez de propagar.
- **Nunca** cole segredo/token/`.env`/OIDC secret no chat. Escopo de `neetru bug` = só Core/SDK/CLI/libs (`neetru-regras`).
