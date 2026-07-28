import { describe, it, expect } from 'vitest';
import { classifyMigration, explainStatement } from './index.js';
import { classifyOneStatement } from './classify.js';
import { splitSqlStatements } from './split.js';
import { STATEMENT_RULES } from './rules.js';

// ---------------------------------------------------------------------------
// aditiva — statements seguros, sem perda de dados
// ---------------------------------------------------------------------------
describe('classifyMigration — aditiva', () => {
  it('CREATE TABLE é aditiva', () => {
    const r = classifyMigration(
      'CREATE TABLE users (id serial primary key, name text);',
    );
    expect(r.statements).toHaveLength(1);
    expect(r.statements[0]?.severity).toBe('aditiva');
    expect(r.overallSeverity).toBe('aditiva');
    expect(r.requiresConfirmation).toBe(false);
  });

  it('ADD COLUMN nullable é aditiva', () => {
    const r = classifyMigration('ALTER TABLE users ADD COLUMN email text;');
    expect(r.statements[0]?.severity).toBe('aditiva');
    expect(r.overallSeverity).toBe('aditiva');
  });

  it('ADD COLUMN NOT NULL com DEFAULT é aditiva', () => {
    const r = classifyMigration(
      'ALTER TABLE users ADD COLUMN age integer NOT NULL DEFAULT 0;',
    );
    expect(r.statements[0]?.severity).toBe('aditiva');
  });

  it('CREATE INDEX é aditiva', () => {
    const r = classifyMigration(
      'CREATE INDEX idx_users_email ON users (email);',
    );
    expect(r.statements[0]?.severity).toBe('aditiva');
  });

  it('CREATE INDEX CONCURRENTLY é aditiva e mencionada distintamente', () => {
    const r = classifyMigration(
      'CREATE INDEX CONCURRENTLY idx_users_name ON users (name);',
    );
    expect(r.statements[0]?.severity).toBe('aditiva');
    expect(r.statements[0]?.reason.toLowerCase()).toContain('concurrently');
  });

  // bug_0e89270321 (2026-06-11): ADD CONSTRAINT FK com ON DELETE era classificado
  // destrutivo (caía no UNKNOWN fail-closed), bloqueando migrações 100% aditivas.
  it('ADD CONSTRAINT FK com ON DELETE CASCADE é aditiva', () => {
    const r = classifyMigration(
      'ALTER TABLE orders ADD CONSTRAINT fk_cust FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;',
    );
    expect(r.statements[0]?.severity).toBe('aditiva');
    expect(r.overallSeverity).toBe('aditiva');
    expect(r.requiresConfirmation).toBe(false);
  });

  it('ADD CONSTRAINT FK com ON DELETE RESTRICT é aditiva', () => {
    const r = classifyMigration(
      'ALTER TABLE items ADD CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT;',
    );
    expect(r.statements[0]?.severity).toBe('aditiva');
    expect(r.overallSeverity).toBe('aditiva');
  });

  it('migração 100% aditiva (CREATE TABLE + ADD CONSTRAINT FK ON DELETE) NÃO exige confirmação', () => {
    const r = classifyMigration(
      'CREATE TABLE customers (id serial primary key, name text);\n' +
        'CREATE TABLE orders (id serial primary key, customer_id integer);\n' +
        'ALTER TABLE orders ADD CONSTRAINT fk_c FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;',
    );
    expect(r.statements).toHaveLength(3);
    expect(r.statements.every((s) => s.severity === 'aditiva')).toBe(true);
    expect(r.overallSeverity).toBe('aditiva');
    expect(r.requiresConfirmation).toBe(false);
  });

  // bug_59ee92b8 (2026-06-12): CREATE TYPE ... AS ENUM (emitido pelo drizzle-kit
  // pra enums) caía no UNKNOWN fail-closed -> destrutiva, marcando migrações
  // 100% aditivas como destrutivas. Criar um tipo/schema/sequence/domínio é
  // aditivo (objeto novo, zero impacto em dados existentes).
  it('CREATE TYPE ... AS ENUM é aditiva', () => {
    const r = classifyMigration(
      `CREATE TYPE "public"."sale_status" AS ENUM('pending', 'paid', 'cancelled');`,
    );
    expect(r.statements[0]?.severity).toBe('aditiva');
    expect(r.overallSeverity).toBe('aditiva');
    expect(r.requiresConfirmation).toBe(false);
  });

  it('CREATE TYPE composite, CREATE SCHEMA, CREATE SEQUENCE e CREATE DOMAIN são aditivas', () => {
    for (const sql of [
      `CREATE TYPE "addr" AS ("street" text, "num" integer);`,
      `CREATE SCHEMA IF NOT EXISTS "app";`,
      `CREATE SEQUENCE "order_seq" START 1;`,
      `CREATE DOMAIN "pos_int" AS integer CHECK (VALUE > 0);`,
    ]) {
      const r = classifyMigration(sql);
      expect(r.statements[0]?.severity, sql).toBe('aditiva');
      expect(r.overallSeverity, sql).toBe('aditiva');
    }
  });

  // Cenário real do bug: drizzle 0000_*.sql = CREATE TYPE + CREATE TABLE +
  // ADD CONSTRAINT FK ON DELETE set null. 100% aditivo -> sem confirmação.
  it('migração drizzle (CREATE TYPE enum + CREATE TABLE + FK ON DELETE SET NULL) é 100% aditiva', () => {
    const r = classifyMigration(
      `CREATE TYPE "public"."sale_status" AS ENUM('pending', 'paid');\n` +
        `CREATE TABLE "customers" ("id" serial PRIMARY KEY, "name" text NOT NULL);\n` +
        `CREATE TABLE "sales" ("id" serial PRIMARY KEY, "customer_id" integer, "status" "public"."sale_status");\n` +
        `ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;`,
    );
    expect(r.statements).toHaveLength(4);
    expect(r.statements.every((s) => s.severity === 'aditiva')).toBe(true);
    expect(r.overallSeverity).toBe('aditiva');
    expect(r.requiresConfirmation).toBe(false);
  });

  // bug_59ee92b8 (2026-06-12): CREATE TABLE com coluna de tipo definido pelo
  // usuário (enum) NÃO parseia no node-sql-parser → caía no fail-closed. O
  // fallback por palavra-chave classifica como aditiva (CREATE TABLE é sempre
  // aditivo, independentemente do corpo).
  it('CREATE TABLE com coluna de tipo enum customizado (unparseable) é aditiva', () => {
    const r = classifyMigration(
      `CREATE TABLE "sales" ("id" serial PRIMARY KEY, "status" "public"."sale_status" DEFAULT 'pending');`,
    );
    expect(r.statements[0]?.severity).toBe('aditiva');
    expect(r.overallSeverity).toBe('aditiva');
    expect(r.requiresConfirmation).toBe(false);
  });

  // bug_pdv_createtype_guard_2026-07-28: Postgres não tem `CREATE TYPE IF NOT
  // EXISTS` — o idioma canônico de idempotência é o guard `DO $$ ... EXCEPTION
  // WHEN duplicate_object THEN null; END $$;`, que o node-sql-parser não
  // consegue parsear (PL/pgSQL). Sem o fallback dedicado, isso caía em
  // UNKNOWN → destrutiva, forçando confirm --mfa-token numa migração 100%
  // aditiva (só cria um enum que talvez já exista).
  it('CREATE TYPE dentro do guard idempotente DO $$ ... duplicate_object é aditiva', () => {
    const r = classifyMigration(
      `DO $$ BEGIN
        CREATE TYPE "public"."ft_entity_type" AS ENUM('supplier', 'customer', 'other');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;`,
    );
    expect(r.statements[0]?.severity).toBe('aditiva');
    expect(r.overallSeverity).toBe('aditiva');
    expect(r.requiresConfirmation).toBe(false);
  });

  it('guard idempotente sem schema-qualifier ("nome" em vez de "schema"."nome") também é aditivo', () => {
    const c = classifyOneStatement(
      `DO $$ BEGIN CREATE TYPE "status" AS ENUM('a', 'b'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    expect(c.severity).toBe('aditiva');
  });

  // Achado testando end-to-end contra o drizzle-kit real (não só unitário):
  // `splitSqlStatements` atribui o comentário `--> statement-breakpoint` do
  // statement ANTERIOR como PREFIXO deste — todo DO $$ guard exceto o
  // primeiro do arquivo chegava aqui com esse comentário colado na frente e
  // quebrava a âncora `^DO...`. Migração real do pdv-agiliza (16 enums) tinha
  // 15 dos 16 guards indo pro fail-closed por causa disso.
  it('múltiplos guards separados por --> statement-breakpoint (saída real do drizzle-kit) são TODOS aditivos', () => {
    const r = classifyMigration(
      `DO $$ BEGIN
        CREATE TYPE "public"."ft_entity_type" AS ENUM('supplier', 'customer', 'other');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;--> statement-breakpoint
DO $$ BEGIN
        CREATE TYPE "public"."ft_status" AS ENUM('pending', 'paid', 'overdue');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;--> statement-breakpoint
CREATE TABLE "x" (id int);`,
    );
    expect(r.statements).toHaveLength(3);
    expect(r.statements.every((s) => s.severity === 'aditiva')).toBe(true);
    expect(r.overallSeverity).toBe('aditiva');
    expect(r.requiresConfirmation).toBe(false);
  });

  // Mesma lacuna existia no fallback IRMÃO (bug_59ee92b8, CREATE TABLE com
  // enum customizado) — nunca testado com 2+ statements antes.
  it('CREATE TABLE com enum customizado precedido de --> statement-breakpoint continua aditivo', () => {
    const r = classifyMigration(
      `CREATE TABLE "a" (id int);--> statement-breakpoint
CREATE TABLE "sales" ("id" serial PRIMARY KEY, "status" "public"."sale_status" DEFAULT 'pending');`,
    );
    expect(r.statements).toHaveLength(2);
    expect(r.statements.every((s) => s.severity === 'aditiva')).toBe(true);
    expect(r.overallSeverity).toBe('aditiva');
  });

  // SEGURANÇA: o reconhecimento é ANCORADO no idioma exato — qualquer desvio
  // (outro exception handler, um segundo statement escondido no BEGIN, corpo
  // que não é CREATE TYPE) tem que continuar fail-closed. Um DO $$ genérico
  // pode rodar QUALQUER código PL/pgSQL — não dá pra assumir "aditivo" sem essa
  // âncora estrita.
  it('DO $$ com EXCEPTION WHEN OTHERS (não duplicate_object) continua destrutivo (fail-closed)', () => {
    const c = classifyOneStatement(
      `DO $$ BEGIN CREATE TYPE "x" AS ENUM('a'); EXCEPTION WHEN OTHERS THEN null; END $$;`,
    );
    expect(c.severity).toBe('destrutiva');
  });

  it('DO $$ com um segundo statement escondido dentro do BEGIN continua destrutivo (fail-closed)', () => {
    const c = classifyOneStatement(
      `DO $$ BEGIN CREATE TYPE "x" AS ENUM('a'); DELETE FROM "y"; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    expect(c.severity).toBe('destrutiva');
  });

  it('DO $$ genérico (sem CREATE TYPE nenhum) continua destrutivo (fail-closed)', () => {
    const c = classifyOneStatement(
      `DO $$ BEGIN UPDATE "y" SET "col" = 1; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    expect(c.severity).toBe('destrutiva');
  });

  // Achado por Codex review adversarial: os 3 payloads acima (WHEN OTHERS,
  // 2º statement escondido, DO$$ genérico) só foram testados com o guard
  // "puro" — precisam continuar fail-closed mesmo com o `--> statement-
  // breakpoint` na frente (o shape REAL que sai do drizzle-kit, e o que
  // stripEdgeComments precisa continuar rejeitando corretamente).
  it('payloads adversariais continuam destrutivos MESMO com --> statement-breakpoint na frente', () => {
    const payloads = [
      `DO $$ BEGIN CREATE TYPE "x" AS ENUM('a'); EXCEPTION WHEN OTHERS THEN null; END $$;`,
      `DO $$ BEGIN CREATE TYPE "x" AS ENUM('a'); DELETE FROM "y"; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
      `DO $$ BEGIN UPDATE "y" SET "col" = 1; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    ];
    for (const payload of payloads) {
      const c = classifyOneStatement(`--> statement-breakpoint\n${payload}`);
      expect(c.severity, payload).toBe('destrutiva');
    }
  });

  // Confirma que a âncora usa `$$` LITERAL (sem tag), não backreference — um
  // guard com tag (`$tag$ ... $tag$`, sintaxe válida de dollar-quote do
  // Postgres) não é reconhecido pelo fallback e cai fail-closed. Não é uma
  // lacuna de segurança (é so mais restritivo que o necessário), mas trava o
  // design atual explicitamente em teste.
  it('guard com dollar-quote TAGUEADO ($tag$...$tag$) não é reconhecido (fail-closed, mais restritivo)', () => {
    const c = classifyOneStatement(
      `DO $tag$ BEGIN CREATE TYPE "x" AS ENUM('a'); EXCEPTION WHEN duplicate_object THEN null; END $tag$;`,
    );
    expect(c.severity).toBe('destrutiva');
  });

  // Irmão do guard de CREATE TYPE — mesmo problema em ADD CONSTRAINT
  // (Postgres não tem `ADD CONSTRAINT IF NOT EXISTS`), achado verificando o
  // fix de CREATE TYPE com Docker real (2ª aplicação quebrava em
  // "constraint already exists" logo depois de tabelas/tipos ficarem ok).
  it('ADD CONSTRAINT (FK) dentro do guard idempotente é aditiva', () => {
    const r = classifyMigration(
      `DO $$ BEGIN
        ALTER TABLE "cash_registers" ADD CONSTRAINT "fk1" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE restrict ON UPDATE no action;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;`,
    );
    expect(r.statements[0]?.severity).toBe('aditiva');
    expect(r.overallSeverity).toBe('aditiva');
    expect(r.requiresConfirmation).toBe(false);
  });

  it.each(['CHECK ("age" > 0)', 'UNIQUE ("email")', 'PRIMARY KEY ("id")'])(
    'ADD CONSTRAINT %s dentro do guard também é aditiva',
    (clause) => {
      const c = classifyOneStatement(
        `DO $$ BEGIN ALTER TABLE "x" ADD CONSTRAINT "c1" ${clause}; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
      );
      expect(c.severity).toBe('aditiva');
    },
  );

  it('múltiplos guards de ADD CONSTRAINT separados por --> statement-breakpoint são todos aditivos', () => {
    const r = classifyMigration(
      `DO $$ BEGIN
        ALTER TABLE "a" ADD CONSTRAINT "fk_a" FOREIGN KEY ("b_id") REFERENCES "b"("id");
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;--> statement-breakpoint
DO $$ BEGIN
        ALTER TABLE "b" ADD CONSTRAINT "uq_b" UNIQUE ("name");
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;`,
    );
    expect(r.statements).toHaveLength(2);
    expect(r.statements.every((s) => s.severity === 'aditiva')).toBe(true);
    expect(r.overallSeverity).toBe('aditiva');
  });

  // SEGURANÇA: mesmas defesas do irmão CREATE TYPE — handler errado ou
  // segundo statement escondido tem que continuar fail-closed.
  it('ADD CONSTRAINT com EXCEPTION WHEN OTHERS continua destrutivo (fail-closed)', () => {
    const c = classifyOneStatement(
      `DO $$ BEGIN ALTER TABLE "x" ADD CONSTRAINT "c1" UNIQUE ("email"); EXCEPTION WHEN OTHERS THEN null; END $$;`,
    );
    expect(c.severity).toBe('destrutiva');
  });

  it('ADD CONSTRAINT com um segundo statement escondido continua destrutivo (fail-closed)', () => {
    const c = classifyOneStatement(
      `DO $$ BEGIN ALTER TABLE "x" ADD CONSTRAINT "c1" UNIQUE ("email"); DELETE FROM "y"; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    expect(c.severity).toBe('destrutiva');
  });

  it('DROP/ALTER de constraint dentro do guard NÃO é reconhecido (só ADD é aditivo)', () => {
    const c = classifyOneStatement(
      `DO $$ BEGIN ALTER TABLE "x" DROP CONSTRAINT "c1"; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    expect(c.severity).toBe('destrutiva');
  });

  // GUARD do fallback: um chunk com 2+ statements (CREATE seguido de DROP) NÃO
  // pode ser classificado aditivo pelo atalho de palavra-chave — fail-closed.
  it('fallback NÃO classifica aditivo um chunk composto (CREATE ...; DROP ...)', () => {
    const c = classifyOneStatement(
      `CREATE TABLE "x" ("c" "public"."t"); DROP TABLE "y";`,
    );
    expect(c.severity).toBe('destrutiva');
  });

  // GUARD 3 (SEGURANCA, auditoria 2026-06-30): CTAS com CTE que MODIFICA dado
  // NÃO é aditivo — o DELETE/UPDATE/INSERT executa e altera dado existente.
  // Antes o fallback por palavra-chave classificava qualquer CREATE TABLE como
  // aditivo "independente do corpo" → bypassava o gate de confirmação MFA.
  it('CTAS com CTE que modifica dado (DELETE) é destrutiva, não aditiva', () => {
    const r = classifyMigration(
      `CREATE TABLE "snapshot" AS WITH moved AS (DELETE FROM "orders" WHERE old = true RETURNING *) SELECT * FROM moved;`,
    );
    expect(r.overallSeverity).toBe('destrutiva');
    expect(r.requiresConfirmation).toBe(true);
  });

  it('CTAS com tipo customizado (unparseable) + DML embutido NÃO vira aditivo — Guard 3', () => {
    // Tipo "public"."t" força o fallback por palavra-chave; o INSERT no corpo
    // tem que derrubar pro fail-closed.
    const c = classifyOneStatement(
      `CREATE TABLE "x" AS WITH s AS (INSERT INTO "y" ("c") VALUES (1) RETURNING *) SELECT * FROM s;`,
    );
    expect(c.severity).toBe('destrutiva');
  });

  // GUARD fail-closed: o whitelist de CREATE NÃO vaza pra view/extension
  // (corpos/scripts arbitrários permanecem destrutivos).
  it('CREATE VIEW / EXTENSION permanecem destrutivos (fail-closed)', () => {
    for (const sql of [
      `CREATE VIEW "v" AS SELECT 1;`,
      `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`,
    ]) {
      const r = classifyMigration(sql);
      expect(r.overallSeverity, sql).toBe('destrutiva');
      expect(r.requiresConfirmation, sql).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// destrutiva — statements com perda de dados / risco
// ---------------------------------------------------------------------------
describe('classifyMigration — destrutiva', () => {
  it('DROP COLUMN é destrutiva e traz sugestão expand-contract', () => {
    const r = classifyMigration('ALTER TABLE users DROP COLUMN email;');
    expect(r.statements[0]?.severity).toBe('destrutiva');
    expect(r.statements[0]?.suggestion).toBeTruthy();
    expect(r.statements[0]?.suggestion?.toLowerCase()).toContain(
      'expand-contract',
    );
    expect(r.overallSeverity).toBe('destrutiva');
    expect(r.requiresConfirmation).toBe(true);
  });

  it('DROP TABLE é destrutiva', () => {
    const r = classifyMigration('DROP TABLE users;');
    expect(r.statements[0]?.severity).toBe('destrutiva');
    expect(r.statements[0]?.suggestion).toBeTruthy();
  });

  it('ALTER COLUMN ... TYPE é destrutiva', () => {
    const r = classifyMigration(
      'ALTER TABLE users ALTER COLUMN age TYPE bigint;',
    );
    expect(r.statements[0]?.severity).toBe('destrutiva');
    expect(r.statements[0]?.suggestion).toBeTruthy();
  });

  it('ADD COLUMN NOT NULL sem DEFAULT é destrutiva', () => {
    const r = classifyMigration(
      'ALTER TABLE users ADD COLUMN email text NOT NULL;',
    );
    expect(r.statements[0]?.severity).toBe('destrutiva');
    expect(r.statements[0]?.suggestion?.toLowerCase()).toContain('default');
  });

  it('RENAME COLUMN é destrutiva', () => {
    const r = classifyMigration(
      'ALTER TABLE users RENAME COLUMN email TO email_addr;',
    );
    expect(r.statements[0]?.severity).toBe('destrutiva');
  });

  it('DROP CONSTRAINT é destrutiva', () => {
    const r = classifyMigration(
      'ALTER TABLE users DROP CONSTRAINT users_pkey;',
    );
    expect(r.statements[0]?.severity).toBe('destrutiva');
  });

  it('DELETE (DML) é destrutiva — fail-closed', () => {
    const r = classifyMigration('DELETE FROM users;');
    expect(r.statements[0]?.severity).toBe('destrutiva');
  });

  it('TRUNCATE é destrutiva', () => {
    const r = classifyMigration('TRUNCATE users;');
    expect(r.statements[0]?.severity).toBe('destrutiva');
  });

  it('SQL inválido é destrutiva — fail-closed', () => {
    const r = classifyMigration('this is not valid sql at all !!!;');
    expect(r.statements[0]?.severity).toBe('destrutiva');
    expect(r.overallSeverity).toBe('destrutiva');
  });
});

// ---------------------------------------------------------------------------
// nível de relatório
// ---------------------------------------------------------------------------
describe('classifyMigration — relatório', () => {
  it('multi-statement com 1 destrutiva => overall destrutiva', () => {
    const r = classifyMigration(
      'CREATE TABLE a (id int); ALTER TABLE b DROP COLUMN c;',
    );
    expect(r.statements).toHaveLength(2);
    expect(r.overallSeverity).toBe('destrutiva');
    expect(r.requiresConfirmation).toBe(true);
    expect(r.statements[0]?.severity).toBe('aditiva');
    expect(r.statements[1]?.severity).toBe('destrutiva');
  });

  it('multi-statement só aditiva => overall aditiva', () => {
    const r = classifyMigration(
      'CREATE TABLE a (id int); ALTER TABLE b ADD COLUMN c text;',
    );
    expect(r.statements).toHaveLength(2);
    expect(r.overallSeverity).toBe('aditiva');
    expect(r.requiresConfirmation).toBe(false);
  });

  it('string vazia => relatório vazio aditiva', () => {
    const r = classifyMigration('');
    expect(r).toEqual({
      overallSeverity: 'aditiva',
      statements: [],
      requiresConfirmation: false,
    });
  });

  it('só espaços em branco => relatório vazio aditiva', () => {
    const r = classifyMigration('   \n\t  ');
    expect(r.statements).toEqual([]);
    expect(r.overallSeverity).toBe('aditiva');
  });

  it('só comentários => relatório vazio aditiva', () => {
    const r = classifyMigration('-- apenas um comentário\n');
    expect(r.statements).toEqual([]);
    expect(r.overallSeverity).toBe('aditiva');
    expect(r.requiresConfirmation).toBe(false);
  });

  it('ALTER TABLE multi-ação com 1 destrutiva => statement destrutiva', () => {
    const r = classifyMigration(
      'ALTER TABLE users ADD COLUMN a int, DROP COLUMN b;',
    );
    expect(r.statements).toHaveLength(1);
    expect(r.statements[0]?.severity).toBe('destrutiva');
    expect(r.overallSeverity).toBe('destrutiva');
  });

  it('preserva o SQL bruto trimado de cada statement', () => {
    const r = classifyMigration(
      '  CREATE TABLE a (id int)  ;  ALTER TABLE b DROP COLUMN c ;',
    );
    expect(r.statements[0]?.sql).toBe('CREATE TABLE a (id int)');
    expect(r.statements[1]?.sql).toBe('ALTER TABLE b DROP COLUMN c');
  });

  it('é determinística — mesmo input, output deeply-equal', () => {
    const sql =
      'CREATE TABLE a (id int); ALTER TABLE b DROP COLUMN c; DROP TABLE d;';
    expect(classifyMigration(sql)).toEqual(classifyMigration(sql));
  });
});

// ---------------------------------------------------------------------------
// fail-closed é sagrado
// ---------------------------------------------------------------------------
describe('fail-closed', () => {
  it('erro de parse NUNCA produz aditiva', () => {
    const inputs = [
      'this is not valid sql at all !!!;',
      'GIBBERISH ###;',
      'ALTER TABLE x DO SOMETHING WEIRD;',
      ')))(((;',
    ];
    for (const sql of inputs) {
      const r = classifyMigration(sql);
      for (const s of r.statements) {
        expect(s.severity).not.toBe('aditiva');
        expect(s.severity).toBe('destrutiva');
      }
      expect(r.overallSeverity).toBe('destrutiva');
    }
  });

  it('a regra UNKNOWN é destrutiva na tabela', () => {
    expect(STATEMENT_RULES.UNKNOWN).toBe('destrutiva');
  });

  it('tipo de statement não reconhecido => destrutiva', () => {
    // GRANT não é DDL de schema reconhecido pelo classificador
    const r = classifyMigration('GRANT SELECT ON users TO somerole;');
    expect(r.statements[0]?.severity).toBe('destrutiva');
  });
});

// ---------------------------------------------------------------------------
// fail-closed — cobertura explícita de allowlists (regressão Codex review)
// ---------------------------------------------------------------------------
describe('fail-closed — allowlists', () => {
  it('ALTER TABLE com ação não reconhecida (parseável) => destrutiva (UNKNOWN)', () => {
    // OWNER TO parseia, mas não é ADD/DROP/ALTER/RENAME de coluna/constraint.
    const r = classifyMigration('ALTER TABLE users OWNER TO bob;');
    expect(r.statements[0]?.severity).toBe('destrutiva');
    expect(r.overallSeverity).toBe('destrutiva');
  });

  it('ALTER TABLE ... SET SCHEMA => destrutiva (fail-closed)', () => {
    const r = classifyMigration('ALTER TABLE users SET SCHEMA other;');
    expect(r.statements[0]?.severity).toBe('destrutiva');
  });

  it('CREATE VIEW => destrutiva (não está na allowlist de CREATE)', () => {
    const r = classifyMigration('CREATE VIEW v AS SELECT 1;');
    expect(r.statements[0]?.severity).toBe('destrutiva');
    expect(r.overallSeverity).toBe('destrutiva');
  });

  it('CREATE FUNCTION => destrutiva (não está na allowlist de CREATE)', () => {
    const r = classifyMigration(
      'CREATE FUNCTION f() RETURNS int AS $$ SELECT 1 $$ LANGUAGE sql;',
    );
    expect(r.statements[0]?.severity).toBe('destrutiva');
  });

  // bug_59ee92b8 (2026-06-12): CREATE SCHEMA/TYPE/SEQUENCE/DOMAIN agora são
  // aditivos (objeto nomeado novo, zero impacto em dados). Antes caíam no
  // fail-closed. Ver bloco de testes "aditiva" para a cobertura completa.
  it('CREATE SCHEMA => aditiva (objeto novo, sem impacto em dados)', () => {
    const r = classifyMigration('CREATE SCHEMA myschema;');
    expect(r.statements[0]?.severity).toBe('aditiva');
  });

  it('DROP INDEX => destrutiva (não está na allowlist de aditiva)', () => {
    const r = classifyMigration('DROP INDEX idx;');
    expect(r.statements[0]?.severity).toBe('destrutiva');
    expect(r.overallSeverity).toBe('destrutiva');
  });
});

// ---------------------------------------------------------------------------
// Fix 1 — astify pode devolver ARRAY: nenhum node destrutivo pode se perder
// ---------------------------------------------------------------------------
describe('fail-closed — multi-AST do astify (Fix 1)', () => {
  it('classifyOneStatement com 2 statements (CREATE + DROP) => destrutiva', () => {
    // Quando astify recebe um chunk com 2 statements ele devolve um ARRAY.
    // O DROP NUNCA pode ser silenciado pelo CREATE aditivo que vem antes.
    const c = classifyOneStatement('CREATE TABLE a (id int); DROP TABLE b;');
    expect(c.severity).toBe('destrutiva');
    expect(c.reason.toLowerCase()).toContain('destrut');
  });

  it('classifyOneStatement com ordem invertida (DROP + CREATE) => destrutiva', () => {
    const c = classifyOneStatement('DROP TABLE b; CREATE TABLE a (id int);');
    expect(c.severity).toBe('destrutiva');
  });

  it('classifyOneStatement multi-statement só aditivo => aditiva', () => {
    const c = classifyOneStatement(
      'CREATE TABLE a (id int); CREATE TABLE b (id int);',
    );
    expect(c.severity).toBe('aditiva');
  });

  it('chunk multi-statement não split => DROP propaga pra overall destrutiva', () => {
    // Garante o caminho end-to-end: se por algum motivo um único chunk
    // contiver CREATE + DROP, o relatório ainda marca destrutiva.
    const r = classifyMigration('CREATE TABLE a (id int); DROP TABLE b;');
    expect(r.overallSeverity).toBe('destrutiva');
    expect(r.requiresConfirmation).toBe(true);
    // qualquer statement DROP TABLE precisa ser destrutivo
    expect(r.statements.some((s) => s.severity === 'destrutiva')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fix 2 — dollar-quote boundary-aware no splitter
// ---------------------------------------------------------------------------
describe('split — dollar-quote (Fix 2)', () => {
  it('o ; dentro de $$...$$ NÃO divide o statement', () => {
    const r = classifyMigration(
      'CREATE FUNCTION f() RETURNS int AS $$ BEGIN RETURN 1; END; $$ LANGUAGE plpgsql;',
    );
    expect(r.statements).toHaveLength(1);
  });

  it('o ; dentro de $tag$...$tag$ NÃO divide o statement', () => {
    const r = classifyMigration(
      'CREATE FUNCTION g() RETURNS int AS $body$ BEGIN RETURN 2; END; $body$ LANGUAGE plpgsql;',
    );
    expect(r.statements).toHaveLength(1);
  });

  it('params posicionais $1/$2 não disparam estado de dollar-quote', () => {
    // $1 e $2 não são aberturas de dollar-quote válidas; o ; final divide.
    const chunks = splitSqlStatements(
      "INSERT INTO t (a, b) VALUES ($1, $2); DROP TABLE t;",
    );
    expect(chunks).toHaveLength(2);
    expect(chunks[1]).toBe('DROP TABLE t');
  });

  it('dollar-quote seguido de statement real: split correto', () => {
    const chunks = splitSqlStatements(
      'CREATE FUNCTION f() RETURNS int AS $$ SELECT 1; SELECT 2; $$ LANGUAGE sql; DROP TABLE x;',
    );
    expect(chunks).toHaveLength(2);
    expect(chunks[1]).toBe('DROP TABLE x');
  });

  it('$ isolado / não-opener não engole o resto da migração', () => {
    // Um "$" que não forma opener válido não deve virar dollar-quote.
    const chunks = splitSqlStatements('SELECT 1; SELECT 2;');
    expect(chunks).toHaveLength(2);
  });

  it('identificador com $ embutido (foo$bar$baz) NÃO dispara dollar-quote (Fix A1)', () => {
    // `$` é caractere legal de identificador no PostgreSQL. Um `$tag$` colado
    // a um identificador (`foo$bar$baz`) NÃO é abertura de dollar-quote — o
    // splitter não pode engolir o DROP TABLE que vem depois do `;`.
    const r = classifyMigration(
      'CREATE TABLE foo$bar$baz (id int); DROP TABLE x;',
    );
    expect(r.statements).toHaveLength(2);
    expect(r.overallSeverity).toBe('destrutiva');
    expect(r.statements[0]?.severity).toBe('aditiva');
    expect(r.statements[1]?.severity).toBe('destrutiva');
  });

  it('split cru: identificador com $ embutido não merge os statements (Fix A1)', () => {
    const chunks = splitSqlStatements(
      'CREATE TABLE foo$bar$baz (id int); DROP TABLE x;',
    );
    expect(chunks).toHaveLength(2);
    expect(chunks[1]).toBe('DROP TABLE x');
  });
});

// ---------------------------------------------------------------------------
// explainStatement
// ---------------------------------------------------------------------------
describe('explainStatement', () => {
  it('descreve uma statement aditiva em uma linha', () => {
    const r = classifyMigration('CREATE TABLE users (id int);');
    const line = explainStatement(r.statements[0]!);
    expect(line).toContain('ADITIVA');
    expect(line).not.toContain('\n');
  });

  it('descreve uma statement destrutiva em uma linha', () => {
    const r = classifyMigration('DROP TABLE users;');
    const line = explainStatement(r.statements[0]!);
    expect(line).toContain('DESTRUTIVA');
    expect(line).not.toContain('\n');
    expect(line).toContain(r.statements[0]!.reason);
  });
});

// ---------------------------------------------------------------------------
// tabela de regras
// ---------------------------------------------------------------------------
describe('STATEMENT_RULES', () => {
  it('tem todas as 17 chaves congeladas com a severidade correta', () => {
    expect(STATEMENT_RULES).toEqual({
      CREATE_TABLE: 'aditiva',
      CREATE_TYPE: 'aditiva',
      CREATE_SCHEMA: 'aditiva',
      CREATE_SEQUENCE: 'aditiva',
      CREATE_DOMAIN: 'aditiva',
      ADD_COLUMN_NULLABLE: 'aditiva',
      ADD_COLUMN_NOT_NULL_WITH_DEFAULT: 'aditiva',
      ADD_CONSTRAINT: 'aditiva',
      CREATE_INDEX_CONCURRENTLY: 'aditiva',
      CREATE_INDEX: 'aditiva',
      DROP_COLUMN: 'destrutiva',
      DROP_TABLE: 'destrutiva',
      ALTER_COLUMN_TYPE: 'destrutiva',
      ADD_COLUMN_NOT_NULL_WITHOUT_DEFAULT: 'destrutiva',
      RENAME_COLUMN: 'destrutiva',
      DROP_CONSTRAINT: 'destrutiva',
      UNKNOWN: 'destrutiva',
    });
  });
});
