import { useEffect, useState } from 'react';

import { fetchPublishedCatalog, fetchPublishedCount } from '@/lib/businessCatalog';

// Referência estável: um `[]` novo a cada render remontaria o efeito.
const EMPTY = [];

// Estado de leitura do catálogo. `loading` importa: as telas que mostram número
// (home, /categorias) precisam distinguir "ainda não sei" de "zero", senão a
// home pisca "0 negócios cadastrados" a cada visita.
function useAsyncValue(load, fallback) {
    const [state, setState] = useState({ data: fallback, loading: true, error: null });

    useEffect(() => {
        let ativo = true;

        load()
            .then((data) => {
                if (ativo) setState({ data, loading: false, error: null });
            })
            .catch((error) => {
                if (!ativo) return;

                console.error('Falha ao ler o catálogo de negócios:', error);
                setState({ data: fallback, loading: false, error });
            });

        return () => {
            ativo = false;
        };
        // `load` e `fallback` são estáveis (import de módulo e constante), então
        // a consulta roda uma vez por montagem — e o cache do módulo cobre o
        // resto da navegação.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return state;
}

export function useBusinessCount() {
    return useAsyncValue(fetchPublishedCount, null);
}

export function useBusinessCatalog() {
    return useAsyncValue(fetchPublishedCatalog, EMPTY);
}
