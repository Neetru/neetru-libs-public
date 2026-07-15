import { describe, it, expect } from 'vitest';
import { detectSchemaDrift } from './detect.js';
import type { SchemaSnapshot } from './types.js';

describe('detectSchemaDrift', () => {
  it('schemas identicos -> sem deriva, todos os arrays vazios', () => {
    const snap: SchemaSnapshot = {
      'users.id': { dataType: 'uuid', nullable: false },
      'users.email': { dataType: 'text', nullable: false },
    };
    const report = detectSchemaDrift({ expected: snap, live: { ...snap } });
    expect(report.drifted).toBe(false);
    expect(report.added).toEqual([]);
    expect(report.removed).toEqual([]);
    expect(report.changed).toEqual([]);
  });

  it('coluna so no live -> added', () => {
    const expected: SchemaSnapshot = {
      'users.id': { dataType: 'uuid', nullable: false },
    };
    const live: SchemaSnapshot = {
      'users.id': { dataType: 'uuid', nullable: false },
      'users.api_key': { dataType: 'text', nullable: true },
    };
    const report = detectSchemaDrift({ expected, live });
    expect(report.drifted).toBe(true);
    expect(report.added).toEqual(['users.api_key']);
    expect(report.removed).toEqual([]);
    expect(report.changed).toEqual([]);
  });

  it('coluna so no expected -> removed', () => {
    const expected: SchemaSnapshot = {
      'users.id': { dataType: 'uuid', nullable: false },
      'users.legacy': { dataType: 'text', nullable: true },
    };
    const live: SchemaSnapshot = {
      'users.id': { dataType: 'uuid', nullable: false },
    };
    const report = detectSchemaDrift({ expected, live });
    expect(report.drifted).toBe(true);
    expect(report.added).toEqual([]);
    expect(report.removed).toEqual(['users.legacy']);
    expect(report.changed).toEqual([]);
  });

  it('dataType diferente -> changed', () => {
    const expected: SchemaSnapshot = {
      'users.id': { dataType: 'uuid', nullable: false },
    };
    const live: SchemaSnapshot = {
      'users.id': { dataType: 'text', nullable: false },
    };
    const report = detectSchemaDrift({ expected, live });
    expect(report.drifted).toBe(true);
    expect(report.changed).toEqual([
      {
        column: 'users.id',
        expected: { dataType: 'uuid', nullable: false },
        live: { dataType: 'text', nullable: false },
      },
    ]);
    expect(report.added).toEqual([]);
    expect(report.removed).toEqual([]);
  });

  it('nullable diferente -> changed', () => {
    const expected: SchemaSnapshot = {
      'users.email': { dataType: 'text', nullable: false },
    };
    const live: SchemaSnapshot = {
      'users.email': { dataType: 'text', nullable: true },
    };
    const report = detectSchemaDrift({ expected, live });
    expect(report.drifted).toBe(true);
    expect(report.changed).toEqual([
      {
        column: 'users.email',
        expected: { dataType: 'text', nullable: false },
        live: { dataType: 'text', nullable: true },
      },
    ]);
  });

  it('uma mistura -> os tres populados, drifted true', () => {
    const expected: SchemaSnapshot = {
      'users.id': { dataType: 'uuid', nullable: false },
      'users.email': { dataType: 'text', nullable: false },
      'users.legacy': { dataType: 'text', nullable: true },
    };
    const live: SchemaSnapshot = {
      'users.id': { dataType: 'uuid', nullable: false },
      'users.email': { dataType: 'text', nullable: true },
      'users.api_key': { dataType: 'text', nullable: true },
    };
    const report = detectSchemaDrift({ expected, live });
    expect(report.drifted).toBe(true);
    expect(report.added).toEqual(['users.api_key']);
    expect(report.removed).toEqual(['users.legacy']);
    expect(report.changed).toEqual([
      {
        column: 'users.email',
        expected: { dataType: 'text', nullable: false },
        live: { dataType: 'text', nullable: true },
      },
    ]);
  });

  it('ordena added e removed lexicograficamente', () => {
    const expected: SchemaSnapshot = {
      'z.removed': { dataType: 'text', nullable: true },
      'a.removed': { dataType: 'text', nullable: true },
    };
    const live: SchemaSnapshot = {
      'z.added': { dataType: 'text', nullable: true },
      'a.added': { dataType: 'text', nullable: true },
    };
    const report = detectSchemaDrift({ expected, live });
    expect(report.added).toEqual(['a.added', 'z.added']);
    expect(report.removed).toEqual(['a.removed', 'z.removed']);
  });

  it('ordena changed por column', () => {
    const expected: SchemaSnapshot = {
      'z.col': { dataType: 'int', nullable: false },
      'a.col': { dataType: 'int', nullable: false },
      'm.col': { dataType: 'int', nullable: false },
    };
    const live: SchemaSnapshot = {
      'z.col': { dataType: 'text', nullable: false },
      'a.col': { dataType: 'text', nullable: false },
      'm.col': { dataType: 'text', nullable: false },
    };
    const report = detectSchemaDrift({ expected, live });
    expect(report.changed.map((c) => c.column)).toEqual([
      'a.col',
      'm.col',
      'z.col',
    ]);
  });

  it('fail-safe: spec do live e null -> changed, nunca silenciosamente sem deriva', () => {
    const expected: SchemaSnapshot = {
      'users.id': { dataType: 'uuid', nullable: false },
    };
    const live = {
      'users.id': null as unknown as SchemaSnapshot[string],
    } as SchemaSnapshot;
    const report = detectSchemaDrift({ expected, live });
    expect(report.drifted).toBe(true);
    expect(report.changed.map((c) => c.column)).toEqual(['users.id']);
  });

  it('fail-safe: dataType e um numero -> changed', () => {
    const expected: SchemaSnapshot = {
      'users.id': { dataType: 'uuid', nullable: false },
    };
    const live = {
      'users.id': { dataType: 123, nullable: false } as unknown as SchemaSnapshot[string],
    } as SchemaSnapshot;
    const report = detectSchemaDrift({ expected, live });
    expect(report.drifted).toBe(true);
    expect(report.changed.map((c) => c.column)).toEqual(['users.id']);
  });

  it('fail-safe: nullable nao e boolean -> changed', () => {
    const expected: SchemaSnapshot = {
      'users.id': { dataType: 'uuid', nullable: false },
    };
    const live = {
      'users.id': {
        dataType: 'uuid',
        nullable: 'no' as unknown as boolean,
      } as unknown as SchemaSnapshot[string],
    } as SchemaSnapshot;
    const report = detectSchemaDrift({ expected, live });
    expect(report.drifted).toBe(true);
    expect(report.changed.map((c) => c.column)).toEqual(['users.id']);
  });

  it('fail-safe: spec malformado nos dois lados ainda conta como deriva', () => {
    const expected = {
      'users.id': null as unknown as SchemaSnapshot[string],
    } as SchemaSnapshot;
    const live = {
      'users.id': null as unknown as SchemaSnapshot[string],
    } as SchemaSnapshot;
    const report = detectSchemaDrift({ expected, live });
    expect(report.drifted).toBe(true);
    expect(report.changed.map((c) => c.column)).toEqual(['users.id']);
  });

  it('defesa contra chave de prototipo: __proto__ tratado como coluna normal', () => {
    // Um literal `{ __proto__: ... }` aciona o setter de prototipo e NAO cria
    // chave propria. Um payload real malicioso chega como chave propria — por
    // ex. via JSON.parse. Reproduzimos isso explicitamente.
    const expected = JSON.parse(
      '{"__proto__":{"dataType":"text","nullable":false}}',
    ) as SchemaSnapshot;
    const live = JSON.parse(
      '{"__proto__":{"dataType":"text","nullable":true}}',
    ) as SchemaSnapshot;
    expect(Object.prototype.hasOwnProperty.call(expected, '__proto__')).toBe(
      true,
    );
    let report;
    expect(() => {
      report = detectSchemaDrift({ expected, live });
    }).not.toThrow();
    expect(report!.changed.map((c) => c.column)).toEqual(['__proto__']);
    // sem confusao de prototipo
    expect(Object.getPrototypeOf(report!)).toBe(Object.prototype);
  });

  it('defesa contra chave de prototipo: constructor tratado como coluna normal', () => {
    const expected: SchemaSnapshot = {
      constructor: { dataType: 'int', nullable: false },
    } as unknown as SchemaSnapshot;
    const live: SchemaSnapshot = {} as SchemaSnapshot;
    const report = detectSchemaDrift({ expected, live });
    expect(report.removed).toEqual(['constructor']);
    expect(report.drifted).toBe(true);
  });

  it('expected null/undefined -> tratado como vazio, sem lancar', () => {
    const live: SchemaSnapshot = {
      'users.id': { dataType: 'uuid', nullable: false },
    };
    const r1 = detectSchemaDrift({
      expected: null as unknown as SchemaSnapshot,
      live,
    });
    expect(r1.added).toEqual(['users.id']);
    expect(r1.drifted).toBe(true);

    const r2 = detectSchemaDrift({
      expected: undefined as unknown as SchemaSnapshot,
      live,
    });
    expect(r2.added).toEqual(['users.id']);
  });

  it('live null/undefined -> tratado como vazio, sem lancar', () => {
    const expected: SchemaSnapshot = {
      'users.id': { dataType: 'uuid', nullable: false },
    };
    const r1 = detectSchemaDrift({
      expected,
      live: null as unknown as SchemaSnapshot,
    });
    expect(r1.removed).toEqual(['users.id']);
    expect(r1.drifted).toBe(true);

    const r2 = detectSchemaDrift({
      expected,
      live: undefined as unknown as SchemaSnapshot,
    });
    expect(r2.removed).toEqual(['users.id']);
  });

  it('ambos vazios -> sem deriva', () => {
    const report = detectSchemaDrift({ expected: {}, live: {} });
    expect(report.drifted).toBe(false);
    expect(report.added).toEqual([]);
    expect(report.removed).toEqual([]);
    expect(report.changed).toEqual([]);
  });

  it('e deterministico: mesma entrada -> saida deeply-equal duas vezes', () => {
    const expected: SchemaSnapshot = {
      'b.col': { dataType: 'int', nullable: false },
      'a.col': { dataType: 'int', nullable: false },
    };
    const live: SchemaSnapshot = {
      'a.col': { dataType: 'text', nullable: false },
      'c.col': { dataType: 'text', nullable: true },
    };
    const r1 = detectSchemaDrift({ expected, live });
    const r2 = detectSchemaDrift({ expected, live });
    expect(r1).toEqual(r2);
  });

  it('nao muta as entradas', () => {
    const expected: SchemaSnapshot = {
      'users.id': { dataType: 'uuid', nullable: false },
    };
    const live: SchemaSnapshot = {
      'users.email': { dataType: 'text', nullable: true },
    };
    const expectedSnapshot = JSON.parse(JSON.stringify(expected));
    const liveSnapshot = JSON.parse(JSON.stringify(live));
    detectSchemaDrift({ expected, live });
    expect(expected).toEqual(expectedSnapshot);
    expect(live).toEqual(liveSnapshot);
  });
});
