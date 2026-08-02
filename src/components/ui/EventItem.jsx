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
        <article className="flex gap-4 rounded-3xl bg-card p-4 shadow-sm sm:p-5">
            <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-ocean py-3 text-card">
                <span className="text-xs font-bold tracking-wide">{month}</span>
                <span className="font-head text-2xl font-extrabold">{day}</span>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
                <span className="w-fit rounded-full bg-turquoise/10 px-3 py-1 text-xs font-semibold text-turquoise">
                    {event.category}
                </span>
                <h3 className="font-head text-lg font-semibold text-foreground">{event.title}</h3>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        <Clock size={15} className="text-turquoise" aria-hidden="true" />
                        {formatFullDate(event.date)}, {event.time}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <MapPin size={15} className="text-turquoise" aria-hidden="true" />
                        {event.location}
                    </span>
                </div>
            </div>
            <span className="h-fit shrink-0 self-start rounded-full bg-sand-dark px-3 py-1 text-xs font-semibold whitespace-nowrap text-dark-ocean">
                {event.price}
            </span>
        </article>
    );
}

export default EventItem;
