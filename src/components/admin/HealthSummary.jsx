import { formatDate, formatNumber, formatRelativeTime } from '../../lib/format';

// Saúde da infraestrutura, não do produto. "Último evento" e "última agregação"
// aparecem separados de propósito: um agendador parado há três dias continua
// tendo evento de um minuto atrás, e é essa diferença que precisa saltar aos
// olhos.
function HealthSummary({ health }) {
    const linhas = [
        { label: 'Eventos armazenados', value: formatNumber(health.events_total) },
        { label: 'Primeiro evento', value: formatDate(health.first_event_at) },
        { label: 'Último evento', value: formatRelativeTime(health.last_event_at) },
        { label: 'Última agregação', value: formatDate(health.last_aggregated_date) },
        { label: 'Dias agregados', value: formatNumber(health.aggregated_days) },
        { label: 'Linhas agregadas', value: formatNumber(health.daily_rows) },
    ];

    return (
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {linhas.map((linha) => (
                <div
                    key={linha.label}
                    className="flex items-baseline justify-between gap-3 rounded-2xl bg-sand-dark/40 px-4 py-2.5"
                >
                    <dt className="text-sm text-dark-ocean/70">{linha.label}</dt>
                    <dd className="text-sm font-bold text-dark-ocean">{linha.value}</dd>
                </div>
            ))}
        </dl>
    );
}

export default HealthSummary;
