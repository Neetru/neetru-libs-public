/**
 * neetru-glossario — vocabulário plain PT-BR do ecossistema Neetru como código.
 *
 * Fonte única de verdade da terminologia. Importado pelo CLI e pelo Core, e base
 * do lint anti-jargão. A UI staff do Core fala português brasileiro claro:
 * jargão estrangeiro (tenant, workspace, provisioning, entitlement, tier…) é
 * ruído cognitivo. Um `.md` apodrece; um módulo tipado força a tradução a ficar
 * correta — divergir quebra o build.
 *
 * Funções puras, determinísticas, isomórficas, zero dependências.
 *
 * ## Distinção fundamental entre Customer, Tenant e Workspace (pdv #8)
 *
 * Esses três conceitos são DIFERENTES e NÃO devem ser confundidos:
 *
 * - **Customer** (`customers/` no Firestore): a empresa ou PJ que paga pelos
 *   serviços Neetru. É o "cliente comercial" — aparece no CRM, tem CNPJ, email
 *   de contato, account manager etc. Criado via `neetru customers create`.
 *   NÃO é a mesma coisa que uma conta de usuário final (`accounts/{uid}`).
 *
 * - **Tenant** (`tenants/` no Firestore): uma instância de produto alocada para
 *   um customer em um ambiente específico (dev-local | staging | prod). Um customer
 *   pode ter N tenants (um por produto contratado, um por ambiente, ou combinação).
 *   O tenant carrega entitlements, domínio primário, plano ativo etc.
 *   Criado via `neetru tenants create` (com `customerId` + `productId` + `env`).
 *   `EnvironmentId` válidos: `'dev-local'` | `'staging'` | `'prod'`.
 *   (Alias legado `'dev'` é deprecado — usar `'dev-local'`.)
 *
 * - **Workspace** (`tenants/` no Firestore — faceta runtime do mesmo doc):
 *   o ambiente de runtime isolado do tenant — onde o código do produto realmente
 *   roda. Em v1 do modelo, `workspace.id === tenant.id`; não há coleção
 *   `workspaces/` separada. O tenant é o "contrato/billing/config", o workspace
 *   é a "faceta de runtime/motor" do mesmo documento.
 *   Criado via `neetru workspaces create` (com `customerId` + `productId` + `env`).
 *
 * Resumo de quem cria o quê:
 *   `neetru customers create`  → Customer (PJ pagante no CRM)
 *   `neetru tenants create`    → Tenant (instância de produto)
 *   `neetru workspaces create` → Workspace (runtime do tenant)
 */

/**
 * Termos estrangeiros do ecossistema → tradução plain PT-BR.
 * Chaves em minúsculas. Congelado — a tradução é cravada.
 */
export const VOCABULARY: Readonly<Record<string, string>> = Object.freeze({
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

/**
 * Guia de distinção entre os três conceitos-chave do ecossistema (pdv #8).
 *
 * Use em mensagens de erro, tooltips ou onboarding para esclarecer a diferença
 * entre Customer, Tenant e Workspace sem expor jargão técnico.
 */
export const CONCEPT_GUIDE = Object.freeze({
  customer: {
    term: 'Customer',
    ptBr: 'Cliente',
    summary: 'Empresa ou PJ que paga pelos serviços Neetru (CRM comercial).',
    collection: 'customers',
    cliCommand: 'neetru customers create',
    notSameAs: ['tenant', 'workspace', 'account'],
  },
  tenant: {
    term: 'Tenant',
    ptBr: 'Instância de produto',
    summary:
      'Unidade de acesso/billing/configuração de produto para um customer em um environmentId.',
    storageCollection: 'tenants',
    /** @deprecated Use storageCollection. Removido em próxima major. */
    collection: 'tenants',
    envIds: ['dev-local', 'staging', 'prod'] as const,
    /** @deprecated 'dev' é alias legado — use 'dev-local'. */
    legacyEnvAlias: { dev: 'dev-local' } as const,
    cliCommand: 'neetru tenants create',
    notSameAs: ['customer', 'workspace'],
  },
  workspace: {
    term: 'Workspace',
    ptBr: 'Ambiente do produto',
    summary:
      'Faceta de runtime/motor isolado do tenant em `tenants/{tenantId}`. ' +
      'Não há coleção `workspaces/` separada em v1. ' +
      'workspace.id === tenant.id (relação 1:1 de faceta).',
    storageCollection: 'tenants',
    /** @deprecated Use storageCollection. Workspace NÃO usa coleção 'workspaces/'. */
    collection: 'tenants',
    cliCommand: 'neetru workspaces create',
    notSameAs: ['customer', 'tenant'],
  },
} as const);

/**
 * Estados de `product_databases` (status do banco por produto) → rótulo PT-BR.
 * Congelado — os estados são cravados.
 */
export const DB_STATE: Readonly<Record<string, string>> = Object.freeze({
  requested: 'Solicitado',
  provisioning: 'Configurando',
  active: 'Ativo',
  degraded: 'Degradado',
  failed: 'Falhou',
  archived: 'Arquivado',
  pending_manual_provisioning: 'Aguardando configuração manual',
  purged: 'Removido permanentemente',
});

/**
 * Estados de `product_db_migrations` (MigrationStatus) → rótulo PT-BR.
 * Espelha `MigrationStatus` em `src/types/product-db-migrations.ts` do Core.
 * Congelado — divergir quebra rastreabilidade de migrações na UI.
 */
export const MIGRATION_STATE: Readonly<Record<string, string>> = Object.freeze({
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

/**
 * Engines de banco de dados por produto — espelha `DatabaseEngine` em
 * `src/types/product-databases.ts` do Core. Array somente-leitura para
 * iteração (select options, validação de formulário, etc).
 */
export const DATABASE_ENGINES = [
  'firestore-instance',
  'cloud-sql-postgres',
  'cloud-sql-mysql',
  'vm-postgres-single',
  'vm-postgres-cluster',
  'vm-mysql-single',
  'vm-mysql-cluster',
  'nosql-vm',
] as const;

/** Tipo derivado do array — garante que engineLabel() e DATABASE_ENGINES nunca derivem. */
export type DatabaseEngine = (typeof DATABASE_ENGINES)[number];

/**
 * Termos técnicos e nomes próprios que o lint anti-jargão NÃO deve sinalizar.
 * São siglas/protocolos/produtos sem tradução PT-BR razoável. Minúsculas.
 */
export const ALLOWED_FOREIGN: ReadonlySet<string> = new Set<string>([
  'api',
  'json',
  'sql',
  'url',
  'http',
  'https',
  'id',
  'uuid',
  'postgres',
  'mysql',
  'mongodb',
  'firestore',
  'cloud run',
  'cloud sql',
  'npm',
  'git',
  'token',
  'webhook',
  'backup',
  'log',
  'cron',
]);

/**
 * Traduz um termo do `VOCABULARY` para plain PT-BR.
 *
 * Busca case-insensitive (a entrada é minusculada só para a busca). Se o termo
 * for conhecido, devolve o valor PT-BR. Se não, devolve o termo ORIGINAL
 * inalterado — sem lançar, sem minuscular. Defensivo: entrada não-string é
 * coagida a string (ou string vazia) — nunca lança.
 */
export function humanize(term: string): string {
  if (typeof term !== 'string') {
    return term == null ? '' : String(term);
  }
  const hit = VOCABULARY[term.toLowerCase()];
  return hit ?? term;
}

/**
 * Mapeia um `DatabaseEngine` para um rótulo plain PT-BR.
 * Engine desconhecido → a entrada inalterada.
 */
export function engineLabel(engine: string): string {
  switch (engine) {
    case 'vm-postgres-single':
    case 'vm-postgres-cluster':
      return 'Postgres';
    case 'vm-mysql-single':
    case 'vm-mysql-cluster':
      return 'MySQL';
    case 'cloud-sql-postgres':
      return 'Postgres (gerenciado)';
    case 'cloud-sql-mysql':
      return 'MySQL (gerenciado)';
    case 'firestore-instance':
      return 'Documentos';
    case 'nosql-vm':
      return 'MongoDB (VM)';
    default:
      return engine;
  }
}

/**
 * Selo curto de qualificação de um `DatabaseEngine`.
 * `vm-*` → "Econômico"; `cloud-sql-*` → "Gerenciado";
 * `firestore-instance` → "Padrão"; desconhecido → "".
 */
export function engineSeal(engine: string): string {
  if (typeof engine !== 'string') return '';
  if (engine.startsWith('vm-')) return 'Econômico';
  if (engine.startsWith('cloud-sql-')) return 'Gerenciado';
  if (engine === 'firestore-instance') return 'Padrão';
  return '';
}

// ─── EnvironmentId — fonte única de verdade ────────────────────────────────────

/**
 * Ambientes canônicos do ecossistema Neetru.
 *
 * `'prod'` é o valor canônico para produção — alinhado ao Core (`EnvironmentId`
 * em `src/lib/types.ts`) e ao `CONCEPT_GUIDE.tenant.envIds`.
 * O valor `'production'` é um alias legado aceito por `normalizeEnvId`
 * mas NUNCA persistido diretamente.
 *
 * Regra: o que vai para Firestore / API é sempre um `EnvironmentId` canônico.
 */
export type EnvironmentId = 'dev-local' | 'staging' | 'prod';

/**
 * Array somente-leitura com todos os `EnvironmentId` canônicos,
 * na ordem de progressão natural (local → staging → prod).
 * Use para gerar select options, validar inputs de formulário etc.
 */
export const ENV_IDS: ReadonlyArray<EnvironmentId> = Object.freeze([
  'dev-local',
  'staging',
  'prod',
] as EnvironmentId[]);

/**
 * Aliases de ambiente aceitos → `EnvironmentId` canônico.
 * Entradas são normalizadas para lowercase + trim antes do lookup.
 */
const ENV_ALIASES: Readonly<Record<string, EnvironmentId>> = Object.freeze({
  'dev-local': 'dev-local',
  dev: 'dev-local',
  local: 'dev-local',
  staging: 'staging',
  stg: 'staging',
  prod: 'prod',
  production: 'prod', // alias legado — normaliza para 'prod'
});

/**
 * Normaliza qualquer string de ambiente para um `EnvironmentId` canônico.
 *
 * - Faz lowercase + trim antes do lookup.
 * - `'production'` é aceito como alias e retorna `'prod'`.
 * - Entrada inválida lança `Error` com lista dos valores aceitos.
 * - Função pura — sem side-effects, sem acesso a process/stderr.
 *
 * @example
 *   normalizeEnvId('prod')       // → 'prod'
 *   normalizeEnvId('production') // → 'prod'
 *   normalizeEnvId('dev')        // → 'dev-local'
 *   normalizeEnvId('stg')        // → 'staging'
 */
export function normalizeEnvId(input: string): EnvironmentId {
  if (typeof input !== 'string') {
    throw new Error(
      `normalizeEnvId: ambiente inválido (esperava string, recebeu ${typeof input}). ` +
        `Valores aceitos: dev-local, staging, prod. Aliases: dev/local → dev-local, stg → staging, production → prod.`,
    );
  }

  const key = input.trim().toLowerCase();
  const canonical = ENV_ALIASES[key];

  if (!canonical) {
    throw new Error(
      `normalizeEnvId: ambiente "${input}" não reconhecido. ` +
        `Valores aceitos: dev-local, staging, prod. ` +
        `Aliases: dev/local → dev-local, stg → staging, production → prod.`,
    );
  }

  return canonical;
}
