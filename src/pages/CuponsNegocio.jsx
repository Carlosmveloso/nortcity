import { Loader2, ScanLine } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, OfferPageHero } from '@/components/offers/OfferParts';
import ActionDialog from '@/components/ui/ActionDialog';
import { validationRpc } from '@/integrations/supabase/couponValidation';
import { useLoader } from '@/hooks/useLoader';
import { useMyBusiness } from '@/hooks/useMyBusiness';
import { usePageMeta } from '@/hooks/usePageMeta';
import { formatCouponDateTime } from '@/lib/coupons';
import { validationErrorMessage } from '@/lib/couponValidation';
import { formatMoney } from '@/lib/offers';
import { staticPageMeta } from '@/lib/siteMeta';

function Validators({ businessId }) {
    const { data, error, refetch } = useLoader(() => validationRpc.listValidators(businessId), `validators:${businessId}`);
    const validators = data?.data ?? [];
    const [email, setEmail] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ kind: '', text: '' });
    const [removing, setRemoving] = useState(null);

    const add = async (event) => {
        event.preventDefault();
        if (saving) return;
        if (!/^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/.test(email.trim())) {
            setMessage({ kind: 'error', text: 'Informe um e-mail válido.' });
            return;
        }
        setSaving(true);
        setMessage({ kind: '', text: '' });
        const { error: rpcError } = await validationRpc.addValidator(businessId, email.trim());
        setSaving(false);
        if (rpcError) {
            setMessage({ kind: 'error', text: validationErrorMessage(rpcError) });
            return;
        }
        setEmail('');
        setMessage({ kind: 'ok', text: 'Validador cadastrado.' });
        refetch();
    };

    const active = validators.filter((item) => item.active);
    const inactive = validators.filter((item) => !item.active);

    return (
        <Card title="Validadores" titleId="validators-title">
            <p className="mt-1 text-sm text-dark-ocean/70">
                Você já valida os cupons do seu negócio. Cadastre aqui quem mais pode confirmar utilizações no balcão. A
                pessoa precisa ter uma conta no Farol Pitimbu.
            </p>
            {(error || data?.error) && <p role="alert" className="mt-3 text-sm text-red-600">Não foi possível carregar os validadores.</p>}
            <ul className="mt-4 flex flex-col gap-2" aria-label="Validadores ativos">
                {active.length === 0 && <li className="text-sm text-dark-ocean/60">Nenhum validador cadastrado.</li>}
                {active.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-sand/60 px-4 py-3">
                        <span className="min-w-0 text-sm break-words">
                            <strong className="font-semibold">{item.full_name || item.email}</strong>
                            {item.full_name && <span className="text-dark-ocean/70"> · {item.email}</span>}
                            <span className="block text-xs text-dark-ocean/60">Desde {formatCouponDateTime(item.added_at)}</span>
                        </span>
                        <button
                            type="button"
                            onClick={() => setRemoving(item)}
                            className="rounded-full bg-red-100 px-4 py-2 text-sm font-semibold text-red-700"
                        >
                            Desativar<span className="sr-only"> {item.email}</span>
                        </button>
                    </li>
                ))}
            </ul>
            <form onSubmit={add} noValidate className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="flex-1 text-sm font-semibold text-foreground">
                    E-mail da conta
                    <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        autoComplete="off"
                        aria-invalid={message.kind === 'error'}
                        aria-describedby={message.text ? 'validator-message' : undefined}
                        className="mt-1 w-full rounded-2xl border border-sand-dark bg-white px-4 py-3 font-normal text-dark-ocean focus:border-turquoise focus:outline-none"
                    />
                </label>
                <button
                    type="submit"
                    disabled={saving}
                    aria-busy={saving}
                    className="flex items-center justify-center gap-2 rounded-full bg-turquoise px-5 py-3 text-sm font-bold text-sand disabled:opacity-60"
                >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    Cadastrar validador
                </button>
            </form>
            <div aria-live="polite">
                {message.text && (
                    <p id="validator-message" className={`mt-2 text-sm ${message.kind === 'error' ? 'text-red-600' : 'font-semibold text-ocean'}`}>
                        {message.text}
                    </p>
                )}
            </div>
            {inactive.length > 0 && (
                <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-semibold text-dark-ocean/80">Desativados ({inactive.length})</summary>
                    <ul className="mt-2 flex flex-col gap-1 text-sm text-dark-ocean/70">
                        {inactive.map((item) => (
                            <li key={item.id}>
                                {item.email} · desativado em {formatCouponDateTime(item.deactivated_at)}
                            </li>
                        ))}
                    </ul>
                </details>
            )}
            <ActionDialog
                open={Boolean(removing)}
                title="Desativar validador"
                description={removing ? `${removing.email} deixará de confirmar cupons do seu negócio. O histórico das validações já feitas continua guardado.` : null}
                confirmLabel="Desativar"
                tone="danger"
                errorMessage={validationErrorMessage}
                onClose={() => setRemoving(null)}
                onConfirm={async () => {
                    const response = await validationRpc.deactivateValidator(removing.id);
                    if (!response.error) refetch();
                    return response;
                }}
            />
        </Card>
    );
}

function Usages({ businessId }) {
    const { data, loading, error } = useLoader(() => validationRpc.usages(businessId), `usages:${businessId}`);
    const usages = data?.data ?? [];
    const total = usages.reduce((sum, usage) => sum + Number(usage.fee_amount), 0);
    return (
        <Card title="Cupons utilizados" titleId="usages-title">
            <p className="mt-1 text-sm text-dark-ocean/70">
                Cada utilização registra a taxa aceita na versão da oferta. Fechamento e cobrança ainda não estão
                disponíveis.
            </p>
            {loading && !data && <p role="status" className="mt-3 text-sm text-dark-ocean/60">Carregando...</p>}
            {(error || data?.error) && <p role="alert" className="mt-3 text-sm text-red-600">Não foi possível carregar as utilizações.</p>}
            {data && usages.length === 0 && <p className="mt-3 text-sm text-dark-ocean/60">Nenhum cupom utilizado ainda.</p>}
            {usages.length > 0 && (
                <>
                    <p className="mt-3 text-sm text-foreground">
                        {usages.length} {usages.length === 1 ? 'utilização' : 'utilizações'} · taxas lançadas: <strong>{formatMoney(total)}</strong>
                    </p>
                    <ul className="mt-3 flex flex-col gap-2" aria-label="Utilizações">
                        {usages.map((usage) => (
                            <li key={usage.id} className="rounded-2xl bg-sand/60 px-4 py-3 text-sm">
                                <div className="flex flex-wrap justify-between gap-2">
                                    <span className="font-semibold break-words">{usage.offer_title}</span>
                                    <span>{formatMoney(usage.fee_amount)}</span>
                                </div>
                                <p className="text-dark-ocean/70">
                                    <span className="font-mono">{usage.code}</span> · {formatCouponDateTime(usage.used_at)} ·{' '}
                                    {usage.method === 'qr' ? 'QR Code' : 'código'} · {usage.validator_name}
                                </p>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </Card>
    );
}

function CuponsNegocio() {
    usePageMeta(staticPageMeta('/meu-negocio/cupons'));
    const { business, loading } = useMyBusiness();
    return (
        <>
            <OfferPageHero
                crumbs={[{ label: 'Meu Negócio', to: '/meu-negocio' }, { label: 'Cupons' }]}
                title="Cupons do negócio"
                subtitle="Valide cupons no balcão, cadastre validadores e acompanhe as utilizações."
            >
                {business && (
                    <Link
                        to="/validar"
                        className="mt-6 inline-flex items-center gap-2 rounded-full bg-card px-5 py-2.5 text-sm font-bold text-dark-ocean"
                    >
                        <ScanLine size={16} aria-hidden="true" />
                        Validar cupom
                    </Link>
                )}
            </OfferPageHero>
            <section className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
                <div className="container mx-auto flex max-w-3xl flex-col gap-6">
                    {loading && <p role="status" className="text-sm text-dark-ocean/60">Carregando...</p>}
                    {!loading && !business && (
                        <p className="rounded-3xl bg-card p-6 text-sm text-dark-ocean/80 shadow-sm">
                            Esta área é do proprietário de um negócio cadastrado.{' '}
                            <Link to="/cadastrar-negocio" className="font-semibold text-ocean underline">
                                Cadastrar negócio
                            </Link>
                        </p>
                    )}
                    {business && (
                        <>
                            <Validators businessId={business.id} />
                            <Usages businessId={business.id} />
                        </>
                    )}
                </div>
            </section>
        </>
    );
}

export default CuponsNegocio;
