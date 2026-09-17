import { formatNumber } from '../../lib/format';

// Quatro números principais e, quando fizer sentido, dois de apoio. Sem
// tendência, sem comparação com período anterior: a Sprint entrega leitura, e
// gráfico exigiria biblioteca nova.
function MetricCards({ metrics }) {
    return (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {metrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl bg-sand-dark/40 p-4">
                    <p className="text-xs font-semibold text-dark-ocean/60 uppercase">{metric.label}</p>
                    <p className="mt-1 font-head text-2xl font-extrabold text-foreground md:text-3xl">
                        {formatNumber(metric.value)}
                    </p>
                </div>
            ))}
        </div>
    );
}

export default MetricCards;
