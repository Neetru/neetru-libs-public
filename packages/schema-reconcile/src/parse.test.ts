import { describe, expect, it } from 'vitest';
import { parseDeclaredColumns } from './parse.js';

describe('parseDeclaredColumns', () => {
  it('extrai colunas com aspas + defaults + `timestamp with time zone`; pula constraints de tabela', () => {
    const sql = [
      'CREATE TABLE IF NOT EXISTS "user_profiles" (',
      '\t"id" serial PRIMARY KEY NOT NULL,',
      '\t"user_id" integer NOT NULL,',
      "\t\"status\" text DEFAULT 'active' NOT NULL,",
      '\t"created_at" timestamp with time zone DEFAULT now() NOT NULL,',
      '\t"deleted_at" timestamp with time zone,',
      '\tCONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id"),',
      '\tPRIMARY KEY ("id"),',
      '\tFOREIGN KEY ("user_id") REFERENCES "users"("id"),',
      '\tCHECK ("user_id" > 0)',
      ');',
    ].join('\n');
    const cols = parseDeclaredColumns(sql).get('user_profiles');
    expect(cols!.map((c) => c.name)).toEqual(['id', 'user_id', 'status', 'created_at', 'deleted_at']);
    expect(cols!.find((c) => c.name === 'deleted_at')!.definition).toBe('timestamp with time zone');
    expect(cols!.find((c) => c.name === 'status')!.definition).toBe("text DEFAULT 'active' NOT NULL");
  });

  it('pula blocos `DO $$ ... END $$` (guards de CREATE TYPE)', () => {
    const sql = [
      'DO $$ BEGIN',
      " CREATE TYPE \"public\".\"role\" AS ENUM('admin', 'user');",
      'EXCEPTION WHEN duplicate_object THEN null;',
      'END $$;',
      'CREATE TABLE IF NOT EXISTS "accounts" ("id" serial PRIMARY KEY NOT NULL, "role" "role" DEFAULT \'user\' NOT NULL);',
    ].join('\n');
    const map = parseDeclaredColumns(sql);
    expect([...map.keys()]).toEqual(['accounts']);
    expect(map.get('accounts')!.map((c) => c.name)).toEqual(['id', 'role']);
  });

  it('parenteses/virgulas dentro de literal de default nao quebram o split; numeric(10,2) intacto', () => {
    const sql =
      'CREATE TABLE IF NOT EXISTS "t" ("id" serial PRIMARY KEY NOT NULL, "weird" text DEFAULT \'a)b,c(d\' NOT NULL, "n" numeric(10, 2));';
    const cols = parseDeclaredColumns(sql).get('t')!;
    expect(cols.map((c) => c.name)).toEqual(['id', 'weird', 'n']);
    expect(cols.find((c) => c.name === 'weird')!.definition).toBe("text DEFAULT 'a)b,c(d' NOT NULL");
    expect(cols.find((c) => c.name === 'n')!.definition).toBe('numeric(10, 2)');
  });

  it('UNIQUE inline numa coluna E coluna (nao constraint de tabela)', () => {
    const cols = parseDeclaredColumns(
      'CREATE TABLE IF NOT EXISTS "t" ("id" serial PRIMARY KEY NOT NULL, "email" text UNIQUE NOT NULL);',
    ).get('t')!;
    expect(cols.map((c) => c.name)).toEqual(['id', 'email']);
  });

  it('ignora statements que nao sao CREATE TABLE (ALTER/CREATE INDEX/DROP)', () => {
    expect(
      parseDeclaredColumns('ALTER TABLE "t" ADD COLUMN "x" int; CREATE INDEX i ON "t" ("x"); DROP TABLE "y";').size,
    ).toBe(0);
  });

  it('aceita `CREATE TABLE` sem `IF NOT EXISTS`', () => {
    expect(parseDeclaredColumns('CREATE TABLE "t" ("id" integer, "c" text);').get('t')!.map((c) => c.name)).toEqual([
      'id',
      'c',
    ]);
  });

  // ─── Regressoes da revisao adversarial (2026-08-07) ──────────────────────────

  it('ve TODAS as tabelas mesmo com `--> statement-breakpoint` entre elas (drizzle-kit)', () => {
    const sql = [
      'CREATE TABLE IF NOT EXISTS "users" ("id" serial PRIMARY KEY NOT NULL);',
      '--> statement-breakpoint',
      'CREATE TABLE IF NOT EXISTS "user_profiles" ("id" serial PRIMARY KEY NOT NULL, "deleted_at" timestamp with time zone);',
    ].join('\n');
    const map = parseDeclaredColumns(sql);
    expect([...map.keys()].sort()).toEqual(['user_profiles', 'users']);
    expect(map.get('user_profiles')!.map((c) => c.name)).toEqual(['id', 'deleted_at']);
  });

  it('CREATE TABLE precedido de comentario de cabecalho `--` ainda e parseado', () => {
    const sql = ['-- migracao 0007: adiciona deleted_at', 'CREATE TABLE IF NOT EXISTS "t" ("id" integer, "deleted_at" timestamp);'].join(
      '\n',
    );
    expect(parseDeclaredColumns(sql).get('t')!.map((c) => c.name)).toEqual(['id', 'deleted_at']);
  });

  it('pula tabela de schema != public (fail-safe cross-schema)', () => {
    expect(parseDeclaredColumns('CREATE TABLE IF NOT EXISTS "analytics"."events" ("id" integer, "payload" jsonb);').has('events')).toBe(
      false,
    );
  });

  it('aceita tabela explicitamente `public.<t>`', () => {
    expect(
      parseDeclaredColumns('CREATE TABLE IF NOT EXISTS public.orders ("id" integer, "total" numeric(10, 2));').get('orders')!.map((c) => c.name),
    ).toEqual(['id', 'total']);
  });

  it('elemento de tabela `LIKE ... INCLUDING` nao vira coluna espuria', () => {
    const cols = parseDeclaredColumns('CREATE TABLE IF NOT EXISTS "t" ("id" integer, LIKE "other" INCLUDING ALL, "c" text);').get('t')!;
    expect(cols.map((c) => c.name)).toEqual(['id', 'c']);
  });
});
