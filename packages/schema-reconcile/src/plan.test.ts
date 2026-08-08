import { describe, expect, it } from 'vitest';
import { parseDeclaredColumns } from './parse.js';
import {
  planAdditiveReconciliation,
  buildIntrospectionQuery,
  buildAlterColumnSql,
  stripInlinePrimaryKey,
  quoteIdent,
} from './plan.js';

describe('buildIntrospectionQuery', () => {
  it('monta SELECT public-only com nomes escapados', () => {
    const q = buildIntrospectionQuery(['users', "o'brien"]);
    expect(q).toContain("table_schema = 'public'");
    expect(q).toContain("'users'");
    expect(q).toContain("'o''brien'"); // aspa simples escapada
  });
  it('null quando nao ha tabelas', () => {
    expect(buildIntrospectionQuery([])).toBeNull();
  });
});

describe('quoteIdent', () => {
  it('escapa aspas duplas', () => {
    expect(quoteIdent('a"b')).toBe('"a""b"');
  });
});

describe('stripInlinePrimaryKey', () => {
  it('preserva PRIMARY KEY dentro de literal de DEFAULT', () => {
    expect(stripInlinePrimaryKey("text NOT NULL DEFAULT 'PRIMARY KEY'")).toBe("text NOT NULL DEFAULT 'PRIMARY KEY'");
  });
  it('preserva espacos duplos dentro de literal', () => {
    expect(stripInlinePrimaryKey("text DEFAULT 'a  b'")).toBe("text DEFAULT 'a  b'");
  });
  it('remove PRIMARY KEY que E constraint de coluna (fora de literal)', () => {
    expect(stripInlinePrimaryKey('integer PRIMARY KEY').toUpperCase()).not.toContain('PRIMARY KEY');
    expect(stripInlinePrimaryKey('integer PRIMARY KEY NOT NULL')).toMatch(/integer\s+NOT NULL/);
  });
});

describe('buildAlterColumnSql', () => {
  it('monta ADD COLUMN IF NOT EXISTS aditivo, sem PRIMARY KEY inline', () => {
    const sql = buildAlterColumnSql('user_profiles', { name: 'deleted_at', definition: 'timestamp with time zone' });
    expect(sql).toBe('ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone');
  });
  it('strip do PRIMARY KEY inline', () => {
    const sql = buildAlterColumnSql('t', { name: 'code', definition: 'integer PRIMARY KEY' });
    expect(sql).not.toMatch(/PRIMARY KEY/i);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "code" integer/);
  });
});

describe('planAdditiveReconciliation', () => {
  const declared = parseDeclaredColumns(
    'CREATE TABLE IF NOT EXISTS "user_profiles" ("id" serial PRIMARY KEY NOT NULL, "name" text NOT NULL, "deleted_at" timestamp with time zone);',
  );

  it('coluna declarada AUSENTE numa tabela existente → 1 ALTER aditivo', () => {
    const plan = planAdditiveReconciliation(declared, [
      { table: 'user_profiles', column: 'id' },
      { table: 'user_profiles', column: 'name' }, // sem deleted_at
    ]);
    expect(plan.alters.map((a) => a.column)).toEqual(['deleted_at']);
    expect(plan.alters[0]!.sql).toBe(
      'ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone',
    );
  });

  it('todas as colunas presentes → nenhum ALTER', () => {
    const plan = planAdditiveReconciliation(declared, [
      { table: 'user_profiles', column: 'id' },
      { table: 'user_profiles', column: 'name' },
      { table: 'user_profiles', column: 'deleted_at' },
    ]);
    expect(plan.alters).toEqual([]);
  });

  it('tabela NOVA (introspeccao vazia) → nao e drift, nenhum ALTER', () => {
    const plan = planAdditiveReconciliation(declared, []); // tabela ausente = nova
    expect(plan.alters).toEqual([]);
  });

  it('end-to-end com breakpoint drizzle: cura a coluna da 2a tabela', () => {
    const sql = [
      'CREATE TABLE IF NOT EXISTS "users" ("id" serial PRIMARY KEY NOT NULL);',
      '--> statement-breakpoint',
      'CREATE TABLE IF NOT EXISTS "user_profiles" ("id" serial PRIMARY KEY NOT NULL, "deleted_at" timestamp with time zone);',
    ].join('\n');
    const decl = parseDeclaredColumns(sql);
    const q = buildIntrospectionQuery([...decl.keys()]);
    expect(q).toContain("'users'");
    expect(q).toContain("'user_profiles'"); // ambas introspectadas (regressao do breakpoint)
    const plan = planAdditiveReconciliation(decl, [
      { table: 'users', column: 'id' },
      { table: 'user_profiles', column: 'id' }, // sem deleted_at
    ]);
    expect(plan.alters).toEqual([
      {
        table: 'user_profiles',
        column: 'deleted_at',
        sql: 'ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone',
      },
    ]);
  });

  it('ignora linhas malformadas na introspeccao', () => {
    const plan = planAdditiveReconciliation(declared, [
      { table: 'user_profiles', column: 'id' },
      { table: 'user_profiles', column: 'name' },
      { table: '', column: 'x' } as never,
      null as never,
    ]);
    expect(plan.alters.map((a) => a.column)).toEqual(['deleted_at']);
  });
});
