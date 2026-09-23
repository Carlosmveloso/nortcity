// Banco Postgres real, isolado e descartável, para testar migrations, RLS e
// concorrência sem tocar no Supabase de produção.
//
// Por que PGlite: esta máquina não tem Docker nem Postgres local, então
// `supabase start` não sobe. PGlite é o Postgres de verdade compilado para
// WASM — as policies, triggers, constraints e funções PL/pgSQL das migrations
// rodam exatamente como no servidor.
//
// O que é stub aqui (e portanto NÃO é testado): os schemas `auth`, `storage`,
// `net`, `vault` e `cron` do Supabase. São recriados com o mínimo que as
// migrations usam — auth.users, auth.uid() lendo o mesmo GUC que o Supabase
// usa, storage.buckets, storage.objects e storage.foldername().
//
// `net.http_post` grava numa tabela em vez de sair para a rede. Isso não é só
// para a migration do rebuild aplicar: é o que torna a trigger testável, porque
// o teste consegue afirmar quantas chamadas saíram e para qual URL.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const migrationsDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../supabase/migrations'
);

const BOOTSTRAP = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
);

grant usage on schema auth to anon, authenticated;

create or replace function auth.uid() returns uuid
language sql stable as $fn$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$fn$;

create schema storage;
create table storage.buckets (id text primary key, name text, public boolean not null default false);
create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets(id),
    name text not null,
    owner uuid
);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant select on storage.buckets to anon, authenticated;

create or replace function storage.foldername(p_name text) returns text[]
language sql immutable as $fn$
    select (string_to_array(p_name, '/'))[1:array_length(string_to_array(p_name, '/'), 1) - 1];
$fn$;

-- pg_net: a chamada HTTP vira uma linha. O teste lê net._sent para saber o que
-- teria saído para a rede.
create schema net;
create table net._sent (
    id bigserial primary key,
    url text not null,
    body jsonb,
    sent_at timestamptz not null default now()
);
create or replace function net.http_post(
    url text,
    body jsonb default '{}'::jsonb,
    params jsonb default '{}'::jsonb,
    headers jsonb default '{}'::jsonb,
    timeout_milliseconds integer default 5000
) returns bigint
language plpgsql as $fn$
declare
    v_id bigint;
begin
    insert into net._sent (url, body) values (http_post.url, http_post.body)
    returning net._sent.id into v_id;
    return v_id;
end;
$fn$;

-- Supabase Vault: no servidor é uma view sobre os segredos cifrados. Aqui é
-- tabela, para o teste conseguir criar e remover o segredo do deploy hook.
create schema vault;
create table vault.decrypted_secrets (
    id uuid primary key default gen_random_uuid(),
    name text unique,
    decrypted_secret text
);

-- pg_cron: registrar o agendamento basta. Quem executa a varredura no teste é o
-- próprio teste, chamando fire_site_rebuild() direto.
create schema cron;
create table cron.job (
    jobid bigserial primary key,
    jobname text unique,
    schedule text,
    command text
);
create or replace function cron.schedule(p_job_name text, p_schedule text, p_command text)
returns bigint
language sql as $fn$
    insert into cron.job (jobname, schedule, command) values (p_job_name, p_schedule, p_command)
    on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command
    returning jobid;
$fn$;
`;

export async function createTestDb() {
    const db = await PGlite.create({ extensions: { pgcrypto } });
    await db.exec(BOOTSTRAP);

    const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
    for (const file of files) {
        const sql = await readFile(path.join(migrationsDir, file), 'utf8');
        try {
            await db.exec(sql);
        } catch (error) {
            throw new Error(`Migration ${file} falhou: ${error.message}`, { cause: error });
        }
    }

    return db;
}

/** Executa como visitante anônimo. */
export async function asAnon(db) {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;`);
}

/** Executa como usuário autenticado (a role do PostgREST é sempre `authenticated`). */
export async function asUser(db, userId) {
    await db.exec(
        `reset role; select set_config('request.jwt.claim.sub', '${userId}', false); set role authenticated;`
    );
}

/** Conexão direta sem JWT: seed, SQL editor, service_role. */
export async function asService(db) {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
}

export async function createUser(db, { admin = false } = {}) {
    await asService(db);
    const { rows } = await db.query(`insert into auth.users default values returning id`);
    const id = rows[0].id;
    if (admin) {
        await db.query(`insert into public.user_roles (user_id, role) values ($1, 'admin')`, [id]);
    }
    return id;
}

export async function seedCategories(db, slugs = ['gastronomia', 'hospedagem', 'servicos', 'passeios']) {
    await asService(db);
    const ids = {};
    for (const [index, slug] of slugs.entries()) {
        const { rows } = await db.query(
            `insert into public.categories (slug, name, order_index) values ($1, $2, $3) returning id`,
            [slug, slug, index]
        );
        ids[slug] = rows[0].id;
    }
    return ids;
}

/** Payload mínimo válido; sobrescreva o que o teste precisa variar. */
export function businessPayload(overrides = {}) {
    return {
        name: 'Pousada Beira Mar',
        description: 'Pousada pé na areia na Praia dos Mariscos, com oito quartos e café da manhã.',
        address: 'Av. Beira Mar, 100',
        neighborhood: 'Mariscos',
        phone: '(83) 99999-0000',
        ...overrides,
    };
}

/** Roda uma chamada esperando erro e devolve a mensagem (o código estável). */
export async function expectError(promise) {
    try {
        await promise;
    } catch (error) {
        return error.message;
    }
    throw new Error('Esperava um erro, mas a operação foi concluída.');
}
