import { formatNumber } from '../../lib/format';

// Lista ordenada com barra proporcional ao maior valor da própria lista. O
// projeto não tem nenhuma <table>; o padrão daqui é card, como no resto do
// admin. A barra é comparação relativa dentro da lista, não escala absoluta.
function RankingList({ rows }) {
    const max = rows.reduce((maior, row) => Math.max(maior, Number(row.value) || 0), 0);

    return (
        <ul className="flex flex-col gap-2">
            {rows.map((row) => (
                <li key={row.key} className="rounded-2xl bg-sand-dark/40 p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-semibold break-all text-foreground">{row.label}</span>
                        <span className="text-sm font-bold text-dark-ocean">{formatNumber(row.value)}</span>
                    </div>

                    {row.sublabel && <p className="mt-0.5 text-xs text-dark-ocean/60">{row.sublabel}</p>}

                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white">
                        <div
                            className="h-full rounded-full bg-turquoise"
                            style={{ width: max > 0 ? `${((Number(row.value) || 0) / max) * 100}%` : '0%' }}
                        />
                    </div>

                    {row.metrics?.length > 0 && (
                        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-dark-ocean/70">
                            {row.metrics.map((metric) => (
                                <div key={metric.label} className="flex gap-1">
                                    <dt>{metric.label}:</dt>
                                    <dd className="font-semibold text-dark-ocean">{metric.value}</dd>
                                </div>
                            ))}
                        </dl>
                    )}
                </li>
            ))}
        </ul>
    );
}

export default RankingList;
