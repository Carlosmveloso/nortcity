import { Ticket } from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';
import { CouponStatusBadge } from '@/components/coupons/CouponParts';
import { OfferPageHero } from '@/components/offers/OfferParts';
import { couponRpc } from '@/integrations/supabase/coupons';
import { useAuth } from '@/hooks/useAuth';
import { useLoader } from '@/hooks/useLoader';
import { usePageMeta } from '@/hooks/usePageMeta';
import { COUPON_FILTERS, couponDisplayStatus, couponErrorMessage, formatCouponDateTime } from '@/lib/coupons';
import { benefitSummary } from '@/lib/offers';
import { staticPageMeta } from '@/lib/siteMeta';

function MeusCupons() {
    usePageMeta(staticPageMeta('/meus-cupons'));
    const { user } = useAuth();
    const { data, loading, error, refetch } = useLoader(couponRpc.mine, user?.id ?? 'anon', Boolean(user));
    const [searchParams, setSearchParams] = useSearchParams();
    const filter = COUPON_FILTERS.some((item) => item.value === searchParams.get('situacao')) ? searchParams.get('situacao') : 'available';
    const coupons = (data?.data ?? []).map((coupon) => ({ ...coupon, status: couponDisplayStatus(coupon) }));
    const visible = coupons.filter((coupon) => coupon.status === filter);
    const rpcError = error ?? data?.error;

    return (
        <>
            <OfferPageHero
                crumbs={[{ label: 'Início', to: '/' }, { label: 'Meus cupons' }]}
                title="Meus cupons"
                subtitle="Seus cupons gerados nas ofertas do Farol Pitimbu."
            />
            <section className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
                <div className="container mx-auto flex max-w-3xl flex-col gap-6">
                    <div role="group" aria-label="Filtrar cupons por situação" className="flex flex-wrap gap-2">
                        {COUPON_FILTERS.map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                aria-pressed={filter === item.value}
                                onClick={() => setSearchParams({ situacao: item.value }, { replace: true })}
                                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                                    filter === item.value ? 'bg-turquoise text-sand' : 'bg-white text-dark-ocean shadow-sm'
                                }`}
                            >
                                {item.label}{' '}
                                <span className="opacity-70">({coupons.filter((coupon) => coupon.status === item.value).length})</span>
                            </button>
                        ))}
                    </div>

                    {loading && !data && (
                        <p role="status" className="text-sm text-dark-ocean/60">
                            Carregando cupons...
                        </p>
                    )}
                    {rpcError && (
                        <p role="alert" className="rounded-3xl bg-red-50 px-5 py-4 text-sm text-red-700">
                            {couponErrorMessage(rpcError)}{' '}
                            <button type="button" onClick={refetch} className="font-semibold underline">
                                Tentar novamente
                            </button>
                        </p>
                    )}

                    {data && !rpcError && coupons.length === 0 && (
                        <div className="rounded-3xl border border-dashed border-dark-ocean/20 p-10 text-center">
                            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-turquoise/10 text-turquoise">
                                <Ticket size={26} aria-hidden="true" />
                            </span>
                            <h2 className="mt-4 font-head text-xl font-bold text-foreground">Você ainda não gerou cupons</h2>
                            <p className="mx-auto mt-2 max-w-md text-sm text-dark-ocean/70">
                                As ofertas aparecem no perfil dos negócios participantes.
                            </p>
                            <Link to="/explorar" className="mt-6 inline-flex rounded-full bg-turquoise px-6 py-3 font-bold text-sand">
                                Explorar negócios
                            </Link>
                        </div>
                    )}
                    {coupons.length > 0 && visible.length === 0 && (
                        <p className="text-sm text-dark-ocean/60">Nenhum cupom nesta situação.</p>
                    )}

                    <ul className="flex flex-col gap-4" aria-label="Cupons">
                        {visible.map((coupon) => (
                            <li key={coupon.id} className="rounded-3xl bg-card p-5 shadow-sm">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-ocean">{benefitSummary(coupon.version)}</p>
                                        <h2 className="font-head text-lg font-bold break-words text-foreground">{coupon.version.title}</h2>
                                        <p className="text-sm text-dark-ocean/70">{coupon.business.name}</p>
                                    </div>
                                    <CouponStatusBadge status={coupon.status} />
                                </div>
                                <p className="mt-2 text-sm text-dark-ocean/80">
                                    {coupon.status === 'available'
                                        ? `Válido até ${formatCouponDateTime(coupon.expires_at)}`
                                        : coupon.status === 'expired'
                                          ? `Expirou em ${formatCouponDateTime(coupon.expires_at)}`
                                          : `Cancelado em ${formatCouponDateTime(coupon.canceled_at)}`}
                                </p>
                                <Link
                                    to={`/meus-cupons/${coupon.id}`}
                                    className="mt-4 inline-flex rounded-full bg-turquoise px-5 py-2.5 text-sm font-bold text-sand"
                                >
                                    Ver cupom<span className="sr-only"> {coupon.code}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>
        </>
    );
}

export default MeusCupons;
