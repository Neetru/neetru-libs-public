---
name: neetru-release-gates
description: Use when a VM feature a Neetru product needs depends on the installed `neetru-agent-service-vm` version — backup, db snapshot/apply, runtime logs (`neetru logs`), or self-update behavior — and you must check "is the handler actually LIVE on the fleet?" before declaring a feature broken or fixed. Covers the capability→minimum-release map, "merged ≠ live", cosmetic self-update (the reported version lies — check binaryHash), and why a Core cron/CLI command existing does NOT mean the VM-side handler exists. For the deploy flow see `neetru-deploy`; for migrations/backup proof see `neetru-migrations`.
---

# neetru-release-gates — "merged ≠ live no campo"

> O agente Linux (`Neetru/neetru-agent-service-vm`) roda em cada VM e executa handlers via message bus Firestore. Uma capacidade só funciona se o **binário NA VM** tiver o handler. Confirme a versão atual no handoff (`CLAUDE.md`) — **não confie em número hard-coded em doc velho** (vários citam `v1.5.0`, defasado).

## Regra mestra
Antes de usar/diagnosticar uma capacidade de VM: **confira a versão do agente no campo** (`neetru servers list` → `agentVersion`) **e** o release que traz o handler (`gs://neetru-agent-releases/vX/`). Core ter o cron/comando **NÃO** garante que o handler está na VM.

## Capacidade → release mínimo (confirmar, não decorar)
| Capacidade | Depende de | Sinal de "não está live" |
|---|---|---|
| Backup do DB em VM | agente ≥ 1.6.30 (`bug_af1ee884`) | `product_databases_backups` sem nenhum `status=completed`; warden firando `no_backups` |
| `agent.db.migrate` (migração prod na VM) | handler presente | `Unknown command: agent.db.migrate` no command-result |
| Runtime logs (`neetru logs`) | receptor + `log_ship` | logs vazios/410 |
| Self-update | compare de versão correto | loop / versão não muda |

## 🔴 Self-update COSMÉTICO — a versão MENTE
`handleAgentUpgrade` persistia `agentVersion` ANTES do swap do binário → o número sobe mas o **binário velho continua rodando** (`bug_b4d009f6`; também o bug do compare com prefixo `v`, corrigido em `v1.6.1`). 
- **Não confie só no número.** Confira o **hash do binário rodando** vs o `.sha256` do release no GCS (`gs://neetru-agent-releases/vX/…sha256`).
- Não fique disparando `check_for_update` em loop "pra consertar" — diagnostique versão real + metadata + rollback.

## Upgrade message — campos a validar (contrato do agente)
`toVersion`, hash/assinatura, `healthCheck`, `rollback` (campos do contrato Core↔agente — confirme no repo do agente). Rollback é **attempt-based** (3 restarts reais), não time-based.

## Pending command travado?
Causas de 1ª classe: schema mismatch, TTL expirado, lock, listener desconectado. Ground-truth = o doc do **command** (`servers/{id}/commands/{cid}.status`+`.result`), não a deployment doc.

## Release é OWNER-GATED
Buildar/promover binário do agente exige autorização do owner (igual publish/deploy). O Suporte prepara o **checklist de release** (ex: `RELEASE_CHECKLIST_AGENTE_1.6.30`); o owner libera; o Dev Core executa. Cobre via `neetru-chat`, não tente publicar.
