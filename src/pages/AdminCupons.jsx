import { useMemo, useState } from 'react';
import { OfferPageHero } from '@/components/offers/OfferParts';
import { validationRpc } from '@/integrations/supabase/couponValidation';
import { useLoader } from '@/hooks/useLoader';
import { usePageMeta } from '@/hooks/usePageMeta';
import { formatCouponDateTime } from '@/lib/coupons';
import { formatMoney } from '@/lib/offers';
import { staticPageMeta } from '@/lib/siteMeta';

const inputClasses =
    'w-full rounded-2xl border border-sand-dark bg-white px-4 py-2.5 text-sm text-dark-ocean focus:border-turquoise focus:outline-none';

/** Dia (YYYY-MM-DD) em Pitimbu → instante de início ou do dia seguinte. */
const dayStart = (day) => (day ? `${day}T00:00:00-03:00` : null);
function nextDayStart(day) {
    if (!day) return null;
    const date = new Date(`${day}T00:00:00-03:00`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString();
}

/** Auditoria das utilizações. Sem fechamento financeiro (Sprint 4). */
function AdminCupons() {
    usePageMeta(staticPageMeta('/admin/cupons'));
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [business, setBusiness] = useState('');
    const { data, loading, error } = useLoader(
        () => validationRpc.usages(null, dayStart(from), nextDayStart(to)),
        `admin-usages:${from}:${to}`
    );
    const usages = useMemo(() => data?.data ?? [], [data]);
    const businesses = useMemo(
        () => [...new Map(usages.map((usage) => [usage.business_id, usage.business_name])).entries()].sort((a, b) => a[1].localeCompare(b[1])),
        [usages]
    );
    const visible = business ? usages.filter((usage) => usage.business_id === business) : usages;
    const total = visible.reduce((sum, usage) => sum + Number(usage.fee_amount), 0);

    return (
        <>
            <OfferPageHero
                wide
                crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Cupons utilizados' }]}
                title="Cupons utilizados"
                subtitle="Utilizações confirmadas e taxas lançadas, para auditoria. Fechamento e cobrança ficam para a próxima etapa."
            />
            <section className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
                <div className="container mx-auto max-w-5xl">
                    <div className="grid gap-3 rounded-3xl bg-card p-5 shadow-sm sm:grid-cols-3">
                        <label className="text-xs font-semibold text-dark-ocean/70">
                            De
                            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={`${inputClasses} mt-1`} />
                        </label>
                        <label className="text-xs font-semibold text-dark-ocean/70">
                            Até
                            <input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className={`${inputClasses} mt-1`} />
                        </label>
                        <label className="text-xs font-semibold text-dark-ocean/70">
                            Negócio
                            <select value={business} onChange={(event) => setBusiness(event.target.value)} className={`${inputClasses} mt-1`}>
                                <option value="">Todos</option>
                                {businesses.map(([id, name]) => (
                                    <option key={id} value={id}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    {loading && !data && <p role="status" className="mt-6 text-sm text-dark-ocean/60">Carregando...</p>}
                    {(error || data?.error) && <p role="alert" className="mt-6 text-sm text-red-600">Não foi possível carregar as utilizações.</p>}
                    <p className="mt-6 text-sm text-foreground">
                        {visible.length} {visible.length === 1 ? 'utilização' : 'utilizações'} · taxas lançadas: <strong>{formatMoney(total)}</strong>
                    </p>
                    <ul className="mt-4 flex flex-col gap-3" aria-label="Utilizações">
                        {visible.map((usage) => (
                            <li key={usage.id} className="rounded-3xl bg-card p-4 text-sm shadow-sm">
                                <div className="flex flex-wrap justify-between gap-2">
                                    <span className="font-semibold break-words">
                                        {usage.business_name} · {usage.offer_title}
                                    </span>
                                    <span>{formatMoney(usage.fee_amount)}</span>
                                </div>
                                <p className="mt-1 text-dark-ocean/70">
                                    <span className="font-mono">{usage.code}</span> · {formatCouponDateTime(usage.used_at)} · versão{' '}
                                    {usage.version_number} · {usage.method === 'qr' ? 'QR Code' : 'código'} · {usage.validator_name}
                                </p>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>
        </>
    );
}

export default AdminCupons;
