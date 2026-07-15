import { describe, it, expect } from 'vitest';
import { maskResultSet } from './mask.js';

/** O glifo de mascaramento generico — U+25CF BLACK CIRCLE, 4 vezes. */
const GENERIC = '●●●●';

describe('maskResultSet — fail-closed (coluna nao classificada)', () => {
  it('mascara genericamente uma coluna AUSENTE do mapa de politicas', () => {
    const rows = [{ ssn: '123-45-6789' }];
    const out = maskResultSet(rows, { columns: {} });
    expect(out.rows[0]!.ssn).toBe(GENERIC);
  });

  it('nao deixa nenhum pedaco do valor original sobreviver', () => {
    const original = 'segredo-absoluto-42';
    const rows = [{ undisclosed: original }];
    const out = maskResultSet(rows, { columns: {} });
    const masked = String(out.rows[0]!.undisclosed);
    expect(masked).toBe(GENERIC);
    // Nenhum substring nao-trivial do original aparece no resultado.
    for (const part of ['segredo', 'absoluto', '42', 'seg', '4']) {
      expect(masked).not.toContain(part);
    }
  });

  it('uma coluna classificada como safe coexiste com colunas nao classificadas mascaradas', () => {
    const rows = [{ id: 7, leaked: 'pii-aqui' }];
    const out = maskResultSet(rows, { columns: { id: 'safe' } });
    expect(out.rows[0]!.id).toBe(7);
    expect(out.rows[0]!.leaked).toBe(GENERIC);
  });
});

describe('maskResultSet — policy safe', () => {
  it('passa o valor sem alteracao', () => {
    const rows = [{ id: 42, name: 'Acme Ltda' }];
    const out = maskResultSet(rows, { columns: { id: 'safe', name: 'safe' } });
    expect(out.rows[0]!.id).toBe(42);
    expect(out.rows[0]!.name).toBe('Acme Ltda');
  });

  it('nao adiciona coluna safe a maskedColumns', () => {
    const rows = [{ id: 1 }];
    const out = maskResultSet(rows, { columns: { id: 'safe' } });
    expect(out.maskedColumns).not.toContain('id');
    expect(out.maskedColumns).toEqual([]);
  });
});

describe('maskResultSet — policy generic', () => {
  it('substitui o valor inteiro por ●●●●', () => {
    const rows = [{ note: 'qualquer coisa' }];
    const out = maskResultSet(rows, { columns: { note: 'generic' } });
    expect(out.rows[0]!.note).toBe(GENERIC);
  });

  it('mascara generic mesmo um valor numerico', () => {
    const rows = [{ amount: 99999 }];
    const out = maskResultSet(rows, { columns: { amount: 'generic' } });
    expect(out.rows[0]!.amount).toBe(GENERIC);
  });
});

describe('maskResultSet — policy email', () => {
  it('mascara um e-mail normal corretamente', () => {
    const rows = [{ email: 'joao.silva@gmail.com' }];
    const out = maskResultSet(rows, { columns: { email: 'email' } });
    expect(out.rows[0]!.email).toBe('jo********@g****.com');
  });

  it('mascara o local inteiro quando ele tem menos de 2 chars', () => {
    const rows = [{ email: 'a@b.co' }];
    const out = maskResultSet(rows, { columns: { email: 'email' } });
    expect(out.rows[0]!.email).toBe('*@b.co');
  });

  it('cai pra generico quando a string nao tem exatamente um @', () => {
    const rows = [{ email: 'isto-nao-e-um-email' }];
    const out = maskResultSet(rows, { columns: { email: 'email' } });
    expect(out.rows[0]!.email).toBe(GENERIC);
  });

  it('cai pra generico quando ha mais de um @', () => {
    const rows = [{ email: 'a@b@c.com' }];
    const out = maskResultSet(rows, { columns: { email: 'email' } });
    expect(out.rows[0]!.email).toBe(GENERIC);
  });

  it('cai pra generico quando o valor de uma coluna email nao e string', () => {
    const rows = [{ email: 12345 }];
    const out = maskResultSet(rows, { columns: { email: 'email' } });
    expect(out.rows[0]!.email).toBe(GENERIC);
  });
});

describe('maskResultSet — policy cpf', () => {
  it('mascara um CPF de 11 digitos preservando os 2 ultimos', () => {
    const rows = [{ cpf: '123.456.789-09' }];
    const out = maskResultSet(rows, { columns: { cpf: 'cpf' } });
    expect(out.rows[0]!.cpf).toBe('***.***.***-09');
  });

  it('mascara um CPF passado so com digitos', () => {
    const rows = [{ cpf: '12345678909' }];
    const out = maskResultSet(rows, { columns: { cpf: 'cpf' } });
    expect(out.rows[0]!.cpf).toBe('***.***.***-09');
  });

  it('cai pra generico quando a contagem de digitos esta errada', () => {
    const rows = [{ cpf: '123.456-78' }];
    const out = maskResultSet(rows, { columns: { cpf: 'cpf' } });
    expect(out.rows[0]!.cpf).toBe(GENERIC);
  });

  it('cai pra generico quando o valor de uma coluna cpf nao e string', () => {
    const rows = [{ cpf: 12345678909 }];
    const out = maskResultSet(rows, { columns: { cpf: 'cpf' } });
    expect(out.rows[0]!.cpf).toBe(GENERIC);
  });
});

describe('maskResultSet — policy phone', () => {
  it('preserva os 4 ultimos digitos de um telefone', () => {
    const rows = [{ phone: '+55 11 98765-4321' }];
    const out = maskResultSet(rows, { columns: { phone: 'phone' } });
    const masked = String(out.rows[0]!.phone);
    expect(masked.endsWith('4321')).toBe(true);
    // Nenhum digito dos 4 primeiros sobrevive.
    expect(masked).not.toContain('5511');
    expect(masked).not.toContain('98765');
  });

  it('cai pra generico quando ha menos de 4 digitos', () => {
    const rows = [{ phone: '12-3' }];
    const out = maskResultSet(rows, { columns: { phone: 'phone' } });
    expect(out.rows[0]!.phone).toBe(GENERIC);
  });

  it('cai pra generico quando o valor de uma coluna phone nao e string', () => {
    const rows = [{ phone: 11987654321 }];
    const out = maskResultSet(rows, { columns: { phone: 'phone' } });
    expect(out.rows[0]!.phone).toBe(GENERIC);
  });
});

describe('maskResultSet — policy card', () => {
  it('mascara um cartao de 16 digitos preservando os 4 ultimos', () => {
    const rows = [{ card: '4111 1111 1111 1234' }];
    const out = maskResultSet(rows, { columns: { card: 'card' } });
    expect(out.rows[0]!.card).toBe('**** **** **** 1234');
  });

  it('mascara um cartao passado so com digitos', () => {
    const rows = [{ card: '4111111111111234' }];
    const out = maskResultSet(rows, { columns: { card: 'card' } });
    expect(out.rows[0]!.card).toBe('**** **** **** 1234');
  });

  it('cai pra generico quando ha menos de 12 digitos', () => {
    const rows = [{ card: '1234' }];
    const out = maskResultSet(rows, { columns: { card: 'card' } });
    expect(out.rows[0]!.card).toBe(GENERIC);
  });

  it('cai pra generico quando ha mais de 19 digitos', () => {
    const rows = [{ card: '12345678901234567890' }];
    const out = maskResultSet(rows, { columns: { card: 'card' } });
    expect(out.rows[0]!.card).toBe(GENERIC);
  });

  it('cai pra generico quando o valor de uma coluna card nao e string', () => {
    const rows = [{ card: 4111111111111234 }];
    const out = maskResultSet(rows, { columns: { card: 'card' } });
    expect(out.rows[0]!.card).toBe(GENERIC);
  });
});

describe('maskResultSet — null / undefined', () => {
  const policies = ['safe', 'generic', 'email', 'cpf', 'phone', 'card'] as const;

  for (const policy of policies) {
    it(`mantem null como null sob a policy ${policy}`, () => {
      const rows = [{ col: null }];
      const out = maskResultSet(rows, { columns: { col: policy } });
      expect(out.rows[0]!.col).toBeNull();
    });

    it(`mantem undefined como undefined sob a policy ${policy}`, () => {
      const rows = [{ col: undefined }];
      const out = maskResultSet(rows, { columns: { col: policy } });
      expect(out.rows[0]!.col).toBeUndefined();
    });
  }

  it('null nunca vira ●●●●, nem com coluna nao classificada (fail-closed)', () => {
    const rows = [{ unclassified: null }];
    const out = maskResultSet(rows, { columns: {} });
    expect(out.rows[0]!.unclassified).toBeNull();
  });
});

describe('maskResultSet — pureza (sem mutacao da entrada)', () => {
  it('nao muta o array de linhas nem os objetos linha', () => {
    const rows = [
      { email: 'joao.silva@gmail.com', id: 1 },
      { email: 'maria@x.com', id: 2 },
    ];
    const snapshot = JSON.parse(JSON.stringify(rows));
    const out = maskResultSet(rows, { columns: { email: 'email', id: 'safe' } });

    // A entrada permanece deep-equal ao snapshot pre-chamada.
    expect(rows).toEqual(snapshot);
    // E o resultado e um array novo com objetos novos.
    expect(out.rows).not.toBe(rows);
    expect(out.rows[0]).not.toBe(rows[0]);
    // E os valores foram de fato mascarados na saida.
    expect(out.rows[0]!.email).toBe('jo********@g****.com');
  });
});

describe('maskResultSet — maskedColumns', () => {
  it('lista apenas as colunas com politica nao-safe', () => {
    const rows = [{ id: 1, email: 'a@b.com', note: 'x' }];
    const out = maskResultSet(rows, {
      columns: { id: 'safe', email: 'email', note: 'generic' },
    });
    expect(out.maskedColumns.slice().sort()).toEqual(['email', 'note']);
  });

  it('inclui colunas nao classificadas (fail-closed = generic aplicado)', () => {
    const rows = [{ a: 'x', b: 'y' }];
    const out = maskResultSet(rows, { columns: { a: 'safe' } });
    expect(out.maskedColumns).toEqual(['b']);
  });

  it('conta uma coluna mascarada mesmo quando todos os valores sao null', () => {
    const rows = [{ secret: null }, { secret: null }];
    const out = maskResultSet(rows, { columns: { secret: 'generic' } });
    expect(out.maskedColumns).toEqual(['secret']);
  });

  it('e deduplicada e ordenada', () => {
    const rows = [
      { z: '1', a: '2' },
      { z: '3', a: '4' },
    ];
    const out = maskResultSet(rows, { columns: {} });
    expect(out.maskedColumns).toEqual(['a', 'z']);
  });
});

describe('maskResultSet — bordas', () => {
  it('result set vazio devolve rows e maskedColumns vazios', () => {
    const out = maskResultSet([], { columns: { email: 'email' } });
    expect(out.rows).toEqual([]);
    expect(out.maskedColumns).toEqual([]);
  });

  it('ignora uma coluna do mapa de politicas que nao aparece nos dados', () => {
    const rows = [{ id: 1 }];
    const out = maskResultSet(rows, {
      columns: { id: 'safe', fantasma: 'email' },
    });
    expect(out.rows[0]).toEqual({ id: 1 });
    expect(out.maskedColumns).toEqual([]);
  });

  it('e deterministico — mesma entrada, mesma saida', () => {
    const rows = [{ email: 'joao@x.com', cpf: '12345678909' }];
    const a = maskResultSet(rows, { columns: { email: 'email', cpf: 'cpf' } });
    const b = maskResultSet(rows, { columns: { email: 'email', cpf: 'cpf' } });
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// Mascaramento recursivo (aninhado + arrays)
// ---------------------------------------------------------------------------

describe('maskResultSet — mascaramento recursivo de objetos aninhados', () => {
  it('mascara campo aninhado por dot-path (address.cpf)', () => {
    const rows = [
      {
        id: 1,
        address: {
          street: 'Rua A',
          cpf: '12345678901',
        },
      },
    ];
    // 'address.cpf' e PII; 'address.street' nao tem policy → generic (fail-closed)
    const out = maskResultSet(rows, {
      columns: {
        id: 'safe',
        'address.cpf': 'cpf',
        'address.street': 'safe',
      },
    });

    const addr = out.rows[0]!.address as Record<string, unknown>;
    expect(addr.cpf).toBe('***.***.***-01');
    expect(addr.street).toBe('Rua A');
  });

  it('campo aninhado ausente do mapa cai pra generic (fail-closed)', () => {
    const rows = [
      {
        user: {
          name: 'Alice',
          secret: 'pii-secreta',
        },
      },
    ];
    // 'user.name' e safe; 'user.secret' nao tem policy → generic
    const out = maskResultSet(rows, {
      columns: { 'user.name': 'safe' },
    });

    const user = out.rows[0]!.user as Record<string, unknown>;
    expect(user.name).toBe('Alice');
    expect(user.secret).toBe(GENERIC);
  });

  it('mascara campo em array com wildcard contacts.*.phone', () => {
    const rows = [
      {
        id: 2,
        contacts: [
          { phone: '11987654321', type: 'mobile' },
          { phone: '1133334444', type: 'home' },
        ],
      },
    ];
    const out = maskResultSet(rows, {
      columns: {
        id: 'safe',
        'contacts.*.phone': 'phone',
        'contacts.*.type': 'safe',
      },
    });

    const contacts = out.rows[0]!.contacts as Array<Record<string, unknown>>;
    expect(contacts).toHaveLength(2);
    // tipo preservado
    expect(contacts[0]!.type).toBe('mobile');
    expect(contacts[1]!.type).toBe('home');
    // telefone mascarado (preserva 4 ultimos)
    const p0 = String(contacts[0]!.phone);
    const p1 = String(contacts[1]!.phone);
    expect(p0.endsWith('4321')).toBe(true);
    expect(p1.endsWith('4444')).toBe(true);
  });

  it('nao muta o objeto aninhado original', () => {
    const original = { addr: { cpf: '12345678901' } };
    const snapshot = JSON.parse(JSON.stringify(original));
    maskResultSet([original], {
      columns: { 'addr.cpf': 'cpf' },
    });
    expect(original).toEqual(snapshot);
  });

  it('campo safe num objeto aninhado NAO aparece em maskedColumns', () => {
    const rows = [{ meta: { id: 42, secret: 'pii' } }];
    const out = maskResultSet(rows, {
      columns: { 'meta.id': 'safe', 'meta.secret': 'generic' },
    });
    expect(out.maskedColumns).not.toContain('meta.id');
    expect(out.maskedColumns).toContain('meta.secret');
  });

  it('objeto profundamente aninhado (3 niveis) mascara fail-closed', () => {
    const rows = [
      {
        a: {
          b: {
            c: 'valor-pii',
          },
        },
      },
    ];
    // nenhuma policy declarada → tudo generic
    const out = maskResultSet(rows, { columns: {} });
    const abc = (out.rows[0]!.a as Record<string, unknown>).b as Record<string, unknown>;
    expect(abc.c).toBe(GENERIC);
  });
});
