# neetru — Skills Claude Code

Skills do ecossistema Neetru para Claude Code. Cobre o CLI control plane (`@neetru/cli`) e o SDK runtime (`@neetru/sdk`) com contexto preciso sobre comandos, namespaces, versões, e libs de apoio.

## O que tem aqui

### Skill `neetru`

Skill principal. Ativa automaticamente quando o contexto menciona:

- Comandos `neetru …` (deploy, db apply, audit tail, tenants, ops, etc.)
- Imports de `@neetru/sdk` (qualquer subpath)
- Scaffold ou deploy de produto SaaS novo no ecossistema Neetru
- Libs `@neetru/db-classifier`, `@neetru/sql-guard`, `@neetru/pii-mask`, `neetru-glossario`

O que a skill sabe:

- **CLI `@neetru/cli@2.8.0`**: ~55 comandos, incluindo `neetru db` (migrations por produto), `neetru admin database` (plano de controle staff), `neetru ops` (6 scripts operacionais), destrutivos top-tier com MFA obrigatório, flags `--dry-run`/`--json`/`--yes`/`--mfa-token`.
- **SDK `@neetru/sdk@2.1.0`**: 13 namespaces com assinaturas corretas (`auth`, `catalog`, `entitlements`, `telemetry`, `usage`, `support`, `db`, `checkout`, `webhooks`, `notifications`, `errors`, `mocks`, `react`). Namespace `db` reestruturado em v2.0 (offline-first, engine-aware, suporte SQL via `client.db.sql()`). Modo dev `NEETRU_ENV=dev` com mocks in-memory.
- **Libs de apoio** (`@neetru/db-classifier`, `@neetru/sql-guard`, `@neetru/pii-mask`, `neetru-glossario`): APIs básicas e quando usar cada uma.
- **Agente Linux v1.5.0** (repo `Neetru/neetru-agent-service-vm`): contrato Core↔agente via Firestore.

## Requisitos

- Claude Code instalado
- `@neetru/cli@2.8.0` globalmente para usar os comandos no terminal: `npm install -g @neetru/cli`
- `@neetru/sdk@2.1.0` no projeto do produto SaaS: `npm install @neetru/sdk`

## Instalação

Ver [INSTALL.md](./INSTALL.md) para o passo-a-passo completo (3 opções).

**Resumo rápido — diretório local:**
```bash
claude --plugin-dir /caminho/para/neetru-libs/claude-skills
```

**Cópia manual permanente:**
```bash
cp -r claude-skills/skills/neetru ~/.claude/skills/neetru
```

## Licença

UNLICENSED — uso interno Neetru. Não distribuir externamente sem autorização.

## Links

- Repo CLI: `Neetru/neetru-cli`
- Repo SDK: `Neetru/neetru-sdk`
- Repo agente: `Neetru/neetru-agent-service-vm`
- Repo libs: `Neetru/neetru-libs`
- Painel staff: `core.neetru.com`
- Docs: `docs/sistema/manuais/devex/cli-reference/` e `docs/sistema/manuais/devex/sdk-reference/` no repo `neetru_core`
