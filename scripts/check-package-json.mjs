#!/usr/bin/env node
/**
 * check-package-json.mjs — trava de publish dos pacotes @neetru/*.
 *
 * Roda no `prepublishOnly` de cada pacote (cwd = pasta do pacote). Barra o
 * publish se o package.json tiver:
 *   - BOM UTF-8 — o Node tolera, mas o Vite/vitest não resolve o pacote
 *     ("Failed to load url @neetru/<lib>"). Aconteceu em 2026-07-15: 5 libs
 *     publicadas com BOM quebraram o vitest de todo consumidor.
 *   - mojibake (UTF-8 lido como Latin-1 e regravado: "Ã©", "Ã£", "Â"; ou lido
 *     como Windows-1252: "â€”", "â€œ", "â€™" — travessão/aspas viram "â€…").
 *   - JSON inválido.
 * Causa típica: bump de versão via PowerShell (`Set-Content`/`ConvertTo-Json`).
 * Bumpe com `npm version patch --no-git-tag-version` e commite o bump.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'package.json');
const buf = readFileSync(file);
const errors = [];

if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) errors.push('tem BOM UTF-8 (Vite não resolve o pacote)');

const text = buf.toString('utf8');
const mojibake = text.match(/Ã[\u0080-¿]|Â[\u0080-¿ ]|â€./);
if (mojibake) errors.push(`mojibake de encoding ("${mojibake[0]}") — arquivo foi regravado com encoding errado`);

try {
  JSON.parse(text.replace(/^﻿/, ''));
} catch (e) {
  errors.push(`JSON inválido: ${e.message}`);
}

if (errors.length > 0) {
  process.stderr.write(`[check-package-json] ${file}\n${errors.map((e) => `  - ${e}`).join('\n')}\n`);
  process.stderr.write('[check-package-json] publish BLOQUEADO. Regrave o arquivo em UTF-8 sem BOM.\n');
  process.exit(1);
}
process.stdout.write(`[check-package-json] OK ${path.basename(path.dirname(file))}\n`);
