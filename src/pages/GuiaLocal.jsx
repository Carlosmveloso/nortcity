import { ChevronRight, Waves, ShoppingBasket, CalendarDays, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { events } from '../data/events';
import { usefulPhones } from '../data/usefulPhones';
import { localMarkets, localMarketsSchedule } from '../data/localMarkets';
import EventItem from '../components/ui/EventItem';
import Reveal from '../components/ui/Reveal';
import TideForecast from '../components/ui/TideForecast';

const upcomingEvents = [...events].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);

function InfoCard({ icon: Icon, title, children }) {
    return (
        <div className="rounded-3xl bg-card p-6 shadow-sm">
            <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-ocean text-card">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="font-head text-xl font-bold text-foreground">{title}</h2>
            </div>
            <div className="mt-4">{children}</div>
        </div>
    );
}

function GuiaLocal() {
    return (
        <>
            <section className="bg-gradient-ocean px-4 pt-28 pb-14 sm:px-6 lg:px-8 lg:pt-32">
                <div className="container mx-auto max-w-5xl">
                    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-card/70">
                        <Link to="/" className="hover:text-card">
                            Início
                        </Link>
                        <ChevronRight size={14} aria-hidden="true" />
                        <span className="text-card">Guia Local</span>
                    </nav>
                    <p className="text-sm font-bold tracking-wide text-turquoise-light uppercase">Para o dia a dia</p>
                    <h1 className="mt-2 font-head text-3xl font-extrabold text-card md:text-4xl">Guia Local</h1>
                    <p className="mt-2 max-w-2xl text-card/80">
                        Maré, feiras livres, eventos e telefones úteis de Pitimbu, tudo em um só lugar.
                    </p>
                </div>
            </section>

            <section className="bg-background px-4 py-12 sm:px-6 lg:px-8">
                <div className="container mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2">
                    <Reveal>
                        <InfoCard icon={Waves} title="Tábua de Marés">
                            <TideForecast />
                        </InfoCard>
                    </Reveal>

                    <Reveal delay={60}>
                        <InfoCard icon={ShoppingBasket} title="Feiras Livres">
                            <p className="text-sm text-muted-foreground">
                                Toda semana, aos {localMarketsSchedule.day.toLowerCase()}s, das{' '}
                                {localMarketsSchedule.hours}, com funcionamento mais intenso pela manhã.
                            </p>
                            <ul className="mt-4 flex flex-col gap-3">
                                {localMarkets.map((market) => (
                                    <li key={market.id} className="text-sm">
                                        <p className="font-semibold text-foreground">{market.name}</p>
                                        <p className="text-muted-foreground">{market.location}</p>
                                    </li>
                                ))}
                            </ul>
                            <p className="mt-4 text-sm text-muted-foreground">
                                Frutas, verduras, grãos, artesanato local e forte presença de frutos do mar,
                                trazidos direto por pescadores, marisqueiras e agricultores familiares da região.
                            </p>
                        </InfoCard>
                    </Reveal>

                    <Reveal delay={120}>
                        <InfoCard icon={CalendarDays} title="Próximos Eventos">
                            <div className="flex flex-col gap-3">
                                {upcomingEvents.map((event) => (
                                    <EventItem key={event.id} event={event} />
                                ))}
                            </div>
                            <Link
                                to="/eventos"
                                className="mt-4 inline-block text-sm font-semibold text-turquoise hover:underline"
                            >
                                Ver agenda completa →
                            </Link>
                        </InfoCard>
                    </Reveal>

                    <Reveal delay={180}>
                        <InfoCard icon={Phone} title="Telefones Úteis">
                            <ul className="flex flex-col gap-3">
                                {usefulPhones.map((phone) => (
                                    <li key={phone.label} className="flex items-center justify-between gap-3 text-sm">
                                        <span className="text-foreground">{phone.label}</span>
                                        {phone.number ? (
                                            <a
                                                href={`tel:${phone.number}`}
                                                className="rounded-full bg-turquoise/10 px-3 py-1 font-semibold text-turquoise whitespace-nowrap"
                                            >
                                                {phone.number}
                                            </a>
                                        ) : (
                                            <span className="rounded-full bg-sand-dark px-3 py-1 text-xs font-semibold whitespace-nowrap text-muted-foreground">
                                                A confirmar
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </InfoCard>
                    </Reveal>
                </div>
            </section>
        </>
    );
}

export default GuiaLocal;
