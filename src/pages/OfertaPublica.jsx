import { Loader2, Ticket } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { OfferPageHero, OfferSummary } from '@/components/offers/OfferParts';
import { couponRpc, fetchCouponTerms, fetchPublicOffer } from '@/integrations/supabase/coupons';
import { useAuth } from '@/hooks/useAuth';
import { useLoader } from '@/hooks/useLoader';
import { usePageMeta } from '@/hooks/usePageMeta';
import { COUPON_TERMS_CHECKBOX, couponErrorMessage } from '@/lib/coupons';
import { benefitSummary } from '@/lib/offers';

function GenerateBox({ offer, user, myCoupon, termsVersion, refetchMine }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [accepted, setAccepted] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const lock = useRef(false);

    if (!user) {
        return (
            <div className="flex flex-col gap-3">
                <button
                    type="button"
                    onClick={() =>
                        navigate('/entrar', { state: { from: location.pathname, reason: 'Entre para gerar este cupom.' } })
                    }
                    className="flex items-center justify-center gap-2 rounded-full bg-turquoise px-6 py-3 font-bold text-sand"
                >
                    <Ticket size={18} aria-hidden="true" />
                    Gerar meu cupom
                </button>
                <p className="text-sm text-dark-ocean/70">Entre na sua conta para gerar o cupom.</p>
            </div>
        );
    }

    if (myCoupon) {
        return (
            <div className="rounded-2xl bg-turquoise/10 p-4 text-sm text-dark-ocean">
                <p className="font-semibold">Você já tem um cupom disponível desta oferta.</p>
                <Link to={`/meus-cupons/${myCoupon.id}`} className="mt-3 inline-flex rounded-full bg-turquoise px-5 py-2.5 font-bold text-sand">
                    Ver meu cupom
                </Link>
            </div>
        );
    }

    if (!offer.available) {
        return (
            <div className="rounded-2xl bg-sand-dark/70 p-4 text-sm text-dark-ocean">
                <p className="font-semibold">Cupons temporariamente esgotados</p>
                <p className="mt-1">Uma vaga pode voltar quando algum cupom gerado expirar.</p>
            </div>
        );
    }

    const generate = async (event) => {
        event.preventDefault();
        if (lock.current) return;
        if (!accepted) {
            setError('Marque a concordância com o regulamento e as condições para gerar o cupom.');
            return;
        }
        lock.current = true;
        setBusy(true);
        setError('');
        const { data, error: rpcError } = await couponRpc.generate(offer.id, termsVersion);
        lock.current = false;
        setBusy(false);
        if (rpcError) {
            setError(couponErrorMessage(rpcError));
            if (rpcError.message === 'coupon_already_available') refetchMine();
            return;
        }
        navigate(`/meus-cupons/${data.coupon_id}`, { state: { flash: 'Cupom gerado. Apresente-o no estabelecimento antes de concluir a compra.' } });
    };

    return (
        <form onSubmit={generate} noValidate className="flex flex-col gap-4">
            <label className="flex items-start gap-3 text-sm text-foreground">
                <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={accepted}
                    onChange={(event) => {
                        setAccepted(event.target.checked);
                        setError('');
                    }}
                    aria-describedby={error ? 'generate-error' : 'terms-link'}
                    aria-invalid={Boolean(error) && !accepted}
                />
                <span>{COUPON_TERMS_CHECKBOX}</span>
            </label>
            <p id="terms-link" className="text-xs text-dark-ocean/70">
                <Link to={`/regulamento-cupons?versao=${termsVersion}`} className="font-semibold text-ocean underline">
                    Ler o Regulamento de Utilização dos Cupons
                </Link>{' '}
                (versão {termsVersion})
            </p>
            {error && (
                <p id="generate-error" role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </p>
            )}
            <button
                type="submit"
                disabled={busy || !termsVersion}
                aria-busy={busy}
                className="flex items-center justify-center gap-2 rounded-full bg-turquoise px-6 py-3 font-bold text-sand disabled:opacity-70"
            >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Ticket size={18} aria-hidden="true" />}
                {busy ? 'Gerando...' : 'Gerar meu cupom'}
            </button>
            <p className="text-xs text-dark-ocean/70">
                Importante: o benefício somente poderá ser utilizado de acordo com as condições apresentadas nesta oferta.
            </p>
        </form>
    );
}

function OfertaPublica() {
    const { offerId } = useParams();
    const { user, loading: authLoading } = useAuth();
    const offerState = useLoader(() => fetchPublicOffer(offerId), offerId);
    const termsState = useLoader(() => fetchCouponTerms(), 'current-terms');
    const mineKey = user ? `${user.id}:${offerId}` : null;
    const mine = useLoader(couponRpc.mine, mineKey, Boolean(user));
    const offer = offerState.data?.offer ?? null;
    const myCoupon = (mine.data?.data ?? []).find((coupon) => coupon.offer_id === offerId && coupon.status === 'available');

    usePageMeta({
        path: `/ofertas/${offerId}`,
        title: offer ? `${offer.version.title} — Farol Pitimbu` : 'Oferta — Farol Pitimbu',
        description: offer ? `${benefitSummary(offer.version)} em ${offer.business.name}, no Farol Pitimbu.` : 'Ofertas de Pitimbu.',
        noindex: true,
    });

    if (offerState.loading && !offer) {
        return (
            <section className="min-h-screen bg-background px-4 pt-32">
                <p role="status" className="container mx-auto max-w-3xl text-sm text-dark-ocean/60">
                    Carregando oferta...
                </p>
            </section>
        );
    }
    if (!offer) {
        return (
            <section className="min-h-screen bg-background px-4 pt-32">
                <div className="container mx-auto max-w-3xl rounded-3xl bg-card p-6 text-sm text-dark-ocean/80 shadow-sm">
                    <h1 className="font-head text-2xl font-bold text-foreground">Oferta indisponível</h1>
                    <p className="mt-2">Esta oferta não está no ar. Ela pode ter terminado ou ainda não ter começado.</p>
                    <Link to="/explorar" className="mt-4 inline-flex rounded-full bg-turquoise px-5 py-2.5 font-bold text-sand">
                        Explorar Pitimbu
                    </Link>
                </div>
            </section>
        );
    }

    return (
        <>
            <OfferPageHero
                wide
                crumbs={[
                    { label: 'Início', to: '/' },
                    { label: offer.business.name, to: `/negocio/${offer.business.slug}` },
                    { label: 'Oferta' },
                ]}
                title={offer.version.title}
                subtitle={`${benefitSummary(offer.version)} · ${offer.business.name}`}
            />
            <section className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
                <div className="container mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                    <div className="rounded-3xl bg-card p-5 shadow-sm sm:p-6">
                        <h2 className="font-head text-lg font-bold text-foreground">Condições da oferta</h2>
                        <div className="mt-3">
                            <OfferSummary version={offer.version} />
                        </div>
                        <p className="mt-4 text-sm text-dark-ocean/70">
                            Oferecida por{' '}
                            <Link to={`/negocio/${offer.business.slug}`} className="font-semibold text-ocean underline">
                                {offer.business.name}
                            </Link>
                            , responsável pelo benefício e pelas condições comerciais.
                        </p>
                    </div>
                    <aside className="flex flex-col gap-4 rounded-3xl bg-card p-5 shadow-sm sm:p-6 lg:sticky lg:top-24 lg:h-fit">
                        <h2 className="font-head text-lg font-bold text-foreground">Seu cupom</h2>
                        {authLoading || (user && mine.loading && !mine.data) ? (
                            <p role="status" className="text-sm text-dark-ocean/60">
                                Carregando...
                            </p>
                        ) : (
                            <GenerateBox
                                offer={offer}
                                user={user}
                                myCoupon={myCoupon}
                                termsVersion={termsState.data?.terms?.version}
                                refetchMine={mine.refetch}
                            />
                        )}
                    </aside>
                </div>
            </section>
        </>
    );
}

export default OfertaPublica;
