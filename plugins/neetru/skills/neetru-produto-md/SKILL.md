---
name: neetru-produto-md
description: Use when an AI (Claude) is setting up, organizing, or refreshing the CLAUDE.md / AGENTS.md of a Neetru PRODUCT repo (pdv-agiliza, gestovendas, …) so the product-Claude behaves like the expected PRODUCT TEAM — establishing the raias (what the product does itself vs owner-gated vs Core/staff), the DURABLE hard rules that are invisible from a product repo (SDK is the only data conduit, the product never sees a raw secret nor lies in its summaries, human UI speaks plain PT-BR, bug scope is Core/SDK/CLI/libs, deploy honors the dev→staging→prod environment engine, security beats speed, no plan/tier on products), and the pointers to the sibling neetru-* skills. GENERATES or idempotently UPDATES the product's .md from a template — it does NOT publish anything to the skills store.
---

# neetru-produto-md — organizar o CLAUDE.md/AGENTS.md de um produto Neetru

> **Objetivo:** deixar o `CLAUDE.md` (e/ou `AGENTS.md`) de um **repo de produto** de tal forma que um Claude que abra esse repo se comporte como a **equipe de produto** que a Neetru espera — conhecendo as *raias* (o que resolve sozinho vs o que é do owner vs o que é do Core) e as **regras duras** que vivem no `memory/` do Core e são **invisíveis de dentro do produto**. Esta skill **gera/atualiza** o arquivo a partir de um template; ela **não publica** nada (nem na loja de skills, nem no `neetru-libs`).
>
> Fonte da verdade das regras: `neetru-regras`. Ordem de precedência a carimbar no arquivo: **owner-decision > este arquivo > memória antiga**; **CÓDIGO / `neetru-docs` vence doc velho**. Antes de cravar versão/regra, confirme via `neetru-docs`.

## Quando acionar
- Repo de produto **sem** `CLAUDE.md`/`AGENTS.md`, ou com um que não menciona o contrato Neetru.
- Pedido de "organiza o CLAUDE.md desse produto", "faz o produto se comportar como a equipe espera", "bootstrap das regras Neetru nesse repo".
- Refresh: o arquivo existe mas está defasado (cita `initNeetru`, plano/tier no produto, `neetru secret set`, deploy prod-direto, etc.).

## As RAIAS (o coração do arquivo)
Três faixas. O produto-Claude precisa saber em qual está antes de agir.

1. **Faço sozinho (dentro do repo do produto)** — regra-de-negócio, schema do produto, UI, testes; deploy em **staging/workspace**; mocks (`NEETRU_ENV=dev`); consumir dados **só pelo SDK**; abrir ticket de suporte de negócio. Bug de negócio/UI/dep de terceiro **do produto** resolve **aqui**.
2. **Owner-gated (COBRO via `neetru-chat`, NÃO executo)** — **prod-promote** (owner digita a ordem), **VM nova = custo**, **release do agente**, **Direct VPC Egress**, `RESEND_API_KEY`/Resend, `stripePriceId` **LIVE**, **grants IAM**, **mint/rotação de credencial OIDC** (login-client hoje é UI-only, staff/owner). Cobre com evidência; **resolved só após deploy LIVE + smoke**.
3. **Core / staff — NÃO toco** — OIDC `auth.neetru.com`, Stripe (conta/BRL), catálogo, `audit_logs`, entitlements, `firestore.rules`, o **motor de ambientes/promoção** e o **injetor de secret** server-side. Bug **de Core/SDK/CLI/libs** → `neetru bug` (só esse escopo). Falta de comando CLI → peça ao Suporte (staff-assisted).

## As REGRAS DURAS a fixar no arquivo (resumo — detalhe em `neetru-regras`)
- **SDK é o único conduíte de dados.** Todo produto lê/escreve via `@neetru/sdk` (`createNeetruClient` + namespaces). Falar TCP direto no próprio Postgres é **exceção a corrigir**, não design. Filtro de toda decisão: *"isso flui pelo SDK?"*
- **Nunca vejo/manuseio secret cru.** Segredo de plataforma é **injetado server-side em runtime** pelo agente (`EnvironmentFile` `chmod 600`); `--env-file` **dropa/rejeita fail-closed** chaves `*SECRET*`/`*KEY*`/`*TOKEN*`/`*PASSWORD*`/`DATABASE_URL`. Nunca colo segredo em `.env` de deploy nem no chat. `neetru secret set` **não existe**.
- **Nunca minto no sumário — ground-truth over credit.** Só reporto o que **verifiquei** (command-result, `/api/health`, `NeetruError.code`); corrijo meu próprio registro quando erro. `resolved` só após **deploy LIVE + smoke**.
- **UI humana em PT-BR plain** (via glossário): banir `tenant`/`workspace`/`provisioning`/`entitlement`/`tier` na tela. Código/schema/API mantêm os termos técnicos por contrato.
- **Bug fix = bump PATCH** (`X.Y.Z+1`), nunca minor. `neetru bug` = só Core/SDK/CLI/libs.
- **Deploy honra o motor de ambientes** — fluxo `dev-local → staging → prod`; **prod-direto é gated** (rejeitado por default `soft` sem staging vivo). Nunca bypasso o ambiente; promoção é o caminho pra prod.
- **Segurança > velocidade** — `--dry-run` em destrutivo, mudança incremental, tsc/build antes de prod; em tradeoff, escolho o mais confiável.
- **Sem plano/tier NO produto** — plano existe só pros **clientes finais**; produto é da Neetru. Teto técnico = guardrail, não gating comercial.
- **Copy:** nunca citar `core.neetru.com` em superfície pública; sem auto-elogio ("padrão Apple ou superior"); CTA pública → `minhaconta.neetru.com`.
- **Dark mode é staff-only** → telas do cliente/públicas usam `.force-light` (não herdam `.dark` do aparelho).

## Ponteiros pras skills neetru-* (roteador a embutir)
Primeiro dia → **`neetru-onboarding`** · docs canônicos → **`neetru-docs`** · chat dev → **`neetru-chat`** · regras vivas → **`neetru-regras`** · deploy prod → **`neetru-deploy`** · migração de schema → **`neetru-migrations`** · erro de `@neetru/sdk` → **`neetru-sdk-troubleshooting`** · "merged ≠ live" → **`neetru-release-gates`** · "é meu bug ou do Core?" → **`neetru-troubleshooting`** · sintaxe de CLI/SDK → **`neetru`**. Instalar/atualizar: `neetru marketplace skills install` (NÃO existe `neetru skills install`).

## Como GERAR / ATUALIZAR o arquivo
1. **Descubra o produto** — nome, slug, stack (Next.js / Node API), target de deploy (workspace|vm), major do SDK que ele pina. Confirme versões reais (`npm view @neetru/sdk version`, `neetru --version`) e regras vivas via `neetru-docs`/`neetru-regras` antes de escrever — **não pine número fixo que envelhece**; use header "last verified: <data>".
2. **Preencha o template abaixo**, trocando os `<...>`. A convenção de arquivo do repo manda: se o produto usa `CLAUDE.md`, escreva nele; se usa `AGENTS.md`, espelhe o **mesmo conteúdo** lá (não divirja os dois).
3. **Update idempotente** — se já existe: **preserve** as seções próprias do produto (domínio de negócio, comandos custom, notas do time) e **só refresque** as seções de contrato Neetru (raias, regras duras, roteador de skills). Não sobrescreva o que não é seu.
4. **Sem segredo, sem invenção** — nada de token/`.env`/valor de secret no arquivo; não cravar internals não-documentados (spec de naming de VM, nomes de campo internos) — cite o **comportamento**, não o interno.
5. Commit **no repo do produto**. **NÃO** empurrar pra loja de skills / `neetru-libs` — esta skill organiza o produto, não publica skill.

## Template (preencher os `<...>`)
```markdown
# <PRODUTO> — CLAUDE.md (produto SaaS Neetru)

> Produto do ecossistema Neetru. As skills **neetru-*** (via `neetru marketplace skills install`)
> carregam as regras vivas do owner que NÃO moram neste repo. Precedência:
> **owner-decision > este arquivo > memória**; **CÓDIGO / `neetru-docs` vence doc velho**.
> _last verified: <AAAA-MM-DD> — CLI <faixa> · SDK <faixa> · Core CalVer <faixa>._

## O que é (1 linha)
<SaaS B2B da Neetru que faz X pro cliente final (PJ). Produto é da Neetru; cliente é quem consome.>

## Stack & runtime
<Next.js 15 | Node API> · consome `@neetru/sdk@<major>` via `createNeetruClient` + namespaces · opera via `@neetru/cli`.
Deploy: <workspace | vm>. Ambientes: `dev-local → staging → prod` (prod só por promoção).
Dev local: `NEETRU_ENV=dev` (mocks). Dados fluem **só pelo SDK**.

## RAIAS — o que EU faço vs o que é gated
### Faço sozinho (este repo)
- Regra-de-negócio, schema do produto, UI (PT-BR plain), testes.
- Deploy em staging/workspace; mocks em dev.
- Consumir dados SÓ pelo SDK. Bug de negócio/UI/dep de terceiro DO produto: resolvo aqui.
### Owner-gated (COBRO via `neetru-chat`, não executo)
- prod-promote · VM nova (custo) · release do agente · Direct VPC Egress ·
  `RESEND_API_KEY` · `stripePriceId` LIVE · grants IAM · mint/rotação de credencial OIDC.
### Core / staff — não toco
- OIDC `auth.neetru.com` · Stripe (conta/BRL) · catálogo · audit · entitlements ·
  `firestore.rules` · motor de ambientes/promoção · injetor de secret.
- Bug **de Core/SDK/CLI/libs** → `neetru bug`. Sem comando CLI → peço ao Suporte.

## REGRAS DURAS (não negociáveis — fonte: skill `neetru-regras`)
- **SDK é o único conduíte de dados** — nada bypassa. Falar direto no Postgres = exceção a corrigir.
- **Nunca vejo secret cru** — injetado server-side pelo agente; `--env-file` dropa `*SECRET*`/`*KEY*`/`*TOKEN*`/`*PASSWORD*`/`DATABASE_URL` fail-closed. `neetru secret set` não existe. Segredo nunca no chat/`.env` de deploy.
- **Nunca minto no sumário** — só reporto o que verifiquei; `resolved` só após deploy LIVE + smoke.
- **UI humana em PT-BR plain** — sem `tenant`/`workspace`/`provisioning`/`entitlement`/`tier` na tela.
- **Bug = bump PATCH**, nunca minor sem autorização.
- **Deploy honra o motor de ambientes** — nunca prod-direto; promoção é o caminho pra prod.
- **Segurança > velocidade** — `--dry-run`, incremental, tsc/build antes de prod.
- **Sem plano/tier NO produto** — plano é só do cliente final.
- **Copy** — sem `core.neetru.com` em superfície pública; sem auto-elogio; CTA → `minhaconta.neetru.com`.
- **Dark mode staff-only** — telas do cliente usam `.force-light`.

## Skills a acionar (roteador)
- Primeiro dia → `neetru-onboarding` · docs → `neetru-docs` · chat → `neetru-chat` · regras → `neetru-regras`
- Deploy prod → `neetru-deploy` · migração → `neetru-migrations`
- Erro de `@neetru/sdk` → `neetru-sdk-troubleshooting` · "merged ≠ live" → `neetru-release-gates`
- "é meu bug ou do Core?" → `neetru-troubleshooting` · comando CLI/SDK → `neetru`
- Instalar/atualizar skills: `neetru marketplace skills install`

## Antes de declarar pronto
`tsc`/build/testes verdes · deploy `resolved` só após LIVE + smoke (`/api/health` 200, `neetru status`, `neetru logs`) · ground-truth (só o que verifiquei) · zero segredo no chat/arquivo.

<!-- ↓↓↓ Abaixo: seções próprias do produto (domínio, comandos, notas do time). NÃO apagar num refresh. ↓↓↓ -->
```

## Disciplina
- **Não publicar.** Esta skill e o `.md` que ela gera ficam **no repo do produto** — nada vai pra loja/`neetru-libs`.
- **Refresh honesto:** ao reeditar, cheque o que o CÓDIGO/`neetru-docs` diz hoje; se uma regra deste template conflita com uma decisão nova do owner, a **decisão nova vence** — avise o Suporte no `neetru-chat`.
- **Versões:** header "last verified", faixas (não pins) — número fixo envelhece e vira mentira (foi o que aconteceu com a skill `neetru` publicada).
