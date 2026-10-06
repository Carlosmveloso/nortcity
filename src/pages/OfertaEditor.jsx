import { AlertTriangle, Check, Loader2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Card, OfferPageHero, OfferSummary } from '@/components/offers/OfferParts';
import { offerRpc } from '@/integrations/supabase/offers';
import { useMyBusiness } from '@/hooks/useMyBusiness';
import { useOfferDetail, useOfferTerms } from '@/hooks/useOffers';
import { usePageMeta } from '@/hooks/usePageMeta';
import { offerErrorMessage } from '@/lib/offerErrors';
import {
    ALL_DAYS,
    CONDITIONS_MAX,
    DESCRIPTION_MAX,
    ELIGIBLE_ITEMS_MAX,
    OFFER_STEPS,
    TITLE_MAX,
    buildOfferPayload,
    firstStepWithErrors,
    offerFormFromVersion,
    offerPeriodEnded,
    validateOfferStep,
} from '@/lib/offerForm';
import {
    BENEFIT_TYPES,
    COUPON_VALIDITY_OPTIONS,
    VALUED_BENEFITS,
    WEEKDAYS,
    couponValidityLabel,
    describeOffer,
    formatMoney,
    latestAdminMessage,
} from '@/lib/offers';
import { staticPageMeta } from '@/lib/siteMeta';

const inputClasses =
    'w-full rounded-2xl border border-sand-dark bg-white px-4 py-3 text-dark-ocean focus:border-turquoise focus:outline-none focus-visible:ring-2 focus-visible:ring-turquoise/40 aria-[invalid=true]:border-red-400';

const EDITABLE_OFFER_STATUSES = ['draft', 'changes_requested', 'active'];
const EDITABLE_VERSION_STATUSES = ['draft', 'changes_requested'];

function describedBy(id, error, hint) {
    return [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
}

function Field({ id, label, error, hint, children, optional = false }) {
    return (
        <div>
            <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-foreground">
                {label}
                {optional && <span className="font-normal text-dark-ocean/60"> (opcional)</span>}
            </label>
            {children}
            {hint && (
                <p id={`${id}-hint`} className="mt-1 text-xs text-dark-ocean/60">
                    {hint}
                </p>
            )}
            {error && (
                <p id={`${id}-error`} className="mt-1 text-sm text-red-600">
                    {error}
                </p>
            )}
        </div>
    );
}

function Stepper({ step }) {
    return (
        <ol className="grid grid-cols-4 gap-2" aria-label="Etapas da oferta">
            {OFFER_STEPS.map((item) => {
                const done = item.id < step;
                const current = item.id === step;
                return (
                    <li key={item.id} aria-current={current ? 'step' : undefined} className="flex flex-col items-center gap-1 text-center">
                        <span
                            className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                                current ? 'bg-turquoise text-sand' : done ? 'bg-turquoise/15 text-ocean' : 'bg-white text-dark-ocean/60 shadow-sm'
                            }`}
                        >
                            {done ? <Check size={16} aria-hidden="true" /> : item.id}
                        </span>
                        <span className={`text-xs ${current ? 'font-bold text-foreground' : 'text-dark-ocean/70'}`}>
                            {item.label}
                            {done && <span className="sr-only"> (concluída)</span>}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

// ---------------------------------------------------------------------------
// Etapas
// ---------------------------------------------------------------------------

function StepOffer({ form, errors, update }) {
    const valued = VALUED_BENEFITS.includes(form.benefitType);
    const percent = form.benefitType === 'percentage_discount';
    return (
        <div className="flex flex-col gap-5">
            <Field id="offer-title" label="Título" error={errors.title} hint={`${form.title.trim().length}/${TITLE_MAX} caracteres`}>
                <input
                    id="offer-title"
                    className={inputClasses}
                    value={form.title}
                    maxLength={TITLE_MAX}
                    onChange={(event) => update('title', event.target.value)}
                    aria-invalid={Boolean(errors.title)}
                    aria-describedby={describedBy('offer-title', errors.title, true)}
                    placeholder="Ex.: 20% no almoço executivo"
                />
            </Field>
            <Field
                id="offer-description"
                label="Descrição"
                error={errors.description}
                hint={`O que a pessoa recebe e como usar. ${form.description.trim().length}/${DESCRIPTION_MAX}`}
            >
                <textarea
                    id="offer-description"
                    rows={4}
                    className={inputClasses}
                    value={form.description}
                    maxLength={DESCRIPTION_MAX}
                    onChange={(event) => update('description', event.target.value)}
                    aria-invalid={Boolean(errors.description)}
                    aria-describedby={describedBy('offer-description', errors.description, true)}
                />
            </Field>
            <Field id="offer-benefit-type" label="Tipo de benefício" error={errors.benefitType}>
                <select
                    id="offer-benefit-type"
                    className={inputClasses}
                    value={form.benefitType}
                    onChange={(event) => update('benefitType', event.target.value)}
                    aria-invalid={Boolean(errors.benefitType)}
                    aria-describedby={describedBy('offer-benefit-type', errors.benefitType)}
                >
                    <option value="">Selecione...</option>
                    {BENEFIT_TYPES.map((item) => (
                        <option key={item.value} value={item.value}>
                            {item.label}
                        </option>
                    ))}
                </select>
            </Field>
            {valued && (
                <Field
                    id="offer-benefit-value"
                    label={percent ? 'Percentual de desconto (%)' : 'Valor do desconto (R$)'}
                    error={errors.benefitValue}
                    hint={percent ? 'De 1 a 100. Ex.: 20' : 'Ex.: 15,00'}
                >
                    <input
                        id="offer-benefit-value"
                        inputMode="decimal"
                        className={`${inputClasses} sm:max-w-xs`}
                        value={form.benefitValue}
                        onChange={(event) => update('benefitValue', event.target.value)}
                        aria-invalid={Boolean(errors.benefitValue)}
                        aria-describedby={describedBy('offer-benefit-value', errors.benefitValue, true)}
                    />
                </Field>
            )}
            {form.benefitType && !valued && (
                <p className="rounded-2xl bg-sand/70 px-4 py-3 text-sm text-dark-ocean/80">
                    Este tipo não precisa de valor em dinheiro. Explique o benefício na descrição.
                </p>
            )}
        </div>
    );
}

function DayWindows({ day, windows, onChange }) {
    const label = WEEKDAYS.find((item) => item.value === day)?.label;
    const set = (index, key, value) => onChange(windows.map((window, i) => (i === index ? { ...window, [key]: value } : window)));
    return (
        <fieldset className="rounded-2xl bg-sand/60 p-4">
            <legend className="sr-only">Horários de {label}</legend>
            <p aria-hidden="true" className="text-sm font-semibold text-foreground">
                {label}
            </p>
            <ul className="mt-2 flex flex-col gap-2">
                {windows.map((window, index) => (
                    <li key={index} className="flex flex-wrap items-end gap-2">
                        <label className="flex flex-col text-xs text-dark-ocean/70">
                            <span>
                                Início<span className="sr-only"> do horário {index + 1} de {label}</span>
                            </span>
                            <input
                                type="time"
                                value={window.start}
                                onChange={(event) => set(index, 'start', event.target.value)}
                                className="rounded-xl border border-sand-dark bg-white px-3 py-2 text-dark-ocean focus:border-turquoise focus:outline-none"
                            />
                        </label>
                        <label className="flex flex-col text-xs text-dark-ocean/70">
                            <span>
                                Fim<span className="sr-only"> do horário {index + 1} de {label}</span>
                            </span>
                            <input
                                type="time"
                                value={window.end}
                                onChange={(event) => set(index, 'end', event.target.value)}
                                className="rounded-xl border border-sand-dark bg-white px-3 py-2 text-dark-ocean focus:border-turquoise focus:outline-none"
                            />
                        </label>
                        <button
                            type="button"
                            onClick={() => onChange(windows.filter((_, i) => i !== index))}
                            aria-label={`Remover horário ${index + 1} de ${label}`}
                            className="flex h-10 w-10 items-center justify-center rounded-full text-red-600 hover:bg-red-50"
                        >
                            <Trash2 size={16} aria-hidden="true" />
                        </button>
                    </li>
                ))}
            </ul>
            <button
                type="button"
                onClick={() => onChange([...windows, { start: '11:00', end: '15:00' }])}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-dark-ocean shadow-sm"
            >
                <Plus size={14} aria-hidden="true" />
                Adicionar horário<span className="sr-only"> em {label}</span>
            </button>
        </fieldset>
    );
}

function StepConditions({ form, errors, update, setForm }) {
    const toggleDay = (day) =>
        update('days', form.days.includes(day) ? form.days.filter((item) => item !== day) : [...form.days, day].sort());
    const selectedDays = [...form.days].sort();
    const copyFirst = () => {
        const source = form.windows[selectedDays[0]] ?? [];
        setForm((prev) => ({
            ...prev,
            windows: Object.fromEntries(ALL_DAYS.map((day) => [day, prev.days.includes(day) ? source.map((w) => ({ ...w })) : prev.windows[day]])),
        }));
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
                <Field id="offer-start" label="Data inicial" error={errors.startDate}>
                    <input
                        id="offer-start"
                        type="date"
                        className={inputClasses}
                        value={form.startDate}
                        onChange={(event) => update('startDate', event.target.value)}
                        aria-invalid={Boolean(errors.startDate)}
                        aria-describedby={describedBy('offer-start', errors.startDate)}
                    />
                </Field>
                <Field id="offer-end" label="Data final" error={errors.endDate} hint="A oferta vale até 23:59 deste dia.">
                    <input
                        id="offer-end"
                        type="date"
                        className={inputClasses}
                        value={form.endDate}
                        min={form.startDate || undefined}
                        onChange={(event) => update('endDate', event.target.value)}
                        aria-invalid={Boolean(errors.endDate)}
                        aria-describedby={describedBy('offer-end', errors.endDate, true)}
                    />
                </Field>
            </div>

            <fieldset aria-describedby={errors.days ? 'offer-days-error' : undefined}>
                <legend className="mb-1.5 text-sm font-semibold text-foreground">Dias da semana</legend>
                <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((day) => {
                        const checked = form.days.includes(day.value);
                        return (
                            <label
                                key={day.value}
                                className={`cursor-pointer rounded-full px-4 py-2 text-sm font-semibold focus-within:ring-2 focus-within:ring-turquoise ${
                                    checked ? 'bg-turquoise text-sand' : 'bg-white text-dark-ocean shadow-sm'
                                }`}
                            >
                                <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleDay(day.value)} />
                                <span aria-hidden="true">{day.short}</span>
                                <span className="sr-only">{day.label}</span>
                            </label>
                        );
                    })}
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    <button type="button" className="font-semibold text-ocean underline" onClick={() => update('days', [...ALL_DAYS])}>
                        Todos os dias
                    </button>
                    <button type="button" className="font-semibold text-ocean underline" onClick={() => update('days', [1, 2, 3, 4, 5])}>
                        Segunda a sexta
                    </button>
                </div>
                {errors.days && (
                    <p id="offer-days-error" className="mt-1 text-sm text-red-600">
                        {errors.days}
                    </p>
                )}
            </fieldset>

            <fieldset aria-describedby={errors.windows ? 'offer-windows-error' : undefined}>
                <legend className="mb-1.5 text-sm font-semibold text-foreground">Horários</legend>
                <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex items-center gap-2">
                        <input
                            type="radio"
                            name="offer-hours"
                            checked={form.hoursMode === 'all_day'}
                            onChange={() => update('hoursMode', 'all_day')}
                        />
                        Dia inteiro
                    </label>
                    <label className="flex items-center gap-2">
                        <input
                            type="radio"
                            name="offer-hours"
                            checked={form.hoursMode === 'windows'}
                            onChange={() => update('hoursMode', 'windows')}
                        />
                        Horários específicos
                    </label>
                </div>
                {form.hoursMode === 'windows' && (
                    <div className="mt-3 flex flex-col gap-3">
                        {selectedDays.map((day) => (
                            <DayWindows
                                key={day}
                                day={day}
                                windows={form.windows[day] ?? []}
                                onChange={(next) => setForm((prev) => ({ ...prev, windows: { ...prev.windows, [day]: next } }))}
                            />
                        ))}
                        {selectedDays.length > 1 && (
                            <button type="button" onClick={copyFirst} className="self-start text-sm font-semibold text-ocean underline">
                                Usar os horários de {WEEKDAYS.find((item) => item.value === selectedDays[0])?.label} em todos os dias
                            </button>
                        )}
                    </div>
                )}
                {errors.windows && (
                    <p id="offer-windows-error" className="mt-1 text-sm text-red-600">
                        {errors.windows}
                    </p>
                )}
            </fieldset>

            <Field id="offer-minimum" label="Compra mínima (R$)" optional error={errors.minimumPurchase} hint="Ex.: 80,00">
                <input
                    id="offer-minimum"
                    inputMode="decimal"
                    className={`${inputClasses} sm:max-w-xs`}
                    value={form.minimumPurchase}
                    onChange={(event) => update('minimumPurchase', event.target.value)}
                    aria-invalid={Boolean(errors.minimumPurchase)}
                    aria-describedby={describedBy('offer-minimum', errors.minimumPurchase, true)}
                />
            </Field>
            <Field
                id="offer-eligible"
                label="Produtos ou serviços participantes"
                optional
                error={errors.eligibleItems}
                hint={`Ex.: pratos do almoço executivo. ${form.eligibleItems.trim().length}/${ELIGIBLE_ITEMS_MAX}`}
            >
                <textarea
                    id="offer-eligible"
                    rows={2}
                    className={inputClasses}
                    maxLength={ELIGIBLE_ITEMS_MAX}
                    value={form.eligibleItems}
                    onChange={(event) => update('eligibleItems', event.target.value)}
                    aria-invalid={Boolean(errors.eligibleItems)}
                    aria-describedby={describedBy('offer-eligible', errors.eligibleItems, true)}
                />
            </Field>
            <label className="flex items-start gap-3 text-sm text-foreground">
                <input
                    type="checkbox"
                    className="mt-1"
                    checked={form.stackable}
                    onChange={(event) => update('stackable', event.target.checked)}
                />
                <span>Pode ser usada junto com outras promoções do negócio</span>
            </label>
            <Field
                id="offer-conditions"
                label="Condições ou restrições adicionais"
                optional
                error={errors.conditions}
                hint={`${form.conditions.trim().length}/${CONDITIONS_MAX}`}
            >
                <textarea
                    id="offer-conditions"
                    rows={3}
                    className={inputClasses}
                    maxLength={CONDITIONS_MAX}
                    value={form.conditions}
                    onChange={(event) => update('conditions', event.target.value)}
                    aria-invalid={Boolean(errors.conditions)}
                    aria-describedby={describedBy('offer-conditions', errors.conditions, true)}
                />
            </Field>
        </div>
    );
}

function StepCoupons({ form, errors, update }) {
    const current = Number(form.couponValidityMinutes);
    const options = COUPON_VALIDITY_OPTIONS.some((item) => item.value === current) || !current
        ? COUPON_VALIDITY_OPTIONS
        : [...COUPON_VALIDITY_OPTIONS, { value: current, label: couponValidityLabel(current) }];
    return (
        <div className="flex flex-col gap-6">
            <p className="rounded-2xl bg-sand/70 px-4 py-3 text-sm text-dark-ocean/80">
                Estas regras valem para os cupons que as pessoas vão gerar quando a oferta estiver no ar.
            </p>
            <fieldset aria-describedby={errors.totalLimit ? 'offer-total-error' : undefined}>
                <legend className="mb-1.5 text-sm font-semibold text-foreground">Quantidade total de utilizações</legend>
                <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex items-center gap-2">
                        <input
                            type="radio"
                            name="offer-limit"
                            checked={form.limitMode === 'limited'}
                            onChange={() => update('limitMode', 'limited')}
                        />
                        Quantidade limitada
                    </label>
                    <label className="flex items-center gap-2">
                        <input
                            type="radio"
                            name="offer-limit"
                            checked={form.limitMode === 'unlimited'}
                            onChange={() => update('limitMode', 'unlimited')}
                        />
                        Sem limite
                    </label>
                </div>
                {form.limitMode === 'limited' && (
                    <div className="mt-3">
                        <label htmlFor="offer-total" className="mb-1.5 block text-sm text-foreground">
                            Quantidade
                        </label>
                        <input
                            id="offer-total"
                            inputMode="numeric"
                            className={`${inputClasses} sm:max-w-xs`}
                            value={form.totalLimit}
                            onChange={(event) => update('totalLimit', event.target.value)}
                            aria-invalid={Boolean(errors.totalLimit)}
                            aria-describedby={errors.totalLimit ? 'offer-total-error' : undefined}
                        />
                    </div>
                )}
                {errors.totalLimit && (
                    <p id="offer-total-error" className="mt-1 text-sm text-red-600">
                        {errors.totalLimit}
                    </p>
                )}
            </fieldset>
            <Field id="offer-per-user" label="Limite por pessoa" error={errors.perUserLimit} hint="Quantas vezes a mesma pessoa pode usar.">
                <input
                    id="offer-per-user"
                    inputMode="numeric"
                    className={`${inputClasses} sm:max-w-xs`}
                    value={form.perUserLimit}
                    onChange={(event) => update('perUserLimit', event.target.value)}
                    aria-invalid={Boolean(errors.perUserLimit)}
                    aria-describedby={describedBy('offer-per-user', errors.perUserLimit, true)}
                />
            </Field>
            <Field
                id="offer-validity"
                label="Validade do cupom após a geração"
                error={errors.couponValidityMinutes}
                hint="Depois desse prazo, o cupom gerado deixa de valer."
            >
                <select
                    id="offer-validity"
                    className={`${inputClasses} sm:max-w-xs`}
                    value={form.couponValidityMinutes}
                    onChange={(event) => update('couponValidityMinutes', event.target.value)}
                    aria-invalid={Boolean(errors.couponValidityMinutes)}
                    aria-describedby={describedBy('offer-validity', errors.couponValidityMinutes, true)}
                >
                    <option value="">Selecione...</option>
                    {options.map((item) => (
                        <option key={item.value} value={item.value}>
                            {item.label}
                        </option>
                    ))}
                </select>
            </Field>
        </div>
    );
}

function StepReview({ form, terms, termsLoading, termsError, accepted, setAccepted, business }) {
    const preview = buildOfferPayload(form);
    const hasFee = terms && terms.fee_amount !== null && terms.fee_amount !== undefined;
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="font-head text-xl font-bold break-words text-foreground">{preview.title || 'Oferta sem título'}</h3>
                <div className="mt-3">
                    <OfferSummary version={preview} />
                </div>
            </div>

            <section aria-labelledby="offer-terms-title" className="rounded-2xl border border-sand-dark p-4 sm:p-5">
                <h3 id="offer-terms-title" className="font-head text-lg font-bold text-foreground">
                    Condições comerciais
                </h3>
                {termsLoading && (
                    <p role="status" className="mt-2 text-sm text-dark-ocean/60">
                        Carregando as condições do seu plano...
                    </p>
                )}
                {termsError && (
                    <p role="alert" className="mt-2 text-sm text-red-600">
                        Não foi possível carregar as condições do seu plano. Recarregue a página.
                    </p>
                )}
                {terms && !hasFee && (
                    <div className="mt-3 rounded-2xl bg-sun/10 px-4 py-3 text-sm text-dark-ocean">
                        <p className="font-semibold">Seu plano atual ({terms.plan_name}) não inclui publicação de ofertas.</p>
                        <p className="mt-1">
                            Sua oferta fica salva como rascunho. Para enviá-la para análise, fale com a{' '}
                            <Link to="/contato" className="font-semibold text-ocean underline">
                                equipe do Farol
                            </Link>{' '}
                            sobre a mudança de plano.
                        </p>
                    </div>
                )}
                {hasFee && (
                    <>
                        <p className="mt-2 text-sm text-dark-ocean/80">
                            Plano <strong className="font-semibold">{terms.plan_name}</strong>
                        </p>
                        <p className="mt-1 text-2xl font-extrabold text-foreground">
                            {formatMoney(terms.fee_amount)} <span className="text-base font-semibold">por cupom utilizado</span>
                        </p>
                        <p className="mt-2 text-sm text-dark-ocean/80">
                            A geração do cupom não gera cobrança. A taxa é registrada somente quando um cupom é confirmado
                            como utilizado. O valor fica registrado nesta versão da oferta.
                        </p>
                        <label className="mt-4 flex items-start gap-3 text-sm font-semibold text-foreground">
                            <input
                                type="checkbox"
                                className="mt-1 h-4 w-4"
                                checked={accepted}
                                onChange={(event) => setAccepted(event.target.checked)}
                            />
                            <span>Li e concordo com as condições comerciais desta oferta.</span>
                        </label>
                    </>
                )}
                {business.status !== 'active' && (
                    <p className="mt-3 rounded-2xl bg-sun/10 px-4 py-3 text-sm text-dark-ocean">
                        Seu negócio ainda não está publicado. A oferta pode ser enviada depois que o cadastro for aprovado.
                    </p>
                )}
            </section>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

function EditorForm({ business, offer, latest, reviews, step, goToStep, onSaved }) {
    const navigate = useNavigate();
    const [form, setForm] = useState(() => offerFormFromVersion(latest));
    const [errors, setErrors] = useState({});
    // Versão devolvida com pedido de ajustes ainda não foi copiada: o primeiro
    // salvamento cria a próxima versão, que é a que recebe aceite e envio.
    const [dirty, setDirty] = useState(!offer || latest?.review_status === 'changes_requested');
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [error, setError] = useState('');
    const [accepted, setAccepted] = useState(false);
    const busy = useRef(false);
    const formRef = useRef(null);
    const { terms, loading: termsLoading, error: termsError, refetch: refetchTerms } = useOfferTerms(business.id);

    const forking = latest?.review_status === 'changes_requested';
    const adminMessage = forking ? latestAdminMessage(reviews, ['changes_requested']) : null;
    const hasFee = terms && terms.fee_amount !== null && terms.fee_amount !== undefined;

    const update = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => ({ ...prev, [field]: undefined }));
        setDirty(true);
        setFeedback('');
    };
    const updateForm = (updater) => {
        setForm(updater);
        setDirty(true);
        setErrors((prev) => ({ ...prev, windows: undefined }));
    };

    const focusFirstError = () =>
        requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());

    /** Salva o rascunho; devolve o id da oferta ou null. */
    const persist = async () => {
        const payload = buildOfferPayload(form);
        const result = offer ? await offerRpc.updateDraft(offer.id, payload) : await offerRpc.create(business.id, payload);
        if (result.error) {
            setError(offerErrorMessage(result.error));
            return null;
        }
        setDirty(false);
        return offer?.id ?? result.data;
    };

    const save = async ({ strict, nextStep }) => {
        if (busy.current) return;
        const validation = validateOfferStep(form, step, { strict });
        if (Object.keys(validation).length > 0) {
            setErrors(validation);
            setError('Revise os campos destacados.');
            focusFirstError();
            return;
        }
        busy.current = true;
        setSaving(true);
        setError('');
        setFeedback('');
        const id = !dirty && offer ? offer.id : await persist();
        busy.current = false;
        setSaving(false);
        if (!id) return;
        const target = nextStep ?? step;
        if (!offer) {
            navigate(`/meu-negocio/ofertas/${id}/editar?etapa=${target}`, {
                replace: true,
                state: { flash: 'Rascunho salvo.' },
            });
            return;
        }
        if (nextStep) goToStep(nextStep);
        else setFeedback('Rascunho salvo.');
        await onSaved();
    };

    const submit = async () => {
        if (busy.current) return;
        const invalidStep = firstStepWithErrors(form);
        if (invalidStep) {
            setErrors(validateOfferStep(form, invalidStep));
            setError('Faltam informações nesta etapa antes do envio.');
            goToStep(invalidStep);
            focusFirstError();
            return;
        }
        if (offerPeriodEnded(form)) {
            setErrors({ endDate: 'A data final já passou.' });
            setError('O período desta oferta já terminou. Ajuste a data final.');
            goToStep(2);
            return;
        }
        busy.current = true;
        setSaving(true);
        setError('');
        const id = !dirty && offer ? offer.id : await persist();
        if (!id) {
            busy.current = false;
            setSaving(false);
            return;
        }
        const acceptance = await offerRpc.acceptTerms(id, Number(terms.fee_amount));
        if (acceptance.error) {
            busy.current = false;
            setSaving(false);
            if (acceptance.error.message === 'fee_changed') {
                setAccepted(false);
                refetchTerms();
            }
            setError(offerErrorMessage(acceptance.error));
            return;
        }
        const submission = await offerRpc.submit(id);
        busy.current = false;
        setSaving(false);
        if (submission.error) {
            setError(offerErrorMessage(submission.error));
            return;
        }
        navigate(`/meu-negocio/ofertas/${id}`, {
            state: { flash: 'Oferta enviada para análise. Acompanhe a decisão por esta página.' },
        });
    };

    const canSubmit = hasFee && accepted && business.status === 'active' && !saving;

    return (
        <form
            ref={formRef}
            noValidate
            onSubmit={(event) => {
                event.preventDefault();
                if (step < 4) save({ strict: true, nextStep: step + 1 });
                else if (canSubmit) submit();
            }}
            className="flex flex-col gap-6"
        >
            {forking && (
                <div className="flex gap-3 rounded-3xl border border-sun/40 bg-sun/10 p-5">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-dark-ocean" aria-hidden="true" />
                    <div className="text-sm text-dark-ocean">
                        <p className="font-semibold">Ajustes solicitados pela equipe do Farol</p>
                        {adminMessage && <p className="mt-1 whitespace-pre-line">“{adminMessage.message}”</p>}
                        <p className="mt-2">
                            A versão {latest.version_number} analisada fica preservada. Ao salvar, suas correções viram a
                            versão {latest.version_number + 1}, que precisa de um novo aceite antes do reenvio.
                        </p>
                    </div>
                </div>
            )}
            {offer?.status === 'active' && (
                <p className="rounded-3xl bg-turquoise/10 px-5 py-4 text-sm text-dark-ocean">
                    A versão publicada continua no ar enquanto esta alteração é preparada e analisada.
                </p>
            )}

            <Stepper step={step} />

            <Card>
                <h2 className="mb-5 font-head text-lg font-bold text-foreground" tabIndex={-1} id="offer-step-title">
                    Passo {step} — {OFFER_STEPS[step - 1].label}
                </h2>
                {step === 1 && <StepOffer form={form} errors={errors} update={update} />}
                {step === 2 && <StepConditions form={form} errors={errors} update={update} setForm={updateForm} />}
                {step === 3 && <StepCoupons form={form} errors={errors} update={update} />}
                {step === 4 && (
                    <StepReview
                        form={form}
                        terms={terms}
                        termsLoading={termsLoading}
                        termsError={termsError}
                        accepted={accepted}
                        setAccepted={setAccepted}
                        business={business}
                    />
                )}
            </Card>

            <div aria-live="polite" className="min-h-6">
                {error && (
                    <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </p>
                )}
                {feedback && !error && <p className="text-sm font-semibold text-ocean">{feedback}</p>}
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                    {step > 1 && (
                        <button
                            type="button"
                            onClick={() => goToStep(step - 1)}
                            disabled={saving}
                            className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-dark-ocean shadow-sm disabled:opacity-60"
                        >
                            Voltar
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => save({ strict: false })}
                        disabled={saving}
                        className="rounded-full px-5 py-3 text-sm font-semibold text-ocean underline disabled:opacity-60"
                    >
                        Salvar rascunho
                    </button>
                </div>
                {step < 4 ? (
                    <button
                        type="submit"
                        disabled={saving}
                        aria-busy={saving}
                        className="flex items-center justify-center gap-2 rounded-full bg-turquoise px-6 py-3 font-bold text-sand disabled:opacity-70"
                    >
                        {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                        Continuar
                    </button>
                ) : (
                    hasFee && (
                        <button
                            type="submit"
                            disabled={!canSubmit}
                            aria-busy={saving}
                            className="flex items-center justify-center gap-2 rounded-full bg-turquoise px-6 py-3 font-bold text-sand disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                            {saving ? 'Enviando...' : 'Enviar para análise'}
                        </button>
                    )
                )}
            </div>
        </form>
    );
}

function OfertaEditor() {
    usePageMeta(staticPageMeta('/meu-negocio/ofertas'));
    const { offerId } = useParams();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const step = Math.min(4, Math.max(1, Number(searchParams.get('etapa')) || 1));
    const { business, loading: businessLoading } = useMyBusiness();
    const { offer, versions, reviews, loading, error, refetch } = useOfferDetail(offerId);
    const flash = location.state?.flash;

    const goToStep = (next) => {
        setSearchParams({ etapa: String(next) }, { replace: true, state: null });
        requestAnimationFrame(() => {
            document.getElementById('offer-step-title')?.focus();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    };

    useEffect(() => {
        if (!offerId && step !== 1) setSearchParams({}, { replace: true });
    }, [offerId, step, setSearchParams]);

    const view = offer ? describeOffer(offer, versions) : null;
    const latest = view?.latest ?? null;
    const editable =
        !offerId ||
        (offer && EDITABLE_OFFER_STATUSES.includes(offer.status) && EDITABLE_VERSION_STATUSES.includes(latest?.review_status));
    const ready = !businessLoading && business && (!offerId || offer);

    return (
        <>
            <OfferPageHero
                crumbs={[
                    { label: 'Meu Negócio', to: '/meu-negocio' },
                    { label: 'Ofertas', to: '/meu-negocio/ofertas' },
                    { label: offerId ? 'Editar oferta' : 'Nova oferta' },
                ]}
                title={offerId ? 'Editar oferta' : 'Nova oferta'}
                subtitle="Monte a oferta em quatro passos. O rascunho fica salvo e pode ser retomado depois."
            />
            <section className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
                <div className="container mx-auto flex max-w-3xl flex-col gap-6">
                    {flash && (
                        <p role="status" className="rounded-2xl bg-turquoise/10 px-4 py-3 text-sm font-semibold text-ocean">
                            {flash}
                        </p>
                    )}
                    {(businessLoading || (offerId && loading && !offer)) && (
                        <p role="status" className="text-sm text-dark-ocean/60">
                            Carregando...
                        </p>
                    )}
                    {!businessLoading && !business && (
                        <p className="rounded-3xl bg-card p-6 text-sm text-dark-ocean/80 shadow-sm">
                            Cadastre seu negócio antes de criar ofertas.{' '}
                            <Link to="/cadastrar-negocio" className="font-semibold text-ocean underline">
                                Cadastrar negócio
                            </Link>
                        </p>
                    )}
                    {offerId && !loading && (error || !offer) && (
                        <p role="alert" className="rounded-3xl bg-red-50 px-5 py-4 text-sm text-red-700">
                            Oferta não encontrada.{' '}
                            <Link to="/meu-negocio/ofertas" className="font-semibold underline">
                                Voltar às ofertas
                            </Link>
                        </p>
                    )}
                    {ready && !editable && (
                        <div className="rounded-3xl bg-card p-6 shadow-sm">
                            <p className="text-sm text-dark-ocean/80">
                                Esta versão da oferta já foi enviada e não pode mais ser alterada.
                            </p>
                            <Link
                                to={`/meu-negocio/ofertas/${offerId}`}
                                className="mt-4 inline-flex rounded-full bg-turquoise px-5 py-2.5 text-sm font-bold text-sand"
                            >
                                Ver a oferta
                            </Link>
                        </div>
                    )}
                    {ready && editable && (
                        <EditorForm
                            key={latest?.id ?? 'new'}
                            business={business}
                            offer={offer}
                            latest={latest}
                            reviews={reviews}
                            step={offerId ? step : 1}
                            goToStep={goToStep}
                            onSaved={refetch}
                        />
                    )}
                </div>
            </section>
        </>
    );
}

export default OfertaEditor;
