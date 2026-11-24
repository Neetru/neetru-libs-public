---
name: neetru-regras
description: Use when an AI (Claude) working on a Neetru PRODUCT repo is about to make an architecture, data-access, versioning, copy, UI-vocabulary, billing, VM-naming or bug-reporting decision — to honor the owner's DURABLE rules ("REGRA DURA") that govern the ecosystem but live in the Core's memory/ and CLAUDE.md and are INVISIBLE from a product repo. Read before assuming a design is "ok": the SDK is the only conduit to data (no product bypasses its DB), products NEVER get plan/tier limits, a bug fix bumps only PATCH, `neetru bug` is Core/SDK/CLI/libs only, copy never cites core.neetru.com nor self-praises, human UI speaks plain PT-BR, dark mode is staff-only, and security beats speed. Inside the Core repo, CLAUDE.md and AGENTS.md already carry the public/internal boundary, dark mode and the pre-push gate — read them there.
---

# neetru-regras — as REGRAS DURAS do dono, para quem está fora do Core

> Estas decisões vivem em `memory/feedback_*.md` e no `CLAUDE.md` do Core, e **um Claude num repo de produto não os vê**. **Quem está dentro do Core** lê o `CLAUDE.md` e o `AGENTS.md` (fronteira público/interno, dark mode, gate de pre-push, comandos): esta skill não os repete para ele. Em conflito: **decisão do dono/`CLAUDE.md` > memória antiga**, e **código > doc**. Em dúvida, a resposta está nos docs (`neetru-docs`: síntese do capítulo, depois o doc pelos metadados).

## Arquitetura e dados
- **O SDK (`@neetru/sdk`) é o conduíte de TODOS os dados de TODOS os produtos.** Nenhum produto o contorna: falar TCP direto no próprio Postgres é exceção a corrigir, não design. Filtro de toda decisão: *«isso flui pelo SDK?»* (regra do dono, 15/06/2026).
- **Produtos são da Neetru; o Core é a infra interna deles.** Nunca aplique plano, tier ou permissão **aos produtos**: plano só existe para os **clientes finais** que usam o produto. Teto técnico é guardrail operacional, não gating comercial.

## Versão e bug
- **Bug fix = bump PATCH** (`X.Y.Z+1`), nunca minor. Minor só para feature grande; major ou breaking só com autorização verbal. Vale para produto, SDK, CLI, agente e libs.
- **Escopo de `neetru bug`:** só Core, SDK, CLI, libs, glossário e contrato de schema. Regra de negócio, UI própria ou dependência de terceiro **do produto** o Claude do produto resolve **no repo do produto** (reporte fora do escopo vira `wont_fix` com comentário que ensina).

## Segurança e operação
- **Segurança e confiabilidade acima de velocidade.** `--dry-run` em destrutivo, mudança incremental e revisável, type-check e build antes de produção. Entre dois caminhos, o mais confiável.
- **O pre-push local É o CI** (o GitHub Actions da org está sem cobrança): todo repo Neetru tem o gate e push direto para `main` é bloqueado. Pular o gate (`NEETRU_SKIP_PREPUSH=1`) só em emergência, com o motivo escrito no PR; `--no-verify`, nunca. Repo sem gate: adote. Etapas, modo CI remoto e diagnóstico: `neetru-pre-push`.
- **Licenças (dono, 29/10/2026):** nada AGPL em lugar nenhum; SSPL (MongoDB) só como banco interno, nunca oferecido a terceiros como serviço; GPL nunca no que é distribuído (e, no distribuído, nem LGPL). A etapa `licencas` do pre-push barra AGPL, SSPL e GPL no que roda. Exceção só com motivo escrito no `package.json`.
- **Codex review por prudência**, sempre que possível, antes de commit ou deploy (uma camada além do gate completo).
- **VMs são multipropósito e densas** (vários bancos e produtos juntos). O nome é `snee-NNN-role`, nunca o slug de um produto. O agente fica sempre na última versão.

## Marca e superfícies
- **Português plain na UI humana.** Jargão estrangeiro sai da tela: `tenant`, `workspace`, `provisioning`, `entitlement`, `tier`, `provider`, `deployment`, `customer`, `staff` (e `billing` e `dunning` na tela do cliente). A biblioteca `neetru-glossario` guarda os termos e o Core tem o `lint:jargao`. Código, schema e API mantêm os nomes técnicos por contrato.
- **Público × interno:** superfície pública nunca cita `core.neetru.com`; a chamada para entrar é `minhaconta.neetru.com`; o Core não é IaaS para o cliente. **Copy sem auto-elogio** («padrão Apple ou superior»): excelência se demonstra, não se declara.
- **Dark mode é só do painel staff.** Landing, portal, login e MFA são claros por desenho: use `.force-light` e não herde o `.dark` do aparelho. No painel do Core, tokens, nunca `bg-white` fixo.

## Cobrança
- **Só BRL**, sem multi-moeda (decisão do CEO, 07/05/2026). O gateway e o desenho da cobrança mudaram desde então: confirme no `CLAUDE.md` do Core e no código antes de afirmar «é Stripe» ou «é Mercado Pago».

## Se a regra mudou
A decisão nova do dono vence esta lista. Avise no `neetru-chat` para atualizar a skill.
