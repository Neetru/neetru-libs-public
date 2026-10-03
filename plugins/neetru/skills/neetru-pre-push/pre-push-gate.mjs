#!/usr/bin/env node
/**
 * pre-push-gate.mjs — gate de pré-push PADRÃO do ecossistema Neetru (portátil).
 *
 * Distribuído pela skill `neetru-pre-push` (loja Neetru/neetru-libs-public).
 * Copie pra `scripts/pre-push-gate.mjs` do repo e ligue o hook (ver SKILL.md).
 * Sem dependências: só Node >= 18 e git. Detecta a stack sozinho.
 *
 * Contrato (igual em todo repo Neetru — o Core usa a variante estendida
 * `scripts/pre-push-check.mjs`, com os mesmos flags):
 *   - push direto pra main/master: BLOQUEADO (fluxo branch -> PR -> merge)
 *   - push só de remoção de ref: não valida nada
 *   - etapas abortam na primeira falha; nada é enviado
 *   - etapas rodam SEM as variáveis de repositório que o git exporta pro hook
 *     (GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE...) — ver sanitizeGitEnv
 *   - repo de PRODUTO (neetru.config.json) com docs/** alterado: etapa docs
 *     (`neetru docs check --changed --offline`); sem a CLI >= 2.31.0, pula com aviso
 *
 * Etapas (Node — scripts do package.json, na ordem):
 *   typecheck  script `typecheck`; senão `lint` se ele for `tsc --noEmit`;
 *              senão `npx tsc --noEmit` se existir tsconfig.json
 *   lint       script `lint` (se não foi usado como typecheck)
 *   docs       `neetru docs check --changed --offline` — só em repo de produto
 *              quando o push mexe em docs/** (protocolo de docs de produto §8.3)
 *   test       script `test`                  (pulado com NEETRU_PREPUSH_FAST=1)
 *   build      script `build`                 (só com NEETRU_PREPUSH_FULL=1)
 * Etapas (Go — go.mod na raiz): go vet ./... · go test ./... · go build ./... (FULL)
 * Override por repo: package.json -> "neetru": { "prePush": ["typecheck","test"] }
 *
 * Flags (env ou CLI):
 *   NEETRU_SKIP_PREPUSH=1     pula tudo (emergência — declare no PR)
 *   NEETRU_PREPUSH_FULL=1     inclui build
 *   NEETRU_PREPUSH_FAST=1     pula testes
 *   NEETRU_ALLOW_MAIN_PUSH=1  permite push direto pra main/master
 *   NEETRU_PREPUSH_NO_DOCS=1  pula só a etapa docs (declare no PR)
 *   --plan                    imprime o plano e sai
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROTECTED_BRANCHES = ['refs/heads/main', 'refs/heads/master'];

/**
 * Variáveis "de repositório" que o git exporta para hooks (githooks(5): "GIT_DIR,
 * GIT_WORK_TREE, etc., are exported so that Git commands run by the hook can
 * correctly locate the repository"). Num worktree o pre-push recebe
 * GIT_DIR=<repo>/.git/worktrees/<nome>. Herdadas pelas etapas, fazem QUALQUER git
 * rodado por elas — ex.: teste que cria repo em tmpdir com `git init`/`git config`/
 * `git commit` — operar no repo do push (incidente 2026-10-01: core.bare=true,
 * user.name de teste e commit "init" no clone real). Lista = `git rev-parse
 * --local-env-vars` (git 2.53) + GIT_NAMESPACE + GIT_QUARANTINE_PATH; os pares
 * GIT_CONFIG_KEY_<n>/GIT_CONFIG_VALUE_<n> saem junto com GIT_CONFIG_COUNT.
 * Transporte/credencial (GIT_SSH, GIT_SSH_COMMAND, GIT_ASKPASS,
 * GIT_TERMINAL_PROMPT...) NÃO são de repositório e ficam.
 */
export const GIT_REPO_ENV_VARS = [
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_COMMON_DIR',
  'GIT_CONFIG',
  'GIT_CONFIG_COUNT',
  'GIT_CONFIG_PARAMETERS',
  'GIT_DIR',
  'GIT_GRAFT_FILE',
  'GIT_IMPLICIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_NAMESPACE',
  'GIT_NO_REPLACE_OBJECTS',
  'GIT_OBJECT_DIRECTORY',
  'GIT_PREFIX',
  'GIT_QUARANTINE_PATH',
  'GIT_REPLACE_REF_BASE',
  'GIT_SHALLOW_FILE',
  'GIT_WORK_TREE',
];

/** Cópia de `env` sem as variáveis de repositório do git (pura; nomes sem distinção de caixa, como no Windows). */
export function sanitizeGitEnv(env = {}) {
  const out = {};
  for (const [key, value] of Object.entries(env)) {
    const k = key.toUpperCase();
    if (GIT_REPO_ENV_VARS.includes(k) || /^GIT_CONFIG_(KEY|VALUE)_\d+$/.test(k)) continue;
    out[key] = value;
  }
  return out;
}

export function parsePushLines(text) {
  return String(text ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [localRef = '', localSha = '', remoteRef = '', remoteSha = ''] = l.split(/\s+/);
      return { localRef, localSha, remoteRef, remoteSha };
    });
}

export const isDeleteRef = (r) => r.localRef === '(delete)' || /^0{40}$/.test(r.localSha ?? '');
export const isPushToProtected = (refs) =>
  refs.some((r) => PROTECTED_BRANCHES.includes(r.remoteRef) && !isDeleteRef(r));

export function parseFlags(argv = [], env = {}) {
  const has = (f) => argv.includes(f);
  return {
    help: has('--help') || has('-h'),
    skip: env.NEETRU_SKIP_PREPUSH === '1',
    full: env.NEETRU_PREPUSH_FULL === '1' || has('--full'),
    fast: env.NEETRU_PREPUSH_FAST === '1' || has('--fast'),
    allowMain: env.NEETRU_ALLOW_MAIN_PUSH === '1',
    noDocs: env.NEETRU_PREPUSH_NO_DOCS === '1',
    plan: has('--plan'),
  };
}

const npmRun = (script) => ({ name: script, cmd: 'npm', args: ['run', '--silent', script] });

/** Plano puro (testável): recebe o que existe no repo, devolve as etapas. */
export function planSteps({ pkg, hasTsconfig, hasGoMod, flags }) {
  if (hasGoMod && !pkg) {
    const steps = [{ name: 'go vet', cmd: 'go', args: ['vet', './...'] }];
    if (!flags.fast) steps.push({ name: 'go test', cmd: 'go', args: ['test', './...'] });
    if (flags.full) steps.push({ name: 'go build', cmd: 'go', args: ['build', './...'] });
    return steps;
  }

  const scripts = pkg?.scripts ?? {};
  const override = pkg?.neetru?.prePush;
  if (Array.isArray(override)) {
    return override
      .filter((s) => !(flags.fast && s === 'test'))
      .map((s) => (scripts[s] ? npmRun(s) : { name: s, error: `script "${s}" não existe no package.json` }));
  }

  const steps = [];
  const lintIsTsc = /^tsc\b.*--noEmit/.test(scripts.lint ?? '');
  if (scripts.typecheck) steps.push(npmRun('typecheck'));
  else if (lintIsTsc) steps.push({ ...npmRun('lint'), name: 'typecheck (lint)' });
  else if (hasTsconfig) steps.push({ name: 'typecheck', cmd: 'npx', args: ['tsc', '--noEmit'] });

  if (scripts.lint && !(lintIsTsc && !scripts.typecheck)) steps.push(npmRun('lint'));
  if (scripts.test && !flags.fast) steps.push(npmRun('test'));
  if (scripts.build && flags.full) steps.push(npmRun('build'));
  return steps;
}

// ─── etapa docs (template v3) ────────────────────────────────────────────────

/** Versão mínima da CLI que tem `neetru docs check`. */
export const DOCS_MIN_CLI = [2, 31, 0];

export function parseCliVersion(text) {
  const m = String(text ?? '').match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? m.slice(1, 4).map(Number) : null;
}

export function cliSupportsDocs(v) {
  if (!v) return false;
  for (let i = 0; i < 3; i++) if (v[i] !== DOCS_MIN_CLI[i]) return v[i] > DOCS_MIN_CLI[i];
  return true;
}

/** Pasta de docs do produto (`docs.root` do neetru.config.json; nunca fora do repo). */
export function docsRootOf(config) {
  const r = config?.docs?.root;
  if (typeof r !== 'string' || !r.trim() || r.includes('..') || /^([A-Za-z]:|\/)/.test(r)) return 'docs';
  return r.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '') || 'docs';
}

/**
 * Etapa docs (pura). `config` = neetru.config.json (null = não é repo de produto);
 * `changedFiles` = arquivos do push (null = não deu pra calcular → roda, fail-closed);
 * `cliVersion` = [maj, min, patch] da CLI instalada (null = ausente).
 */
export function planDocsStep({ config, changedFiles, cliVersion, flags }) {
  if (!config || flags.noDocs) return null;
  const root = docsRootOf(config);
  if (Array.isArray(changedFiles) && !changedFiles.some((f) => String(f).replace(/\\/g, '/').startsWith(`${root}/`))) return null;
  if (!cliSupportsDocs(cliVersion)) {
    const v = cliVersion ? cliVersion.join('.') : 'não encontrada';
    return { name: 'docs', skip: `CLI neetru ${v} — etapa docs pulada (precisa >= ${DOCS_MIN_CLI.join('.')}: npm i -g @neetru/cli)` };
  }
  return { name: 'docs', cmd: 'neetru', args: ['docs', 'check', '--changed', '--offline'] };
}

function gitOut(cwd, args, env) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: sanitizeGitEnv(env) });
  return r.status === 0 ? r.stdout.trim() : null;
}

/** Arquivos que o push leva (relativos à raiz). null = não deu pra calcular. */
export function pushedFiles(refs, cwd, env = process.env) {
  const files = new Set();
  for (const r of refs) {
    if (isDeleteRef(r)) continue;
    let base = /^0{40}$/.test(r.remoteSha ?? '') ? null : r.remoteSha;
    if (!base) {
      for (const ref of ['origin/main', 'origin/master']) {
        base = gitOut(cwd, ['merge-base', ref, r.localSha], env);
        if (base) break;
      }
    }
    if (!base) return null;
    const out = gitOut(cwd, ['diff', '--name-only', base, r.localSha], env);
    if (out === null) return null;
    out.split('\n').filter(Boolean).forEach((f) => files.add(f));
  }
  return refs.length ? [...files] : null;
}

function cliVersionOf(cwd, env) {
  const r = spawnSync('neetru --version', { cwd, encoding: 'utf8', shell: true, env: sanitizeGitEnv(env) });
  return r.status === 0 ? parseCliVersion(r.stdout) : null;
}

function run({ name, cmd, args }, cwd, env = process.env) {
  return new Promise((resolve) => {
    const start = Date.now();
    process.stdout.write(`\n[pre-push] -> ${name}\n`);
    // shell:true é necessário no Windows (npm.cmd/npx.cmd); args são nomes de
    // script/flags fixos, sem input do usuário. env sem GIT_DIR & cia (ver sanitizeGitEnv).
    const child = spawn([cmd, ...args].join(' '), { cwd, stdio: 'inherit', shell: true, env: sanitizeGitEnv(env) });
    child.on('error', () => resolve({ ok: false, ms: Date.now() - start }));
    child.on('exit', (code) => resolve({ ok: code === 0, ms: Date.now() - start }));
  });
}

export async function main(argv = process.argv.slice(2), env = process.env, cwd = process.cwd()) {
  const flags = parseFlags(argv, env);
  if (flags.help) {
    process.stdout.write(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0] + '*/\n');
    return 0;
  }
  if (flags.skip) {
    process.stdout.write('[pre-push] PULADO (NEETRU_SKIP_PREPUSH=1) — declare o motivo no PR.\n');
    return 0;
  }

  let stdin = '';
  try {
    if (!process.stdin.isTTY) stdin = readFileSync(0, 'utf8');
  } catch {}
  const refs = parsePushLines(stdin);
  if (refs.length > 0 && refs.every(isDeleteRef)) {
    process.stdout.write('[pre-push] só remoção de ref — nada a validar.\n');
    return 0;
  }
  if (isPushToProtected(refs) && !flags.allowMain) {
    process.stderr.write('[pre-push] push direto pra main/master BLOQUEADO (fluxo: branch -> PR -> merge).\n');
    process.stderr.write('[pre-push] emergência consciente: NEETRU_ALLOW_MAIN_PUSH=1 git push ...\n');
    return 1;
  }

  const pkgPath = path.join(cwd, 'package.json');
  const steps = planSteps({
    pkg: existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, 'utf8')) : null,
    hasTsconfig: existsSync(path.join(cwd, 'tsconfig.json')),
    hasGoMod: existsSync(path.join(cwd, 'go.mod')),
    flags,
  });

  // Etapa docs (repo de produto): entra depois do lint e antes dos testes.
  const configPath = path.join(cwd, 'neetru.config.json');
  if (existsSync(configPath) && !flags.noDocs) {
    let config = null;
    try {
      config = JSON.parse(readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''));
    } catch {
      config = {};
    }
    const changed = pushedFiles(refs, cwd, env);
    const touches = !Array.isArray(changed) || changed.some((f) => f.startsWith(`${docsRootOf(config)}/`));
    const docs = touches ? planDocsStep({ config, changedFiles: changed, cliVersion: cliVersionOf(cwd, env), flags }) : null;
    if (docs) {
      const at = steps.findIndex((st) => /^(test|go test|build)$/.test(st.name));
      steps.splice(at < 0 ? steps.length : at, 0, docs);
    }
  }

  process.stdout.write(`[pre-push] gate Neetru — ${steps.map((s) => s.name).join(' -> ') || '(nenhuma etapa)'}\n`);
  if (flags.plan) return 0;
  if (steps.length === 0) {
    process.stderr.write('[pre-push] nenhuma etapa detectada — configure "neetru.prePush" no package.json.\n');
    return 1;
  }

  const done = [];
  for (const step of steps) {
    if (step.error) {
      process.stderr.write(`[pre-push] FALHOU ${step.name}: ${step.error}\n`);
      return 1;
    }
    if (step.skip) {
      process.stdout.write(`\n[pre-push] aviso: ${step.skip}\n`);
      done.push(`${step.name} pulado`);
      continue;
    }
    const r = await run(step, cwd, env);
    done.push(`${step.name} ${(r.ms / 1000).toFixed(1)}s`);
    if (!r.ok) {
      process.stderr.write(`\n[pre-push] ABORTADO em "${step.name}". Nada foi enviado.\n`);
      return 1;
    }
  }
  process.stdout.write(`\n[pre-push] OK — ${done.join(' | ')}\n`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((c) => process.exit(c), (e) => {
    process.stderr.write(`[pre-push] erro inesperado: ${e?.stack ?? e}\n`);
    process.exit(1);
  });
}
