import { AlertTriangle, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Card, OfferHistory, OfferPageHero, OfferStatusBadge, OfferSummary } from '@/components/offers/OfferParts';
import { offerRpc } from '@/integrations/supabase/offers';
import { useOfferDetail } from '@/hooks/useOffers';
import { usePageMeta } from '@/hooks/usePageMeta';
import { offerErrorMessage } from '@/lib/offerErrors';
import {
    REVISION_STATUS_LABELS,
    describeOffer,
    formatMoney,
    formatOfferDate,
    formatOfferDateTime,
    latestAdminMessage,
} from '@/lib/offers';
import { staticPageMeta } from '@/lib/siteMeta';

const EXPLANATION = {
    draft: 'Rascunho salvo. Complete os quatro passos e aceite as condições comerciais para enviar à análise.',
    pending_review: 'A equipe do Farol está analisando esta versão. Enquanto isso, ela não pode ser alterada.',
    changes_requested:
        'A equipe pediu ajustes. A versão analisada fica preservada; suas correções viram uma nova versão, com novo aceite.',
    approved: 'Oferta aprovada. Ela entra no ar quando a equipe do Farol publicar.',
    scheduled: 'Publicação agendada para a data de início. A equipe do Farol acompanha a entrada no ar.',
    active: 'Oferta no ar para quem usa o Farol Pitimbu.',
    suspended: 'Oferta suspensa pela equipe do Farol. Ela não aparece para o público enquanto estiver suspensa.',
    rejected: 'Esta oferta não foi aprovada. Para tentar de novo, crie uma nova oferta considerando o motivo informado.',
    ended: 'Oferta encerrada. Para repetir a promoção, crie uma nova oferta.',
};

const MESSAGE_FOR_STATUS = {
    changes_requested: ['changes_requested'],
    rejected: ['rejected'],
    suspended: ['suspended'],
};

function FinancialNote({ version }) {
    if (!version?.financial_accepted_at) return null;
    return (
        <p className="mt-4 rounded-2xl bg-sand/70 px-4 py-3 text-sm text-dark-ocean/80">
            Taxa aceita: <strong className="font-semibold">{formatMoney(version.fee_amount)} por cupom utilizado</strong>, em{' '}
            {formatOfferDateTime(version.financial_accepted_at)}.
        </p>
    );
}

function OfertaDetalhe() {
    usePageMeta(staticPageMeta('/meu-negocio/ofertas'));
    const { offerId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { offer, versions, reviews, loading, error, refetch } = useOfferDetail(offerId);
    const [actionError, setActionError] = useState('');
    const [creating, setCreating] = useState(false);
    const busy = useRef(false);
    const flash = location.state?.flash;

    if (loading && !offer) {
        return (
            <section className="min-h-screen bg-background px-4 pt-32">
                <p role="status" className="container mx-auto max-w-3xl text-sm text-dark-ocean/60">
                    Carregando oferta...
                </p>
            </section>
        );
    }

    if (error || !offer) {
        return (
            <section className="min-h-screen bg-background px-4 pt-32">
                <div role="alert" className="container mx-auto max-w-3xl rounded-3xl bg-red-50 px-5 py-4 text-sm text-red-700">
                    Oferta não encontrada.{' '}
                    <Link to="/meu-negocio/ofertas" className="font-semibold underline">
                        Voltar às ofertas
                    </Link>
                </div>
            </section>
        );
    }

    const view = describeOffer(offer, versions);
    const { latest, published, display } = view;
    const status = offer.status;
    const messageActions = MESSAGE_FOR_STATUS[status] ?? (view.revisionStatus === 'changes_requested' || view.revisionStatus === 'rejected'
        ? [view.revisionStatus]
        : null);
    const adminMessage = messageActions ? latestAdminMessage(reviews, messageActions) : null;

    const canEditDraft = status === 'draft' && latest?.review_status === 'draft';
    const canFix =
        (status === 'changes_requested' || (status === 'active' && view.revisionStatus))
        && ['changes_requested', 'draft'].includes(latest?.review_status);
    const canRevise = status === 'active' && ['approved', 'rejected'].includes(latest?.review_status);

    const createRevision = async () => {
        if (busy.current) return;
        busy.current = true;
        setCreating(true);
        setActionError('');
        const { error: rpcError } = await offerRpc.createRevision(offer.id);
        busy.current = false;
        setCreating(false);
        if (rpcError) {
            setActionError(offerErrorMessage(rpcError));
            refetch();
            return;
        }
        navigate(`/meu-negocio/ofertas/${offer.id}/editar`);
    };

    return (
        <>
            <OfferPageHero
                crumbs={[
                    { label: 'Meu Negócio', to: '/meu-negocio' },
                    { label: 'Ofertas', to: '/meu-negocio/ofertas' },
                    { label: display?.title || 'Oferta' },
                ]}
                title={display?.title || 'Oferta sem título'}
            >
                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <OfferStatusBadge status={status} />
                    <span className="text-sm text-card/80">
                        Versão {latest?.version_number} · criada em {formatOfferDate(offer.created_at)}
                    </span>
                </div>
            </OfferPageHero>

            <section className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
                <div className="container mx-auto flex max-w-3xl flex-col gap-6">
                    {flash && (
                        <p role="status" className="rounded-2xl bg-turquoise/10 px-4 py-3 text-sm font-semibold text-ocean">
                            {flash}
                        </p>
                    )}

                    <Card>
                        <p className="text-sm text-dark-ocean/80">{EXPLANATION[status]}</p>
                        {status === 'scheduled' && display?.starts_at && (
                            <p className="mt-2 text-sm font-semibold text-foreground">
                                Início previsto: {formatOfferDate(display.starts_at)}
                            </p>
                        )}
                        {view.revisionStatus && (
                            <p className="mt-2 text-sm font-semibold text-ocean">
                                {REVISION_STATUS_LABELS[view.revisionStatus]} (versão {latest.version_number}). A versão{' '}
                                {published.version_number} continua no ar.
                            </p>
                        )}
                        {adminMessage && (
                            <div className="mt-4 flex gap-3 rounded-2xl border border-sun/40 bg-sun/10 p-4">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-dark-ocean" aria-hidden="true" />
                                <div className="text-sm text-dark-ocean">
                                    <p className="font-semibold">Mensagem da equipe do Farol</p>
                                    <p className="mt-1 whitespace-pre-line">{adminMessage.message}</p>
                                </div>
                            </div>
                        )}

                        <div className="mt-5 flex flex-wrap gap-3">
                            {canEditDraft && (
                                <Link
                                    to={`/meu-negocio/ofertas/${offer.id}/editar`}
                                    className="rounded-full bg-turquoise px-5 py-2.5 text-sm font-bold text-sand"
                                >
                                    Continuar edição
                                </Link>
                            )}
                            {canFix && (
                                <Link
                                    to={`/meu-negocio/ofertas/${offer.id}/editar`}
                                    className="rounded-full bg-turquoise px-5 py-2.5 text-sm font-bold text-sand"
                                >
                                    {latest.review_status === 'draft'
                                        ? status === 'active'
                                            ? 'Continuar alteração'
                                            : 'Continuar correção'
                                        : 'Corrigir e criar nova versão'}
                                </Link>
                            )}
                            {canRevise && (
                                <button
                                    type="button"
                                    onClick={createRevision}
                                    disabled={creating}
                                    aria-busy={creating}
                                    className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-dark-ocean shadow-sm disabled:opacity-60"
                                >
                                    {creating && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                                    Propor alteração
                                </button>
                            )}
                        </div>
                        {canRevise && (
                            <p className="mt-2 text-xs text-dark-ocean/60">
                                A alteração vira uma nova versão. A versão atual continua no ar até a nova ser aprovada e
                                publicada.
                            </p>
                        )}
                        {actionError && (
                            <p role="alert" className="mt-3 text-sm text-red-600">
                                {actionError}
                            </p>
                        )}
                    </Card>

                    <Card title={published ? `Versão publicada (versão ${published.version_number})` : `Versão ${latest?.version_number}`} titleId="offer-version">
                        <div className="mt-3">
                            <OfferSummary version={display} />
                        </div>
                        <FinancialNote version={display} />
                    </Card>

                    {view.revisionStatus && latest && (
                        <Card title={`Alteração proposta (versão ${latest.version_number})`} titleId="offer-revision">
                            <p className="mt-1 text-sm text-dark-ocean/70">{REVISION_STATUS_LABELS[view.revisionStatus]}</p>
                            <div className="mt-3">
                                <OfferSummary version={latest} />
                            </div>
                            <FinancialNote version={latest} />
                        </Card>
                    )}

                    <Card title="Histórico" titleId="offer-history">
                        <div className="mt-3">
                            <OfferHistory reviews={reviews} versions={versions} />
                        </div>
                    </Card>
                </div>
            </section>
        </>
    );
}

export default OfertaDetalhe;
