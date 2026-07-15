import { describe, it, expect } from 'vitest';
import { computeSchemaFingerprint } from './fingerprint.js';
import type { SchemaSnapshot } from './types.js';

const HEX64 = /^[0-9a-f]{64}$/;

describe('computeSchemaFingerprint', () => {
  it('produz o mesmo hash independente da ordem de insercao das chaves', () => {
    const a: SchemaSnapshot = {
      'users.id': { dataType: 'uuid', nullable: false },
      'users.email': { dataType: 'text', nullable: false },
      'orders.total': { dataType: 'numeric', nullable: true },
    };
    const b: SchemaSnapshot = {
      'orders.total': { dataType: 'numeric', nullable: true },
      'users.email': { dataType: 'text', nullable: false },
      'users.id': { dataType: 'uuid', nullable: false },
    };
    expect(computeSchemaFingerprint(a)).toBe(computeSchemaFingerprint(b));
  });

  it('produz hashes diferentes para snapshots diferentes', () => {
    const a: SchemaSnapshot = { 'users.id': { dataType: 'uuid', nullable: false } };
    const b: SchemaSnapshot = { 'users.id': { dataType: 'text', nullable: false } };
    expect(computeSchemaFingerprint(a)).not.toBe(computeSchemaFingerprint(b));
  });

  it('detecta diferenca em nullable', () => {
    const a: SchemaSnapshot = { 'users.email': { dataType: 'text', nullable: false } };
    const b: SchemaSnapshot = { 'users.email': { dataType: 'text', nullable: true } };
    expect(computeSchemaFingerprint(a)).not.toBe(computeSchemaFingerprint(b));
  });

  it('snapshot vazio produz um hash hex de 64 chars estavel entre chamadas', () => {
    const h1 = computeSchemaFingerprint({});
    const h2 = computeSchemaFingerprint({});
    expect(h1).toMatch(HEX64);
    expect(h1).toBe(h2);
    // hash do SHA-256 da string vazia
    expect(h1).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('produz sempre uma string hex de 64 chars', () => {
    const snap: SchemaSnapshot = { 'a.b': { dataType: 'int', nullable: false } };
    expect(computeSchemaFingerprint(snap)).toMatch(HEX64);
  });

  it('nao lanca com um spec malformado e ainda e deterministico', () => {
    const malformed = {
      'users.id': { dataType: 'uuid', nullable: false },
      'users.weird': null as unknown as SchemaSnapshot[string],
      'users.weirder': 42 as unknown as SchemaSnapshot[string],
    } as SchemaSnapshot;
    let h1 = '';
    expect(() => {
      h1 = computeSchemaFingerprint(malformed);
    }).not.toThrow();
    const h2 = computeSchemaFingerprint(malformed);
    expect(h1).toMatch(HEX64);
    expect(h1).toBe(h2);
  });

  it('nao depende de chaves do prototipo', () => {
    // `__proto__` via JSON.parse vira chave propria de verdade.
    const snap = JSON.parse(
      '{"__proto__":{"dataType":"text","nullable":true},"constructor":{"dataType":"int","nullable":false}}',
    ) as SchemaSnapshot;
    expect(() => computeSchemaFingerprint(snap)).not.toThrow();
    expect(computeSchemaFingerprint(snap)).toMatch(HEX64);
  });
});
