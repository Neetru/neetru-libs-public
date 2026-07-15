import { describe, it, expect } from 'vitest';
import { assertNonTrivialWhere } from './where-guard.js';

describe('assertNonTrivialWhere — passa (WHERE genuino)', () => {
  it('DELETE com WHERE id = 5 passa sem lancar', () => {
    expect(() =>
      assertNonTrivialWhere('DELETE FROM users WHERE id = 5'),
    ).not.toThrow();
  });

  it('UPDATE com WHERE de coluna string passa', () => {
    expect(() =>
      assertNonTrivialWhere("UPDATE users SET x = 1 WHERE status = 'banned'"),
    ).not.toThrow();
  });

  it('DELETE com WHERE composto por AND de colunas passa', () => {
    expect(() =>
      assertNonTrivialWhere(
        "DELETE FROM users WHERE status = 'x' AND id = 9",
      ),
    ).not.toThrow();
  });

  it('UPDATE com WHERE de comparacao de coluna com numero passa', () => {
    expect(() =>
      assertNonTrivialWhere('UPDATE users SET x = 1 WHERE age > 18'),
    ).not.toThrow();
  });

  it('DELETE com WHERE id = $1 (placeholder) passa', () => {
    expect(() =>
      assertNonTrivialWhere('DELETE FROM users WHERE id = $1'),
    ).not.toThrow();
  });

  it('UPDATE com WHERE coluna = $1 AND coluna = $2 passa', () => {
    expect(() =>
      assertNonTrivialWhere(
        "UPDATE users SET x = 1 WHERE status = 'x' AND tenant_id = $1",
      ),
    ).not.toThrow();
  });

  it('DELETE com WHERE col IN (...) passa', () => {
    expect(() =>
      assertNonTrivialWhere('DELETE FROM users WHERE id IN (1, 2, 3)'),
    ).not.toThrow();
  });

  it('DELETE com WHERE col IS NULL passa (restritivo — só linhas NULL)', () => {
    expect(() =>
      assertNonTrivialWhere('DELETE FROM users WHERE deleted_at IS NULL'),
    ).not.toThrow();
  });

  it('DELETE com WHERE col LIKE ... passa', () => {
    expect(() =>
      assertNonTrivialWhere("DELETE FROM users WHERE name LIKE 'a%'"),
    ).not.toThrow();
  });
});

describe('assertNonTrivialWhere — lanca (sem WHERE)', () => {
  it('DELETE sem WHERE lanca', () => {
    expect(() => assertNonTrivialWhere('DELETE FROM users')).toThrow();
  });

  it('UPDATE sem WHERE lanca', () => {
    expect(() =>
      assertNonTrivialWhere('UPDATE users SET x = 1'),
    ).toThrow();
  });
});

describe('assertNonTrivialWhere — lanca (WHERE tautologico)', () => {
  it('UPDATE com WHERE 1=1 lanca', () => {
    expect(() =>
      assertNonTrivialWhere('UPDATE users SET x = 1 WHERE 1=1'),
    ).toThrow();
  });

  it('DELETE com WHERE true lanca', () => {
    expect(() =>
      assertNonTrivialWhere('DELETE FROM users WHERE true'),
    ).toThrow();
  });

  it("DELETE com WHERE 'a'='a' lanca", () => {
    expect(() =>
      assertNonTrivialWhere("DELETE FROM users WHERE 'a'='a'"),
    ).toThrow();
  });

  it('DELETE com WHERE 1 (literal truthy) lanca', () => {
    expect(() =>
      assertNonTrivialWhere('DELETE FROM users WHERE 1'),
    ).toThrow();
  });

  it("UPDATE com OR que inclui tautologia (status='a' OR 1=1) lanca", () => {
    expect(() =>
      assertNonTrivialWhere("UPDATE users SET x = 1 WHERE status='a' OR 1=1"),
    ).toThrow();
  });

  // bug_2c3ab1e7 — predicados NEGATIVOS/de-exclusao casam ~TODAS as linhas.
  it('DELETE com WHERE col IS NOT NULL lanca (near-tautologia, exclui só NULLs)', () => {
    expect(() =>
      assertNonTrivialWhere('DELETE FROM users WHERE email IS NOT NULL'),
    ).toThrow();
  });

  it('DELETE com WHERE col != literal lanca (exclusao, nao restritivo)', () => {
    expect(() =>
      assertNonTrivialWhere("DELETE FROM users WHERE status != 'x'"),
    ).toThrow();
  });

  it('UPDATE com WHERE col <> literal lanca (exclusao)', () => {
    expect(() =>
      assertNonTrivialWhere("UPDATE users SET x = 1 WHERE status <> 'x'"),
    ).toThrow();
  });

  it('DELETE com WHERE col NOT IN (...) lanca (exclusao)', () => {
    expect(() =>
      assertNonTrivialWhere('DELETE FROM users WHERE id NOT IN (1, 2)'),
    ).toThrow();
  });

  it("DELETE com WHERE col LIKE '%' (so-curinga) lanca (tautologia)", () => {
    expect(() =>
      assertNonTrivialWhere("DELETE FROM users WHERE name LIKE '%'"),
    ).toThrow();
  });

  it('DELETE com OR onde a tautologia esta no ramo esquerdo lanca', () => {
    expect(() =>
      assertNonTrivialWhere("DELETE FROM users WHERE 1=1 OR id = 5"),
    ).toThrow();
  });

  it('UPDATE com WHERE 2 > 1 (comparacao constante verdadeira) lanca', () => {
    expect(() =>
      assertNonTrivialWhere('UPDATE users SET x = 1 WHERE 2 > 1'),
    ).toThrow();
  });

  it('DELETE com WHERE NOT false (fail-open antigo) lanca', () => {
    // Codex HIGH: o guard nao reconhecia `NOT false` como predicado de coluna,
    // e o fail-OPEN antigo deixava passar. Fail-closed agora -> lanca.
    expect(() =>
      assertNonTrivialWhere('DELETE FROM users WHERE NOT false'),
    ).toThrow();
  });

  it('DELETE com WHERE id = id (col = col, tautologia) lanca', () => {
    // Codex MEDIUM: refs de coluna identicas dos dois lados sao tautologicas.
    expect(() =>
      assertNonTrivialWhere('DELETE FROM users WHERE id = id'),
    ).toThrow();
  });

  it('UPDATE com WHERE users.id = users.id (col qualificada igual) lanca', () => {
    expect(() =>
      assertNonTrivialWhere(
        'UPDATE users SET x = 1 WHERE users.id = users.id',
      ),
    ).toThrow();
  });
});

describe('assertNonTrivialWhere — lanca (qualquer OR / fail-closed)', () => {
  // Codex re-review: OR sempre ALARGA o conjunto de linhas. Ramos
  // complementares unidos por OR cobrem TODAS as linhas mesmo que cada
  // ramo pareca restritivo isoladamente (tautologia complementar). Um
  // guard sintatico nao consegue detectar isso -> rejeita OR de forma
  // categorica (fail-closed). Quem precisa de varios valores usa IN (...).

  it('DELETE com OR de predicados complementares IS NULL / IS NOT NULL lanca', () => {
    expect(() =>
      assertNonTrivialWhere(
        'DELETE FROM users WHERE id IS NULL OR id IS NOT NULL',
      ),
    ).toThrow();
  });

  it('UPDATE com OR de predicados complementares numericos lanca', () => {
    expect(() =>
      assertNonTrivialWhere(
        'UPDATE users SET x = 1 WHERE age > 0 OR age <= 0',
      ),
    ).toThrow();
  });

  it('DELETE com OR de igualdade/desigualdade complementar lanca', () => {
    expect(() =>
      assertNonTrivialWhere(
        "DELETE FROM users WHERE status = 'a' OR status != 'a'",
      ),
    ).toThrow();
  });

  it('DELETE com OR de dois predicados de coluna distintos lanca (qualquer OR recusado)', () => {
    expect(() =>
      assertNonTrivialWhere(
        "DELETE FROM users WHERE status = 'a' OR tenant_id = $1",
      ),
    ).toThrow();
  });

  it('DELETE com OR de dois predicados de coluna iguais lanca (qualquer OR recusado)', () => {
    expect(() =>
      assertNonTrivialWhere(
        "DELETE FROM users WHERE status = 'a' OR status = 'b'",
      ),
    ).toThrow();
  });
});

describe('assertNonTrivialWhere — lanca (WHERE nao reconhecido / fail-closed)', () => {
  it('WHERE com forma nao classificavel lanca (fail-closed)', () => {
    // qualquer WHERE que o guard nao prove ser um predicado coluna-vs-literal
    // restritivo -> recusado.
    expect(() =>
      assertNonTrivialWhere('DELETE FROM users WHERE NOT (id IS NULL)'),
    ).toThrow();
  });
});

describe('assertNonTrivialWhere — lanca (tipo errado / fail-closed)', () => {
  it('SELECT passado lanca', () => {
    expect(() =>
      assertNonTrivialWhere('SELECT * FROM users WHERE id = 1'),
    ).toThrow();
  });

  it('INSERT passado lanca', () => {
    expect(() =>
      assertNonTrivialWhere("INSERT INTO users (id) VALUES (1)"),
    ).toThrow();
  });

  it('SQL lixo lanca', () => {
    expect(() => assertNonTrivialWhere('not sql at all')).toThrow();
  });

  it('string vazia lanca', () => {
    expect(() => assertNonTrivialWhere('')).toThrow();
  });

  it('multiplos statements lanca', () => {
    expect(() =>
      assertNonTrivialWhere('DELETE FROM users WHERE id = 1; DELETE FROM t'),
    ).toThrow();
  });
});

// ============================================================
// RC-F: novos casos bloqueados (tautologia / IS NOT NULL + OR / NULL <> / LIKE so-wildcard)
// ============================================================

describe('assertNonTrivialWhere — lanca (RC-F: IS NOT NULL com OR neutraliza filtro)', () => {
  // OR e sempre rejeitado (politica pre-existente); estes testes documentam
  // explicitamente o vetor IS NOT NULL + OR que RC-F aponta.
  it('DELETE com IS NOT NULL OR col = 5 lanca (OR com IS NOT NULL)', () => {
    expect(() =>
      assertNonTrivialWhere(
        'DELETE FROM users WHERE email IS NOT NULL OR id = 5',
      ),
    ).toThrow();
  });

  it('UPDATE com col IS NOT NULL OR col IS NULL lanca (complementar, OR)', () => {
    expect(() =>
      assertNonTrivialWhere(
        'UPDATE users SET x = 1 WHERE email IS NOT NULL OR email IS NULL',
      ),
    ).toThrow();
  });
});

describe('assertNonTrivialWhere — lanca (RC-F: LIKE/ILIKE positivo so-`%` always-true)', () => {
  // Apenas o LIKE/ILIKE POSITIVO com padrao composto SO de `%` e tautologico:
  // casa qualquer string nao-NULL. `_` (1 char) e `%_%` (>=1 char) sao
  // restritivos -> nao entram aqui (ver bloco anti-falso-positivo abaixo).
  it('DELETE com LIKE somente percent lanca', () => {
    expect(() =>
      assertNonTrivialWhere("DELETE FROM users WHERE name LIKE '%'"),
    ).toThrow();
  });

  it('DELETE com LIKE duplo-percent lanca', () => {
    expect(() =>
      assertNonTrivialWhere("DELETE FROM users WHERE name LIKE '%%'"),
    ).toThrow();
  });

  it('DELETE com LIKE triplo-percent lanca', () => {
    expect(() =>
      assertNonTrivialWhere("DELETE FROM users WHERE name LIKE '%%%'"),
    ).toThrow();
  });

  it('DELETE com ILIKE somente percent lanca', () => {
    expect(() =>
      assertNonTrivialWhere("DELETE FROM users WHERE name ILIKE '%'"),
    ).toThrow();
  });
});

describe('assertNonTrivialWhere — lanca (RC-F: <> NULL / != NULL sempre UNKNOWN)', () => {
  it('DELETE com col <> NULL lanca', () => {
    expect(() =>
      assertNonTrivialWhere('DELETE FROM users WHERE email <> NULL'),
    ).toThrow();
  });

  it('UPDATE com col != NULL lanca', () => {
    expect(() =>
      assertNonTrivialWhere('UPDATE users SET x = 1 WHERE email != NULL'),
    ).toThrow();
  });

  it('DELETE com NULL <> col (NULL DE VERDADE no lado esquerdo) lanca', () => {
    // node-sql-parser preserva NULL a esquerda; o guard cobre ambos os lados
    // (isNullLiteralNode(left) || isNullLiteralNode(right)).
    expect(() =>
      assertNonTrivialWhere('DELETE FROM users WHERE NULL <> email'),
    ).toThrow();
  });

  it('UPDATE com NULL != col (NULL a esquerda, !=) lanca', () => {
    expect(() =>
      assertNonTrivialWhere('UPDATE users SET x = 1 WHERE NULL != email'),
    ).toThrow();
  });
});

describe('assertNonTrivialWhere — passa (RC-F: anti-falso-positivo)', () => {
  // Garantia: os novos checks NAO bloqueiam queries legitimas.

  it('DELETE com col IS NOT NULL passa (filtro real em coluna nullable)', () => {
    // IS NOT NULL sozinho permanece aceito — filtra linhas com email preenchido.
    expect(() =>
      assertNonTrivialWhere('DELETE FROM users WHERE email IS NOT NULL'),
    ).not.toThrow();
  });

  it('DELETE com col IS NOT NULL AND id = 5 passa (AND com predicado real)', () => {
    expect(() =>
      assertNonTrivialWhere(
        'DELETE FROM users WHERE email IS NOT NULL AND id = 5',
      ),
    ).not.toThrow();
  });

  it("DELETE com LIKE 'a%' passa (padrao com char literal)", () => {
    expect(() =>
      assertNonTrivialWhere("DELETE FROM users WHERE name LIKE 'a%'"),
    ).not.toThrow();
  });

  it("DELETE com LIKE '%texto%' passa (padrao com chars literais)", () => {
    expect(() =>
      assertNonTrivialWhere("DELETE FROM users WHERE name LIKE '%texto%'"),
    ).not.toThrow();
  });

  it("UPDATE com LIKE 'prefix_%' passa (prefixo literal presente)", () => {
    expect(() =>
      assertNonTrivialWhere("UPDATE users SET x = 1 WHERE name LIKE 'prefix_%'"),
    ).not.toThrow();
  });

  it("DELETE com ILIKE '%@example.com' passa (sufixo literal presente)", () => {
    expect(() =>
      assertNonTrivialWhere("DELETE FROM users WHERE email ILIKE '%@example.com'"),
    ).not.toThrow();
  });

  it("DELETE com LIKE '_' passa (1 char exato — restritivo, NAO always-true)", () => {
    // `_` casa EXATAMENTE 1 char: exclui a string vazia e qualquer len != 1.
    expect(() =>
      assertNonTrivialWhere("DELETE FROM users WHERE name LIKE '_'"),
    ).not.toThrow();
  });

  it("DELETE com LIKE '%_%' passa (>=1 char — restritivo, NAO always-true)", () => {
    // `%_%` exige PELO MENOS 1 char: exclui a string vazia -> restritivo.
    expect(() =>
      assertNonTrivialWhere("DELETE FROM users WHERE name LIKE '%_%'"),
    ).not.toThrow();
  });

  it("UPDATE com NOT LIKE '_' passa (negacao e RESTRITIVA, nao tautologica)", () => {
    // FP-1: NOT LIKE e o oposto do always-true -> nunca deve ser bloqueado.
    expect(() =>
      assertNonTrivialWhere("UPDATE users SET x = 1 WHERE name NOT LIKE '_'"),
    ).not.toThrow();
  });

  it("UPDATE com NOT LIKE '%' passa (negacao de always-true = restritivo)", () => {
    expect(() =>
      assertNonTrivialWhere("UPDATE users SET x = 1 WHERE name NOT LIKE '%'"),
    ).not.toThrow();
  });

  it("DELETE com LIKE '%%' ESCAPE '%' passa (ESCAPE torna % literal)", () => {
    // FP-3: com ESCAPE o `%` pode ser literal -> nao da pra provar wildcard ->
    // conservador, pula o bloqueio (restritivo na pratica: casa a string '%').
    expect(() =>
      assertNonTrivialWhere("DELETE FROM users WHERE name LIKE '%%' ESCAPE '%'"),
    ).not.toThrow();
  });

  it("UPDATE com col <> 'some_value' passa (nao e NULL)", () => {
    expect(() =>
      assertNonTrivialWhere("UPDATE users SET x = 1 WHERE status <> 'active'"),
    ).not.toThrow();
  });

  it('DELETE com col != 5 passa (nao e NULL, comparacao com numero)', () => {
    expect(() =>
      assertNonTrivialWhere('DELETE FROM users WHERE age != 18'),
    ).not.toThrow();
  });
});

describe('assertNonTrivialWhere — determinismo', () => {
  it('mesmo input ok -> sempre ok', () => {
    const run = () =>
      assertNonTrivialWhere('DELETE FROM users WHERE id = 5');
    expect(run).not.toThrow();
    expect(run).not.toThrow();
  });

  it('mesmo input tautologico -> sempre lanca', () => {
    const run = () =>
      assertNonTrivialWhere('DELETE FROM users WHERE 1=1');
    expect(run).toThrow();
    expect(run).toThrow();
  });
});
