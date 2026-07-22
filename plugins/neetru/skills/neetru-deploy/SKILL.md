---
name: neetru-deploy
description: Use when an AI (Claude) building a Neetru product (pdv-agiliza, gestovendas, …) is shipping to PRODUCTION via `neetru deploy --target vm` (or cloud-run) — the ORDERED path plus the traps that bite product-Claudes: an app that boots WITHOUT its OIDC/SDK secret (because `--env-file` drops *SECRET*/*KEY*/*TOKEN*/*PASSWORD*/DATABASE_URL fail-closed), a `--domain` that did not map (VM vhost vs Cloud Run mapping), an artifact download that 500s, an agent fix that is "merged but not live", or a status stuck `degraded` right after deploy (cold-start false positive). For COMMAND SYNTAX use the `neetru` skill; this is the WORKFLOW + diagnosis. For schema migrations use `neetru-migrations`.
---

# neetru-deploy — levar um produto a PRODUÇÃO sem tropeçar

> `neetru` (skill) é a REFERÊNCIA do comando. Esta é o **caminho ordenado + armadilhas + gates**. Confirme versões reais antes de operar: `npm view @neetru/cli version` / `neetru --version`. Detalhe canônico via `neetru-docs` (`07-deploy`, `GUIA_AGENT_VM`, `TROUBLESHOOTING_VM`); regras de decisão em `neetru-regras`; triagem de falha em `neetru-troubleshooting`.

## Caminho ordenado VM → prod
1. `neetru build [--stack node|docker|php-apache|static]` → gera o artefato.
2. **Usar VM EXISTENTE** — `neetru servers list` (VMs são multipropósito/densas). **NUNCA** provisionar VM nova em silêncio: VM nova = **custo, owner-gated** (`neetru-regras`).
3. `neetru deploy --target vm --server <id> --domain <host> --port <interna> [--env-file .env] [--artifact-url … --artifact-sha256 …] --env prod --non-interactive` — **confira as flags exatas com `neetru deploy --help`** (o `cli-reference` pode divergir do CLI instalado; ex: `--env` é usado em campo mas não consta na referência lida).
4. Agente sobe o vhost → injeta o secret server-side → app no ar.
5. Smoke: `/api/health` 200 + `neetru status` + `neetru logs -f --json`.

## 🔴 Armadilha #1 — `--env-file` DERRUBA segredos (fail-closed)
Em `--target vm`, o Core **rejeita/derruba** chaves cujo nome casa `*SECRET*` / `*KEY*` / `*TOKEN*` / `*PASSWORD*` / `DATABASE_URL` (fail-closed — comportamento confirmado em campo pelo pdv). Logo **`NEETRU_OIDC_CLIENT_SECRET`/`NEETRU_API_KEY` NÃO sobrevivem ao `--env-file`** → o app sobe sem credencial → `missing_api_key`/`unauthorized` SÓ em prod (passa em dev por causa dos mocks).
- Segredo de plataforma é **injetado server-side em runtime** pelo agente, que grava o `EnvironmentFile` com `chmod 600` (`/etc/neetru/<slug>.env`) — ref `bug_5b6bb0d7` / `BLUEPRINT_SDK_CRED_INJECTION` + `src/app/api/internal/agent/sdk-credentials/issue/route.ts`.
- **`neetru secret set` NÃO existe** (documentado num doc, mas não implementado — não use).
- `--env-file` é pra **config não-secreta**. Segredo = Core injeta. Nunca cole segredo em `.env` de deploy nem no chat.

## 🔴 Armadilha #2 — `--domain` inline (VM) ≠ `hosting create-mapping` (Cloud Run)
- **VM:** `--domain <host>` no `deploy` faz o agente criar o **vhost Apache** na VM. É o caminho certo pra app em VM.
- **Cloud Run:** `neetru hosting create-mapping --service --domain --mfa-token` (destrutivo top-tier, CNAME→`ghs.googlehosted.com`). **Em VM isso dá 403** (`run.domainmappings.create`) — não é teu erro, é o caminho errado pro target.
- Regra: target VM → `--domain` inline; target cloud-run → `hosting create-mapping`.

## 🔴 Armadilha #3 — build de prod compilado com env=dev (`.env.local` venceu `.env.production`)

O Next.js carrega `.env.local` (disco do dev) ANTES de `.env.production` e não sobrescreve valores já definidos — um `.env.local` esquecido com `NEETRU_ENV=dev` fazia o passo 1 (`neetru build`) compilar o bundle de PRODUÇÃO com `NEXT_PUBLIC_NEETRU_ENV=dev`, ativando `MockAuth` no SDK — login real desativado silenciosamente, sem erro nenhum no deploy (incidente pdv-agiliza, 2026-07-22).

- `neetru build` (>= 2.26.2, stacks `node`/`static`) já força `NEXT_PUBLIC_NEETRU_ENV=<targetEnv>` (default `prod`) via spawn-env — automático, sem ação do dev. Use `--target-env dev|workspace|prod` só se quiser um valor diferente do default de propósito.
- Se `next.config.mjs` envolver `withNeetruBuildGuard` (`@neetru/sdk/build-guard`, >= 3.1.15), o passo 1 já **recusa empacotar o tarball** se o env compilado divergir — o sintoma vira erro claro no build, não "login misteriosamente não funciona" descoberto depois do deploy.
- Sintoma se AINDA acontecer (produto sem o guard, ou build feito fora do `neetru build`): botão de login não abre popup nem redireciona — `MockAuth.signIn()` só finge login em memória, nunca navega pro IdP real. Ver `neetru-sdk-troubleshooting`.

## Exit codes do deploy → ação
`1` validação (cheque flags) · `2` 401 (token: `neetru login`) · `3` 403 (permissão/escopo) · `4` 5xx/rede (Core/artefato — pode ser transitório, ver artefato abaixo) · `5` 501 (target/stack não suportado).

## Artefato 500 / ~300 MiB
Download de artefato falhando com 500 era `bug_db02a2ce` (proxy do Core estourava em artefato grande). Fix `8f144bba` **LIVE** em Core ≥ `00233-xus` + CLI ≥ `2.12.20`. Se persistir, confirme versões e reporte (`neetru-troubleshooting`).

## Gating por release do agente — "merged ≠ live"
Uma capacidade de VM (backup, logs, db apply) só funciona se o **binário do agente NO CAMPO** tiver o handler. `merged no main` ≠ `live na frota`. Confira a versão da frota vs `gs://neetru-agent-releases/vX/`. Cuidado com **self-update cosmético** (a versão reportada mente — `bug_b4d009f6`): confira o **hash do binário rodando vs o `.sha256` do release no GCS**, não só o número. Backup só fecha com agente ≥ release que traz o fix (ver `neetru-release-gates`).

## Cold-start = falso-positivo
`degraded`/`503` logo após deploy/flip/idle é esperado (Core `min-instances=0`). **Re-teste quente** antes de diagnosticar falha. Não é o teu produto (`neetru-troubleshooting` › cold-start).

## Owner-gates do deploy (cobre, não executa)
VM nova (custo) · release do agente · Direct VPC Egress · Stripe LIVE. Cobre via `neetru-chat` ao Suporte/Dev Core; **resolved só após deploy LIVE + smoke**.

## Verificação read-only
`neetru status` · `neetru logs -f --json --product=<slug>` · `curl /api/health` (`.sha`/`.revision`) · heartbeat do agente em `neetru servers list`.
