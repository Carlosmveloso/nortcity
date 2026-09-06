import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
        'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY não configuradas. Copie .env.example para .env e preencha com as chaves do seu projeto Supabase.'
    );
}

// URL de placeholder só para createClient não lançar em dev sem .env — as
// chamadas de rede vão falhar (tratadas pelo estado de erro dos hooks) em
// vez de derrubar o app inteiro na primeira renderização.
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-anon-key'
);
