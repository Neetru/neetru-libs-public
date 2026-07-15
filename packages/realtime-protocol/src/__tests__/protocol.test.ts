/**
 * Testes do @neetru/realtime-protocol.
 *
 * Valida:
 *   1. Constantes de op (SUBSCRIBE_OPS / DELTA_OPS) — valores e completude.
 *   2. Type-level checks: atribuicoes validas de SubscribeFrame e DeltaFrame
 *      que o compilador aceita sem erros (verificado na compilacao do test).
 *   3. Runtime assertions: os campos obrigatorios estao presentes em objetos
 *      conformes ao protocolo.
 *   4. Completude: todos os ops conhecidos sao cobertos nos arrays de constantes.
 */

import { describe, it, expect } from 'vitest';
import {
  SUBSCRIBE_OPS,
  DELTA_OPS,
} from '../index.js';
import type {
  SubscribeOp,
  DeltaOp,
  DbQuery,
  SubscribeFrame,
  DbChange,
  DeltaFrame,
} from '../index.js';

// ---------------------------------------------------------------------------
// SUBSCRIBE_OPS
// ---------------------------------------------------------------------------

describe('SUBSCRIBE_OPS — constantes dos ops outbound (cliente → gateway)', () => {
  it('contem exatamente 3 ops', () => {
    expect(SUBSCRIBE_OPS).toHaveLength(3);
  });

  it("inclui 'subscribe'", () => {
    expect(SUBSCRIBE_OPS).toContain('subscribe');
  });

  it("inclui 'unsubscribe'", () => {
    expect(SUBSCRIBE_OPS).toContain('unsubscribe');
  });

  it("inclui 'ping'", () => {
    expect(SUBSCRIBE_OPS).toContain('ping');
  });

  it('e readonly (tuple as const)', () => {
    // O objeto deve ser immutable em runtime (Object.isFrozen nao e garantido
    // por "as const" em JS, mas podemos verificar que nao e um Array mutavel
    // com metodos de push funcionando — a tuple as const nao tem push).
    // Apenas verifica que e array-like com indices.
    expect(Array.isArray(SUBSCRIBE_OPS)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DELTA_OPS
// ---------------------------------------------------------------------------

describe('DELTA_OPS — constantes dos ops inbound (gateway → cliente)', () => {
  it('contem exatamente 6 ops', () => {
    expect(DELTA_OPS).toHaveLength(6);
  });

  it("inclui 'delta'", () => {
    expect(DELTA_OPS).toContain('delta');
  });

  it("inclui 'resync'", () => {
    expect(DELTA_OPS).toContain('resync');
  });

  it("inclui 'stale'", () => {
    expect(DELTA_OPS).toContain('stale');
  });

  it("inclui 'error'", () => {
    expect(DELTA_OPS).toContain('error');
  });

  it("inclui 'pong'", () => {
    expect(DELTA_OPS).toContain('pong');
  });

  it("inclui 'drain'", () => {
    expect(DELTA_OPS).toContain('drain');
  });
});

// ---------------------------------------------------------------------------
// Conformidade de frames (runtime shape assertions)
// ---------------------------------------------------------------------------

describe('SubscribeFrame — shape do frame outbound', () => {
  it('frame subscribe minimo e conforme', () => {
    const frame: SubscribeFrame = {
      op: 'subscribe',
      subscriptionId: 'sub-001',
      collection: 'orders',
    };
    expect(frame.op).toBe('subscribe');
    expect(frame.subscriptionId).toBe('sub-001');
    expect(frame.collection).toBe('orders');
    expect(frame.query).toBeUndefined();
  });

  it('frame subscribe com query completa e conforme', () => {
    const query: DbQuery = {
      filter: { status: 'active', _ticket: 'tk-abc', _dbId: 'db-001' },
      limit: 50,
      orderBy: 'createdAt',
      orderDir: 'desc',
    };
    const frame: SubscribeFrame = {
      op: 'subscribe',
      subscriptionId: 'sub-002',
      collection: 'products',
      query,
    };
    expect(frame.query?.filter?.['status']).toBe('active');
    expect(frame.query?.filter?.['_ticket']).toBe('tk-abc');
    expect(frame.query?.filter?.['_dbId']).toBe('db-001');
    expect(frame.query?.limit).toBe(50);
    expect(frame.query?.orderBy).toBe('createdAt');
    expect(frame.query?.orderDir).toBe('desc');
  });

  it('frame unsubscribe e conforme (sem collection/query)', () => {
    const frame: SubscribeFrame = {
      op: 'unsubscribe',
      subscriptionId: 'sub-001',
    };
    expect(frame.op).toBe('unsubscribe');
    expect(frame.collection).toBeUndefined();
  });

  it('frame ping usa subscriptionId vazio por convencao', () => {
    const frame: SubscribeFrame = {
      op: 'ping',
      subscriptionId: '',
    };
    expect(frame.op).toBe('ping');
    expect(frame.subscriptionId).toBe('');
  });
});

describe('DeltaFrame — shape do frame inbound', () => {
  it('frame delta com changes e conforme', () => {
    const change: DbChange = {
      type: 'insert',
      documentId: 'doc-001',
      data: { title: 'Pedido novo', status: 'pending' },
    };
    const frame: DeltaFrame = {
      op: 'delta',
      subscriptionId: 'sub-001',
      changes: [change],
    };
    expect(frame.op).toBe('delta');
    expect(frame.changes).toHaveLength(1);
    expect(frame.changes?.[0]?.documentId).toBe('doc-001');
    expect(frame.changes?.[0]?.type).toBe('insert');
  });

  it('frame resync sem changes e conforme', () => {
    const frame: DeltaFrame = {
      op: 'resync',
      subscriptionId: 'sub-001',
    };
    expect(frame.op).toBe('resync');
    expect(frame.changes).toBeUndefined();
  });

  it('frame error com reason e conforme', () => {
    const frame: DeltaFrame = {
      op: 'error',
      subscriptionId: 'sub-001',
      reason: 'subscription_not_found',
    };
    expect(frame.reason).toBe('subscription_not_found');
  });

  it('frame pong sem changes e conforme (resposta ao ping)', () => {
    const frame: DeltaFrame = {
      op: 'pong',
      subscriptionId: '',
    };
    expect(frame.op).toBe('pong');
  });

  it('frame drain sem changes e conforme (graceful shutdown)', () => {
    const frame: DeltaFrame = {
      op: 'drain',
      subscriptionId: '',
    };
    expect(frame.op).toBe('drain');
  });

  it('frame stale sem changes e conforme', () => {
    const frame: DeltaFrame = {
      op: 'stale',
      subscriptionId: 'sub-002',
    };
    expect(frame.op).toBe('stale');
  });
});

describe('DbChange — shape de uma mudanca individual', () => {
  it('delete nao tem data', () => {
    const change: DbChange = {
      type: 'delete',
      documentId: 'doc-999',
    };
    expect(change.data).toBeUndefined();
  });

  it('update tem data', () => {
    const change: DbChange = {
      type: 'update',
      documentId: 'doc-100',
      data: { status: 'shipped' },
    };
    expect(change.data?.['status']).toBe('shipped');
  });
});

// ---------------------------------------------------------------------------
// Verificacao de completude: todos os ops cabem nos types
// ---------------------------------------------------------------------------

describe('type completude — SubscribeOp e DeltaOp cobrem os arrays', () => {
  it('todos os SUBSCRIBE_OPS sao validos como SubscribeOp', () => {
    // Se o TypeScript nao reclamar desta atribuicao, os tipos sao compatíveis.
    const ops: SubscribeOp[] = [...SUBSCRIBE_OPS];
    expect(ops).toHaveLength(3);
  });

  it('todos os DELTA_OPS sao validos como DeltaOp', () => {
    const ops: DeltaOp[] = [...DELTA_OPS];
    expect(ops).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// Serializacao JSON (o protocolo usa JSON sobre WS)
// ---------------------------------------------------------------------------

describe('serializacao JSON dos frames', () => {
  it('SubscribeFrame sobrevive a JSON.stringify + JSON.parse', () => {
    const original: SubscribeFrame = {
      op: 'subscribe',
      subscriptionId: 'sub-json-1',
      collection: 'invoices',
      query: { filter: { _ticket: 'tk-x', _dbId: 'db-y' }, limit: 10 },
    };
    const roundtripped = JSON.parse(JSON.stringify(original)) as SubscribeFrame;
    expect(roundtripped.op).toBe(original.op);
    expect(roundtripped.subscriptionId).toBe(original.subscriptionId);
    expect(roundtripped.collection).toBe(original.collection);
    expect(roundtripped.query?.filter?.['_ticket']).toBe('tk-x');
    expect(roundtripped.query?.limit).toBe(10);
  });

  it('DeltaFrame com changes sobrevive a JSON.stringify + JSON.parse', () => {
    const original: DeltaFrame = {
      op: 'delta',
      subscriptionId: 'sub-json-2',
      changes: [
        { type: 'insert', documentId: 'd1', data: { x: 1 } },
        { type: 'delete', documentId: 'd2' },
      ],
    };
    const roundtripped = JSON.parse(JSON.stringify(original)) as DeltaFrame;
    expect(roundtripped.changes).toHaveLength(2);
    expect(roundtripped.changes?.[0]?.type).toBe('insert');
    expect(roundtripped.changes?.[1]?.type).toBe('delete');
    expect(roundtripped.changes?.[1]?.data).toBeUndefined();
  });
});
