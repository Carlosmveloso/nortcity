import { useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useTideForecast } from '../../hooks/useTideForecast';

const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    timeZone: 'America/Sao_Paulo',
});

function dayLabel(date, index) {
    if (index === 0) return 'Hoje';
    if (index === 1) return 'Amanhã';
    const label = weekdayFormatter.format(new Date(`${date}T12:00:00`)).replace('.', '');
    return label.charAt(0).toUpperCase() + label.slice(1);
}

function TideForecast() {
    const { days, status } = useTideForecast(undefined, 7);
    const [activeIndex, setActiveIndex] = useState(0);

    if (status === 'error') {
        return (
            <p className="text-sm text-muted-foreground">
                Não foi possível carregar a previsão de maré agora. Tente novamente mais tarde ou
                consulte uma fonte oficial, como a Marinha do Brasil.
            </p>
        );
    }

    if (status === 'loading' || !days) {
        return (
            <div className="flex flex-col gap-2" aria-busy="true" aria-label="Carregando previsão de maré">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-10 animate-pulse rounded-xl bg-sand-dark/60" />
                ))}
            </div>
        );
    }

    const activeDay = days[activeIndex] ?? days[0];

    return (
        <div>
            <div className="flex flex-wrap gap-2">
                {days.map((day, index) => (
                    <button
                        key={day.date}
                        type="button"
                        onClick={() => setActiveIndex(index)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                            index === activeIndex
                                ? 'bg-gradient-ocean text-card'
                                : 'bg-sand-dark text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {dayLabel(day.date, index)}
                    </button>
                ))}
            </div>

            <ul className="mt-3 flex flex-col gap-2">
                {activeDay.extremes.length === 0 && (
                    <li className="text-sm text-muted-foreground">Sem dados de maré para este dia.</li>
                )}
                {activeDay.extremes.map((extreme) => (
                    <li
                        key={extreme.time}
                        className="flex items-center justify-between gap-3 rounded-xl bg-sand px-3 py-2 text-sm"
                    >
                        <span className="flex items-center gap-2 font-semibold text-foreground">
                            {extreme.type === 'alta' ? (
                                <ArrowUp size={15} className="shrink-0 text-turquoise" aria-hidden="true" />
                            ) : (
                                <ArrowDown size={15} className="shrink-0 text-turquoise" aria-hidden="true" />
                            )}
                            Maré {extreme.type}
                        </span>
                        <span className="text-muted-foreground">{extreme.time.slice(11, 16)}</span>
                        <span className="font-semibold text-dark-ocean">{extreme.height.toFixed(1)} m</span>
                    </li>
                ))}
            </ul>

            <p className="mt-3 text-xs text-muted-foreground">
                Estimativa via modelo global (Open-Meteo). Não substitui fontes oficiais de navegação —
                confira a Marinha do Brasil antes de sair para pescar ou passear de barco.
            </p>
        </div>
    );
}

export default TideForecast;
