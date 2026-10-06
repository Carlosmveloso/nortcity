import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { CouponQrCode, CouponStatusBadge } from '@/components/coupons/CouponParts';
import { OfferPageHero, OfferSummary } from '@/components/offers/OfferParts';
import { couponRpc } from '@/integrations/supabase/coupons';
import { useLoader } from '@/hooks/useLoader';
import { usePageMeta } from '@/hooks/usePageMeta';
import { couponDisplayStatus, couponErrorMessage, couponQrPayload, formatCouponDateTime } from '@/lib/coupons';
import { benefitSummary } from '@/lib/offers';
import { staticPageMeta } from '@/lib/siteMeta';

/** Rerenderiza quando o cupom vence com a tela aberta. */
function useExpiryTick(expiresAt) {
    const [, setTick] = useState(0);
    useEffect(() => {
        if (!expiresAt) return undefined;
        const ms = new Date(expiresAt).getTime() - Date.now();
        if (ms <= 0 || ms > 2_147_000_000) return undefined;
        const timer = setTimeout(() => setTick((value) => value + 1), ms + 500);
        return () => clearTimeout(timer);
    }, [expiresAt]);
}

function CupomDetalhe() {
    usePageMeta(staticPageMeta('/meus-cupons'));
    const { couponId } = useParams();
    const location = useLocation();
    const couponState = useLoader(() => couponRpc.one(couponId), couponId);
    const coupon = couponState.data?.data ?? null;
    const rpcError = couponState.error ?? couponState.data?.error;
    useExpiryTick(coupon?.status === 'available' ? coupon.expires_at : null);
    const status = coupon ? couponDisplayStatus(coupon) : null;
    const tokenState = useLoader(() => couponRpc.qrToken(couponId), `qr:${couponId}`, status === 'available');
    const token = status === 'available' ? tokenState.data?.data : null;

    if (couponState.loading && !coupon) {
        return (
            <section className="min-h-screen bg-background px-4 pt-32">
                <p role="status" className="container mx-auto max-w-3xl text-sm text-dark-ocean/60">
                    Carregando cupom...
                </p>
            </section>
        );
    }
    if (rpcError || !coupon) {
        return (
            <section className="min-h-screen bg-background px-4 pt-32">
                <p role="alert" className="container mx-auto max-w-3xl rounded-3xl bg-red-50 px-5 py-4 text-sm text-red-700">
                    {couponErrorMessage(rpcError ?? { message: 'coupon_not_found' })}{' '}
                    <Link to="/meus-cupons" className="font-semibold underline">
                        Ver meus cupons
                    </Link>
                </p>
            </section>
        );
    }

    const version = coupon.version;
    const valid = status === 'available';

    return (
        <>
            <OfferPageHero
                crumbs={[{ label: 'Início', to: '/' }, { label: 'Meus cupons', to: '/meus-cupons' }, { label: coupon.code }]}
                title={benefitSummary(version)}
                subtitle={`${version.title} · ${coupon.business.name}`}
            />
            <section className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
                <div className="container mx-auto flex max-w-3xl flex-col gap-6">
                    {location.state?.flash && (
                        <p role="status" className="rounded-2xl bg-turquoise/10 px-4 py-3 text-sm font-semibold text-ocean">
                            {location.state.flash}
                        </p>
                    )}

                    <section
                        aria-labelledby="coupon-title"
                        className={`flex flex-col items-center gap-4 rounded-3xl p-6 text-center shadow-sm ${valid ? 'bg-card' : 'bg-sand-dark/60'}`}
                    >
                        <h2 id="coupon-title" className="sr-only">
                            Cupom {coupon.code}
                        </h2>
                        <CouponStatusBadge status={status} />
                        <p className="text-xs font-semibold tracking-widest text-dark-ocean/60 uppercase">Código do cupom</p>
                        <p
                            className={`font-mono text-3xl font-extrabold tracking-wider break-all sm:text-4xl ${valid ? 'text-foreground' : 'text-dark-ocean/50 line-through'}`}
                        >
                            {coupon.code}
                        </p>
                        {valid && token && (
                            <CouponQrCode
                                value={couponQrPayload(token)}
                                label={`QR Code do cupom ${coupon.code}, para apresentar em ${coupon.business.name}`}
                            />
                        )}
                        {valid && tokenState.loading && !token && (
                            <p role="status" className="text-sm text-dark-ocean/60">
                                Carregando QR Code...
                            </p>
                        )}
                        {valid ? (
                            <>
                                <p className="text-base font-semibold text-foreground">
                                    Válido até {formatCouponDateTime(coupon.expires_at)}
                                </p>
                                <p className="max-w-md text-sm text-dark-ocean/80">
                                    Apresente este cupom no estabelecimento antes de concluir a compra.
                                </p>
                            </>
                        ) : status === 'expired' ? (
                            <p className="max-w-md text-sm text-dark-ocean/80">
                                Este cupom expirou em {formatCouponDateTime(coupon.expires_at)} e não pode mais ser utilizado.
                            </p>
                        ) : (
                            <p className="max-w-md text-sm text-dark-ocean/80">
                                Este cupom foi cancelado em {formatCouponDateTime(coupon.canceled_at)} e não pode ser utilizado.
                                {coupon.cancel_reason && <> Motivo: {coupon.cancel_reason}</>}
                            </p>
                        )}
                        {!valid && (
                            <Link to={`/ofertas/${coupon.offer_id}`} className="text-sm font-semibold text-ocean underline">
                                Ver a oferta
                            </Link>
                        )}
                    </section>

                    <section aria-labelledby="coupon-conditions" className="rounded-3xl bg-card p-5 shadow-sm sm:p-6">
                        <h2 id="coupon-conditions" className="font-head text-lg font-bold text-foreground">
                            Condições aceitas
                        </h2>
                        <p className="mt-1 text-xs text-dark-ocean/60">
                            Versão {version.version_number} da oferta, vigente quando o cupom foi gerado em{' '}
                            {formatCouponDateTime(coupon.generated_at)}.
                        </p>
                        <div className="mt-3">
                            <OfferSummary version={version} />
                        </div>
                        <p className="mt-4 text-sm text-dark-ocean/70">
                            Estabelecimento:{' '}
                            <Link to={`/negocio/${coupon.business.slug}`} className="font-semibold text-ocean underline">
                                {coupon.business.name}
                            </Link>
                        </p>
                        <p className="mt-1 text-sm text-dark-ocean/70">
                            Regulamento aceito:{' '}
                            <Link to={`/regulamento-cupons?versao=${coupon.terms_version}`} className="font-semibold text-ocean underline">
                                versão {coupon.terms_version}
                            </Link>
                            , em {formatCouponDateTime(coupon.terms_accepted_at)}.
                        </p>
                    </section>
                </div>
            </section>
        </>
    );
}

export default CupomDetalhe;
