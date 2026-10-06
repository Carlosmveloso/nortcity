import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { OfferPageHero, OfferStatusBadge } from '@/components/offers/OfferParts';
import { useAdminOffers } from '@/hooks/useOffers';
import { usePageMeta } from '@/hooks/usePageMeta';
import {
    ADMIN_QUEUES,
    REVISION_STATUS_LABELS,
    adminQueuesFor,
    benefitSummary,
    describeOffer,
    formatOfferDateTime,
    isWaitingForPlanSlot,
    periodSummary,
} from '@/lib/offers';
import { staticPageMeta } from '@/lib/siteMeta';

function AdminOfertas() {
    usePageMeta(staticPageMeta('/admin/ofertas'));
    const { offers, versions, loading, error, refetch } = useAdminOffers();
    const [searchParams, setSearchParams] = useSearchParams();
    const queue = ADMIN_QUEUES.some((item) => item.value === searchParams.get('fila')) ? searchParams.get('fila') : 'pending';

    const items = useMemo(
        () =>
            offers.map((offer) => {
                const view = describeOffer(offer, versions);
                return { offer, view, queues: adminQueuesFor(offer, view) };
            }),
        [offers, versions]
    );
    const counts = Object.fromEntries(
        ADMIN_QUEUES.map((item) => [item.value, items.filter((entry) => entry.queues.includes(item.value)).length])
    );
    const visible = items
        .filter((entry) => entry.queues.includes(queue))
        // Fila de análise: quem enviou primeiro é atendido primeiro.
        .sort((a, b) =>
            queue === 'pending'
                ? new Date(a.view.latest?.submitted_at ?? 0) - new Date(b.view.latest?.submitted_at ?? 0)
                : 0
        );

    return (
        <>
            <OfferPageHero
                wide
                crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Ofertas' }]}
                title="Ofertas"
                subtitle="Analise as ofertas enviadas pelos negócios, publique as aprovadas e acompanhe as que estão no ar."
            />
            <section className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
                <div className="container mx-auto max-w-5xl">
                    <div role="group" aria-label="Filas de ofertas" className="flex flex-wrap gap-2">
                        {ADMIN_QUEUES.map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                aria-pressed={queue === item.value}
                                onClick={() => setSearchParams({ fila: item.value }, { replace: true })}
                                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                                    queue === item.value ? 'bg-turquoise text-sand' : 'bg-white text-dark-ocean shadow-sm'
                                }`}
                            >
                                {item.label} <span className="opacity-70">({counts[item.value]})</span>
                            </button>
                        ))}
                    </div>

                    {loading && offers.length === 0 && (
                        <p role="status" className="mt-6 text-sm text-dark-ocean/60">
                            Carregando ofertas...
                        </p>
                    )}
                    {error && (
                        <p role="alert" className="mt-6 text-sm text-red-600">
                            Não foi possível carregar as ofertas.{' '}
                            <button type="button" onClick={refetch} className="font-semibold underline">
                                Tentar novamente
                            </button>
                        </p>
                    )}
                    {!loading && !error && visible.length === 0 && (
                        <p className="mt-6 text-sm text-dark-ocean/60">Nenhuma oferta nesta fila.</p>
                    )}

                    <ul className="mt-6 flex flex-col gap-4" aria-label="Ofertas da fila">
                        {visible.map(({ offer, view }) => {
                            const shown = queue === 'pending' || queue === 'changes_requested' || queue === 'approved' ? view.latest : view.display;
                            return (
                                <li key={offer.id} className="rounded-3xl bg-card p-5 shadow-sm">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold tracking-wide text-dark-ocean/60 uppercase">
                                                {offer.business?.name ?? 'Negócio'}
                                            </p>
                                            <h2 className="font-head text-lg font-bold break-words text-foreground">
                                                {shown?.title || 'Oferta sem título'}
                                            </h2>
                                        </div>
                                        <OfferStatusBadge status={offer.status} />
                                    </div>
                                    <p className="mt-1 text-sm text-dark-ocean/80">
                                        {benefitSummary(shown)} · {periodSummary(shown)}
                                    </p>
                                    <p className="mt-1 text-xs text-dark-ocean/60">
                                        Versão {view.latest?.version_number}
                                        {view.latest?.submitted_at && ` · enviada em ${formatOfferDateTime(view.latest.submitted_at)}`}
                                    </p>
                                    {view.revisionStatus && (
                                        <p className="mt-1 text-xs font-semibold text-ocean">{REVISION_STATUS_LABELS[view.revisionStatus]}</p>
                                    )}
                                    {isWaitingForPlanSlot(offer, view) && (
                                        <p className="mt-2 inline-flex rounded-full bg-sun/15 px-3 py-1 text-xs font-semibold text-dark-ocean">
                                            Aguardando vaga no plano
                                        </p>
                                    )}
                                    <Link
                                        to={`/admin/ofertas/${offer.id}`}
                                        className="mt-4 inline-flex rounded-full bg-turquoise px-5 py-2.5 text-sm font-bold text-sand"
                                    >
                                        {view.awaitingReview ? 'Analisar' : 'Abrir'}
                                        <span className="sr-only"> {shown?.title}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </section>
        </>
    );
}

export default AdminOfertas;
