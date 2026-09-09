// Reconcilia o banco de produção com os negócios que se perderam no merge de
// 20/08 e no seed vencido de 06/09 (ver docs — o seed.sql saiu de um snapshot
// anterior à correção, então subiu sem estes três e com o Rogério dentro).
//
// Usa as mesmas RPCs do painel /admin, então passa pela mesma validação:
// admin_create_business publica só se o cadastro atende ao mínimo, e
// admin_delete_business é o único caminho de remoção.
//
// Uso:
//   node scripts/reconciliar-negocios.mjs            # simulação, não grava nada
//   node scripts/reconciliar-negocios.mjs --apply    # grava
//
// Credenciais: pede e-mail e senha do admin no terminal (a senha não aparece
// na tela nem no histórico). Também aceita FAROL_ADMIN_EMAIL/FAROL_ADMIN_PASSWORD.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import process from 'node:process';

const APPLY = process.argv.includes('--apply');
const ROOT = new URL('..', import.meta.url);

// --- negócios a recriar -----------------------------------------------------
// Campos vindos de src/data/businesses.data.js. `whatsapp = phone` segue a
// mesma convenção do seed original. `service_area` não existia no arquivo:
// os três atendem sem endereço público, e o banco exige alguma localização
// para publicar. Ajuste no /admin se algum deles tiver endereço de fato.
const CRIAR = [
    {
        arquivo: 'eduardaSouza',
        imagem: 'src/assets/businesses/eduardaSouza.webp',
        payload: {
            name: 'Eduarda Souza',
            subcategory: 'Estética',
            description: 'Estética superficial',
            phone: '(83) 98722-4219',
            whatsapp: '(83) 98722-4219',
            service_area: 'Pitimbu',
        },
        categorias: ['lojas', 'servicos'], // primária = a primeira, como no seed
    },
    {
        arquivo: 'guilhermePintor',
        imagem: 'src/assets/businesses/guilhermePintor.webp',
        payload: {
            name: 'Guilherme Pintor',
            subcategory: 'Pintor',
            phone: '(83) 98137-6092',
            whatsapp: '(83) 98137-6092',
            service_area: 'Pitimbu',
        },
        categorias: ['construcao', 'servicos'],
    },
    {
        arquivo: 'restaurante-lia',
        imagem: 'src/assets/businesses/restaurante-lia.webp',
        payload: {
            name: 'Restaurante da Lia',
            subcategory: 'Restaurante',
            phone: '(83) 99804-9503',
            whatsapp: '(83) 99804-9503',
            service_area: 'Pitimbu',
        },
        categorias: ['gastronomia'],
    },
];

// Substituído por JN Gessos no commit 842524d; sobreviveu porque o seed é anterior.
const REMOVER_SLUG = 'rogerio-gesso';

// --- infraestrutura ---------------------------------------------------------

function env() {
    const raw = readFileSync(new URL('.env', ROOT), 'utf8');
    const get = (key) => raw.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim();
    const url = get('VITE_SUPABASE_URL');
    const key = get('VITE_SUPABASE_ANON_KEY');
    if (!url || !key) throw new Error('VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY ausentes no .env');
    return { url, key };
}

function pergunta(texto, { oculta = false } = {}) {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    return new Promise((resolve) => {
        if (oculta) {
            // Silencia o eco para a senha não aparecer na tela.
            const escrever = rl._writeToOutput?.bind(rl);
            rl._writeToOutput = function (chunk) {
                if (chunk.includes(texto)) escrever(chunk);
            };
        }
        rl.question(texto, (resposta) => {
            if (oculta) process.stdout.write('\n');
            rl.close();
            resolve(resposta.trim());
        });
    });
}

function erroRpc(error) {
    // As RPCs levantam message = código estável, detail = frase em PT-BR.
    return [error.message, error.details].filter(Boolean).join(' — ');
}

async function main() {
    const { url, key } = env();
    const supabase = createClient(url, key, { auth: { persistSession: false } });

    const email = process.env.FAROL_ADMIN_EMAIL || (await pergunta('E-mail do admin: '));
    const password =
        process.env.FAROL_ADMIN_PASSWORD || (await pergunta('Senha: ', { oculta: true }));

    const { data: sessao, error: erroLogin } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    if (erroLogin) throw new Error(`Login falhou: ${erroLogin.message}`);

    const { data: papeis } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', sessao.user.id);
    if (!papeis?.some((p) => p.role === 'admin')) {
        throw new Error(`${email} não tem papel admin — as RPCs vão recusar.`);
    }
    console.log(`\nAutenticado como ${email} (admin).`);
    console.log(APPLY ? 'Modo: GRAVANDO\n' : 'Modo: simulação — nada será gravado\n');

    const { data: categorias } = await supabase.from('categories').select('id, slug');
    const idDaCategoria = Object.fromEntries(categorias.map((c) => [c.slug, c.id]));

    // --- criar ---------------------------------------------------------------
    for (const item of CRIAR) {
        const { data: jaExiste } = await supabase
            .from('businesses')
            .select('slug')
            .eq('name', item.payload.name)
            .maybeSingle();
        if (jaExiste) {
            console.log(`· ${item.payload.name}: já existe como "${jaExiste.slug}" — pulando.`);
            continue;
        }

        const ids = item.categorias.map((slug) => idDaCategoria[slug]);
        if (ids.some((id) => !id)) {
            throw new Error(`Categoria desconhecida em ${item.payload.name}: ${item.categorias}`);
        }

        if (!APPLY) {
            console.log(`+ criaria "${item.payload.name}" (${item.categorias.join(', ')}) como ativo`);
            console.log(`  capa: ${item.imagem}`);
            continue;
        }

        const { data: novoId, error } = await supabase.rpc('admin_create_business', {
            p_payload: item.payload,
            p_category_ids: ids,
            p_primary_category_id: ids[0],
            p_status: 'active',
        });
        if (error) throw new Error(`Falha ao criar ${item.payload.name}: ${erroRpc(error)}`);

        // Capa: caminho único por envio, mesma convenção de uploadAdminCoverImage.
        const arquivo = readFileSync(new URL(item.imagem, ROOT));
        const caminho = `${novoId}/cover-${Date.now()}.webp`;
        const { error: erroUpload } = await supabase.storage
            .from('business-photos')
            .upload(caminho, arquivo, { contentType: 'image/webp', cacheControl: '3600' });
        if (erroUpload) throw new Error(`Upload da capa de ${item.payload.name}: ${erroUpload.message}`);

        const {
            data: { publicUrl },
        } = supabase.storage.from('business-photos').getPublicUrl(caminho);

        const { error: erroCapa } = await supabase.rpc('admin_update_business', {
            p_business_id: novoId,
            p_payload: { cover_image: publicUrl },
        });
        if (erroCapa) throw new Error(`Capa de ${item.payload.name}: ${erroRpc(erroCapa)}`);

        const { data: criado } = await supabase
            .from('businesses')
            .select('slug')
            .eq('id', novoId)
            .single();
        console.log(`+ criado "${item.payload.name}" → /negocio/${criado.slug}`);
    }

    // --- remover -------------------------------------------------------------
    const { data: alvo } = await supabase
        .from('businesses')
        .select('id, name, slug')
        .eq('slug', REMOVER_SLUG)
        .maybeSingle();

    if (!alvo) {
        console.log(`\n· ${REMOVER_SLUG}: não está no banco — nada a remover.`);
    } else if (!APPLY) {
        console.log(`\n- removeria "${alvo.name}" (${alvo.slug})`);
    } else {
        const { error } = await supabase.rpc('admin_delete_business', { p_business_id: alvo.id });
        if (error) throw new Error(`Falha ao remover ${alvo.slug}: ${erroRpc(error)}`);
        console.log(`\n- removido "${alvo.name}" (${alvo.slug})`);
    }

    const { count } = await supabase
        .from('businesses')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active');
    console.log(`\nNegócios ativos no banco: ${count}`);
    if (!APPLY) console.log('Nada foi gravado. Rode com --apply para valer.');

    await supabase.auth.signOut();
}

main().catch((erro) => {
    console.error(`\nERRO: ${erro.message}`);
    process.exit(1);
});
