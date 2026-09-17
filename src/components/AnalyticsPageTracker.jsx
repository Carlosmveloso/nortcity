import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { track } from '../lib/analytics/analytics';
import { AnalyticsEvents } from '../lib/analytics/events';

// Um page_view por navegação real. Fica ao lado de <ScrollToTop /> em App.jsx,
// fora do <Suspense>: ali monta uma vez e não remonta quando uma rota
// preguiçosa termina de carregar, o que duplicaria o evento.
function AnalyticsPageTracker() {
    const location = useLocation();
    const lastView = useRef(null);

    useEffect(() => {
        // `key` muda a cada entrada no histórico, inclusive ao voltar para uma
        // URL já visitada. O que ele não muda é entre as duas execuções do
        // efeito no modo estrito do React — exatamente o disparo a evitar.
        const view = `${location.key}|${location.pathname}`;
        if (lastView.current === view) return;
        lastView.current = view;

        track(AnalyticsEvents.PAGE_VIEW);
    }, [location.key, location.pathname]);

    return null;
}

export default AnalyticsPageTracker;
