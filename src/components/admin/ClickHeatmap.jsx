import { formatNumber } from '../../lib/format';

// Mapa de cliques sem screenshot da página: uma tela proporcional e abstrata.
//
// A proporção 2:3 não é estética — é a mesma do balde do servidor (20 colunas
// por 30 linhas), então cada ponto cai no lugar certo da grade.
//
// Intensidade é sempre RELATIVA ao maior balde da consulta atual. Não existe
// significado absoluto de cor: 10 cliques podem ser o ponto mais quente de um
// dia e irrelevantes num trimestre.
const MIN_SIZE = 14;
const MAX_SIZE = 46;

function ClickHeatmap({ points }) {
    const max = points.reduce((maior, point) => Math.max(maior, Number(point.clicks) || 0), 0);
    const total = points.reduce((soma, point) => soma + (Number(point.clicks) || 0), 0);

    return (
        <div>
            <div className="relative mx-auto aspect-[2/3] w-full max-w-md overflow-hidden rounded-2xl border border-sand-dark bg-sand-dark/30">
                {points.map((point) => {
                    const clicks = Number(point.clicks) || 0;
                    const intensity = max > 0 ? clicks / max : 0;
                    const size = MIN_SIZE + intensity * (MAX_SIZE - MIN_SIZE);

                    return (
                        <div
                            key={`${point.x}-${point.y}`}
                            title={`${formatNumber(clicks)} clique(s)`}
                            className="absolute rounded-full bg-turquoise"
                            style={{
                                left: `${Number(point.x) * 100}%`,
                                top: `${Number(point.y) * 100}%`,
                                width: `${size}px`,
                                height: `${size}px`,
                                // 0,25 de piso: o ponto mais frio ainda precisa
                                // ser visível, senão o mapa mente por omissão.
                                opacity: 0.25 + intensity * 0.55,
                                transform: 'translate(-50%, -50%)',
                                filter: 'blur(4px)',
                            }}
                        />
                    );
                })}
            </div>

            <p className="mt-3 text-sm text-dark-ocean/70">
                {formatNumber(total)} cliques com posição, em {formatNumber(points.length)} região(ões).
            </p>
            <p className="mt-1 text-xs text-dark-ocean/60">
                Mapa aproximado: a posição vertical é medida sobre a altura do documento no momento do
                clique, e tanto o conteúdo quanto a altura da página mudam com o tempo. Cliques feitos
                pelo teclado não têm posição e não aparecem aqui — mas contam na lista de elementos.
            </p>
        </div>
    );
}

export default ClickHeatmap;
