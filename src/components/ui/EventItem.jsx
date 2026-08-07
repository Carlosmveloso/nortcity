import { Clock, MapPin } from 'lucide-react';

const monthLabels = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

function formatDateBadge(dateStr) {
    const [, month, day] = dateStr.split('-').map(Number);
    return { month: monthLabels[month - 1], day };
}

function formatFullDate(dateStr) {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function EventItem({ event }) {
    const { month, day } = formatDateBadge(event.date);

    return (
        <article className="flex gap-3 rounded-3xl bg-card p-4 shadow-sm sm:gap-4 sm:p-5">
            <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-ocean py-2.5 text-card sm:w-16 sm:py-3">
                <span className="text-xs font-bold tracking-wide">{month}</span>
                <span className="font-head text-xl font-extrabold sm:text-2xl">{day}</span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="w-fit rounded-full bg-turquoise/10 px-3 py-1 text-xs font-semibold text-turquoise">
                        {event.category}
                    </span>
                    <span className="shrink-0 rounded-full bg-sand-dark px-3 py-1 text-xs font-semibold whitespace-nowrap text-dark-ocean">
                        {event.price}
                    </span>
                </div>
                <h3 className="font-head text-base font-semibold text-foreground sm:text-lg">{event.title}</h3>
                {event.description && <p className="text-sm text-foreground/80">{event.description}</p>}
                <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-1">
                    <span className="flex items-center gap-1.5">
                        <Clock size={15} className="shrink-0 text-turquoise" aria-hidden="true" />
                        {formatFullDate(event.date)}, {event.time}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <MapPin size={15} className="shrink-0 text-turquoise" aria-hidden="true" />
                        {event.location}
                    </span>
                </div>
            </div>
        </article>
    );
}

export default EventItem;
