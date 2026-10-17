import { useCallback, useEffect, useState } from 'react';

/**
 * Carrega dados assíncronos com cancelamento e recarga explícita. `key`
 * identifica o recurso; `loader` deve ser estável para a mesma chave.
 *
 * `loading` sai da comparação entre a requisição atual e a última resposta,
 * sem setState síncrono no efeito. Numa recarga do mesmo recurso os dados
 * anteriores continuam visíveis; em outro recurso, não.
 */
export function useLoader(loader, key, enabled = true) {
    const [version, setVersion] = useState(0);
    const [state, setState] = useState({ key: null, request: null, data: null, error: null });
    const request = `${key}#${version}`;

    useEffect(() => {
        if (!enabled) return undefined;
        let cancelled = false;
        loader().then(
            (result) => {
                if (!cancelled) setState({ key, request, data: result, error: result?.error ?? null });
            },
            (error) => {
                if (!cancelled) setState({ key, request, data: null, error });
            }
        );
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `request` resume as dependências do loader.
    }, [request, enabled]);

    const refetch = useCallback(() => setVersion((value) => value + 1), []);
    const sameResource = state.key === key;
    return {
        data: sameResource ? state.data : null,
        error: sameResource ? state.error : null,
        loading: enabled && state.request !== request,
        refetch,
    };
}
