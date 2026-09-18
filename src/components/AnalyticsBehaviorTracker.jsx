import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsEnabled, track } from '../lib/analytics/analytics';
import { clickMetadata } from '../lib/analytics/clicks';
import { AnalyticsEvents } from '../lib/analytics/events';
import { pendingMilestones, readScrollDepth } from '../lib/analytics/scroll';

// Os dois únicos listeners de comportamento do site, num lugar só. Fica ao lado
// de <AnalyticsPageTracker /> em App.jsx, fora do <Suspense>, e é separado dele
// de propósito: a semântica de `page_view` é da Sprint 01 e não se mistura com
// isto.
function AnalyticsBehaviorTracker() {
    const location = useLocation();
    const sentMilestones = useRef(null);

    // Scroll. A lista de dependências é o reset por visualização de página: o
    // conjunto de marcos nasce vazio a cada page view, e `ScrollToTop` devolve a
    // barra ao topo quando o caminho muda.
    //
    // `location.key` e não só `pathname` porque o funil do painel divide marcos
    // por page views, e `page_view` dispara a cada entrada no histórico. Em
    // /explorar cada filtro chama `setSearchParams`, que empurra entrada nova:
    // com reset só por pathname, três filtros davam 4 page views e 1 conjunto de
    // marcos, e o funil daquela página mostrava um quarto do valor real.
    useEffect(() => {
        if (!analyticsEnabled) return undefined;

        const sent = new Set();
        sentMilestones.current = sent;
        let frame = 0;

        function measure() {
            frame = 0;
            const percent = readScrollDepth();

            for (const milestone of pendingMilestones(percent, sent)) {
                sent.add(milestone);
                track(AnalyticsEvents.SCROLL_DEPTH, { metadata: { depth: milestone } });
            }
        }

        // O navegador dispara scroll dezenas de vezes por segundo. A flag faz o
        // trabalho acontecer no máximo uma vez por quadro, e a RPC só sai quando
        // um marco novo cai: 500 eventos de DOM viram 3 requisições.
        function handleScroll() {
            if (frame) return;
            frame = requestAnimationFrame(measure);
        }

        // Sem medição na montagem, só em evento de scroll: enquanto a rota
        // preguiçosa carrega, o documento tem a altura do fallback, e medir ali
        // daria resultado sobre uma página que ainda não existe.
        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (frame) cancelAnimationFrame(frame);
        };
    }, [location.key, location.pathname]);

    // Cliques. Um listener para o site inteiro, montado uma vez.
    useEffect(() => {
        if (!analyticsEnabled) return undefined;

        function handleClick(event) {
            const metadata = clickMetadata(event);
            if (!metadata) return;

            track(AnalyticsEvents.ELEMENT_CLICK, { metadata });
        }

        // Fase de captura: um `stopPropagation` de qualquer handler no caminho
        // não faz o clique desaparecer da contagem. Nada aqui chama
        // preventDefault — o clique segue para o destino normalmente.
        document.addEventListener('click', handleClick, true);

        return () => document.removeEventListener('click', handleClick, true);
    }, []);

    return null;
}

export default AnalyticsBehaviorTracker;
