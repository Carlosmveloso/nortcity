// @vitest-environment node
//
// Guarda contra a armadilha que já mordeu o projeto três vezes: função interna
// tem `execute` revogado de PUBLIC, e alguém a chama de um contexto que roda
// como `authenticated`. O caso concreto foi `business_categories_check()`, uma
// constraint trigger DEFERRED — ela não roda dentro da RPC `SECURITY DEFINER`,
// roda no COMMIT, quando o papel corrente já voltou a ser o do usuário.
//
// Por que é teste de catálogo e não de execução: o PGlite não recusa a chamada
// (só o Postgres do servidor recusa), então o único jeito de pegar isto antes
// de produção é olhar para `pg_proc` e `pg_trigger`.
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from './harness';

let db;

beforeAll(async () => {
    db = await createTestDb();
}, 60_000);

async function funcoesRevogadas() {
    const { rows } = await db.query(`
        select p.proname
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and not has_function_privilege('authenticated', p.oid, 'execute')
    `);
    return rows.map((row) => row.proname);
}

describe('privilégios de função', () => {
    it('toda trigger que chama função interna é SECURITY DEFINER', async () => {
        const revogadas = await funcoesRevogadas();
        expect(revogadas.length).toBeGreaterThan(0);

        const { rows: triggers } = await db.query(`
            select distinct p.proname, p.prosecdef, p.prosrc, c.relname as tabela
              from pg_trigger t
              join pg_class c on c.oid = t.tgrelid
              join pg_proc p on p.oid = t.tgfoid
              join pg_namespace n on n.oid = c.relnamespace
             where not t.tgisinternal and n.nspname in ('public', 'auth', 'storage')
        `);

        const furadas = triggers
            .filter((fn) => !fn.prosecdef)
            .flatMap((fn) =>
                revogadas
                    .filter((alvo) => alvo !== fn.proname && new RegExp(`\\b${alvo}\\s*\\(`).test(fn.prosrc))
                    .map((alvo) => `${fn.tabela}: ${fn.proname}() chama ${alvo}() sem ser SECURITY DEFINER`)
            );

        expect(furadas).toEqual([]);
    });

    it('quem chama require_auth/require_admin roda como dono', async () => {
        const { rows } = await db.query(`
            select p.proname
              from pg_proc p
              join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public'
               and p.prokind = 'f'
               and not p.prosecdef
               and p.proname not in ('require_auth', 'require_admin')
               and p.prosrc ~ 'require_(auth|admin)\\s*\\('
        `);

        expect(rows.map((row) => row.proname)).toEqual([]);
    });
});
