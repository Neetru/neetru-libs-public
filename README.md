# Skills Neetru para Claude Code

Skills do ecossistema Neetru para Claude Code. Cobrem o CLI control plane
(`@neetru/cli`), o SDK runtime (`@neetru/sdk`) e as libs de apoio, com os
comandos e assinaturas reais.

> Este README é publicado na loja pública `Neetru/neetru-libs-public`, onde ele
> fica na **raiz** — os caminhos abaixo não têm prefixo `claude-skills/`.

## O que tem aqui

`plugins/neetru/skills/<nome>/SKILL.md` — uma pasta por skill:

| Skill | Pra quê |
|---|---|
| `neetru` | CLI `neetru …` e SDK `@neetru/sdk` — comandos, namespaces, libs de apoio |
| `neetru-onboarding` | Primeiro dia num produto Neetru |
| `neetru-docs` | Doc canônica + roteiro até produção |
| `neetru-deploy` | Levar um produto a produção |
| `neetru-migrations` | Mudança de schema em produção |
| `neetru-pre-push` | O gate de pré-push (o CI local) |
| `neetru-release-gates` | "merged ≠ live": o que a frota de fato roda |
| `neetru-troubleshooting` | "é meu bug ou do Core?" |
| `neetru-sdk-troubleshooting` | Erro de `@neetru/sdk`, sintoma → causa → fix |
| `neetru-produto-md` | CLAUDE.md / AGENTS.md de um repo de produto |
| `neetru-regras` | Regras duras do owner |
| `neetru-trabalho-continuo` | Postura de trabalho contínuo |
| `neetru-chat` | Chat de dev entre agentes |
| `neetru-identidade` | Material de marca: manual, logo, paleta, identidade de produto, papelaria, régua visual das peças |
| `neetru-agencia` | Marketing próprio: peças, anúncios, legendas, campanha, aprovação do dono |

## Versões

**Nenhuma versão é fixada aqui de propósito.** Número em texto envelhece e vira
mentira — foi assim que esta loja chegou a ensinar uma `@neetru/sql-guard` com
furo crítico aberto. Confirme em runtime:

```bash
npm view @neetru/cli version
npm view @neetru/sdk version
npm view @neetru/sql-guard version   # piso de segurança: >=0.1.9
```

## Instalação

Ver [INSTALL.md](./INSTALL.md). Resumo:

```bash
# com a CLI Neetru (recomendado)
neetru archive skills install

# ou via marketplace do Claude Code
claude plugin marketplace add Neetru/neetru-libs-public --scope user
claude plugin install neetru@neetru --scope user
```

## Pra quem edita

A fonte é o repo privado `Neetru/neetru-libs`, em `claude-skills/`. **Esta loja é
espelho** — editar direto aqui é perder o trabalho no próximo espelhamento. Veja
a seção final do `INSTALL.md`.

## Licença

UNLICENSED — uso interno Neetru. Repositório público para distribuição das
skills; isso não concede licença de uso do código.

## Links

- Repo CLI: `Neetru/neetru-cli`
- Repo SDK: `Neetru/neetru-sdk`
- Repo agente: `Neetru/neetru-agent-service-vm`
- Repo libs (privado): `Neetru/neetru-libs`
