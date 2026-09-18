import { formatNumber, formatPercent } from '../../lib/format';

// Funil de rolagem em texto e barra — nunca só em cor ou desenho.
function ScrollFunnel({ steps }) {
    const pageViews = Number(steps[0]?.page_views) || 0;

    return (
        <div>
            <ul className="flex flex-col gap-2">
                {steps.map((step) => {
                    const rate = Number(step.rate) || 0;

                    return (
                        <li key={step.depth} className="flex items-center gap-3">
                            <span className="w-12 shrink-0 text-sm font-bold text-dark-ocean">{step.depth}%</span>
                            <div className="h-3 flex-1 overflow-hidden rounded-full bg-sand-dark/60">
                                <div
                                    className="h-full rounded-full bg-turquoise"
                                    style={{ width: `${Math.min(100, rate)}%` }}
                                />
                            </div>
                            <span className="w-32 shrink-0 text-right text-sm text-dark-ocean/70">
                                {formatPercent(step.rate)} · {formatNumber(step.reached)}
                            </span>
                        </li>
                    );
                })}
            </ul>

            <p className="mt-3 text-sm text-dark-ocean/70">
                Base: {formatNumber(pageViews)} visualização(ões) desta página no período.
            </p>
            <p className="mt-1 text-xs text-dark-ocean/60">
                Página que cabe inteira na tela não gera evento de rolagem, então aparece zerada aqui —
                isso é ausência de rolagem, não ausência de leitura.
            </p>
        </div>
    );
}

export default ScrollFunnel;
