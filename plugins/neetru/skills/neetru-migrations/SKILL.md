---
name: neetru-migrations
description: Use when an AI (Claude) building a Neetru product takes a DB schema change to PRODUCTION on its per-product database via `neetru db apply` / `neetru db migrations *` on a VM engine — and hits a migration failing `type "x" already exists` (already-applied/redundant hash, "ME1"), a destructive migration that pauses demanding `migrations confirm --mfa-token`, a backup that never reaches `completed`, or needs to see WHERE/WHY a migration stopped. Covers the additive-vs-destructive gate do `@neetru/db-classifier`, ME1 + DDL idempotente, `db migrations show/resolve`, reset de migração stale `applied`→`pending` em VM reprovisionada, e backup gated por release do agente — SEM reescrever o schema caçando um bug que é do motor do Core.
---

# neetru-migrations — schema do produto → produção, sem retrabalho

> `neetru` (skill) lista a mecânica de `db apply`/`confirm`. Esta é o **caminho prod-safe + armadilhas**. Confirme versões: `neetru db --help` (`migrations show/resolve` exigem CLI ≥ 2.12.15).

## Pipeline prod-safe
1. `neetru db apply --dry-run` → lê o relatório do **`@neetru/db-classifier`** (`additive` vs `destructive`).
2. **Aditiva** → aplica. **Destrutiva** → o pipeline **PAUSA** e exige `neetru db migrations confirm <id> --mfa-token=<TOTP>` (não tem como pular; DROP/ALTER COLUMN/TRUNCATE são detectados automaticamente).
3. Em VM, roda via `agent.db.migrate` (comando no command-bus `servers/{id}/commands/{cid}`; Core não abre TCP no Postgres da VM sem Direct VPC Egress — owner-gated).

## 🔴 ME1 — migração REDUNDANTE `type "…" already exists`
Acontece quando uma migração tem o **mesmo hash** de uma já `applied` (re-aplica schema idêntico). O motor de migração do Core **deveria pular hash já-aplicado** (no-op/superseded) — é melhoria conhecida do Core, **não bug do teu schema**.
- **NÃO reescreva `schema.ts` caçando isso** — foi exatamente o retrabalho do incidente do pdv (schema intacto desde a migração anterior; o bug era do motor).
- Mitigação no produto: **DDL idempotente** — `CREATE TABLE IF NOT EXISTS`; pra **tipos** (Postgres NÃO tem `CREATE TYPE IF NOT EXISTS`) use guard `DO $$ BEGIN CREATE TYPE … ; EXCEPTION WHEN duplicate_object THEN null; END $$;`.
- Antes de re-aplicar: **junte evidência** (histórico + classifier + status anterior) e decida "é meu ou do motor?" (`neetru-troubleshooting`).

## `neetru db migrations show` / `resolve` (observabilidade — ME2)
`show` dá a flag `applied` **por-statement** + onde/por quê parou (o `list` sozinho deixa o produto cego). `resolve` marca a redundante como `applied` (com `redundantOfMigrationId`). Confirme os subcomandos com `neetru db --help`. Use antes de re-aplicar às cegas.

## VM reprovisionada → resetar stale `applied`→`pending`
Quando a VM/DB é recriada (ex: pós-incidente), migrações que constavam `applied` apontavam pro DB morto. Antes de re-aplicar na Postgres nova/vazia, as `applied` stale precisam virar `pending` (senão o dedup do ME1 pula o re-apply). No incidente recente o **Dev Core resetou isso** — confirme com ele antes de assumir.

## Backup GATED por release do agente
- Backup do DB em VM depende do **handler do agente** (não é só cron do Core) e do **release ≥ 1.6.30** (`bug_af1ee884` — gsutil precisava `HOME`/`CLOUDSDK_CONFIG` fora de root read-only).
- Backup automático só roda em migração **destrutiva** (by-design).
- **Prova de sucesso:** 1 doc em `product_databases_backups` com `status=completed` + `gcsPath` não-vazio + o `backup-warden` parar de firar `no_backups`. Até o release landar, o DB roda **sem backup automático** — cobre o release via `neetru-chat`.

## Cold-start ≠ falha de DB
DB `degraded` logo após deploy/idle costuma ser cold-start do Core (`min-instances=0`), não falha do banco — re-poll quente (`neetru-troubleshooting`).

## Verificação
`neetru db status` · `neetru db migrations show/list` · `product_databases_backups`. Resolved só após deploy LIVE + o command-result passar.
