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
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ehExecucaoDireta } from '../plugins/neetru/skills/neetru-pre-push/pre-push-gate.mjs';

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
