// @vitest-environment node
//
// O Supabase carrega a extensão pg-safeupdate nas conexões do PostgREST: todo
// UPDATE/DELETE sem WHERE é recusado com "UPDATE requires a WHERE clause",
// mesmo dentro de função SECURITY DEFINER ou trigger. O PGlite não carrega a
// extensão, então nenhum teste de execução acusa — foi assim que as triggers de
// site_rebuild (tabela de uma linha só) quebraram toda escrita na vitrine.
// Teste de catálogo: lê o corpo das funções e procura o comando sem WHERE.
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from './harness';

let db;

beforeAll(async () => {
    db = await createTestDb();
}, 60_000);

// Devolve os UPDATE/DELETE sem WHERE: cada um vai da palavra-chave até o `;`
// seguinte. Comentários e strings saem antes, para `;` e palavras dentro deles
// não confundirem o recorte.
function writesWithoutWhere(source) {
    const code = source
        .replace(/--[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/'(?:[^']|'')*'/g, "''");

    const statements = code.match(/\b(?:update\s+[\w.]+\s+set|delete\s+from)\b[^;]*/gi) ?? [];
    return statements
        .map((statement) => statement.replace(/\s+/g, ' ').trim())
        .filter((statement) => !/\bwhere\b/i.test(statement));
}

describe('pg-safeupdate', () => {
    it('o detector acusa UPDATE sem WHERE e aceita com WHERE', () => {
        expect(writesWithoutWhere('begin update t set a = 1; return null; end')).toHaveLength(1);
        expect(writesWithoutWhere('begin update t set a = 1 where id; end')).toEqual([]);
        expect(writesWithoutWhere("delete from t; -- where")).toHaveLength(1);
        expect(writesWithoutWhere('if exists (select 1 from b where x) then update t set a = 1; end if')).toHaveLength(1);
    });

    it('nenhuma função do schema public faz UPDATE/DELETE sem WHERE', async () => {
        const { rows } = await db.query(`
            select p.proname, p.prosrc
              from pg_proc p
              join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public'
               and p.prolang in (select oid from pg_language where lanname in ('plpgsql', 'sql'))
        `);

        const furadas = rows.flatMap((fn) =>
            writesWithoutWhere(fn.prosrc).map((statement) => `${fn.proname}(): ${statement}`)
        );

        expect(furadas).toEqual([]);
    });
});
