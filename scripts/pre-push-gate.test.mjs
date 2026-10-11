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
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
