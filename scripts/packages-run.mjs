#!/usr/bin/env node
/**
 * packages-run.mjs — roda uma etapa do gate de pre-push em TODOS os pacotes
 * de `packages/*` (monorepo de libs Neetru).
 *
 * Existe porque o `scripts/pre-push-gate.mjs` (template da skill
 * `neetru-pre-push`, copiado SEM alteração) só enxerga os scripts do
 * package.json da raiz. O override da raiz
 *   "neetru": { "prePush": ["typecheck", "test"] }
 * aponta `typecheck`/`test` pra este script.
 *
 * Etapas, por pacote (ordem alfabética):
 *   typecheck  script `typecheck` do pacote, se existir; senão
 *              `tsc --noEmit -p tsconfig.json` com o typescript que o pacote
 *              resolve (node_modules do pacote ou de qualquer pasta acima)
 *   test       script `test` do pacote (`npm run test`)
 * Pacote sem a etapa (sem script e sem tsconfig) é listado como "sem etapa".
 *
 * Fail-closed: dependência declarada (dependencies/devDependencies) que não
 * está instalada FALHA com a instrução de instalar — nunca é pulada em
 * silêncio. Aborta no primeiro pacote que falhar.
 *
 * Uso: node scripts/packages-run.mjs <typecheck|test>
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STEPS = ['typecheck', 'test'];
const step = process.argv[2];

if (!STEPS.includes(step)) {
  process.stderr.write(`uso: node scripts/packages-run.mjs <${STEPS.join('|')}>\n`);
  process.exit(2);
}

/** Procura `node_modules/<dep>` subindo a partir da pasta do pacote (como o Node resolve). */
function findInstalled(dep, fromDir) {
  for (let dir = fromDir; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', dep);
    if (existsSync(path.join(candidate, 'package.json'))) return candidate;
    if (path.dirname(dir) === dir) return null;
  }
}

function sh(cmd, args, cwd) {
  // shell:true é necessário no Windows (npm.cmd); args são fixos, sem input do usuário.
  const quoted = [cmd, ...args].map((a) => (/\s/.test(a) ? `"${a}"` : a));
  return spawnSync(quoted.join(' '), { cwd, stdio: 'inherit', shell: true }).status === 0;
}

const rootPkgPath = path.join(ROOT, 'package.json');
const isWorkspaces = existsSync(rootPkgPath) && Array.isArray(JSON.parse(readFileSync(rootPkgPath, 'utf8')).workspaces);
const installHint = (name) => (isWorkspaces ? 'npm install (na raiz — monorepo com workspaces)' : `npm install --prefix packages/${name}`);

const pkgsDir = path.join(ROOT, 'packages');
const packages = readdirSync(pkgsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(path.join(pkgsDir, d.name, 'package.json')))
  .map((d) => d.name)
  .sort();

if (packages.length === 0) {
  process.stderr.write('[packages] nenhum pacote em packages/* — nada a validar é suspeito, abortando.\n');
  process.exit(1);
}

const summary = [];
for (const name of packages) {
  const dir = path.join(pkgsDir, name);
  const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const scripts = pkg.scripts ?? {};
  const label = pkg.name ?? name;

  const declared = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  let run = null;
  if (step === 'typecheck') {
    if (scripts.typecheck) run = () => sh('npm', ['run', '--silent', 'typecheck'], dir);
    else if (existsSync(path.join(dir, 'tsconfig.json'))) {
      if (!declared.includes('typescript')) declared.push('typescript');
      run = () => {
        const tsc = path.join(findInstalled('typescript', dir), 'bin', 'tsc');
        return sh(process.execPath, [tsc, '--noEmit', '-p', 'tsconfig.json'], dir);
      };
    }
  } else if (scripts.test) {
    run = () => sh('npm', ['run', '--silent', 'test'], dir);
  }

  if (!run) {
    summary.push(`${name}: sem etapa`);
    process.stdout.write(`[packages] ${step} ${label} — sem etapa (sem script/tsconfig)\n`);
    continue;
  }

  const missing = declared.filter((dep) => !findInstalled(dep, dir));
  if (missing.length > 0) {
    process.stderr.write(
      `[packages] FALHOU ${step} ${label}: dependências não instaladas: ${missing.join(', ')}\n` +
        `[packages] instale antes de empurrar: ${installHint(name)}\n`,
    );
    process.exit(1);
  }

  process.stdout.write(`\n[packages] -> ${step} ${label}\n`);
  const start = Date.now();
  if (!run()) {
    process.stderr.write(`\n[packages] ABORTADO: ${step} falhou em ${label}.\n`);
    process.exit(1);
  }
  summary.push(`${name} ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

process.stdout.write(`\n[packages] ${step} OK — ${summary.join(' | ')}\n`);
