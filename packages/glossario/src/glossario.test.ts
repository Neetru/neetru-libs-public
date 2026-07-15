import { describe, it, expect } from 'vitest';
import {
  VOCABULARY,
  DB_STATE,
  MIGRATION_STATE,
  DATABASE_ENGINES,
  ALLOWED_FOREIGN,
  ENV_IDS,
  humanize,
  engineLabel,
  engineSeal,
  normalizeEnvId,
} from './index.js';

describe('VOCABULARY', () => {
  it('tem exatamente 15 entradas', () => {
    expect(Object.keys(VOCABULARY)).toHaveLength(15);
  });

  it('mapeia cada termo para o valor PT-BR cravado', () => {
    expect(VOCABULARY).toEqual({
      tenant: 'Ambiente',
      workspace: 'Ambiente do produto',
      provisioning: 'Configurando',
      entitlement: 'Permissão',
      tier: 'Tamanho',
      subscription: 'Assinatura',
      deployment: 'Lançamento',
      deploy: 'Lançamento',
      provider: 'Fornecedor',
      customer: 'Cliente',
      staff: 'Equipe',
      account: 'Conta',
      organization: 'Empresa',
      resource: 'Recurso',
      dunning: 'Cobrança em atraso',
    });
  });

  it('é congelado — mutação não tem efeito', () => {
    expect(Object.isFrozen(VOCABULARY)).toBe(true);
    expect(() => {
      // @ts-expect-error — teste de imutabilidade em runtime
      VOCABULARY.tenant = 'Hackeado';
    }).toThrow();
    expect(VOCABULARY.tenant).toBe('Ambiente');
  });
});

describe('DB_STATE', () => {
  it('tem exatamente 8 entradas', () => {
    expect(Object.keys(DB_STATE)).toHaveLength(8);
  });

  it('mapeia cada status para o rótulo PT-BR cravado', () => {
    expect(DB_STATE).toEqual({
      requested: 'Solicitado',
      provisioning: 'Configurando',
      active: 'Ativo',
      degraded: 'Degradado',
      failed: 'Falhou',
      archived: 'Arquivado',
      pending_manual_provisioning: 'Aguardando configuração manual',
      purged: 'Removido permanentemente',
    });
  });

  it('cada chave de status devolve seu rótulo', () => {
    expect(DB_STATE.requested).toBe('Solicitado');
    expect(DB_STATE.provisioning).toBe('Configurando');
    expect(DB_STATE.active).toBe('Ativo');
    expect(DB_STATE.degraded).toBe('Degradado');
    expect(DB_STATE.failed).toBe('Falhou');
    expect(DB_STATE.archived).toBe('Arquivado');
    expect(DB_STATE.pending_manual_provisioning).toBe(
      'Aguardando configuração manual',
    );
    expect(DB_STATE.purged).toBe('Removido permanentemente');
  });

  it('é congelado — mutação não tem efeito', () => {
    expect(Object.isFrozen(DB_STATE)).toBe(true);
    expect(() => {
      // @ts-expect-error — teste de imutabilidade em runtime
      DB_STATE.active = 'Hackeado';
    }).toThrow();
    expect(DB_STATE.active).toBe('Ativo');
  });
});

describe('ALLOWED_FOREIGN', () => {
  it('é um Set', () => {
    expect(ALLOWED_FOREIGN).toBeInstanceOf(Set);
  });

  it('contém termos técnicos / nomes próprios permitidos', () => {
    expect(ALLOWED_FOREIGN.has('api')).toBe(true);
    expect(ALLOWED_FOREIGN.has('json')).toBe(true);
    expect(ALLOWED_FOREIGN.has('sql')).toBe(true);
    expect(ALLOWED_FOREIGN.has('postgres')).toBe(true);
    expect(ALLOWED_FOREIGN.has('cloud run')).toBe(true);
    expect(ALLOWED_FOREIGN.has('cron')).toBe(true);
  });

  it('NÃO contém jargão que deve ser traduzido', () => {
    expect(ALLOWED_FOREIGN.has('tenant')).toBe(false);
    expect(ALLOWED_FOREIGN.has('workspace')).toBe(false);
    expect(ALLOWED_FOREIGN.has('entitlement')).toBe(false);
  });
});

describe('humanize', () => {
  it('traduz um termo conhecido', () => {
    expect(humanize('tenant')).toBe('Ambiente');
  });

  it('é case-insensitive na busca', () => {
    expect(humanize('Workspace')).toBe('Ambiente do produto');
    expect(humanize('DEPLOY')).toBe('Lançamento');
  });

  it('devolve o termo original inalterado se desconhecido', () => {
    expect(humanize('frobnicate')).toBe('frobnicate');
  });

  it('não faz lowercase do original devolvido', () => {
    expect(humanize('FrobNicate')).toBe('FrobNicate');
  });

  it('é defensivo com string vazia — não lança', () => {
    expect(() => humanize('')).not.toThrow();
    expect(humanize('')).toBe('');
  });

  it('é defensivo com entrada não-string — não lança', () => {
    // @ts-expect-error — teste de robustez em runtime
    expect(() => humanize(undefined)).not.toThrow();
    // @ts-expect-error — teste de robustez em runtime
    expect(() => humanize(null)).not.toThrow();
    // @ts-expect-error — teste de robustez em runtime
    expect(() => humanize(42)).not.toThrow();
  });
});

describe('MIGRATION_STATE', () => {
  it('tem exatamente 9 entradas (espelha MigrationStatus do Core)', () => {
    expect(Object.keys(MIGRATION_STATE)).toHaveLength(9);
  });

  it('mapeia cada status de migração para o rótulo PT-BR cravado', () => {
    expect(MIGRATION_STATE).toEqual({
      pending: 'Pendente',
      awaiting_confirmation: 'Aguardando confirmação',
      confirmed: 'Confirmado',
      applying: 'Aplicando',
      applied: 'Aplicado',
      failed: 'Falhou',
      partially_applied: 'Aplicado parcialmente',
      cancelled: 'Cancelado',
      expired: 'Expirado',
    });
  });

  it('é congelado — mutação não tem efeito', () => {
    expect(Object.isFrozen(MIGRATION_STATE)).toBe(true);
    expect(() => {
      // @ts-expect-error — teste de imutabilidade em runtime
      MIGRATION_STATE.pending = 'Hackeado';
    }).toThrow();
    expect(MIGRATION_STATE.pending).toBe('Pendente');
  });
});

describe('DATABASE_ENGINES', () => {
  it('tem exatamente 8 engines canônicos', () => {
    expect(DATABASE_ENGINES).toHaveLength(8);
  });

  it('contém todos os engines esperados incluindo nosql-vm', () => {
    expect(DATABASE_ENGINES).toContain('firestore-instance');
    expect(DATABASE_ENGINES).toContain('cloud-sql-postgres');
    expect(DATABASE_ENGINES).toContain('cloud-sql-mysql');
    expect(DATABASE_ENGINES).toContain('vm-postgres-single');
    expect(DATABASE_ENGINES).toContain('vm-postgres-cluster');
    expect(DATABASE_ENGINES).toContain('vm-mysql-single');
    expect(DATABASE_ENGINES).toContain('vm-mysql-cluster');
    expect(DATABASE_ENGINES).toContain('nosql-vm');
  });
});

describe('engineLabel', () => {
  it('mapeia cada um dos 8 engines para seu rótulo', () => {
    expect(engineLabel('vm-postgres-single')).toBe('Postgres');
    expect(engineLabel('vm-postgres-cluster')).toBe('Postgres');
    expect(engineLabel('vm-mysql-single')).toBe('MySQL');
    expect(engineLabel('vm-mysql-cluster')).toBe('MySQL');
    expect(engineLabel('cloud-sql-postgres')).toBe('Postgres (gerenciado)');
    expect(engineLabel('cloud-sql-mysql')).toBe('MySQL (gerenciado)');
    expect(engineLabel('firestore-instance')).toBe('Documentos');
    expect(engineLabel('nosql-vm')).toBe('MongoDB (VM)');
  });

  it('devolve a entrada inalterada se o engine for desconhecido', () => {
    expect(engineLabel('foo-engine')).toBe('foo-engine');
  });
});

describe('engineSeal', () => {
  it('engine vm-* → Econômico', () => {
    expect(engineSeal('vm-postgres-single')).toBe('Econômico');
    expect(engineSeal('vm-mysql-cluster')).toBe('Econômico');
  });

  it('engine cloud-sql-* → Gerenciado', () => {
    expect(engineSeal('cloud-sql-mysql')).toBe('Gerenciado');
    expect(engineSeal('cloud-sql-postgres')).toBe('Gerenciado');
  });

  it('firestore-instance → Padrão', () => {
    expect(engineSeal('firestore-instance')).toBe('Padrão');
  });

  it('engine desconhecido → string vazia', () => {
    expect(engineSeal('foo-engine')).toBe('');
    expect(engineSeal('nosql-vm')).toBe('');
  });
});

describe('determinismo', () => {
  it('mesma entrada → mesma saída', () => {
    expect(humanize('tenant')).toBe(humanize('tenant'));
    expect(engineLabel('vm-mysql-single')).toBe(engineLabel('vm-mysql-single'));
    expect(engineSeal('cloud-sql-postgres')).toBe(
      engineSeal('cloud-sql-postgres'),
    );
  });
});

describe('ENV_IDS', () => {
  it('contém exatamente 3 ambientes canônicos', () => {
    expect(ENV_IDS).toHaveLength(3);
  });

  it('contém dev-local, staging e prod na ordem correta', () => {
    expect(ENV_IDS[0]).toBe('dev-local');
    expect(ENV_IDS[1]).toBe('staging');
    expect(ENV_IDS[2]).toBe('prod');
  });

  it('NÃO contém production (alias legado — normalizado para prod)', () => {
    expect(ENV_IDS).not.toContain('production');
  });

  it('é congelado — mutação não tem efeito', () => {
    expect(Object.isFrozen(ENV_IDS)).toBe(true);
  });
});

describe('normalizeEnvId', () => {
  it('canônicos passam direto', () => {
    expect(normalizeEnvId('dev-local')).toBe('dev-local');
    expect(normalizeEnvId('staging')).toBe('staging');
    expect(normalizeEnvId('prod')).toBe('prod');
  });

  it('aliases conhecidos são normalizados', () => {
    expect(normalizeEnvId('dev')).toBe('dev-local');
    expect(normalizeEnvId('local')).toBe('dev-local');
    expect(normalizeEnvId('stg')).toBe('staging');
    expect(normalizeEnvId('production')).toBe('prod');
  });

  it('é case-insensitive e faz trim', () => {
    expect(normalizeEnvId('  PROD  ')).toBe('prod');
    expect(normalizeEnvId('Dev-Local')).toBe('dev-local');
    expect(normalizeEnvId('STAGING')).toBe('staging');
    expect(normalizeEnvId('PRODUCTION')).toBe('prod');
  });

  it('lança para entrada desconhecida', () => {
    expect(() => normalizeEnvId('foo')).toThrow(/não reconhecido/);
    expect(() => normalizeEnvId('')).toThrow();
  });

  it('lança para entrada não-string', () => {
    // @ts-expect-error — teste de robustez em runtime
    expect(() => normalizeEnvId(null)).toThrow(/esperava string/);
    // @ts-expect-error — teste de robustez em runtime
    expect(() => normalizeEnvId(42)).toThrow(/esperava string/);
  });

  it('é determinístico — mesma entrada sempre devolve mesmo resultado', () => {
    expect(normalizeEnvId('production')).toBe(normalizeEnvId('production'));
    expect(normalizeEnvId('prod')).toBe(normalizeEnvId('prod'));
  });
});
