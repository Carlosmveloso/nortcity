import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, OfferHistory, OfferPageHero, OfferStatusBadge, OfferSummary } from '@/components/offers/OfferParts';
import ActionDialog from '@/components/ui/ActionDialog';
import { offerRpc } from '@/integrations/supabase/offers';
import { useOfferDetail, useOfferTerms } from '@/hooks/useOffers';
import { usePageMeta } from '@/hooks/usePageMeta';
import { offerErrorMessage } from '@/lib/offerErrors';
import {
    OFFER_STATUS_LABELS,
    REVISION_STATUS_LABELS,
    describeOffer,
    formatMoney,
    formatOfferDate,
    formatOfferDateTime,
} from '@/lib/offers';
import { staticPageMeta } from '@/lib/siteMeta';

const VERSION_STATUS_LABELS = {
    draft: 'Rascunho',
    submitted: 'Aguardando análise',
    changes_requested: 'Ajustes solicitados',
    approved: 'Aprovada',
    rejected: 'Não aprovada',
};

/** Ações disponíveis no estado registrado pelo banco. A RPC confere de novo. */
function availableActions(offer, view) {
    const actions = [];
    const { latest } = view;
    if (view.awaitingReview) actions.push('approve', 'request_changes', 'reject');
    if (['approved', 'active'].includes(offer.status) && latest?.review_status === 'approved' && latest.id !== offer.published_version_id) {
        actions.push('publish');
    }
    if (offer.status === 'active') actions.push('suspend');
    if (offer.status === 'suspended') actions.push('reactivate');
    if (['approved', 'scheduled', 'active', 'suspended'].includes(offer.status)) actions.push('end');
    return actions;
}

function actionConfig(action, { offer, view }) {
    const latest = view.latest;
    const isRevision = offer.status === 'active';
    const future = latest?.starts_at && new Date(latest.starts_at) > new Date();
    switch (action) {
        case 'approve':
            return {
                button: 'Aprovar',
                title: 'Aprovar oferta',
                description: 'Aprovar não publica. Depois da aprovação, use “Publicar” para colocar a oferta no ar ou agendá-la.',
                confirm: 'Aprovar',
                messageMode: 'optional',
                messageLabel: 'Observação para o proprietário',
                run: (message) => offerRpc.approve(offer.id, message),
                done: () => 'Oferta aprovada. Agora ela pode ser publicada.',
            };
        case 'request_changes':
            return {
                button: 'Solicitar ajustes',
                title: 'Solicitar ajustes',
                description:
                    'O proprietário verá esta mensagem e enviará uma nova versão, com novo aceite financeiro. A versão analisada fica preservada.',
                confirm: 'Enviar solicitação',
                messageMode: 'required',
                messageLabel: 'Motivo / instruções',
                messagePlaceholder: 'Ex.: Informe quais produtos participam da promoção.',
                run: (message) => offerRpc.requestChanges(offer.id, message),
                done: () => 'Ajustes solicitados ao proprietário.',
            };
        case 'reject':
            return {
                button: 'Rejeitar',
                title: 'Rejeitar oferta',
                description: isRevision
                    ? 'A alteração não será publicada. A versão atual continua no ar.'
                    : 'A oferta fica no histórico como não aprovada. Para tentar de novo, o negócio precisará criar outra oferta.',
                confirm: 'Rejeitar',
                tone: 'danger',
                messageMode: 'required',
                messageLabel: 'Motivo da não aprovação',
                messageHint: 'O proprietário lê este texto. Explique o que impede a aprovação.',
                run: (message) => offerRpc.reject(offer.id, message),
                done: () => (isRevision ? 'Alteração não aprovada.' : 'Oferta não aprovada.'),
            };
        case 'publish':
            return {
                button: isRevision ? 'Publicar alteração' : future ? 'Agendar publicação' : 'Publicar',
                title: isRevision ? 'Publicar alteração' : 'Publicar oferta',
                description: isRevision
                    ? `A versão ${latest.version_number} substitui a versão publicada. As versões anteriores ficam preservadas.`
                    : future
                      ? `O início é em ${formatOfferDate(latest.starts_at)}: a oferta será agendada e entra no ar nessa data.`
                      : 'A oferta entra no ar agora, se o plano do negócio tiver vaga para mais uma oferta ativa.',
                confirm: isRevision ? 'Publicar alteração' : future ? 'Agendar' : 'Publicar',
                run: () => offerRpc.publish(offer.id),
                done: (status) =>
                    status === 'scheduled'
                        ? `Publicação agendada para ${formatOfferDate(latest.starts_at)}.`
                        : 'Oferta ativa e visível para o público.',
            };
        case 'suspend':
            return {
                button: 'Suspender',
                title: 'Suspender oferta',
                description: 'A oferta sai da vitrine imediatamente. O proprietário verá o motivo. Ela pode ser reativada depois.',
                confirm: 'Suspender',
                tone: 'danger',
                messageMode: 'required',
                messageLabel: 'Motivo da suspensão',
                run: (message) => offerRpc.suspend(offer.id, message),
                done: () => 'Oferta suspensa.',
            };
        case 'reactivate':
            return {
                button: 'Reativar',
                title: 'Reativar oferta',
                description:
                    'A oferta volta ao ar se o período ainda for válido, o negócio estiver publicado e o plano tiver vaga.',
                confirm: 'Reativar',
                messageMode: 'optional',
                messageLabel: 'Observação',
                run: (message) => offerRpc.reactivate(offer.id, message),
                done: () => 'Oferta reativada.',
            };
        case 'end':
            return {
                button: offer.status === 'active' || offer.status === 'suspended' ? 'Encerrar' : 'Cancelar e encerrar',
                title: 'Encerrar oferta',
                description: (
                    <>
                        <strong className="font-semibold">O encerramento é definitivo.</strong> A oferta não volta ao ar; para
                        repetir a promoção, o negócio precisa criar uma nova oferta. O histórico fica preservado.
                    </>
                ),
                confirm: 'Encerrar definitivamente',
                tone: 'danger',
                messageMode: 'optional',
                messageLabel: 'Motivo',
                run: (message) => offerRpc.end(offer.id, message),
                done: () => 'Oferta encerrada.',
            };
        default:
            return null;
    }
}

function person(profiles, id) {
    const profile = profiles[id];
    if (!profile) return id ? 'Conta sem perfil visível' : 'Sistema';
    return [profile.full_name, profile.email].filter(Boolean).join(' · ');
}

function VersionBlock({ version, profiles, title }) {
    return (
        <Card title={title} titleId={`version-${version.id}`}>
            <p className="mt-1 text-xs text-dark-ocean/60">
                {VERSION_STATUS_LABELS[version.review_status]}
                {version.submitted_at && ` · enviada em ${formatOfferDateTime(version.submitted_at)}`}
            </p>
            <div className="mt-3">
                <OfferSummary version={version} />
            </div>
            <div className="mt-4 rounded-2xl bg-sand/70 px-4 py-3 text-sm text-dark-ocean/80">
                {version.financial_accepted_at ? (
                    <>
                        <p>
                            Taxa aceita: <strong className="font-semibold">{formatMoney(version.fee_amount)} por cupom utilizado</strong>
                        </p>
                        <p className="mt-1">
                            Aceite de {person(profiles, version.financial_accepted_by)} em {formatOfferDateTime(version.financial_accepted_at)}
                        </p>
                    </>
                ) : (
                    <p>Sem aceite financeiro nesta versão.</p>
                )}
            </div>
        </Card>
    );
}

function AdminOfertaAnalise() {
    usePageMeta(staticPageMeta('/admin/ofertas'));
    const { offerId } = useParams();
    const { offer, versions, reviews, profiles, loading, error, refetch } = useOfferDetail(offerId, { admin: true });
    const { terms, refetch: refetchTerms } = useOfferTerms(offer?.business_id);
    const [dialog, setDialog] = useState(null);
    const [flash, setFlash] = useState('');

    if (loading && !offer) {
        return (
            <section className="min-h-screen bg-background px-4 pt-32">
                <p role="status" className="container mx-auto max-w-5xl text-sm text-dark-ocean/60">
                    Carregando oferta...
                </p>
            </section>
        );
    }
    if (error || !offer) {
        return (
            <section className="min-h-screen bg-background px-4 pt-32">
                <p role="alert" className="container mx-auto max-w-5xl rounded-3xl bg-red-50 px-5 py-4 text-sm text-red-700">
                    Oferta não encontrada.{' '}
                    <Link to="/admin/ofertas" className="font-semibold underline">
                        Voltar às ofertas
                    </Link>
                </p>
            </section>
        );
    }

    const view = describeOffer(offer, versions);
    const { latest, published } = view;
    const context = { offer, view };
    const actions = availableActions(offer, view);
    const current = dialog ? actionConfig(dialog, context) : null;
    const older = view.versions.filter((version) => version.id !== latest?.id && version.id !== published?.id).reverse();
    const owner = offer.business?.owner_id;

    return (
        <>
            <OfferPageHero
                wide
                crumbs={[
                    { label: 'Admin', to: '/admin' },
                    { label: 'Ofertas', to: '/admin/ofertas' },
                    { label: latest?.title || 'Oferta' },
                ]}
                title={latest?.title || 'Oferta sem título'}
            >
                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <OfferStatusBadge status={offer.status} />
                    {view.revisionStatus && (
                        <span className="rounded-full bg-card/20 px-3 py-1 text-xs font-semibold text-card">
                            {REVISION_STATUS_LABELS[view.revisionStatus]}
                        </span>
                    )}
                    <span className="text-sm text-card/80">{offer.business?.name}</span>
                </div>
            </OfferPageHero>

            <section className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
                <div className="container mx-auto flex max-w-5xl flex-col gap-6">
                    {flash && (
                        <p role="status" className="rounded-2xl bg-turquoise/10 px-4 py-3 text-sm font-semibold text-ocean">
                            {flash}
                        </p>
                    )}

                    <Card title="Ações" titleId="offer-actions">
                        {actions.length === 0 ? (
                            <p className="mt-2 text-sm text-dark-ocean/70">
                                Nenhuma ação disponível para uma oferta “{OFFER_STATUS_LABELS[offer.status]}”
                                {offer.status === 'draft' ? ' — o proprietário ainda não enviou esta oferta.' : '.'}
                            </p>
                        ) : (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {actions.map((action) => {
                                    const config = actionConfig(action, context);
                                    const danger = config.tone === 'danger';
                                    return (
                                        <button
                                            key={action}
                                            type="button"
                                            onClick={() => {
                                                setFlash('');
                                                setDialog(action);
                                            }}
                                            className={`rounded-full px-5 py-2.5 text-sm font-bold ${
                                                danger
                                                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                                    : action === 'approve' || action === 'publish'
                                                      ? 'bg-turquoise text-sand'
                                                      : 'bg-white text-dark-ocean shadow-sm'
                                            }`}
                                        >
                                            {config.button}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        {offer.status === 'scheduled' && (
                            <p className="mt-3 text-sm text-dark-ocean/70">
                                Início previsto para {formatOfferDate(latest?.starts_at)}.
                            </p>
                        )}
                    </Card>

                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                        <div className="flex min-w-0 flex-col gap-6">
                            {latest && (
                                <VersionBlock
                                    version={latest}
                                    profiles={profiles}
                                    title={
                                        view.awaitingReview
                                            ? `Versão em análise (versão ${latest.version_number})`
                                            : published?.id === latest.id
                                              ? `Versão publicada (versão ${latest.version_number})`
                                              : `Versão mais recente (versão ${latest.version_number})`
                                    }
                                />
                            )}
                            {published && published.id !== latest?.id && (
                                <VersionBlock
                                    version={published}
                                    profiles={profiles}
                                    title={`Versão publicada atual (versão ${published.version_number})`}
                                />
                            )}
                            {older.length > 0 && (
                                <Card title="Versões anteriores" titleId="offer-older">
                                    <div className="mt-3 flex flex-col gap-3">
                                        {older.map((version) => (
                                            <details key={version.id} className="rounded-2xl bg-sand/60 px-4 py-3">
                                                <summary className="cursor-pointer text-sm font-semibold text-foreground">
                                                    Versão {version.version_number} · {VERSION_STATUS_LABELS[version.review_status]}
                                                    {version.submitted_at && ` · ${formatOfferDate(version.submitted_at)}`}
                                                </summary>
                                                <div className="mt-2">
                                                    <OfferSummary version={version} />
                                                    {version.financial_accepted_at && (
                                                        <p className="mt-2 text-xs text-dark-ocean/70">
                                                            Taxa aceita: {formatMoney(version.fee_amount)} em{' '}
                                                            {formatOfferDateTime(version.financial_accepted_at)}
                                                        </p>
                                                    )}
                                                </div>
                                            </details>
                                        ))}
                                    </div>
                                </Card>
                            )}
                        </div>

                        <div className="flex min-w-0 flex-col gap-6">
                            <Card title="Negócio" titleId="offer-business">
                                <p className="mt-2 text-sm font-semibold break-words text-foreground">{offer.business?.name}</p>
                                <p className="mt-1 text-sm break-words text-dark-ocean/70">
                                    Proprietário: {owner ? person(profiles, owner) : 'sem proprietário vinculado'}
                                </p>
                                {terms && (
                                    <p className="mt-1 text-sm text-dark-ocean/70">
                                        Plano {terms.plan_name} · {terms.active_offers} de {terms.active_offer_limit} ofertas ativas
                                        {terms.fee_amount ? ` · taxa vigente ${formatMoney(terms.fee_amount)}` : ''}
                                    </p>
                                )}
                                {offer.business?.status && offer.business.status !== 'active' && (
                                    <p className="mt-2 rounded-2xl bg-sun/10 px-3 py-2 text-xs text-dark-ocean">
                                        O negócio não está publicado: aprovação e publicação serão recusadas.
                                    </p>
                                )}
                                {offer.business?.slug && offer.business?.status === 'active' && (
                                    <Link to={`/negocio/${offer.business.slug}`} className="mt-2 inline-block text-sm font-semibold text-ocean underline">
                                        Ver perfil público
                                    </Link>
                                )}
                            </Card>
                            <Card title="Histórico" titleId="offer-history">
                                <div className="mt-3">
                                    <OfferHistory reviews={reviews} versions={versions} actorName={(id) => person(profiles, id)} />
                                </div>
                            </Card>
                        </div>
                    </div>
                </div>
            </section>

            <ActionDialog
                open={Boolean(current)}
                title={current?.title}
                description={current?.description}
                confirmLabel={current?.confirm}
                tone={current?.tone}
                messageMode={current?.messageMode}
                messageLabel={current?.messageLabel}
                messageHint={current?.messageHint}
                messagePlaceholder={current?.messagePlaceholder}
                errorMessage={offerErrorMessage}
                onClose={() => setDialog(null)}
                onConfirm={async (message) => {
                    const result = await current.run(message);
                    if (result.error) {
                        refetch();
                        return result;
                    }
                    setFlash(current.done(result.data));
                    refetch();
                    refetchTerms();
                    return result;
                }}
            />
        </>
    );
}

export default AdminOfertaAnalise;
