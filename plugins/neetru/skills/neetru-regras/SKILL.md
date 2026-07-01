---
name: neetru-regras
description: Use when an AI (Claude) working on a Neetru PRODUCT or the Core is about to make an architecture, data-access, versioning, copy, UI-vocabulary, billing, VM-naming or bug-reporting decision — to honor the owner's DURABLE rules ("REGRA DURA") that govern the ecosystem but live in the Core's memory/ and are INVISIBLE from a product repo. Read before assuming a design is "ok": the SDK is the only conduit to data (no product bypasses its DB), products NEVER get plan/tier limits, a bug fix bumps only PATCH, `neetru bug` is Core/SDK/CLI/libs only, copy never cites core.neetru.com nor self-praises, human UI speaks plain PT-BR, dark mode is staff-only, and security beats speed.
---

# neetru-regras — as REGRAS DURAS do owner (invisíveis fora do Core)

> Estas decisões do owner vivem em `memory/feedback_*.md` do Core e **um Claude rodando num repo de produto não as vê**. Use antes de assumir que um design é "ok". Em conflito: **owner-decision/CLAUDE.md > memória antiga**, e **CÓDIGO > doc/histórico**. Em dúvida, confirme via `neetru-docs`.

## Arquitetura / dados
- **O SDK (`@neetru/sdk`) é o conduíte canônico de TODOS os dados de TODOS os produtos.** Nenhum produto bypassa — falar TCP direto no próprio Postgres é **exceção a corrigir**, não design. Filtro de toda decisão: *"isso flui pelo SDK?"* (regra owner 2026-06-15).
- **Produtos são da Neetru; o Core é a infra interna deles.** NUNCA aplique plano/tier/permissão **AOS produtos** — plano só existe pros **CLIENTES finais** que consomem o produto. Teto técnico = guardrail operacional, não gating comercial.

## Versão / bug
- **Bug fix = bump PATCH** (`X.Y.Z+1`), **NUNCA** minor. Minor só pra feature grande; major/breaking só com autorização verbal. Vale produto + SDK/CLI/agente/libs.
- **Escopo de `neetru bug`:** só Core/SDK/CLI/libs/glossário/contrato-de-schema. Regra-de-negócio, UI custom ou dep de terceiro **do produto** o Claude do produto resolve **no repo do produto** (reporte inválido → `wont_fix` + comentário educativo).

## Segurança / operação
- **Segurança e confiabilidade ACIMA de velocidade.** `--dry-run` em destrutivo, mudanças incrementais revisáveis, type-check/build antes de prod. Em tradeoff, escolha o caminho mais confiável.
- **Codex review por prudência** sempre que possível antes de commit/deploy (camada extra além do gate FULL).
- **VMs são multipropósito e densas** (vários bancos/produtos juntos); naming **`snee-NNN-role`**, NUNCA slug de produto. (Nota: o spec formal `snee-NNN-role` está em memória do Core, não nos docs públicos.) Agente sempre na última versão.

## Marca / superfícies
- **Vocabulário plain PT-BR** na UI humana (via `neetru-glossario`): banir `tenant`/`workspace`/`provisioning`/`entitlement`/`tier`. Código/schema/API mantêm os termos técnicos por contrato.
- **Fronteira público↔interno:** NUNCA citar `core.neetru.com` em superfície pública; Core ≠ IaaS pro cliente; CTA pública → `minhaconta.neetru.com`. **Proibido copy auto-elogiosa** ("padrão Apple ou superior" etc.) — excelência se demonstra, não se declara.
- **Dark mode é staff-only.** Landing/portal/login/mfa são brancas por design → usar `.force-light` (não herdar `.dark` do aparelho). No painel Core use tokens, nunca `bg-white` fixo.

## Billing
- **Stripe = conta única + BRL apenas** (sem Connect, sem multi-moeda). O `checkout` do SDK assume isso (decisões CEO 2026-05-07).

## Como confirmar a regra viva
owner-decision/CLAUDE.md vence memória antiga; código vence doc em conflito. Antes de afirmar uma regra, cheque via `neetru-docs`. Se uma decisão nova do owner contradiz algo aqui, **a decisão nova vence** — e avise o Suporte no `neetru-chat` pra atualizar.
