import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import QrScanner from '@/components/coupons/QrScanner';
import { OfferPageHero, OfferSummary } from '@/components/offers/OfferParts';
import ActionDialog from '@/components/ui/ActionDialog';
import { validationRpc } from '@/integrations/supabase/couponValidation';
import { useAuth } from '@/hooks/useAuth';
import { useLoader } from '@/hooks/useLoader';
import { usePageMeta } from '@/hooks/usePageMeta';
import { formatCouponDateTime } from '@/lib/coupons';
import { VERIFY_REASONS, readCouponInput, validationErrorMessage } from '@/lib/couponValidation';
import { benefitSummary } from '@/lib/offers';
import { staticPageMeta } from '@/lib/siteMeta';

const inputClasses =
    'w-full rounded-2xl border border-sand-dark bg-white px-4 py-3 font-mono text-lg tracking-wider text-dark-ocean uppercase focus:border-turquoise focus:outline-none focus-visible:ring-2 focus-visible:ring-turquoise/40';

function VerifyResult({ result, onConfirm }) {
    const { coupon, version } = result;
    return (
        <section
            aria-labelledby="verify-title"
            className={`rounded-3xl p-5 shadow-sm sm:p-6 ${result.valid ? 'border-2 border-turquoise bg-card' : 'border-2 border-red-300 bg-red-50'}`}
        >
            <div className="flex items-start gap-3">
                {result.valid ? (
                    <CheckCircle2 className="h-7 w-7 shrink-0 text-ocean" aria-hidden="true" />
                ) : (
                    <XCircle className="h-7 w-7 shrink-0 text-red-700" aria-hidden="true" />
                )}
                <div className="min-w-0">
                    <h2 id="verify-title" className="font-head text-xl font-bold text-foreground">
                        {result.valid ? 'Cupom válido' : 'Cupom não pode ser utilizado'}
                    </h2>
                    <p className="font-mono text-lg font-bold tracking-wider">{coupon.code}</p>
                    {!result.valid && <p className="mt-1 text-sm font-semibold text-red-700">{VERIFY_REASONS[result.reason]}</p>}
                    {result.reason === 'coupon_already_used' && result.usage && (
                        <p className="mt-1 text-sm text-red-700">
                            Utilizado em {formatCouponDateTime(result.usage.used_at)}
                            {result.usage.validator_name ? `, confirmado por ${result.usage.validator_name}` : ''}.
                        </p>
                    )}
                </div>
            </div>
            <div className="mt-4 rounded-2xl bg-turquoise/10 px-4 py-3">
                <p className="text-lg font-extrabold text-ocean">{benefitSummary(version)}</p>
                <p className="text-sm font-semibold text-foreground">{version.title}</p>
                {coupon.status === 'available' && (
                    <p className="mt-1 text-sm text-dark-ocean/80">Válido até {formatCouponDateTime(coupon.expires_at)}</p>
                )}
            </div>
            <details className="mt-4" open={result.valid}>
                <summary className="cursor-pointer text-sm font-semibold text-foreground">
                    Condições aceitas pelo cliente (versão {version.version_number})
                </summary>
                <div className="mt-2">
                    <OfferSummary version={version} />
                </div>
            </details>
            {result.valid && (
                <button
                    type="button"
                    onClick={onConfirm}
                    className="mt-5 w-full rounded-full bg-turquoise px-6 py-3.5 text-base font-bold text-sand sm:w-auto"
                >
                    Confirmar utilização
                </button>
            )}
        </section>
    );
}

function ValidarCupons() {
    usePageMeta(staticPageMeta('/validar'));
    const { user } = useAuth();
    const businessesState = useLoader(validationRpc.myBusinesses, user?.id ?? 'anon', Boolean(user));
    const businesses = businessesState.data?.data ?? [];
    const [chosen, setChosen] = useState('');
    const businessId = chosen || businesses[0]?.id || '';
    const [input, setInput] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [done, setDone] = useState(null);
    const parsed = readCouponInput(input);

    const reset = () => {
        setInput('');
        setResult(null);
        setError('');
        setDone(null);
    };

    const verify = async (value = input) => {
        if (verifying) return;
        setError('');
        setResult(null);
        setDone(null);
        if (!readCouponInput(value)) {
            setError('Digite o código do cupom (FP- e 6 caracteres) ou leia o QR Code.');
            return;
        }
        setVerifying(true);
        const { data, error: rpcError } = await validationRpc.verify(businessId, value);
        setVerifying(false);
        if (rpcError) {
            setError(validationErrorMessage(rpcError));
            return;
        }
        setResult({ ...data, input: value });
    };

    if (businessesState.loading && !businessesState.data) {
        return (
            <section className="min-h-screen bg-background px-4 pt-32">
                <p role="status" className="container mx-auto max-w-3xl text-sm text-dark-ocean/60">
                    Carregando...
                </p>
            </section>
        );
    }

    return (
        <>
            <OfferPageHero
                crumbs={[{ label: 'Início', to: '/' }, { label: 'Validar cupons' }]}
                title="Validar cupons"
                subtitle="Confira o cupom apresentado pelo cliente antes de concluir a compra."
            />
            <section className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
                <div className="container mx-auto flex max-w-3xl flex-col gap-6">
                    {businesses.length === 0 ? (
                        <div className="rounded-3xl bg-card p-6 text-sm text-dark-ocean/80 shadow-sm">
                            <ShieldCheck className="h-8 w-8 text-turquoise" aria-hidden="true" />
                            <h2 className="mt-3 font-head text-xl font-bold text-foreground">Sua conta não valida cupons</h2>
                            <p className="mt-2">
                                A validação é feita pelo proprietário do estabelecimento ou por pessoas cadastradas por ele
                                como validadoras.
                            </p>
                            <Link to="/meus-cupons" className="mt-4 inline-flex rounded-full bg-turquoise px-5 py-2.5 font-bold text-sand">
                                Ver meus cupons
                            </Link>
                        </div>
                    ) : (
                        <>
                            {businesses.length > 1 ? (
                                <div>
                                    <label htmlFor="validate-business" className="mb-1.5 block text-sm font-semibold text-foreground">
                                        Estabelecimento
                                    </label>
                                    <select
                                        id="validate-business"
                                        value={businessId}
                                        onChange={(event) => {
                                            setChosen(event.target.value);
                                            reset();
                                        }}
                                        className="w-full rounded-2xl border border-sand-dark bg-white px-4 py-3 text-dark-ocean focus:border-turquoise focus:outline-none sm:max-w-sm"
                                    >
                                        {businesses.map((business) => (
                                            <option key={business.id} value={business.id}>
                                                {business.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <p className="text-sm text-dark-ocean/80">
                                    Validando para <strong className="font-semibold">{businesses[0].name}</strong>
                                </p>
                            )}

                            {done ? (
                                <section role="status" className="rounded-3xl border-2 border-turquoise bg-card p-6 text-center shadow-sm">
                                    <CheckCircle2 className="mx-auto h-10 w-10 text-ocean" aria-hidden="true" />
                                    <h2 className="mt-2 font-head text-2xl font-bold text-foreground">Utilização confirmada</h2>
                                    <p className="mt-1 font-mono text-lg font-bold tracking-wider">{done.code}</p>
                                    <p className="mt-1 text-sm text-dark-ocean/80">Registrada em {formatCouponDateTime(done.used_at)}.</p>
                                    <button type="button" onClick={reset} className="mt-5 rounded-full bg-turquoise px-6 py-3 font-bold text-sand">
                                        Validar outro cupom
                                    </button>
                                </section>
                            ) : (
                                <div className="flex flex-col gap-4 rounded-3xl bg-card p-5 shadow-sm sm:p-6">
                                    <QrScanner
                                        disabled={verifying}
                                        onDecode={(text) => {
                                            setInput(text);
                                            verify(text);
                                        }}
                                    />
                                    <form
                                        noValidate
                                        onSubmit={(event) => {
                                            event.preventDefault();
                                            verify();
                                        }}
                                        className="flex flex-col gap-2"
                                    >
                                        <label htmlFor="coupon-input" className="text-sm font-semibold text-foreground">
                                            Código do cupom ou conteúdo do QR
                                        </label>
                                        <div className="flex flex-col gap-2 sm:flex-row">
                                            <input
                                                id="coupon-input"
                                                value={input}
                                                onChange={(event) => {
                                                    setInput(event.target.value);
                                                    setError('');
                                                }}
                                                autoComplete="off"
                                                autoCapitalize="characters"
                                                spellCheck={false}
                                                placeholder="FP-XXXXXX"
                                                aria-invalid={Boolean(error)}
                                                aria-describedby={['coupon-input-hint', error && 'coupon-input-error'].filter(Boolean).join(' ')}
                                                className={inputClasses}
                                            />
                                            <button
                                                type="submit"
                                                disabled={verifying || !businessId}
                                                aria-busy={verifying}
                                                className="rounded-full bg-turquoise px-6 py-3 font-bold text-sand disabled:opacity-60"
                                            >
                                                {verifying ? 'Verificando...' : 'Verificar'}
                                            </button>
                                        </div>
                                        <p id="coupon-input-hint" className="text-xs text-dark-ocean/60">
                                            {parsed?.method === 'qr'
                                                ? 'Conteúdo de QR Code reconhecido.'
                                                : parsed
                                                  ? `Código ${parsed.value}`
                                                  : 'Também funciona com leitores de QR que digitam o conteúdo.'}
                                        </p>
                                        {error && (
                                            <p id="coupon-input-error" role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                                                {error}
                                            </p>
                                        )}
                                    </form>
                                </div>
                            )}

                            {result && !done && <VerifyResult result={result} onConfirm={() => setConfirming(true)} />}
                        </>
                    )}
                </div>
            </section>

            <ActionDialog
                open={confirming}
                title="Confirmar utilização"
                description={
                    result ? (
                        <>
                            Confirme somente depois de conferir as condições. O cupom <strong className="font-mono">{result.coupon.code}</strong> será
                            registrado como utilizado e não poderá ser usado de novo.
                        </>
                    ) : null
                }
                confirmLabel="Confirmar utilização"
                errorMessage={validationErrorMessage}
                onClose={() => setConfirming(false)}
                onConfirm={async () => {
                    const response = await validationRpc.confirm(businessId, result.input);
                    if (response.error) {
                        // O estado pode ter mudado (já utilizado, expirado): mostra a situação atual.
                        const fresh = await validationRpc.verify(businessId, result.input);
                        if (!fresh.error) setResult({ ...fresh.data, input: result.input });
                        return response;
                    }
                    setDone(response.data);
                    setResult(null);
                    setInput('');
                    return response;
                }}
            />
        </>
    );
}

export default ValidarCupons;
