/**
 * Trava: as DUAS cópias do gate nesta loja têm que ser byte a byte iguais.
 *
 * A loja carrega o gate duas vezes, com públicos diferentes:
 *
 *   plugins/neetru/skills/neetru-pre-push/pre-push-gate.mjs  — o TEMPLATE que a
 *     skill `neetru-pre-push` manda copiar pra um repo Neetru novo;
 *   scripts/pre-push-gate.mjs                                — o gate que ESTA
 *     loja roda no próprio pre-push.
 *
 * Elas derivaram: o template foi em frente até 477 linhas enquanto `scripts/`
 * ficou parado em 217, duas versões atrás. Quem copiasse de `scripts/` — o
 * caminho mais óbvio, porque é o que está "rodando" — levava um gate velho sem
 * a perna de monorepo multi-stack. O repo fonte (`Neetru/neetru-libs`) tem essa
 * trava desde sempre; a loja não tinha, e foi por isso que derivou.
 *
 * Roda com o runner embutido do Node (`node --test`) — o template é "sem
 * dependências" por contrato, e o teste dele segue a mesma regra.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  ehExecucaoDireta,
  planGoSteps,
  posicaoDaEtapaDocs,
  sanitizeGitEnv,
} from '../plugins/neetru/skills/neetru-pre-push/pre-push-gate.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '..');

const TEMPLATE = 'plugins/neetru/skills/neetru-pre-push/pre-push-gate.mjs';
const COPIA = 'scripts/pre-push-gate.mjs';

/** Lê normalizando CRLF: o checkout no Windows grava CRLF e isso não é deriva. */
const ler = (rel) => readFileSync(path.join(raiz, rel), 'utf8').replace(/\r\n/g, '\n');

test(`${COPIA} está idêntico ao template da skill`, () => {
  assert.equal(
    ler(COPIA),
    ler(TEMPLATE),
    `as duas cópias do gate divergiram — a loja tem que dogfoodar o próprio template.\n` +
      `Copie ${TEMPLATE} por cima de ${COPIA}.`,
  );
});

test('o template é o arquivo que a skill neetru-pre-push manda copiar', () => {
  const skill = readFileSync(path.join(raiz, 'plugins/neetru/skills/neetru-pre-push/SKILL.md'), 'utf8');
  assert.match(
    skill,
    /pre-push-gate\.mjs/,
    'a SKILL.md deixou de citar o pre-push-gate.mjs — a trava perdeu o referente',
  );
});

// ─── P73-gates: a guarda "sou o main?" sem realpath ──────────────────────────
//
// Porta aberta sistêmica: a guarda antiga comparava só com `path.resolve`, sem
// `realpath`. Chamado por um caminho que passa por uma junction/symlink
// (convenção da casa pra repo novo: pasta em `S:` com junction em
// `Documents`), o `import.meta.url` tinha o real resolvido pelo loader do Node
// mas o `argv[1]` não, o guard dava falso e o gate saía 0 CALADO, sem rodar
// etapa nenhuma. `ehExecucaoDireta` compara pelo caminho REAL dos dois lados
// (mesmo padrão do `ehExecucaoDireta` do neetru-core, scripts/lib/execucao-direta.mjs).

test('ehExecucaoDireta', async (t) => {
  const base = mkdtempSync(path.join(tmpdir(), 'neetru-p73-junction-'));
  const real = path.join(base, 'pasta real');
  const link = path.join(base, 'pasta pelo link');
  const arquivo = path.join(real, 'script.mjs');
  mkdirSync(real, { recursive: true });
  writeFileSync(arquivo, '// sonda\n');
  symlinkSync(real, link, 'junction');
  t.after(() => rmSync(base, { recursive: true, force: true }));

  const metaUrl = pathToFileURL(arquivo).href;

  await t.test('pelo caminho real: true', () => {
    assert.equal(ehExecucaoDireta(metaUrl, arquivo), true);
  });

  await t.test('pelo caminho que passa pela junction: true (antes dava false e o gate saía 0 calado)', () => {
    assert.equal(ehExecucaoDireta(metaUrl, path.join(link, 'script.mjs')), true);
  });

  await t.test('outro arquivo: false', () => {
    assert.equal(ehExecucaoDireta(metaUrl, path.join(real, 'outro.mjs')), false);
  });

  await t.test('sem argv[1] (import por teste, REPL): false', () => {
    assert.equal(ehExecucaoDireta(metaUrl, undefined), false);
    assert.equal(ehExecucaoDireta(metaUrl, ''), false);
  });
});

// ─── P73-gates (rodada final 2): o passo "Adotar" trava em LF o gate copiado ─
//
// O template começa com shebang e diz "Fim de linha LF obrigatório (trave no
// .gitattributes)". Mas o passo "Adotar num repo que não tem" da SKILL.md só
// mandava travar `.githooks/*`. Repo que adota o gate no Windows
// (core.autocrlf=true) ao pé da letra recebia `scripts/pre-push-gate.mjs` em
// CRLF no checkout, e todo teste em vitest que importasse o gate morria em
// "SyntaxError: Invalid or unexpected token" (o vite não reconhece
// "#!...\r\n" como shebang — medido em Neetru/neetru-sdk#47). Mesma trava do
// repo fonte (Neetru/neetru-libs, scripts/pre-push-gate.test.mjs): a loja é
// quem entrega a skill, então confere ela mesma o que entrega.

/** Linhas que o passo "Adotar" da SKILL.md manda acrescentar ao .gitattributes. */
function linhasGitattributesDoAdotar(skill) {
  const ini = skill.indexOf('## Adotar num repo que não tem');
  assert.ok(ini >= 0, 'SKILL.md perdeu a seção "Adotar num repo que não tem"');
  const fim = skill.indexOf('\n## ', ini + 1);
  const secao = skill.slice(ini, fim < 0 ? undefined : fim);
  return [...secao.matchAll(/printf '([^']*)' >> \.gitattributes/g)].map((m) => m[1].replace(/\\n/g, '\n'));
}

test('SKILL.md: o passo Adotar grava em LF o hook E o gate copiado, mesmo com core.autocrlf=true', (t) => {
  const linhas = linhasGitattributesDoAdotar(ler('plugins/neetru/skills/neetru-pre-push/SKILL.md'));
  assert.ok(linhas.length > 0, 'o passo Adotar não acrescenta nada ao .gitattributes');

  const dir = mkdtempSync(path.join(tmpdir(), 'neetru-adotar-'));
  // fs.promises.rm, não rmSync: no Node 24 (Windows) o rmSync não apaga caminho com acento.
  t.after(() => rm(dir, { recursive: true, force: true, maxRetries: 3 }));
  // Sem GIT_DIR & cia: rodando dentro do hook, o git herdaria o repo do push.
  const env = sanitizeGitEnv(process.env);
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8', env });
    assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  };
  const escrever = (rel, conteudo) => {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), conteudo);
  };
  git('init', '-q');
  git('config', 'user.email', 'gate@teste.invalid');
  git('config', 'user.name', 'gate-teste');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'core.autocrlf', 'true'); // padrão do Git no Windows
  git('config', 'core.safecrlf', 'false'); // o aviso de conversão não interessa aqui
  escrever('.gitattributes', linhas.join(''));
  escrever('scripts/pre-push-gate.mjs', ler(TEMPLATE));
  escrever('.githooks/pre-push', '#!/usr/bin/env sh\nexec node "$(dirname "$0")/../scripts/pre-push-gate.mjs" "$@"\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'adota o gate');

  // Clone novo de quem chega depois: o checkout grava o arquivo do zero.
  for (const rel of ['.githooks/pre-push', 'scripts/pre-push-gate.mjs']) {
    unlinkSync(path.join(dir, rel));
    assert.equal(existsSync(path.join(dir, rel)), false, `não apagou ${rel}`);
    git('checkout', '--', rel);
    const disco = readFileSync(path.join(dir, rel), 'utf8');
    assert.ok(disco.startsWith('#!'), `${rel} sem shebang: o teste não está medindo o que diz`);
    assert.equal(disco.includes('\r\n'), false, `${rel} saiu em CRLF: o passo Adotar não trava esse arquivo em LF`);
  }
});

// ─── etapa docs: entra antes do primeiro teste ou build ─────────────────────
const nomes = (lista) => lista.map((name) => ({ name }));

test('docs: Node — antes do test', () => {
  assert.equal(posicaoDaEtapaDocs(nomes(['typecheck', 'lint', 'test', 'build'])), 2);
});

test('docs: Go na raiz — antes do go test', () => {
  assert.equal(posicaoDaEtapaDocs(planGoSteps({}, true, '.')), 1);
});

test('docs: Go aninhado — antes do go test (apps/agent), não no fim', () => {
  const passos = planGoSteps({ full: true }, true, 'apps/agent');
  assert.deepEqual(passos.map((s) => s.name), ['go vet (apps/agent)', 'go test (apps/agent)', 'go build (apps/agent)']);
  assert.equal(posicaoDaEtapaDocs(passos), 1);
});

test('docs: Node + Go aninhado — antes do primeiro teste, o do Node', () => {
  const passos = [...nomes(['typecheck', 'lint', 'test']), ...planGoSteps({}, true, 'apps/agent')];
  assert.equal(posicaoDaEtapaDocs(passos), 2);
});

test('docs: override com test:ci — antes dele', () => {
  assert.equal(posicaoDaEtapaDocs(nomes(['lint', 'test:ci'])), 1);
});

test('docs: sem teste nem build (FAST) — no fim', () => {
  const passos = [...nomes(['typecheck', 'lint']), ...planGoSteps({ fast: true }, true, 'apps/agent')];
  assert.equal(posicaoDaEtapaDocs(passos), passos.length);
  assert.equal(posicaoDaEtapaDocs([]), 0);
});

test('docs: nome que só começa parecido não conta', () => {
  assert.equal(posicaoDaEtapaDocs(nomes(['typecheck (lint)', 'testes-manuais', 'buildx', 'lint'])), 4);
});

test('docs: o gate usa posicaoDaEtapaDocs (amarração; nada de regex solto)', () => {
  for (const rel of ['../plugins/neetru/skills/neetru-pre-push/pre-push-gate.mjs', 'pre-push-gate.mjs']) {
    const fonte = readFileSync(path.join(aqui, rel), 'utf8');
    assert.ok(fonte.includes('steps.splice(posicaoDaEtapaDocs(steps), 0, docs)'), `${rel}: a etapa docs não passa por posicaoDaEtapaDocs`);
    assert.ok(!/findIndex\(\(st\) => \/\^\(test\|go test\|build\)\$\//.test(fonte), `${rel}: sobrou o regex antigo`);
  }
});

test('docs: as duas cópias do gate são idênticas', () => {
  const a = readFileSync(path.join(aqui, '../plugins/neetru/skills/neetru-pre-push/pre-push-gate.mjs'), 'utf8');
  const b = readFileSync(path.join(aqui, 'pre-push-gate.mjs'), 'utf8');
  assert.equal(a, b);
});
