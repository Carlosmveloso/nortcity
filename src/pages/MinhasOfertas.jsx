import { BadgePercent, Plus, Store } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, OfferPageHero, OfferStatusBadge } from '@/components/offers/OfferParts';
import { useMyBusiness } from '@/hooks/useMyBusiness';
import { useBusinessOffers, useOfferTerms } from '@/hooks/useOffers';
import { usePageMeta } from '@/hooks/usePageMeta';
import {
    REVISION_STATUS_LABELS,
    benefitSummary,
    describeOffer,
    formatMoney,
    formatOfferDate,
    periodSummary,
} from '@/lib/offers';
import { staticPageMeta } from '@/lib/siteMeta';

const FILTERS = [
    { value: 'all', label: 'Todas', statuses: null },
    { value: 'draft', label: 'Rascunhos', statuses: ['draft'] },
    { value: 'review', label: 'Em análise', statuses: ['pending_review', 'changes_requested', 'approved', 'scheduled'] },
    { value: 'active', label: 'Ativas', statuses: ['active'] },
    { value: 'closed', label: 'Encerradas', statuses: ['suspended', 'ended', 'rejected'] },
];

export function PlanSummary({ terms, business }) {
    if (!terms) return null;
    const hasFee = terms.fee_amount !== null && terms.fee_amount !== undefined;
    return (
        <Card title="Seu plano" titleId="offers-plan">
            <p className="mt-1 text-sm text-dark-ocean/80">
                Plano <strong className="font-semibold">{terms.plan_name}</strong>
                {hasFee && (
                    <>
                        {' '}
                        · até {terms.active_offer_limit} {terms.active_offer_limit === 1 ? 'oferta ativa' : 'ofertas ativas'} ·{' '}
                        {terms.active_offers} {terms.active_offers === 1 ? 'ativa' : 'ativas'} agora
                    </>
                )}
            </p>
            {hasFee ? (
                <p className="mt-1 text-sm text-dark-ocean/80">
                    Taxa de {formatMoney(terms.fee_amount)} por cupom utilizado. Gerar cupom não gera cobrança.
                </p>
            ) : (
                <p className="mt-3 rounded-2xl bg-sun/10 px-4 py-3 text-sm text-dark-ocean">
                    Seu plano atual não inclui publicação de ofertas. Você pode preparar rascunhos; para enviar uma
                    oferta para análise, fale com a{' '}
                    <Link to="/contato" className="font-semibold text-ocean underline">
                        equipe do Farol
                    </Link>{' '}
                    sobre a mudança de plano.
                </p>
            )}
            {business && business.status !== 'active' && (
                <p className="mt-3 rounded-2xl bg-sun/10 px-4 py-3 text-sm text-dark-ocean">
                    Seu negócio ainda não está publicado. Ofertas podem ser preparadas, mas só seguem para análise depois
                    que o cadastro for aprovado.
                </p>
            )}
        </Card>
    );
}

function OfferCard({ offer, versions }) {
    const view = describeOffer(offer, versions);
    const shown = view.display;
    return (
        <li>
            <Link
                to={`/meu-negocio/ofertas/${offer.id}`}
                className="block rounded-3xl bg-card p-5 shadow-sm transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-turquoise focus-visible:outline-none"
            >
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="min-w-0 font-head text-lg font-bold break-words text-foreground">
                        {shown?.title || 'Oferta sem título'}
                    </h3>
                    <OfferStatusBadge status={offer.status} />
                </div>
                <p className="mt-1 text-sm text-dark-ocean/80">{benefitSummary(shown)}</p>
                <p className="mt-1 text-sm text-dark-ocean/70">{periodSummary(shown)}</p>
                <p className="mt-2 text-xs text-dark-ocean/60">
                    Versão {view.latest?.version_number ?? 1} · criada em {formatOfferDate(offer.created_at)}
                </p>
                {view.revisionStatus && (
                    <p className="mt-2 text-xs font-semibold text-ocean">{REVISION_STATUS_LABELS[view.revisionStatus]}</p>
                )}
            </Link>
        </li>
    );
}

function MinhasOfertas() {
    usePageMeta(staticPageMeta('/meu-negocio/ofertas'));
    const { business, loading: businessLoading, error: businessError } = useMyBusiness();
    const { offers, versions, loading, error, refetch } = useBusinessOffers(business?.id);
    const { terms } = useOfferTerms(business?.id);
    const [filter, setFilter] = useState('all');

    const counts = useMemo(
        () =>
            Object.fromEntries(
                FILTERS.map((item) => [
                    item.value,
                    item.statuses ? offers.filter((offer) => item.statuses.includes(offer.status)).length : offers.length,
                ])
            ),
        [offers]
    );
    const statuses = FILTERS.find((item) => item.value === filter)?.statuses;
    const visible = statuses ? offers.filter((offer) => statuses.includes(offer.status)) : offers;

    return (
        <>
            <OfferPageHero
                crumbs={[{ label: 'Início', to: '/' }, { label: 'Meu Negócio', to: '/meu-negocio' }, { label: 'Ofertas' }]}
                title="Minhas ofertas"
                subtitle="Crie promoções para quem usa o Farol Pitimbu e acompanhe cada etapa da análise."
            >
                {business && (
                    <Link
                        to="/meu-negocio/ofertas/nova"
                        className="mt-6 inline-flex items-center gap-2 rounded-full bg-card px-5 py-2.5 text-sm font-bold text-dark-ocean"
                    >
                        <Plus size={16} aria-hidden="true" />
                        Criar oferta
                    </Link>
                )}
            </OfferPageHero>

            <section className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
                <div className="container mx-auto flex max-w-3xl flex-col gap-6">
                    {(businessLoading || loading) && (
                        <p role="status" className="text-sm text-dark-ocean/60">
                            Carregando ofertas...
                        </p>
                    )}

                    {(businessError || error) && (
                        <div role="alert" className="rounded-3xl bg-red-50 px-5 py-4 text-sm text-red-700">
                            Não foi possível carregar suas ofertas.{' '}
                            <button type="button" onClick={refetch} className="font-semibold underline">
                                Tentar novamente
                            </button>
                        </div>
                    )}

                    {!businessLoading && !business && !businessError && (
                        <div className="rounded-3xl border border-dashed border-dark-ocean/20 p-10 text-center">
                            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-turquoise/10 text-turquoise">
                                <Store size={26} aria-hidden="true" />
                            </span>
                            <h2 className="mt-4 font-head text-xl font-bold text-foreground">Cadastre seu negócio primeiro</h2>
                            <p className="mx-auto mt-2 max-w-md text-sm text-dark-ocean/70">
                                As ofertas pertencem a um negócio cadastrado no Farol Pitimbu.
                            </p>
                            <Link
                                to="/cadastrar-negocio"
                                className="mt-6 inline-flex items-center gap-2 rounded-full bg-turquoise px-6 py-3 font-bold text-sand"
                            >
                                Cadastrar meu negócio
                            </Link>
                        </div>
                    )}

                    {business && <PlanSummary terms={terms} business={business} />}

                    {business && !loading && !error && offers.length === 0 && (
                        <div className="rounded-3xl border border-dashed border-dark-ocean/20 p-10 text-center">
                            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-turquoise/10 text-turquoise">
                                <BadgePercent size={26} aria-hidden="true" />
                            </span>
                            <h2 className="mt-4 font-head text-xl font-bold text-foreground">Nenhuma oferta ainda</h2>
                            <p className="mx-auto mt-2 max-w-md text-sm text-dark-ocean/70">
                                Crie promoções exclusivas para usuários do Farol Pitimbu. Toda oferta passa pela análise da
                                equipe antes de ir ao ar.
                            </p>
                            <Link
                                to="/meu-negocio/ofertas/nova"
                                className="mt-6 inline-flex items-center gap-2 rounded-full bg-turquoise px-6 py-3 font-bold text-sand"
                            >
                                Criar primeira oferta
                            </Link>
                        </div>
                    )}

                    {offers.length > 0 && (
                        <>
                            <div role="group" aria-label="Filtrar ofertas por situação" className="flex flex-wrap gap-2">
                                {FILTERS.map((item) => (
                                    <button
                                        key={item.value}
                                        type="button"
                                        aria-pressed={filter === item.value}
                                        onClick={() => setFilter(item.value)}
                                        className={`rounded-full px-4 py-2 text-sm font-semibold ${
                                            filter === item.value ? 'bg-turquoise text-sand' : 'bg-white text-dark-ocean shadow-sm'
                                        }`}
                                    >
                                        {item.label} <span className="opacity-70">({counts[item.value]})</span>
                                    </button>
                                ))}
                            </div>
                            {visible.length === 0 ? (
                                <p className="text-sm text-dark-ocean/60">
                                    Nenhuma oferta {filter === 'all' ? '' : `em “${FILTERS.find((item) => item.value === filter).label}”`}.
                                </p>
                            ) : (
                                <ul className="flex flex-col gap-4" aria-label="Ofertas">
                                    {visible.map((offer) => (
                                        <OfferCard key={offer.id} offer={offer} versions={versions} />
                                    ))}
                                </ul>
                            )}
                        </>
                    )}
                </div>
            </section>
        </>
    );
}

export default MinhasOfertas;
