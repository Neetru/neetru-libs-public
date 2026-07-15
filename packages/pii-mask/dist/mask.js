/**
 * Nucleo do `@neetru/pii-mask`.
 *
 * Mascara dados pessoais (PII) num result set, no servidor, antes de a UI staff
 * do visualizador de banco em producao ve-los. Salvaguarda LGPD.
 *
 * FAIL-CLOSED em duas camadas:
 *  1. Uma coluna AUSENTE do mapa de politicas e tratada como `'generic'` —
 *     uma coluna nao classificada nunca pode vazar.
 *  2. Dentro de uma politica tipada (`email`/`cpf`/`phone`/`card`), um valor
 *     que nao e string ou nao casa com a forma esperada cai pra mascaramento
 *     `'generic'` — nunca se deixa passar um valor que nao parseou.
 *
 * `maskResultSet` e PURA: nao muta o array de entrada nem os objetos linha.
 */
/** O glifo de mascaramento generico — U+25CF BLACK CIRCLE, 4 vezes. */
const GENERIC_MASK = '●●●●'; // ●●●●
/** Conjunto de politicas validas — usado pra normalizar entradas desconhecidas. */
const VALID_POLICIES = new Set([
    'email',
    'cpf',
    'phone',
    'card',
    'generic',
    'safe',
]);
/**
 * Resolve a politica de uma coluna. Coluna ausente do mapa — ou com um valor
 * que nao e uma `MaskPolicy` valida — cai pra `'generic'` (fail-closed).
 */
function resolvePolicy(colName, columns) {
    const declared = Object.prototype.hasOwnProperty.call(columns, colName)
        ? columns[colName]
        : undefined;
    if (declared !== undefined && VALID_POLICIES.has(declared)) {
        return declared;
    }
    return 'generic';
}
/** Mascara um e-mail. Em qualquer desvio da forma esperada, cai pra generico. */
function maskEmail(value) {
    if (typeof value !== 'string')
        return GENERIC_MASK;
    const at = value.indexOf('@');
    // Precisa de exatamente um '@'.
    if (at === -1 || value.indexOf('@', at + 1) !== -1)
        return GENERIC_MASK;
    const local = value.slice(0, at);
    const domain = value.slice(at + 1);
    if (local.length === 0 || domain.length === 0)
        return GENERIC_MASK;
    // O dominio precisa de ao menos um ponto (nome + TLD).
    const lastDot = domain.lastIndexOf('.');
    if (lastDot <= 0 || lastDot === domain.length - 1)
        return GENERIC_MASK;
    const domainName = domain.slice(0, lastDot);
    const tld = domain.slice(lastDot); // inclui o ponto
    // Local: mantem os 2 primeiros chars, mascara o resto. Se < 2 chars, mascara tudo.
    const localMasked = local.length <= 2
        ? '*'.repeat(local.length)
        : local.slice(0, 2) + '*'.repeat(local.length - 2);
    // Dominio: mantem o 1o char do nome, mascara o resto; preserva o TLD.
    const domainMasked = domainName.slice(0, 1) + '*'.repeat(domainName.length - 1);
    return `${localMasked}@${domainMasked}${tld}`;
}
/** Extrai apenas os digitos de uma string. */
function digitsOf(value) {
    return value.replace(/\D/g, '');
}
/** Mascara um CPF brasileiro. Forma fixa de saida; cai pra generico se invalido. */
function maskCpf(value) {
    if (typeof value !== 'string')
        return GENERIC_MASK;
    const digits = digitsOf(value);
    if (digits.length !== 11)
        return GENERIC_MASK;
    return `***.***.***-${digits.slice(-2)}`;
}
/**
 * Mascara um telefone. Preserva os 4 ultimos digitos, mascara cada outro
 * digito com '*' e mantem os separadores. Cai pra generico se < 4 digitos.
 */
function maskPhone(value) {
    if (typeof value !== 'string')
        return GENERIC_MASK;
    const totalDigits = digitsOf(value).length;
    if (totalDigits < 4)
        return GENERIC_MASK;
    const keepFrom = totalDigits - 4; // quantos digitos, da esquerda, mascarar
    let seen = 0;
    let result = '';
    for (const ch of value) {
        if (ch >= '0' && ch <= '9') {
            result += seen < keepFrom ? '*' : ch;
            seen += 1;
        }
        else {
            result += ch;
        }
    }
    return result;
}
/** Mascara um cartao de pagamento. Forma fixa `**** **** **** NNNN` (padrao PCI). */
function maskCard(value) {
    if (typeof value !== 'string')
        return GENERIC_MASK;
    const digits = digitsOf(value);
    if (digits.length < 12 || digits.length > 19)
        return GENERIC_MASK;
    return `**** **** **** ${digits.slice(-4)}`;
}
/**
 * Aplica uma politica de mascaramento a um unico valor.
 *
 * `null`/`undefined` passam intactos sob qualquer politica — um nulo nao e PII.
 * Politicas tipadas que nao casam com a forma esperada caem pra generico.
 */
function applyPolicy(value, policy) {
    if (value === null || value === undefined)
        return value;
    switch (policy) {
        case 'safe':
            return value;
        case 'email':
            return maskEmail(value);
        case 'cpf':
            return maskCpf(value);
        case 'phone':
            return maskPhone(value);
        case 'card':
            return maskCard(value);
        case 'generic':
        default:
            return GENERIC_MASK;
    }
}
// ---------------------------------------------------------------------------
// Mascaramento recursivo de valores aninhados
// ---------------------------------------------------------------------------
/** Profundidade maxima de recursao para mascaramento aninhado. */
const MAX_RECURSION_DEPTH = 10;
/**
 * Mascara recursivamente um valor conforme a politica declarada pelo dot-path
 * acumulado. Suporta:
 *  - Valores primitivos: aplica a politica do caminho exato (ou 'generic'
 *    fail-closed se ausente).
 *  - Objetos aninhados: desce aplicando a politica por `path.field`.
 *  - Arrays: itera com wildcard `path.*` — `contacts.*.phone` mascara o campo
 *    `phone` de cada elemento do array `contacts`.
 *
 * @param value   Valor a ser mascarado.
 * @param path    Caminho dot acumulado para lookup no mapa de politicas.
 * @param columns Mapa completo de caminho → MaskPolicy.
 * @param masked  Set acumulador de caminhos que sofreram mascaramento.
 * @param depth   Profundidade atual (protecao contra recursao infinita).
 */
function maskValueRecursive(value, path, columns, masked, depth) {
    if (value === null || value === undefined)
        return value;
    // Protecao contra recursao infinita / ciclos (o WeakSet nao e usavel
    // aqui pois objetos podem re-aparecer em linhas diferentes; o limite de
    // profundidade e suficiente para os casos reais de banco).
    if (depth > MAX_RECURSION_DEPTH) {
        // Fail-closed: profundidade excessiva → mascaramento generico.
        masked.add(path);
        return GENERIC_MASK;
    }
    // Array: itera com wildcard `path.*`.
    if (Array.isArray(value)) {
        const wildcardPath = `${path}.*`;
        return value.map((item) => maskValueRecursive(item, wildcardPath, columns, masked, depth + 1));
    }
    // Objeto aninhado: desce para cada chave com `path.key`.
    if (typeof value === 'object') {
        const obj = value;
        const next = {};
        for (const key of Object.keys(obj)) {
            const childPath = `${path}.${key}`;
            next[key] = maskValueRecursive(obj[key], childPath, columns, masked, depth + 1);
        }
        return next;
    }
    // Primitivo: aplica politica do caminho exato (fail-closed → 'generic').
    const policy = resolvePolicy(path, columns);
    if (policy !== 'safe') {
        masked.add(path);
    }
    return applyPolicy(value, policy);
}
/**
 * Mascara um result set inteiro, coluna a coluna (com recursao aninhada),
 * segundo o mapa de politicas por dot-path.
 *
 * Funcao PURA — devolve linhas novas, sem mutar a entrada.
 *
 * Profundidade de mascaramento:
 *  - Top-level: politica declarada pelo nome da coluna (`email`, `cpf`, …).
 *  - Aninhado: politica declarada pelo dot-path (`address.cpf`,
 *    `contacts.*.phone`). Um campo ausente do mapa em QUALQUER nivel cai
 *    para `'generic'` (fail-closed).
 *
 * @param rows  As linhas vindas do banco.
 * @param opts  O mapa coluna/dot-path → politica. Ausente = `'generic'`.
 * @returns     As linhas mascaradas e a lista de paths mascarados.
 */
export function maskResultSet(rows, opts) {
    const columns = opts.columns ?? {};
    if (rows.length === 0) {
        return { rows: [], maskedColumns: [] };
    }
    const maskedColumnsSet = new Set();
    const maskedRows = new Array(rows.length);
    for (let i = 0; i < rows.length; i += 1) {
        const source = rows[i] ?? {};
        const next = {};
        for (const colName of Object.keys(source)) {
            const colValue = source[colName];
            // Se o valor e primitivo (nao-objeto, nao-array), aplicamos a politica
            // de top-level diretamente (caminho mais comum e mais rapido).
            if (colValue === null ||
                colValue === undefined ||
                (typeof colValue !== 'object' && !Array.isArray(colValue))) {
                const policy = resolvePolicy(colName, columns);
                next[colName] = applyPolicy(colValue, policy);
                if (policy !== 'safe') {
                    maskedColumnsSet.add(colName);
                }
            }
            else {
                // Valor aninhado (objeto ou array): recursao com caminho composto.
                // O acumulador `maskedColumnsSet` recebe os PATHS internos que foram
                // mascarados alem do nome da coluna top-level.
                const innerMasked = new Set();
                next[colName] = maskValueRecursive(colValue, colName, columns, innerMasked, 1);
                for (const p of innerMasked) {
                    maskedColumnsSet.add(p);
                }
                // Se nenhum campo interno estava classificado como safe, tambem
                // registramos a coluna de topo como mascarada.
                if (innerMasked.size > 0) {
                    maskedColumnsSet.add(colName);
                }
            }
        }
        maskedRows[i] = next;
    }
    return {
        rows: maskedRows,
        maskedColumns: Array.from(maskedColumnsSet).sort(),
    };
}
//# sourceMappingURL=mask.js.map