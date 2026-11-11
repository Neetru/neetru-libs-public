/**
 * Etapa «lockfile no npm 10» do gate de pré-push (template da skill `neetru-pre-push`, que
 * este repo dogfooda em `scripts/pre-push-gate.mjs`).
 *
 * Padrão da casa (dono, 11/11/2026): produção é Node 22 LTS + npm 10, e o lockfile tem de
 * passar no `npm ci` do npm 10. O lock gerado no PC de dev (Node 24, npm 11) omitia as
 * entradas de topo `node_modules/@emnapi/*` e o `npm ci` do npm 10 reprovava com
 * «Missing: @emnapi/core@x from lock file» — só no build do deploy/CI (bug_0ba83586).
 * A etapa roda o `npm ci --dry-run` do npm 10 no pre-push, sempre (também no FAST).
 *
 * Mesmos testes da PR #80 do SDK (`src/__tests__/pre-push-gate-lockfile.test.ts`), portados
 * para o `node --test` deste repo. Tudo roda SEM rede e sem o npm 10: as funções puras são
 * testadas direto, e o fio (flags → plano → execução → falha com sintoma e conserto) com um
 * `npx` falso no PATH.
 */
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  dicaDaFalha,
  interpretarSaidaNpmCi,
  LOCKFILE_NPM10_CONSERTO,
  LOCKFILE_NPM10_STEP,
  lockfileNpm10Args,
  lockfileNpm10Steps,
  parseFlags,
  planSteps,
  quoteArg,
  resumirFalhaLockfile,
} from '../plugins/neetru/skills/neetru-pre-push/pre-push-gate.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GATE = path.join(RAIZ, 'plugins', 'neetru', 'skills', 'neetru-pre-push', 'pre-push-gate.mjs');

/** Saída do npm 10 quando o lock foi gerado pelo npm 11 (o caso real do SDK). */
const SAIDA_LOCK_FORA_DE_SINCRONIA = [
  'npm error code EUSAGE',
  'npm error',
  'npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing.',
  'npm error',
  'npm error Missing: @emnapi/core@1.11.3 from lock file',
  'npm error Missing: @emnapi/runtime@1.11.3 from lock file',
  'npm error',
  'npm error Clean install a project',
  'npm error',
  'npm error Usage:',
  'npm error npm ci',
].join('\n');

const SCRIPTS = { lint: 'tsc --noEmit', build: 'tsup', test: 'vitest run' };
const nomes = (steps) => steps.map((s) => s.name);

describe('lockfileNpm10Args', () => {
  it('as mesmas flags do Core, sem cache', () => {
    assert.deepEqual(lockfileNpm10Args(), [
      '--yes',
      'npm@10',
      'ci',
      '--dry-run',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--prefer-offline',
    ]);
  });

  it('com cache: --cache vai ANTES do pacote (é flag do npx, que repassa ao npm ci)', () => {
    const args = lockfileNpm10Args({ cache: 'S:\\npm-cache' });
    assert.deepEqual(args.slice(0, 3), ['--yes', '--cache', 'S:\\npm-cache']);
    assert.equal(args.indexOf('npm@10'), 3);
  });
});

describe('parseFlags — flags da etapa do lockfile', () => {
  it('lê o motivo do pulo e o cache do npm, aparando espaços', () => {
    const f = parseFlags([], {
      NEETRU_LOCKFILE_NPM10_PULADO: '  sem rede e sem o npm@10 no cache  ',
      NEETRU_NPM_CACHE: ' S:\\npm-cache ',
    });
    assert.equal(f.lockfileNpm10Pulado, 'sem rede e sem o npm@10 no cache');
    assert.equal(f.npmCache, 'S:\\npm-cache');
  });

  it('variável ausente ou vazia vale null (a etapa roda)', () => {
    assert.equal(parseFlags([], {}).lockfileNpm10Pulado, null);
    assert.equal(parseFlags([], { NEETRU_LOCKFILE_NPM10_PULADO: '   ' }).lockfileNpm10Pulado, null);
    assert.equal(parseFlags([], {}).npmCache, null);
  });
});

describe('lockfileNpm10Steps', () => {
  it('padrão: uma etapa que roda `npx … npm@10 ci --dry-run`, com a saída capturada', () => {
    const [step, ...resto] = lockfileNpm10Steps({});
    assert.deepEqual(resto, []);
    assert.equal(step.name, LOCKFILE_NPM10_STEP);
    assert.equal(step.cmd, 'npx');
    assert.equal(step.capturar, 'npm-ci');
    assert.ok(step.args.includes('npm@10'));
    assert.ok(step.args.includes('--dry-run'));
  });

  it('o cache entra no comando', () => {
    const [step] = lockfileNpm10Steps({ npmCache: 'S:\\npm-cache' });
    assert.ok(step.args.includes('--cache'));
  });

  it('com o motivo: etapa PULADA, e o motivo vai para o log', () => {
    const [step] = lockfileNpm10Steps({ lockfileNpm10Pulado: 'sem rede e sem o npm@10 no cache do npx' });
    assert.equal(step.cmd, undefined);
    assert.equal(step.error, undefined);
    assert.ok(step.skip.includes('sem rede e sem o npm@10 no cache do npx'));
    assert.ok(step.skip.includes('declare o motivo no PR'));
  });

  for (const motivo of ['1', 'true', 'sim', 'yes', 'on', '0', 'ab']) {
    it(`pular sem dizer o porquê (${motivo}) BARRA o push`, () => {
      const [step] = lockfileNpm10Steps({ lockfileNpm10Pulado: motivo });
      assert.ok(step.error.includes('não diz o motivo'));
      assert.equal(step.cmd, undefined);
      assert.equal(step.skip, undefined);
    });
  }
});

describe('planSteps — onde a etapa entra', () => {
  it('auto-detecção: a primeira etapa, antes de typecheck e testes', () => {
    const steps = planSteps({ pkg: { scripts: SCRIPTS }, hasTsconfig: true, hasLockfile: true, flags: {} });
    assert.equal(nomes(steps)[0], LOCKFILE_NPM10_STEP);
    assert.deepEqual(nomes(steps), [LOCKFILE_NPM10_STEP, 'typecheck (lint)', 'test']);
  });

  it('override `neetru.prePush` (o da loja): a etapa entra também, o override não a engole', () => {
    const pkg = { scripts: SCRIPTS, neetru: { prePush: ['lint', 'build', 'test'] } };
    const steps = planSteps({ pkg, hasTsconfig: true, hasLockfile: true, flags: {} });
    assert.deepEqual(nomes(steps), [LOCKFILE_NPM10_STEP, 'lint', 'build', 'test']);
  });

  it('FAST pula os testes, mas a etapa do lockfile continua (é barata e evita a quebra no deploy)', () => {
    const pkg = { scripts: SCRIPTS, neetru: { prePush: ['lint', 'build', 'test'] } };
    const steps = planSteps({ pkg, hasTsconfig: true, hasLockfile: true, flags: { fast: true } });
    assert.deepEqual(nomes(steps), [LOCKFILE_NPM10_STEP, 'lint', 'build']);
    const auto = planSteps({ pkg: { scripts: SCRIPTS }, hasTsconfig: true, hasLockfile: true, flags: { fast: true } });
    assert.deepEqual(nomes(auto), [LOCKFILE_NPM10_STEP, 'typecheck (lint)']);
  });

  it('repo sem package-lock.json (ou chamador antigo, sem hasLockfile): a etapa não existe', () => {
    assert.deepEqual(nomes(planSteps({ pkg: { scripts: SCRIPTS }, hasTsconfig: true, hasLockfile: false, flags: {} })), [
      'typecheck (lint)',
      'test',
    ]);
    assert.ok(!nomes(planSteps({ pkg: { scripts: SCRIPTS }, hasTsconfig: true, flags: {} })).includes(LOCKFILE_NPM10_STEP));
  });

  it('o pulo com motivo e o bloqueio por motivo vazio chegam ao plano', () => {
    const pulado = planSteps({
      pkg: { scripts: SCRIPTS },
      hasLockfile: true,
      flags: { lockfileNpm10Pulado: 'sem rede e sem o npm@10 no cache do npx' },
    });
    assert.ok(pulado[0].skip.includes('sem rede'));
    const barrado = planSteps({ pkg: { scripts: SCRIPTS }, hasLockfile: true, flags: { lockfileNpm10Pulado: '1' } });
    assert.ok(barrado[0].error.includes('não diz o motivo'));
  });
});

describe('interpretarSaidaNpmCi e resumirFalhaLockfile', () => {
  it('lock fora de sincronia: acha as linhas «Missing … from lock file»', () => {
    const r = interpretarSaidaNpmCi(SAIDA_LOCK_FORA_DE_SINCRONIA);
    assert.equal(r.foraDeSincronia, true);
    assert.deepEqual(r.faltando, [
      'Missing: @emnapi/core@1.11.3 from lock file',
      'Missing: @emnapi/runtime@1.11.3 from lock file',
    ]);
  });

  it('o resumo mostra o sintoma como o npm o disse, e só ele (sem o Usage)', () => {
    const t = resumirFalhaLockfile(SAIDA_LOCK_FORA_DE_SINCRONIA);
    assert.ok(t.includes('fora de sincronia para o npm 10'));
    assert.ok(t.includes('Missing: @emnapi/core@1.11.3 from lock file'));
    assert.ok(t.includes('Missing: @emnapi/runtime@1.11.3 from lock file'));
    assert.ok(!t.includes('Usage'));
  });

  it('muitas linhas: corta em 8 e diz quantas faltam', () => {
    const muitas = Array.from({ length: 11 }, (_, i) => `npm error Missing: pacote-${i}@1.0.0 from lock file`).join('\n');
    const t = resumirFalhaLockfile(muitas);
    assert.ok(t.includes('pacote-7@1.0.0'));
    assert.ok(!t.includes('pacote-8@1.0.0'));
    assert.ok(t.includes('… e mais 3 linha(s)'));
  });

  it('falha de AMBIENTE (rede, registro) não é lock fora de sincronia: não manda regenerar', () => {
    const rede = ['npm error code ENOTFOUND', 'npm error network request to https://registry.npmjs.org/npm failed'].join('\n');
    assert.equal(interpretarSaidaNpmCi(rede).foraDeSincronia, false);
    const t = resumirFalhaLockfile(rede);
    assert.ok(t.includes('O `npm ci` do npm 10 falhou'));
    assert.ok(t.includes('code ENOTFOUND'));
    assert.ok(!t.includes('fora de sincronia'));
  });

  it('o aviso EBADENGINE (warn) não conta como erro', () => {
    const t = interpretarSaidaNpmCi('npm warn EBADENGINE Unsupported engine\nnpm error code ENOTFOUND');
    assert.deepEqual(t.erros, ['code ENOTFOUND']);
  });
});

describe('dicaDaFalha', () => {
  it('na etapa do lockfile: causa, o conserto exato e os caminhos de ambiente', () => {
    const dica = dicaDaFalha(LOCKFILE_NPM10_STEP) ?? '';
    assert.equal(LOCKFILE_NPM10_CONSERTO, 'npx --yes npm@10 install --package-lock-only --ignore-scripts');
    assert.ok(dica.includes(LOCKFILE_NPM10_CONSERTO));
    assert.ok(dica.includes('Missing: … from lock file'));
    assert.ok(dica.includes('NEETRU_NPM_CACHE'));
    assert.ok(dica.includes('NEETRU_LOCKFILE_NPM10_PULADO'));
  });

  it('em outra etapa: nada', () => {
    assert.equal(dicaDaFalha('test'), null);
    assert.equal(dicaDaFalha('lint'), null);
  });
});

describe('quoteArg', () => {
  it('flag e pacote seguros passam crus; caminho com espaço ou barra invertida vai entre aspas', () => {
    assert.equal(quoteArg('npm@10'), 'npm@10');
    assert.equal(quoteArg('--dry-run'), '--dry-run');
    assert.equal(quoteArg('S:\\npm cache'), '"S:\\\\npm cache"');
  });
});

// ─── o fio inteiro, com um `npx` falso ───────────────────────────────────────

const BASE = mkdtempSync(path.join(os.tmpdir(), 'neetru-lockfile-npm10-'));
after(async () => {
  await rm(BASE, { recursive: true, force: true });
});

const WIN = process.platform === 'win32';

/** Um repo mínimo (package.json + package-lock.json) e um `npx` falso no PATH. */
function montarCenario(nome, npxFalso) {
  const repo = path.join(BASE, nome, 'repo');
  const bin = path.join(BASE, nome, 'bin');
  const log = path.join(BASE, nome, 'npx-args.txt');
  mkdirSync(repo, { recursive: true });
  mkdirSync(bin, { recursive: true });
  writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ name: 'x', neetru: { prePush: [] } }));
  writeFileSync(path.join(repo, 'package-lock.json'), '{}');
  const saidaTxt = path.join(BASE, nome, 'npx-saida.txt');
  writeFileSync(saidaTxt, npxFalso.saida);
  if (WIN) {
    writeFileSync(
      path.join(bin, 'npx.cmd'),
      `@echo off\r\necho %* > "${log}"\r\ntype "${saidaTxt}" 1>&2\r\nexit /b ${npxFalso.codigo}\r\n`,
    );
  } else {
    const sh = path.join(bin, 'npx');
    writeFileSync(sh, `#!/bin/sh\necho "$@" > "${log}"\ncat "${saidaTxt}" >&2\nexit ${npxFalso.codigo}\n`);
    chmodSync(sh, 0o755);
  }
  return { repo, bin, log };
}

function rodarGate(c, args, extraEnv = {}) {
  const pathKey = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
  const env = { ...process.env };
  env[pathKey] = `${c.bin}${path.delimiter}${process.env[pathKey] ?? ''}`;
  // O gate pode estar rodando DENTRO de um hook do git (pre-push), na máquina de quem tem as
  // flags do gate no ambiente (ex.: NEETRU_NPM_CACHE): nada disso pode entrar no cenário.
  for (const k of Object.keys(env)) if (/^GIT_(DIR|WORK_TREE|INDEX_FILE)$/i.test(k)) delete env[k];
  for (const k of ['NEETRU_PREPUSH_FAST', 'NEETRU_PREPUSH_FULL', 'NEETRU_LOCKFILE_NPM10_PULADO', 'NEETRU_NPM_CACHE']) {
    delete env[k];
  }
  const r = spawnSync(process.execPath, [GATE, ...args], {
    cwd: c.repo,
    input: '',
    encoding: 'utf8',
    env: { ...env, ...extraEnv, NEETRU_PREPUSH_NO_LICENCAS: '1' },
    timeout: 60_000,
  });
  return { status: r.status, out: String(r.stdout ?? ''), err: String(r.stderr ?? '') };
}

describe('o gate com um npx falso (sem rede)', () => {
  it('--plan mostra a etapa e o comando real, também no --fast', () => {
    const c = montarCenario('plano', { saida: '', codigo: 0 });
    for (const flags of [[], ['--fast']]) {
      const r = rodarGate(c, ['--plan', ...flags]);
      assert.equal(r.status, 0);
      assert.ok(
        r.out.includes(`${LOCKFILE_NPM10_STEP}  npx --yes npm@10 ci --dry-run --ignore-scripts --no-audit --no-fund --prefer-offline`),
        r.out,
      );
    }
  });

  it('--plan com o motivo do pulo: etapa «pulada», motivo à vista', () => {
    const c = montarCenario('plano-pulado', { saida: '', codigo: 0 });
    const r = rodarGate(c, ['--plan'], { NEETRU_LOCKFILE_NPM10_PULADO: 'sem rede e sem o npm@10 no cache' });
    assert.equal(r.status, 0);
    assert.ok(r.out.includes('(pulada)'), r.out);
    assert.ok(r.out.includes('sem rede e sem o npm@10 no cache'), r.out);
  });

  it('lock fora de sincronia: barra o push, mostra o sintoma e o conserto', () => {
    const c = montarCenario('reprovada', { saida: SAIDA_LOCK_FORA_DE_SINCRONIA, codigo: 1 });
    const r = rodarGate(c, ['--fast']);
    assert.equal(r.status, 1, r.out + r.err);
    assert.ok(r.err.includes('fora de sincronia para o npm 10'), r.err);
    assert.ok(r.err.includes('Missing: @emnapi/core@1.11.3 from lock file'), r.err);
    assert.ok(r.err.includes('npx --yes npm@10 install --package-lock-only --ignore-scripts'), r.err);
    assert.ok(r.err.includes(`ABORTADO em "${LOCKFILE_NPM10_STEP}". Nada foi enviado.`), r.err);
    // A saída longa do dry-run não vaza: só o resumo.
    assert.ok(!r.err.includes('Clean install a project'), r.err);
    // O comando que o npx falso recebeu é o de verdade.
    const args = readFileSync(c.log, 'utf8');
    assert.ok(args.includes('--yes npm@10 ci --dry-run --ignore-scripts --no-audit --no-fund --prefer-offline'), args);
  });

  it('lock em dia: a etapa passa e o resumo final a conta', () => {
    const c = montarCenario('aprovada', { saida: '', codigo: 0 });
    const r = rodarGate(c, ['--fast']);
    assert.equal(r.status, 0, r.out + r.err);
    assert.ok(r.out.includes(`-> ${LOCKFILE_NPM10_STEP}`), r.out);
    assert.match(r.out, /\[pre-push\] OK — .*lockfile no npm 10 \d/);
  });

  it('NEETRU_NPM_CACHE chega ao npx como --cache <dir>', () => {
    const c = montarCenario('cache', { saida: '', codigo: 0 });
    const r = rodarGate(c, ['--fast'], { NEETRU_NPM_CACHE: path.join(BASE, 'cache-do-npm') });
    assert.equal(r.status, 0, r.out + r.err);
    const args = readFileSync(c.log, 'utf8');
    assert.ok(args.includes('--cache'), args);
    assert.ok(args.includes('cache-do-npm'), args);
    assert.ok(args.indexOf('--cache') < args.indexOf('npm@10'), args);
  });

  it('pulo COM motivo: a etapa não roda (o npx falso nunca é chamado) e o motivo vai para o log', () => {
    const c = montarCenario('pulada', { saida: SAIDA_LOCK_FORA_DE_SINCRONIA, codigo: 1 });
    const r = rodarGate(c, ['--fast'], { NEETRU_LOCKFILE_NPM10_PULADO: 'sem rede e sem o npm@10 no cache' });
    assert.equal(r.status, 0, r.out + r.err);
    assert.ok(r.out.includes('PULADA'), r.out);
    assert.ok(r.out.includes('sem rede e sem o npm@10 no cache'), r.out);
    assert.equal(existsSync(c.log), false);
  });

  it('pulo SEM motivo (=1): barra o push em vez de pular calado', () => {
    const c = montarCenario('pulo-sem-motivo', { saida: '', codigo: 0 });
    const r = rodarGate(c, ['--fast'], { NEETRU_LOCKFILE_NPM10_PULADO: '1' });
    assert.equal(r.status, 1, r.out + r.err);
    assert.ok(r.err.includes('não diz o motivo'), r.err);
  });

  // Só deste template (o do SDK não tem o «não concluído»): etapa que nem iniciou (0xC0000142) é
  // ambiente, não lock fora de sincronia — barra o push sem mandar regenerar o lock.
  it(
    'etapa que não chegou ao fim (0xC0000142): barra o push e NÃO manda regenerar o lock',
    { skip: WIN ? false : 'código de saída do Windows' },
    () => {
      const c = montarCenario('nao-concluida', { saida: '', codigo: 0xc0000142 });
      const r = rodarGate(c, ['--fast']);
      assert.equal(r.status, 1, r.out + r.err);
      assert.ok(r.err.includes('NÃO CONCLUÍDO'), r.err);
      assert.ok(r.err.includes('não chegou ao fim'), r.err);
      assert.ok(!r.err.includes(LOCKFILE_NPM10_CONSERTO), r.err);
      assert.ok(!r.err.includes('fora de sincronia'), r.err);
    },
  );
});
