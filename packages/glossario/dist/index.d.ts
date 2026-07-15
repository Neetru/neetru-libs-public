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
export declare const VOCABULARY: Readonly<Record<string, string>>;
/**
 * Guia de distinção entre os três conceitos-chave do ecossistema (pdv #8).
 *
 * Use em mensagens de erro, tooltips ou onboarding para esclarecer a diferença
 * entre Customer, Tenant e Workspace sem expor jargão técnico.
 */
export declare const CONCEPT_GUIDE: Readonly<{
    readonly customer: {
        readonly term: "Customer";
        readonly ptBr: "Cliente";
        readonly summary: "Empresa ou PJ que paga pelos serviços Neetru (CRM comercial).";
        readonly collection: "customers";
        readonly cliCommand: "neetru customers create";
        readonly notSameAs: readonly ["tenant", "workspace", "account"];
    };
    readonly tenant: {
        readonly term: "Tenant";
        readonly ptBr: "Instância de produto";
        readonly summary: "Unidade de acesso/billing/configuração de produto para um customer em um environmentId.";
        readonly storageCollection: "tenants";
        /** @deprecated Use storageCollection. Removido em próxima major. */
        readonly collection: "tenants";
        readonly envIds: readonly ["dev-local", "staging", "prod"];
        /** @deprecated 'dev' é alias legado — use 'dev-local'. */
        readonly legacyEnvAlias: {
            readonly dev: "dev-local";
        };
        readonly cliCommand: "neetru tenants create";
        readonly notSameAs: readonly ["customer", "workspace"];
    };
    readonly workspace: {
        readonly term: "Workspace";
        readonly ptBr: "Ambiente do produto";
        readonly summary: string;
        readonly storageCollection: "tenants";
        /** @deprecated Use storageCollection. Workspace NÃO usa coleção 'workspaces/'. */
        readonly collection: "tenants";
        readonly cliCommand: "neetru workspaces create";
        readonly notSameAs: readonly ["customer", "tenant"];
    };
}>;
/**
 * Estados de `product_databases` (status do banco por produto) → rótulo PT-BR.
 * Congelado — os estados são cravados.
 */
export declare const DB_STATE: Readonly<Record<string, string>>;
/**
 * Estados de `product_db_migrations` (MigrationStatus) → rótulo PT-BR.
 * Espelha `MigrationStatus` em `src/types/product-db-migrations.ts` do Core.
 * Congelado — divergir quebra rastreabilidade de migrações na UI.
 */
export declare const MIGRATION_STATE: Readonly<Record<string, string>>;
/**
 * Engines de banco de dados por produto — espelha `DatabaseEngine` em
 * `src/types/product-databases.ts` do Core. Array somente-leitura para
 * iteração (select options, validação de formulário, etc).
 */
export declare const DATABASE_ENGINES: readonly ["firestore-instance", "cloud-sql-postgres", "cloud-sql-mysql", "vm-postgres-single", "vm-postgres-cluster", "vm-mysql-single", "vm-mysql-cluster", "nosql-vm"];
/** Tipo derivado do array — garante que engineLabel() e DATABASE_ENGINES nunca derivem. */
export type DatabaseEngine = (typeof DATABASE_ENGINES)[number];
/**
 * Termos técnicos e nomes próprios que o lint anti-jargão NÃO deve sinalizar.
 * São siglas/protocolos/produtos sem tradução PT-BR razoável. Minúsculas.
 */
export declare const ALLOWED_FOREIGN: ReadonlySet<string>;
/**
 * Traduz um termo do `VOCABULARY` para plain PT-BR.
 *
 * Busca case-insensitive (a entrada é minusculada só para a busca). Se o termo
 * for conhecido, devolve o valor PT-BR. Se não, devolve o termo ORIGINAL
 * inalterado — sem lançar, sem minuscular. Defensivo: entrada não-string é
 * coagida a string (ou string vazia) — nunca lança.
 */
export declare function humanize(term: string): string;
/**
 * Mapeia um `DatabaseEngine` para um rótulo plain PT-BR.
 * Engine desconhecido → a entrada inalterada.
 */
export declare function engineLabel(engine: string): string;
/**
 * Selo curto de qualificação de um `DatabaseEngine`.
 * `vm-*` → "Econômico"; `cloud-sql-*` → "Gerenciado";
 * `firestore-instance` → "Padrão"; desconhecido → "".
 */
export declare function engineSeal(engine: string): string;
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
export declare const ENV_IDS: ReadonlyArray<EnvironmentId>;
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
export declare function normalizeEnvId(input: string): EnvironmentId;
