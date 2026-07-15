import { describe, it, expect } from 'vitest';
import { computePoolSizing, assertConnectionInvariant } from './index.js';

const RESERVED_CONNECTIONS = 8;

/** Reproduz a derivacao de `usable` do modulo para assertar a propriedade de seguranca. */
function expectedUsable(maxConnections: number, nBancos: number): number {
  return Math.max(maxConnections - RESERVED_CONNECTIONS, nBancos);
}

describe('computePoolSizing — derivacao com max_connections default (100)', () => {
  it('1 banco → defaultPoolSize ~= 92 (usable=92, 92/1)', () => {
    const out = computePoolSizing(1);
    expect(out.defaultPoolSize).toBe(92);
  });

  it('4 bancos → defaultPoolSize ~= 23 (usable=92, floor(92/4))', () => {
    const out = computePoolSizing(4);
    expect(out.defaultPoolSize).toBe(23);
  });

  it('10 bancos → defaultPoolSize ~= 9 (usable=92, floor(92/10))', () => {
    const out = computePoolSizing(10);
    expect(out.defaultPoolSize).toBe(9);
  });

  it('46 bancos → regiao do floor-de-2 (floor(92/46)=2)', () => {
    const out = computePoolSizing(46);
    expect(out.defaultPoolSize).toBe(2);
  });

  it('100 bancos numa VM de 100 conns → floor-de-2 mesmo com over-densidade', () => {
    // usable = max(92, 100) = 100; floor(100/100) = 1 → floor-de-2 entra.
    const out = computePoolSizing(100);
    expect(out.defaultPoolSize).toBe(2);
  });
});

describe('computePoolSizing — propriedade de seguranca no regime normal', () => {
  it('nBancos * defaultPoolSize <= usable sempre que floor(usable/nBancos) >= 2', () => {
    const maxConnsValues = [50, 100, 200, 400, 500];
    for (const maxConnections of maxConnsValues) {
      for (let nBancos = 1; nBancos <= 80; nBancos++) {
        const out = computePoolSizing(nBancos, maxConnections);
        const usable = expectedUsable(maxConnections, nBancos);
        if (Math.floor(usable / nBancos) >= 2) {
          // regime normal — a invariante de seguranca DEVE valer.
          expect(nBancos * out.defaultPoolSize).toBeLessThanOrEqual(usable);
        }
      }
    }
  });

  it('no regime normal o pool e o maior que cabe (floor exato)', () => {
    const out = computePoolSizing(4, 100);
    const usable = expectedUsable(100, 4);
    expect(out.defaultPoolSize).toBe(Math.floor(usable / 4));
  });
});

describe('computePoolSizing — nBancos invalido lanca (fail-closed, sem fallback)', () => {
  it('nBancos = 0 → lanca', () => {
    expect(() => computePoolSizing(0)).toThrow();
  });

  it('nBancos = -3 → lanca', () => {
    expect(() => computePoolSizing(-3)).toThrow();
  });

  it('nBancos = NaN → lanca', () => {
    expect(() => computePoolSizing(NaN)).toThrow();
  });

  it('nBancos = Infinity → lanca', () => {
    expect(() => computePoolSizing(Infinity)).toThrow();
  });

  it('nBancos = 2.5 (nao-inteiro) → lanca', () => {
    expect(() => computePoolSizing(2.5)).toThrow();
  });

  it('nBancos = 10001 (acima do teto sano) → lanca', () => {
    expect(() => computePoolSizing(10001)).toThrow();
  });

  it('a mensagem de erro explica que precisa da contagem real de bancos', () => {
    try {
      computePoolSizing(0);
      throw new Error('deveria ter lancado');
    } catch (e) {
      expect((e as Error).message).toMatch(/nBancos/);
      expect((e as Error).message).toMatch(/contagem real/i);
    }
  });
});

describe('computePoolSizing — nBancos inteiro valido funciona', () => {
  it('1, 4, 10, 46 → nao lancam e produzem pool', () => {
    for (const n of [1, 4, 10, 46]) {
      expect(() => computePoolSizing(n)).not.toThrow();
      expect(computePoolSizing(n).defaultPoolSize).toBeGreaterThanOrEqual(2);
    }
  });

  it('nBancos = 10000 (no teto) → ok', () => {
    expect(() => computePoolSizing(10000)).not.toThrow();
  });
});

describe('computePoolSizing — maxConnections invalido lanca', () => {
  it('maxConnections = 0 → lanca', () => {
    expect(() => computePoolSizing(4, 0)).toThrow();
  });

  it('maxConnections = -1 → lanca', () => {
    expect(() => computePoolSizing(4, -1)).toThrow();
  });

  it('maxConnections = NaN → lanca', () => {
    expect(() => computePoolSizing(4, NaN)).toThrow();
  });

  it('maxConnections = Infinity → lanca (nao-finito)', () => {
    expect(() => computePoolSizing(4, Infinity)).toThrow();
  });
});

describe('computePoolSizing — maxConnections valido / fracionario', () => {
  it('maxConnections fracionario (100.7) → tratado como 100 (floor)', () => {
    expect(computePoolSizing(4, 100.7)).toEqual(computePoolSizing(4, 100));
  });

  it('maxConnections omitido → usa 100', () => {
    expect(computePoolSizing(4)).toEqual(computePoolSizing(4, 100));
  });

  it('maxConnections valido alto → pool maior', () => {
    const out = computePoolSizing(4, 200);
    expect(out.defaultPoolSize).toBe(Math.floor((200 - RESERVED_CONNECTIONS) / 4));
  });

  it('maxConnections pequeno mas legitimo (20) → ok, sem lancar', () => {
    expect(() => computePoolSizing(4, 20)).not.toThrow();
  });
});

describe('computePoolSizing — campos fixos e minimos', () => {
  it('maxClientConn e sempre 500', () => {
    expect(computePoolSizing(1).maxClientConn).toBe(500);
    expect(computePoolSizing(50, 400).maxClientConn).toBe(500);
  });

  it('reservePoolSize e sempre >= 1', () => {
    for (let n = 1; n <= 120; n++) {
      expect(computePoolSizing(n).reservePoolSize).toBeGreaterThanOrEqual(1);
    }
  });

  it('reservePoolSize = floor(defaultPoolSize / 4)', () => {
    const out = computePoolSizing(4, 100); // defaultPoolSize = 23
    expect(out.reservePoolSize).toBe(Math.max(1, Math.floor(out.defaultPoolSize / 4)));
  });

  it('defaultPoolSize e sempre >= 2 (floor de viabilidade)', () => {
    for (let n = 1; n <= 300; n++) {
      expect(computePoolSizing(n).defaultPoolSize).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('computePoolSizing — determinismo e pureza', () => {
  it('mesma entrada → mesma saida', () => {
    expect(computePoolSizing(7, 150)).toEqual(computePoolSizing(7, 150));
    expect(computePoolSizing(7, 150)).toEqual(computePoolSizing(7, 150));
  });

  it('retorna exatamente as 3 chaves do contrato', () => {
    expect(Object.keys(computePoolSizing(4)).sort()).toEqual([
      'defaultPoolSize',
      'maxClientConn',
      'reservePoolSize',
    ]);
  });
});

describe('assertConnectionInvariant — invariante de autoscaling', () => {
  it('2 x 4 = 8 <= 8 → ok (nao lanca)', () => {
    expect(() =>
      assertConnectionInvariant({ sdkPoolMax: 2, maxInstances: 4, defaultPoolSize: 8 }),
    ).not.toThrow();
  });

  it('2 x 5 = 10 > 8 → lanca', () => {
    expect(() =>
      assertConnectionInvariant({ sdkPoolMax: 2, maxInstances: 5, defaultPoolSize: 8 }),
    ).toThrow();
  });

  it('mensagem do erro nomeia os tres numeros', () => {
    try {
      assertConnectionInvariant({ sdkPoolMax: 3, maxInstances: 5, defaultPoolSize: 10 });
      throw new Error('deveria ter lancado');
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain('3');
      expect(msg).toContain('5');
      expect(msg).toContain('10');
    }
  });

  it('invariante folgada (1 x 1 <= 50) → ok', () => {
    expect(() =>
      assertConnectionInvariant({ sdkPoolMax: 1, maxInstances: 1, defaultPoolSize: 50 }),
    ).not.toThrow();
  });
});

describe('assertConnectionInvariant — fail-closed em entrada invalida', () => {
  const bad = [
    { sdkPoolMax: 0, maxInstances: 4, defaultPoolSize: 8 },
    { sdkPoolMax: 2, maxInstances: 0, defaultPoolSize: 8 },
    { sdkPoolMax: 2, maxInstances: 4, defaultPoolSize: 0 },
    { sdkPoolMax: -1, maxInstances: 4, defaultPoolSize: 8 },
    { sdkPoolMax: 2, maxInstances: -4, defaultPoolSize: 8 },
    { sdkPoolMax: 2, maxInstances: 4, defaultPoolSize: -8 },
    { sdkPoolMax: NaN, maxInstances: 4, defaultPoolSize: 8 },
    { sdkPoolMax: 2, maxInstances: NaN, defaultPoolSize: 8 },
    { sdkPoolMax: 2, maxInstances: 4, defaultPoolSize: NaN },
    { sdkPoolMax: 2.5, maxInstances: 4, defaultPoolSize: 8 },
    { sdkPoolMax: 2, maxInstances: 4.5, defaultPoolSize: 8 },
    { sdkPoolMax: 2, maxInstances: 4, defaultPoolSize: 8.5 },
    { sdkPoolMax: Infinity, maxInstances: 4, defaultPoolSize: 8 },
    { sdkPoolMax: 2, maxInstances: Infinity, defaultPoolSize: 8 },
    { sdkPoolMax: 2, maxInstances: 4, defaultPoolSize: Infinity },
    { sdkPoolMax: -Infinity, maxInstances: 4, defaultPoolSize: 8 },
    { sdkPoolMax: 2, maxInstances: -Infinity, defaultPoolSize: 8 },
    { sdkPoolMax: 2, maxInstances: 4, defaultPoolSize: -Infinity },
    { sdkPoolMax: 2, maxInstances: 4, defaultPoolSize: NaN },
  ];

  for (const input of bad) {
    it(`entrada invalida ${JSON.stringify(input)} → lanca`, () => {
      expect(() => assertConnectionInvariant(input)).toThrow();
    });
  }
});
