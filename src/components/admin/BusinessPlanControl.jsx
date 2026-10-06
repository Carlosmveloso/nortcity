import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { fetchOfferTerms, fetchPlans, offerRpc } from '@/integrations/supabase/offers';
import { offerErrorMessage } from '@/lib/offerErrors';

const inputClasses =
    'w-full rounded-2xl border border-sand-dark bg-white px-4 py-2.5 text-sm text-dark-ocean focus:border-turquoise focus:outline-none';

/**
 * Atribuição manual de plano (enquanto não existe assinatura). Carrega só
 * quando aberto, para a lista de negócios não fazer uma consulta por item.
 * A regra de rebaixamento fica no banco (`plan_offer_limit_exceeded`).
 */
export default function BusinessPlanControl({ business }) {
    const [open, setOpen] = useState(false);
    const [state, setState] = useState({ loading: false, terms: null, plans: [], error: '' });
    const [planId, setPlanId] = useState('');
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState('');

    const load = async () => {
        setState((prev) => ({ ...prev, loading: true, error: '' }));
        const [{ terms, error }, { plans, error: plansError }] = await Promise.all([fetchOfferTerms(business.id), fetchPlans()]);
        if (error || plansError) {
            setState({ loading: false, terms: null, plans: [], error: 'Não foi possível carregar o plano.' });
            return;
        }
        setState({ loading: false, terms, plans, error: '' });
        setPlanId(terms?.plan_id ?? '');
    };

    const toggle = () => {
        const next = !open;
        setOpen(next);
        setFeedback('');
        if (next) load();
    };

    const save = async (event) => {
        event.preventDefault();
        if (saving || !planId) return;
        setSaving(true);
        setFeedback('');
        const { error } = await offerRpc.setBusinessPlan(business.id, planId, note.trim());
        setSaving(false);
        if (error) {
            setState((prev) => ({ ...prev, error: offerErrorMessage(error) }));
            return;
        }
        setNote('');
        await load();
        setFeedback('Plano atualizado.');
    };

    const panelId = `plan-panel-${business.id}`;

    return (
        <div className="mt-4">
            <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                aria-controls={panelId}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-dark-ocean shadow-sm"
            >
                {open ? 'Fechar plano' : 'Plano e ofertas'}
            </button>
            {open && (
                <form id={panelId} onSubmit={save} className="mt-3 rounded-2xl bg-sand-dark/40 p-4">
                    {state.loading && (
                        <p role="status" className="text-sm text-dark-ocean/60">
                            Carregando plano...
                        </p>
                    )}
                    {state.terms && (
                        <p className="text-sm text-dark-ocean/80">
                            Plano atual: <strong className="font-semibold">{state.terms.plan_name}</strong> ·{' '}
                            {state.terms.active_offers} de {state.terms.active_offer_limit} ofertas ativas
                        </p>
                    )}
                    {state.plans.length > 0 && (
                        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,12rem)_1fr_auto] sm:items-end">
                            <label className="text-xs font-semibold text-dark-ocean/70">
                                Novo plano
                                <select className={`${inputClasses} mt-1`} value={planId} onChange={(event) => setPlanId(event.target.value)}>
                                    {state.plans.map((plan) => (
                                        <option key={plan.id} value={plan.id}>
                                            {plan.name} (até {plan.active_offer_limit} ativas)
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="text-xs font-semibold text-dark-ocean/70">
                                Observação (opcional)
                                <input
                                    className={`${inputClasses} mt-1`}
                                    value={note}
                                    maxLength={500}
                                    onChange={(event) => setNote(event.target.value)}
                                    placeholder="Ex.: contrato fechado por telefone"
                                />
                            </label>
                            <button
                                type="submit"
                                disabled={saving || planId === state.terms?.plan_id}
                                className="flex items-center justify-center gap-2 rounded-full bg-turquoise px-5 py-2.5 text-sm font-bold text-sand disabled:opacity-60"
                            >
                                {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                                Salvar plano
                            </button>
                        </div>
                    )}
                    <div aria-live="polite">
                        {state.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
                        {feedback && <p className="mt-2 text-sm font-semibold text-ocean">{feedback}</p>}
                    </div>
                </form>
            )}
        </div>
    );
}
