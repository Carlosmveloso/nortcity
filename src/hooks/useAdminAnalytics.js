import { useCallback, useEffect, useState } from 'react';

// Um estado por seção do painel, com a dependência derivada dos argumentos.
//
// É o que faz a Parte 51 funcionar: trocar a página do heatmap muda os
// argumentos só das seções que recebem `pathname`, e a visão geral não refaz
// consulta nenhuma. A chave serializada evita o problema clássico de passar um
// objeto novo a cada render e reexecutar o efeito para sempre.
//
// `loading` é derivado, não guardado: marcar "carregando" com um setState
// dentro do efeito dispara renderização em cascata (e o lint do React 19 barra).
// Comparar o token do resultado com o token atual responde a mesma pergunta
// sem estado extra.
export function useAnalyticsData(loader, args) {
    const key = JSON.stringify(args);
    const [attempt, setAttempt] = useState(0);
    const [result, setResult] = useState({ token: null, data: null, error: null });

    const token = `${attempt}|${key}`;
    const reload = useCallback(() => setAttempt((current) => current + 1), []);

    useEffect(() => {
        let cancelled = false;

        loader(JSON.parse(key)).then(({ data, error }) => {
            if (cancelled) return;
            setResult({ token, data: error ? null : data, error: error ?? null });
        });

        return () => {
            cancelled = true;
        };
    }, [loader, key, token]);

    const loading = result.token !== token;

    return {
        data: loading ? null : result.data,
        error: loading ? null : result.error,
        loading,
        reload,
    };
}
