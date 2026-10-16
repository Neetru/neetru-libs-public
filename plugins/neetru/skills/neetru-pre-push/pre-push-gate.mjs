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
 *   - ferramenta ausente do PATH: etapa PULADA com aviso (fail-open). Ferramenta
 *     presente que quebra: BARRA o push (fail-closed). Ver toolExists.
 *   - arquivo rastreado apagado do disco sem a remoção preparada: AVISO, nunca
 *     barra; o aviso diz como restaurar SÓ ele e volta resumido na última
 *     linha (OK, FALHOU ou ABORTADO). Ver describeDeletedTracked e
 *     lembreteApagados.
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
 *   A perna Go COEXISTE com a Node: repo polyglot (go.mod + package.json na
 *   raiz) roda as duas. Sem `go` no PATH, a perna sai como aviso, não como falha.
 * Override por repo: package.json -> "neetru": { "prePush": ["typecheck","test"] }
 *   O override SUBSTITUI a auto-detecção inteira (Node e Go) — o repo assumiu o
 *   controle e pode delegar por app — mas honra FAST (pula `test`/`test:*`) e
 *   FULL (acrescenta `build`) igual a ela. `--plan` imprime o comando real.
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
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
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

/**
 * Etapa `npm run <script>`. `detail` carrega o CORPO do script no package.json
 * porque o `--plan` imprimia só o nome e escondia o que de fato roda — num
 * monorepo multi-stack isso tornava o contorno invisível (bug_e0fb387f).
 */
const npmRun = (script, scripts = {}) => ({
  name: script,
  cmd: 'npm',
  args: ['run', '--silent', script],
  detail: typeof scripts?.[script] === 'string' ? scripts[script] : undefined,
});

/** Nome de etapa que conta como "teste" pro NEETRU_PREPUSH_FAST (`test`, `test:unit`, ...). */
export const isTestStepName = (name) => /^test(:|$)/.test(String(name ?? ''));

/**
 * O executável existe no PATH?
 *
 * FAIL-OPEN de propósito: se a própria sondagem não der resposta confiável
 * (erro de spawn, status não-numérico, SO exótico) devolvemos `true` e a etapa
 * roda. Pular validação por engano é pior do que rodar à toa — e quando a
 * ferramenta EXISTE e quebra, a etapa barra o push normalmente (fail-closed).
 * Antes disso, sem `go` no PATH a etapa saía != 0 e BARRAVA o push de um repo
 * que nem é Go, sem explicar por quê (bug_e0fb387f).
 */
const toolCache = new Map();
export function toolExists(cmd, env = process.env) {
  if (toolCache.has(cmd)) return toolCache.get(cmd);
  let found = true;
  try {
    // `where` (Windows) e `command -v` (POSIX) saem 1 quando o binário não existe.
    const probe = process.platform === 'win32' ? `where ${cmd}` : `command -v ${cmd}`;
    const r = spawnSync(probe, { shell: true, stdio: 'ignore', env: sanitizeGitEnv(env) });
    found = r.error || typeof r.status !== 'number' ? true : r.status === 0;
  } catch {
    found = true;
  }
  toolCache.set(cmd, found);
  return found;
}

/**
 * Etapas da perna Go (pura). `hasGo=false` vira um aviso, não uma falha.
 *
 * `goDir` é a pasta onde mora o `go.mod`, relativa à raiz do repo. Em monorepo
 * aninhado (`apps/agent/go.mod`) o `go vet ./...` precisa rodar LÁ — rodar na
 * raiz não acha pacote nenhum. O nome da etapa carrega a pasta pra que o
 * relatório diga ONDE validou: gate que não diz onde rodou não dá pra conferir.
 */
export function planGoSteps(flags = {}, hasGo = true, goDir = '.') {
  const onde = goDir && goDir !== '.' ? ` (${goDir})` : '';
  if (!hasGo) {
    return [{ name: `go${onde}`, skip: 'go não está no PATH — perna Go pulada (instale: https://go.dev/dl/)' }];
  }
  const cwd = goDir && goDir !== '.' ? goDir : undefined;
  const steps = [{ name: `go vet${onde}`, cmd: 'go', args: ['vet', './...'], cwd }];
  if (!flags.fast) steps.push({ name: `go test${onde}`, cmd: 'go', args: ['test', './...'], cwd });
  if (flags.full) steps.push({ name: `go build${onde}`, cmd: 'go', args: ['build', './...'], cwd });
  return steps;
}

/** Pastas em que a varredura de `go.mod` nunca entra. */
export const GO_SCAN_IGNORE = new Set(['node_modules', '.git', 'vendor', 'dist', 'build', '.next', 'testdata']);

/**
 * Onde está o `go.mod` — raiz, pasta declarada, ou achado em profundidade 1–2.
 *
 * bug_e0fb387f, segunda rodada (2026-10-11): a primeira correção olhava só
 * `<raiz>/go.mod`, então cobria o layout PLANO (go.mod e package.json juntos na
 * raiz) e deixava de fora justamente o ANINHADO — `apps/agent/go.mod` com a raiz
 * sem go.mod, que é o caso que originou o bug. A sessão do Zelo pegou isso
 * conferindo a linha depois que eu já tinha fechado o bug dizendo "monorepo
 * multi-stack resolvido". Era mais do que foi entregue, e o buraco silencioso
 * era o próprio sintoma que o bug descrevia.
 *
 * Ordem: `neetru.goDir` declarado vence (o repo sabe de si); depois a raiz;
 * depois varredura rasa. Para na profundidade 2 de propósito — ir mais fundo
 * convida a achar `go.mod` de dependência vendorizada e validar código de
 * terceiro no push de alguém.
 *
 * Devolve: a pasta (string), `null` quando não há Go nenhum, ou `{ erro }`
 * quando o repo DECLAROU uma pasta que não tem go.mod — declarado errado é erro
 * de configuração, não motivo pra cair no palpite e fazer a perna sumir calada.
 */
export function findGoDir({ pkg, exists, listDirs }) {
  const declarado = pkg?.neetru?.goDir;
  if (typeof declarado === 'string' && declarado.trim()) {
    const d = declarado.trim().replace(/\\/g, '/').replace(/\/+$/, '');
    return exists(`${d}/go.mod`) ? d : { erro: `neetru.goDir aponta "${d}", mas não há go.mod lá` };
  }
  if (exists('go.mod')) return '.';
  for (const n1 of listDirs('.')) {
    if (GO_SCAN_IGNORE.has(n1) || n1.startsWith('.')) continue;
    if (exists(`${n1}/go.mod`)) return n1;
    for (const n2 of listDirs(n1)) {
      if (GO_SCAN_IGNORE.has(n2) || n2.startsWith('.')) continue;
      if (exists(`${n1}/${n2}/go.mod`)) return `${n1}/${n2}`;
    }
  }
  return null;
}

/** Etapas declaradas em `neetru.prePush` (pura). Honra FAST e FULL igual à auto-detecção. */
export function planOverrideSteps(override, scripts = {}, flags = {}) {
  const steps = override
    .filter((s) => !(flags.fast && isTestStepName(s)))
    .map((s) => (scripts[s] ? npmRun(s, scripts) : { name: s, error: `script "${s}" não existe no package.json` }));
  // FULL só existia no caminho da auto-detecção: o override retornava cedo e
  // nunca ganhava o build (bug_e0fb387f). Só acrescenta se o repo não listou.
  if (flags.full && scripts.build && !override.includes('build')) steps.push(npmRun('build', scripts));
  return steps;
}

/** Etapas da perna Node por auto-detecção (pura). */
export function planAutoNodeSteps(scripts = {}, hasTsconfig = false, flags = {}) {
  const steps = [];
  const lintIsTsc = /^tsc\b.*--noEmit/.test(scripts.lint ?? '');
  if (scripts.typecheck) steps.push(npmRun('typecheck', scripts));
  else if (lintIsTsc) steps.push({ ...npmRun('lint', scripts), name: 'typecheck (lint)' });
  else if (hasTsconfig) steps.push({ name: 'typecheck', cmd: 'npx', args: ['tsc', '--noEmit'] });

  if (scripts.lint && !(lintIsTsc && !scripts.typecheck)) steps.push(npmRun('lint', scripts));
  if (scripts.test && !flags.fast) steps.push(npmRun('test', scripts));
  if (scripts.build && flags.full) steps.push(npmRun('build', scripts));
  return steps;
}

/** Linha do `--plan`: nome + comando REAL (+ corpo do script npm, quando houver). */
export function describeStep(step) {
  if (step.error) return `${step.name}  !! ${step.error}`;
  if (step.skip) return `${step.name}  (pulada) ${step.skip}`;
  const cmd = [step.cmd, ...(step.args ?? [])].join(' ');
  return step.detail ? `${step.name}  ${cmd}  ->  ${step.detail}` : `${step.name}  ${cmd}`;
}

/**
 * Plano puro (testável): recebe o que existe no repo, devolve as etapas.
 *
 * `hasTool(cmd)` diz se o binário está no PATH; é injetável pra teste e o
 * default `() => true` mantém a função determinística quando o teste não liga.
 *
 * bug_e0fb387f: a perna Go era `hasGoMod && !pkg`, então criar o package.json
 * de raiz — justamente a correção recomendada pra monorepo multi-stack —
 * DESLIGAVA a perna Go inteira, sem aviso nenhum. Agora as duas coexistem: um
 * repo com go.mod E package.json na raiz valida os dois lados. O override
 * `neetru.prePush` continua substituindo a auto-detecção por inteiro (o repo
 * assumiu o controle e pode delegar por app), mas agora honra FAST e FULL.
 */
export function planSteps({ pkg, hasTsconfig, hasGoMod, goDir, flags = {}, hasTool = () => true }) {
  const scripts = pkg?.scripts ?? {};
  const override = pkg?.neetru?.prePush;
  if (Array.isArray(override)) return planOverrideSteps(override, scripts, flags);

  const steps = planAutoNodeSteps(scripts, hasTsconfig, flags);
  // `goDir` é o caminho novo; `hasGoMod` segue aceito pra não quebrar chamador
  // antigo (e os testes que já existiam), valendo como goDir = raiz.
  const dir = goDir !== undefined ? goDir : (hasGoMod ? '.' : null);
  if (dir && typeof dir === 'object' && dir.erro) {
    steps.push({ name: 'go', error: dir.erro });
  } else if (typeof dir === 'string') {
    steps.push(...planGoSteps(flags, hasTool('go'), dir));
  }
  return steps;
}

// ─── aviso: fonte rastreada apagada do disco ─────────────────────────────────
//
// POR QUE ISTO EXISTE (incidente 2026-10-12, neetru-libs):
// uma limpeza de `node_modules` num repo com npm workspaces apagou 94 arquivos
// de `packages/*` — 14.258 linhas de FONTE. Em workspaces, `node_modules/@escopo/*`
// são links para `packages/*`, e uma remoção que SEGUE links (o
// `Remove-Item -Recurse` do PowerShell 5.1 faz isso com junction) leva o alvo
// junto. O dano ficou invisível até o build quebrar, longe da causa.
//
// A guarda de `node_modules` ausente/vazio não pega este caso: `node_modules`
// pode estar perfeito enquanto a fonte evaporou.

/**
 * Os comandos que o aviso manda rodar. Os testes rodam ESTES textos, do jeito
 * que alguém digitaria, no Git Bash e no PowerShell.
 *
 * `--literal-pathspecs` em todo `restore`/`rm`: depois do `--` o git lê o
 * caminho como PADRÃO, não como nome. `app/[id]/page.tsx` (rota do Next.js)
 * casa com `app/i/` e `app/d/`: sem o flag, o `restore` joga fora a edição não
 * salva desses irmãos e o `rm` APAGA do disco os que estão intactos (testado em
 * 2026-10-13, git 2.53). É a mesma classe de dano do `git restore .`.
 *
 * `restaurarTodos` roda IGUAL no Git Bash e no PowerShell: o alias `!` é
 * executado pelo sh do próprio git, então o pipe acontece lá dentro. Passar a
 * lista por pipe do PowerShell 5.1 para o git quebra de dois jeitos: caminho
 * com acento chega em octal, e o `--pathspec-from-file=-` ganha um BOM no 1º
 * caminho e recusa a lista. O alias roda na raiz do repo, de qualquer subpasta.
 *   `-z`/`-0`: caminho com espaço ou acento passa cru.
 *   `--ignore-unmerged`: um conflito de merge na lista (o `ls-files -d` lista,
 *   e até repete) não derruba o resto — sem ele o `git restore` recusa TUDO.
 *
 * `'<caminho>'` vai entre aspas simples: sem elas, `<` é operador reservado no
 * PowerShell, e caminho com espaço vira dois argumentos.
 *
 * NUNCA `git restore .`: ele volta a árvore inteira ao índice e joga fora toda
 * edição não preparada, não só os apagados. E o aviso aparece justamente
 * quando alguém acabou de perder arquivo, num clone que várias sessões editam.
 */
export const COMANDOS_APAGADOS = Object.freeze({
  listar: 'git -c core.quotePath=false ls-files -d',
  restaurarTodos:
    "git -c 'alias.restaura-apagados=!git ls-files -d -z | xargs -0 git --literal-pathspecs restore --ignore-unmerged --' restaura-apagados",
  restaurarUm: "git --literal-pathspecs restore -- '<caminho>'",
  removerUm: "git --literal-pathspecs rm -- '<caminho>'",
});

/**
 * Arquivos RASTREADOS que sumiram do disco sem a remoção estar preparada.
 *
 * Lê `git status --porcelain=v1 -z`: entradas `XY caminho` terminadas em NUL,
 * X = estado no índice, Y = na árvore de trabalho. Com `-z` o caminho vem cru,
 * sem aspas nem octal para espaço e acento. Num rename/cópia (R ou C em X ou
 * Y), o campo seguinte é o caminho de ORIGEM, não outra entrada.
 *
 * Entra todo Y = `D` (sumiu da árvore e a remoção não está no índice):
 *   ` D` rastreado e apagado; `MD`/`AD`/`RD` tinha mudança preparada e depois
 *   sumiu — o disco perdeu o arquivo do mesmo jeito.
 * Fica de fora:
 *   `D ` remoção deliberada, já no índice (Y não é `D`);
 *   `DD`/`UD` conflito de merge. Não é dano silencioso: o git já os mostra como
 *   não resolvidos e recusa o commit até alguém decidir, e a saída é resolver
 *   o merge (`git rm`/`git add`), não restaurar — `git restore` recusa caminho
 *   em conflito. No `UD` (o outro lado apagou) a nossa versão segue no disco:
 *   nada sumiu.
 */
export function parseDeletedTracked(statusZ = '') {
  const campos = String(statusZ).split('\0');
  const apagados = [];
  for (let i = 0; i < campos.length; i++) {
    const campo = campos[i];
    if (campo.length < 4) continue; // "XY " + caminho; o último campo vem vazio
    const [x, y] = campo;
    if ('RC'.includes(x) || 'RC'.includes(y)) i++; // pula a origem do rename/cópia
    if (y === 'D' && x !== 'D' && x !== 'U') apagados.push(campo.slice(3));
  }
  return apagados;
}

/**
 * Roda o `git status` e devolve os apagados (`parseDeletedTracked`), ou `null`
 * se o git não respondeu. Nunca lança: o aviso é um extra, não uma etapa.
 *
 * `--no-optional-locks`: o status não regrava o índice, então não disputa
 * `index.lock` com outra sessão no mesmo clone. `--untracked-files=no`: o que
 * não é rastreado não interessa aqui, e varrer custa.
 */
export function listDeletedTracked(cwd, env = process.env) {
  try {
    const r = spawnSync('git', ['--no-optional-locks', 'status', '--porcelain=v1', '-z', '--untracked-files=no'], {
      cwd,
      encoding: 'utf8',
      env: sanitizeGitEnv(env),
    });
    return r.status === 0 ? parseDeletedTracked(r.stdout || '') : null;
  } catch {
    return null;
  }
}

/**
 * Texto do aviso. Separado da detecção para ser testável sem tocar em git.
 *
 * É AVISO, nunca aborto: o que está apagado na árvore de trabalho e não foi
 * preparado NÃO faz parte deste push — os commits que sobem podem estar
 * perfeitos. Barrar aqui travaria um push legítimo por um estado que ele nem
 * envia. O gate grita e segue; quem decide é quem está olhando.
 *
 * O conselho não pode criar um dano novo: restaura SÓ o que sumiu (nunca
 * `git restore .`) e, se a remoção era intencional, prepara só ela, um por um —
 * nem `git add -A`, que põe arquivo não rastreado (um `.env`) no índice, nem
 * `git add -u`, que leva junto a edição não salva de outra sessão e resolve
 * conflito de merge calado, nem `git rm -r <pasta>`, que apaga também o que
 * está intacto. Remover é o caminho de exceção: uma IA que "resolve o aviso"
 * com `git rm` deixa o dano preparado para o próximo commit.
 */
export function describeDeletedTracked(arquivos = [], limite = 5) {
  if (arquivos.length === 0) return '';
  const amostra = arquivos.slice(0, limite);
  const resto = arquivos.length - amostra.length;
  const p = '[pre-push]';
  const c = COMANDOS_APAGADOS;
  return [
    '',
    `${p} ATENÇÃO: ${arquivos.length} arquivo(s) rastreado(s) sumiram do disco sem a remoção estar preparada.`,
    ...amostra.map((f) => `${p}   - ${f}`),
    ...(resto > 0
      ? [
          `${p}   … e mais ${resto}. Lista completa: ${c.listar}`,
          `${p}   (ela mostra também os conflitos de merge, às vezes repetidos; o aviso deixa os conflitos de fora)`,
        ]
      : []),
    `${p} Isso costuma ser DANO, não trabalho: em repo com workspaces, remover`,
    `${p} node_modules seguindo links apaga a fonte em packages/*. Confira antes de seguir.`,
    `${p} Restaure SÓ o que sumiu — todos de uma vez, no Git Bash ou no PowerShell (no cmd.exe não roda), de qualquer pasta do repo:`,
    `${p}   ${c.restaurarTodos}`,
    `${p}   um arquivo só, na raiz do repo: ${c.restaurarUm}`,
    `${p}   NÃO use \`git restore .\`: ele desfaz também toda edição não salva da árvore.`,
    `${p} Só se VOCÊ apagou de propósito e quer a remoção no próximo commit, um por um:`,
    `${p}   ${c.removerUm}`,
    `${p}   Na dúvida, restaure: remover deixa o dano preparado para o próximo commit.`,
    `${p} (aviso apenas — o push NÃO foi barrado por isto)`,
    '',
  ].join('\n');
}

/**
 * Lembrete que vai NA MESMA LINHA da última linha do gate: o `[pre-push] OK`
 * e também o `FALHOU …`/`ABORTADO em …`. O aviso completo sai antes das etapas
 * e some na saída delas (no gate da loja, linha 2 de 169); quem empurra com
 * `| tail` só vê a última linha. Vazio quando não há nada apagado.
 *
 * `falhou`: no incidente que originou o aviso, a fonte some, o typecheck
 * quebra e o gate ABORTA. Aí o lembrete aponta o aviso como causa provável:
 * sem ele, quem lê "ABORTADO" vai caçar erro no código.
 */
export function lembreteApagados(n = 0, { falhou = false } = {}) {
  if (!(n > 0)) return '';
  const base = ` | ATENÇÃO: ${n} arquivo(s) rastreado(s) sumiram do disco`;
  return falhou
    ? `${base} — pode ser a causa desta falha (ver aviso acima)`
    : `${base} (ver aviso acima; o push não foi barrado)`;
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

function run({ name, cmd, args, cwd: subdir }, cwd, env = process.env) {
  return new Promise((resolve) => {
    const start = Date.now();
    process.stdout.write(`\n[pre-push] -> ${name}\n`);
    // shell:true é necessário no Windows (npm.cmd/npx.cmd); args são nomes de
    // script/flags fixos, sem input do usuário. env sem GIT_DIR & cia (ver sanitizeGitEnv).
    // `subdir` existe pra perna nativa em monorepo aninhado: o `go.mod` pode
    // morar em apps/agent e `go vet ./...` precisa rodar LA, nao na raiz.
    const dir = subdir && subdir !== '.' ? path.join(cwd, subdir) : cwd;
    const child = spawn([cmd, ...args].join(' '), { cwd: dir, stdio: 'inherit', shell: true, env: sanitizeGitEnv(env) });
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

  // Dano silencioso: fonte apagada do disco sem ninguém ter mandado.
  // AVISA e segue — ver describeDeletedTracked para o porquê de não abortar.
  let apagados = 0;
  try {
    const lista = listDeletedTracked(cwd, env) ?? [];
    const aviso = describeDeletedTracked(lista);
    if (aviso) process.stdout.write(aviso);
    apagados = lista.length;
  } catch {
    // o aviso é um extra, não uma etapa: nada aqui pode derrubar o gate.
  }

  const pkgPath = path.join(cwd, 'package.json');
  const steps = planSteps({
    pkg: existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, 'utf8')) : null,
    hasTsconfig: existsSync(path.join(cwd, 'tsconfig.json')),
    goDir: findGoDir({
      pkg: existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, 'utf8')) : null,
      exists: (rel) => existsSync(path.join(cwd, rel)),
      listDirs: (rel) => {
        try {
          return readdirSync(path.join(cwd, rel), { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name);
        } catch {
          return [];
        }
      },
    }),
    flags,
    hasTool: (cmd) => toolExists(cmd, env),
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
  if (flags.plan) {
    // O resumo acima só tem nomes de script; num monorepo isso esconde o que
    // roda por app (bug_e0fb387f). Aqui vai o comando real de cada etapa.
    for (const s of steps) process.stdout.write(`[pre-push]   ${describeStep(s)}\n`);
    return 0;
  }
  // Toda saída com falha também carrega o lembrete: no incidente que originou
  // o aviso, é justamente por aqui que o gate sai (a fonte some, o typecheck quebra).
  const lembreteFalha = lembreteApagados(apagados, { falhou: true });
  if (steps.length === 0) {
    process.stderr.write(`[pre-push] nenhuma etapa detectada — configure "neetru.prePush" no package.json.${lembreteFalha}\n`);
    return 1;
  }

  const done = [];
  for (const step of steps) {
    if (step.error) {
      process.stderr.write(`[pre-push] FALHOU ${step.name}: ${step.error}${lembreteFalha}\n`);
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
      process.stderr.write(`\n[pre-push] ABORTADO em "${step.name}". Nada foi enviado.${lembreteFalha}\n`);
      return 1;
    }
  }
  process.stdout.write(`\n[pre-push] OK — ${done.join(' | ')}${lembreteApagados(apagados)}\n`);
  return 0;
}

/**
 * O script foi chamado DIRETO pelo node (e não importado por um teste)?
 *
 * Compara pelo caminho REAL dos dois lados. O loader do Node resolve
 * link/junction no `import.meta.url`, mas o `argv[1]` chega como foi digitado.
 * Só com `path.resolve` (sem realpath): chamado por um caminho que passa por
 * uma junction — convenção da casa pra repo novo é pasta em `S:` com junction
 * em `Documents` — o real do `import.meta.url` diferia do resolved do
 * `argv[1]` e o gate saía 0 CALADO, sem rodar etapa nenhuma (porta aberta
 * sistêmica P73-gates; mesmo padrão do `ehExecucaoDireta` do neetru-core,
 * scripts/lib/execucao-direta.mjs).
 */
function caminhoReal(p) {
  const absoluto = path.resolve(p);
  let real;
  try {
    real = realpathSync(absoluto);
  } catch {
    real = absoluto; // arquivo que ainda não existe: compara como veio
  }
  return process.platform === 'win32' ? real.toLowerCase() : real;
}

export function ehExecucaoDireta(metaUrl, argv1 = process.argv[1]) {
  if (!argv1) return false;
  return caminhoReal(argv1) === caminhoReal(fileURLToPath(metaUrl));
}

if (ehExecucaoDireta(import.meta.url)) {
  main().then((c) => process.exit(c), (e) => {
    process.stderr.write(`[pre-push] erro inesperado: ${e?.stack ?? e}\n`);
    process.exit(1);
  });
}
