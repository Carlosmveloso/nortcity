import { AlertTriangle, ChevronRight, Clock, ExternalLink, ImagePlus, Loader2, Store } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCategories } from '@/hooks/useCategories';
import { useMyBusiness } from '@/hooks/useMyBusiness';
import { usePageMeta } from '../hooks/usePageMeta';
import { staticPageMeta } from '../lib/siteMeta';
import CategoryPicker from '../components/business/CategoryPicker';
import { businessErrorMessage } from '../lib/businessErrors';
import {
    DESCRIPTION_MAX,
    buildBusinessPayload,
    businessFormFromRow,
    isValidContact,
    validateBusinessForm,
} from '../lib/businessForm';
import { BUSINESS_STATUS_LABELS, moderationReasonForOwner, moderationReasonLabel } from '../lib/moderation';
import { uploadBusinessCoverImage, uploadBusinessReviewImage } from '../lib/uploadBusinessCoverImage';

const inputClasses =
    'w-full rounded-2xl border border-sand-dark bg-white px-4 py-3 text-dark-ocean focus:border-turquoise focus:outline-none';

const STATUS_STYLE = {
    pending: 'bg-sun/15 text-sun',
    active: 'bg-turquoise/10 text-turquoise',
    rejected: 'bg-red-100 text-red-700',
    suspended: 'bg-red-100 text-red-700',
};

const STATUS_EXPLANATION = {
    pending: 'Seu cadastro está na fila de análise. Você pode corrigir as informações enquanto ele não é publicado.',
    active: 'Seu negócio está publicado no Farol Pitimbu e aparece nas buscas.',
    rejected: 'O cadastro não foi aprovado nesta forma. Corrija o que for necessário e reenvie para análise.',
    suspended:
        'O perfil foi retirado do ar pela equipe do Farol e continua guardado. A reativação é feita pela equipe, depois que o motivo for resolvido.',
};

function Field({ label, htmlFor, error, hint, children }) {
    return (
        <div>
            <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-foreground">
                {label}
            </label>
            {children}
            {hint && <p className="mt-1 text-xs text-dark-ocean/60">{hint}</p>}
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
    );
}

/** Correção completa do cadastro: só faz sentido enquanto está pendente ou rejeitado. */
function DraftEditor({ business, categories, onSaved }) {
    const [form, setForm] = useState(businessFormFromRow(business));
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [error, setError] = useState('');
    const [coverFile, setCoverFile] = useState(null);

    const update = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => ({ ...prev, [field]: undefined, contact: undefined }));
    };

    const handleSave = async (event) => {
        event.preventDefault();
        const validation = validateBusinessForm(form);
        if (Object.keys(validation).length > 0) {
            setErrors(validation);
            setError('Revise os campos destacados.');
            return;
        }

        setSaving(true);
        setError('');
        setFeedback('');

        const { error: rpcError } = await supabase.rpc('update_own_business', {
            p_business_id: business.id,
            p_payload: buildBusinessPayload(form),
            p_category_ids: form.categories,
            p_primary_category_id: form.primaryCategoryId,
        });

        if (rpcError) {
            setSaving(false);
            setError(businessErrorMessage(rpcError));
            return;
        }

        if (coverFile) {
            const { url } = await uploadBusinessCoverImage(business.id, coverFile);
            if (url) await supabase.rpc('set_business_cover_image', { p_business_id: business.id, p_url: url });
            setCoverFile(null);
        }

        setSaving(false);
        setFeedback('Cadastro atualizado.');
        await onSaved();
    };

    return (
        <form onSubmit={handleSave} className="mt-6 flex flex-col gap-5 border-t border-sand-dark pt-6">
            <Field label="Nome do negócio" htmlFor="my-name" error={errors.name}>
                <input
                    id="my-name"
                    className={inputClasses}
                    value={form.name}
                    onChange={(event) => update('name', event.target.value)}
                />
            </Field>

            <CategoryPicker
                categories={categories}
                selected={form.categories}
                primaryId={form.primaryCategoryId}
                onChange={(nextCategories, nextPrimary) =>
                    setForm((prev) => ({ ...prev, categories: nextCategories, primaryCategoryId: nextPrimary }))
                }
                error={errors.categories}
                primaryError={errors.primaryCategoryId}
            />

            <Field
                label="Descrição (opcional)"
                htmlFor="my-description"
                error={errors.description}
                hint={`${form.description.trim().length}/${DESCRIPTION_MAX} caracteres`}
            >
                <textarea
                    id="my-description"
                    rows={4}
                    className={inputClasses}
                    value={form.description}
                    onChange={(event) => update('description', event.target.value)}
                />
            </Field>

            <div className="flex flex-col gap-2 rounded-2xl bg-sand-dark/40 p-4">
                <label className="flex items-center gap-3 text-sm text-dark-ocean">
                    <input
                        type="radio"
                        name="my-location-mode"
                        checked={form.hasPublicAddress}
                        onChange={() => update('hasPublicAddress', true)}
                    />
                    Tenho um endereço para divulgar
                </label>
                <label className="flex items-center gap-3 text-sm text-dark-ocean">
                    <input
                        type="radio"
                        name="my-location-mode"
                        checked={!form.hasPublicAddress}
                        onChange={() => update('hasPublicAddress', false)}
                    />
                    Atendo sem endereço fixo
                </label>
            </div>

            {form.hasPublicAddress ? (
                <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Endereço" htmlFor="my-street" error={errors.street}>
                        <input
                            id="my-street"
                            className={inputClasses}
                            value={form.street}
                            onChange={(event) => update('street', event.target.value)}
                        />
                    </Field>
                    <Field label="Bairro / localidade" htmlFor="my-neighborhood">
                        <input
                            id="my-neighborhood"
                            className={inputClasses}
                            value={form.neighborhood}
                            onChange={(event) => update('neighborhood', event.target.value)}
                        />
                    </Field>
                </div>
            ) : (
                <Field
                    label="Área de atendimento"
                    htmlFor="my-service-area"
                    error={errors.serviceArea}
                    hint="Aparece na sua ficha no lugar do endereço."
                >
                    <input
                        id="my-service-area"
                        className={inputClasses}
                        value={form.serviceArea}
                        onChange={(event) => update('serviceArea', event.target.value)}
                    />
                </Field>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
                {[
                    ['phone', 'Telefone'],
                    ['whatsapp', 'WhatsApp'],
                    ['email', 'E-mail'],
                    ['instagram', 'Instagram'],
                    ['website', 'Site'],
                ].map(([field, label]) => (
                    <Field key={field} label={label} htmlFor={`my-${field}`}>
                        <input
                            id={`my-${field}`}
                            className={inputClasses}
                            value={form[field]}
                            onChange={(event) => update(field, event.target.value)}
                        />
                    </Field>
                ))}
            </div>
            {errors.contact && <p className="text-sm text-red-600">{errors.contact}</p>}

            <Field label="Imagem de capa" htmlFor="my-cover">
                <label className="flex w-fit cursor-pointer items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-dark-ocean shadow-sm">
                    <ImagePlus className="h-4 w-4" aria-hidden="true" />
                    {coverFile ? coverFile.name : 'Escolher imagem'}
                    <input
                        id="my-cover"
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
                    />
                </label>
            </Field>

            {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            {feedback && <p className="rounded-2xl bg-turquoise/10 px-4 py-3 text-sm text-turquoise">{feedback}</p>}

            <button
                type="submit"
                disabled={saving}
                className="flex w-fit items-center gap-2 rounded-full bg-turquoise px-6 py-3 font-bold text-sand disabled:opacity-70"
            >
                {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Salvar alterações
            </button>
        </form>
    );
}

/**
 * Negócio publicado. Telefone é alteração simples e vai ao ar na hora; nome,
 * imagem, categorias, endereço e descrição viram proposta e só mudam a ficha
 * pública depois da análise.
 */
function ActiveEditor({ business, categories, changeRequest, onSaved }) {
    const [phone, setPhone] = useState(business.phone ?? '');
    const [phoneState, setPhoneState] = useState({ saving: false, error: '', feedback: '' });

    const [form, setForm] = useState(businessFormFromRow(business));
    const [coverFile, setCoverFile] = useState(null);
    const [requestState, setRequestState] = useState({ saving: false, error: '', feedback: '' });

    const savePhone = async () => {
        if (!isValidContact('phone', phone)) {
            setPhoneState({ saving: false, error: 'Informe um telefone válido com DDD.', feedback: '' });
            return;
        }
        setPhoneState({ saving: true, error: '', feedback: '' });
        const { error } = await supabase.rpc('update_own_active_business', {
            p_business_id: business.id,
            p_changes: { phone },
        });
        if (error) {
            setPhoneState({ saving: false, error: businessErrorMessage(error), feedback: '' });
            return;
        }
        setPhoneState({ saving: false, error: '', feedback: 'Telefone atualizado no perfil público.' });
        await onSaved();
    };

    const submitRequest = async (event) => {
        event.preventDefault();
        setRequestState({ saving: true, error: '', feedback: '' });

        const payload = buildBusinessPayload(form);
        const changes = {};
        if (payload.name !== business.name) changes.name = payload.name;
        if (payload.address !== business.address) changes.address = payload.address;
        if (payload.description !== business.description) changes.description = payload.description;

        const categoriesChanged =
            form.categories.length !== business.categoryIds.length ||
            form.categories.some((id) => !business.categoryIds.includes(id)) ||
            form.primaryCategoryId !== business.primaryCategoryId;

        let coverPath = null;
        if (coverFile) {
            const { path, error: uploadError } = await uploadBusinessReviewImage(business.id, coverFile);
            if (uploadError) {
                setRequestState({ saving: false, error: 'Não foi possível enviar a imagem.', feedback: '' });
                return;
            }
            coverPath = path;
        }

        if (Object.keys(changes).length === 0 && !categoriesChanged && !coverPath) {
            setRequestState({ saving: false, error: 'Nenhuma alteração foi feita.', feedback: '' });
            return;
        }

        const { error } = await supabase.rpc('request_business_changes', {
            p_business_id: business.id,
            p_changes: changes,
            p_category_ids: categoriesChanged ? form.categories : null,
            p_primary_category_id: categoriesChanged ? form.primaryCategoryId : null,
            p_cover_image_path: coverPath,
        });

        if (error) {
            setRequestState({ saving: false, error: businessErrorMessage(error), feedback: '' });
            return;
        }

        setCoverFile(null);
        setRequestState({ saving: false, error: '', feedback: 'Alteração enviada para análise.' });
        await onSaved();
    };

    const cancelRequest = async () => {
        const { error } = await supabase.rpc('cancel_business_change_request', { p_request_id: changeRequest.id });
        if (error) {
            setRequestState({ saving: false, error: businessErrorMessage(error), feedback: '' });
            return;
        }
        await onSaved();
    };

    return (
        <div className="mt-6 flex flex-col gap-8 border-t border-sand-dark pt-6">
            <section>
                <h3 className="font-head text-lg font-bold text-foreground">Telefone</h3>
                <p className="mt-1 text-sm text-dark-ocean/70">Alteração simples: entra no ar assim que você salvar.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                    <input
                        aria-label="Telefone"
                        className={`${inputClasses} sm:max-w-xs`}
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                    />
                    <button
                        type="button"
                        onClick={savePhone}
                        disabled={phoneState.saving}
                        className="rounded-full bg-turquoise px-6 py-3 font-bold text-sand disabled:opacity-70"
                    >
                        Salvar
                    </button>
                </div>
                {phoneState.error && <p className="mt-2 text-sm text-red-600">{phoneState.error}</p>}
                {phoneState.feedback && <p className="mt-2 text-sm text-turquoise">{phoneState.feedback}</p>}
            </section>

            {changeRequest ? (
                <section className="rounded-2xl border border-sun/40 bg-sun/10 p-5">
                    <h3 className="flex items-center gap-2 font-head text-lg font-bold text-foreground">
                        <Clock className="h-4 w-4" aria-hidden="true" /> Alteração em análise
                    </h3>
                    <p className="mt-1 text-sm text-dark-ocean/70">
                        Enviada em {new Date(changeRequest.created_at).toLocaleDateString('pt-BR')}. Seu perfil continua
                        publicado com as informações aprovadas até a equipe decidir.
                    </p>
                    <ul className="mt-3 flex flex-col gap-1 text-sm text-dark-ocean/80">
                        {Object.entries(changeRequest.changes ?? {}).map(([field, value]) => (
                            <li key={field}>
                                <strong className="font-semibold">{field}:</strong> {String(value)}
                            </li>
                        ))}
                        {changeRequest.category_ids && <li>Categorias alteradas</li>}
                        {changeRequest.cover_image_path && <li>Nova imagem de capa</li>}
                    </ul>
                    <button
                        type="button"
                        onClick={cancelRequest}
                        className="mt-4 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-dark-ocean shadow-sm"
                    >
                        Cancelar solicitação
                    </button>
                    {requestState.error && <p className="mt-2 text-sm text-red-600">{requestState.error}</p>}
                </section>
            ) : (
                <form onSubmit={submitRequest} className="flex flex-col gap-5">
                    <div>
                        <h3 className="font-head text-lg font-bold text-foreground">Alterações que passam por análise</h3>
                        <p className="mt-1 text-sm text-dark-ocean/70">
                            Nome, imagem, categorias, endereço e descrição mudam a ficha pública, então a equipe confere
                            antes de publicar. Enquanto isso, seu perfil continua no ar como está.
                        </p>
                    </div>

                    <Field label="Nome do negócio" htmlFor="active-name">
                        <input
                            id="active-name"
                            className={inputClasses}
                            value={form.name}
                            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                        />
                    </Field>

                    <CategoryPicker
                        categories={categories}
                        selected={form.categories}
                        primaryId={form.primaryCategoryId}
                        onChange={(nextCategories, nextPrimary) =>
                            setForm((prev) => ({ ...prev, categories: nextCategories, primaryCategoryId: nextPrimary }))
                        }
                    />

                    <Field
                        label="Descrição (opcional)"
                        htmlFor="active-description"
                        hint={`${form.description.trim().length}/${DESCRIPTION_MAX} caracteres`}
                    >
                        <textarea
                            id="active-description"
                            rows={4}
                            className={inputClasses}
                            value={form.description}
                            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                        />
                    </Field>

                    <Field label="Endereço" htmlFor="active-address">
                        <input
                            id="active-address"
                            className={inputClasses}
                            value={form.street}
                            onChange={(event) => setForm((prev) => ({ ...prev, street: event.target.value, number: '' }))}
                        />
                    </Field>

                    <Field label="Imagem de capa" htmlFor="active-cover">
                        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-dark-ocean shadow-sm">
                            <ImagePlus className="h-4 w-4" aria-hidden="true" />
                            {coverFile ? coverFile.name : 'Escolher nova imagem'}
                            <input
                                id="active-cover"
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
                            />
                        </label>
                    </Field>

                    {requestState.error && (
                        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{requestState.error}</p>
                    )}
                    {requestState.feedback && (
                        <p className="rounded-2xl bg-turquoise/10 px-4 py-3 text-sm text-turquoise">
                            {requestState.feedback}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={requestState.saving}
                        className="flex w-fit items-center gap-2 rounded-full bg-turquoise px-6 py-3 font-bold text-sand disabled:opacity-70"
                    >
                        {requestState.saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                        Enviar para análise
                    </button>
                </form>
            )}
        </div>
    );
}

function MeuNegocio() {
    usePageMeta(staticPageMeta('/meu-negocio'));

    const { user } = useAuth();
    const { business, changeRequest, loading, error, refetch } = useMyBusiness();
    const { categories } = useCategories();
    const [resubmitting, setResubmitting] = useState(false);
    const [resubmitError, setResubmitError] = useState('');

    const resubmit = async () => {
        setResubmitting(true);
        setResubmitError('');
        const { error: rpcError } = await supabase.rpc('resubmit_business', { p_business_id: business.id });
        setResubmitting(false);
        if (rpcError) {
            setResubmitError(businessErrorMessage(rpcError));
            return;
        }
        await refetch();
    };

    return (
        <>
            <section className="bg-gradient-ocean px-4 pt-28 pb-14 sm:px-6 lg:px-8 lg:pt-32">
                <div className="container mx-auto max-w-3xl">
                    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-card/70">
                        <Link to="/" className="hover:text-card">
                            Início
                        </Link>
                        <ChevronRight size={14} aria-hidden="true" />
                        <span className="text-card">Meu Negócio</span>
                    </nav>
                    <h1 className="font-head text-3xl font-extrabold text-card md:text-4xl">Meu Negócio</h1>
                    <p className="mt-2 max-w-2xl text-card/80">
                        Acompanhe a análise, corrija informações e mantenha seus dados em dia.
                    </p>
                </div>
            </section>

            <section className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
                <div className="container mx-auto flex max-w-3xl flex-col gap-6">
                    <div className="rounded-3xl bg-card p-6 shadow-sm">
                        <h2 className="font-head text-lg font-bold text-foreground">Sua conta</h2>
                        <p className="mt-1 text-sm text-dark-ocean/70">{user?.email}</p>
                        <p className="mt-1 text-sm text-dark-ocean/70">
                            Plano <strong className="font-semibold">Gratuito</strong> — cadastro, ficha pública e busca
                            orgânica, sem custo.
                        </p>
                    </div>

                    {loading && <p className="text-sm text-dark-ocean/60">Carregando...</p>}

                    {error && (
                        <p className="rounded-3xl bg-red-50 px-5 py-4 text-sm text-red-700">
                            Não foi possível carregar seu negócio. Recarregue a página em instantes.
                        </p>
                    )}

                    {!loading && !error && !business && (
                        <div className="rounded-3xl border border-dashed border-dark-ocean/20 p-10 text-center">
                            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-turquoise/10 text-turquoise">
                                <Store size={26} aria-hidden="true" />
                            </span>
                            <h2 className="mt-4 font-head text-xl font-bold text-foreground">
                                Você ainda não tem um negócio cadastrado
                            </h2>
                            <p className="mx-auto mt-2 max-w-md text-sm text-dark-ocean/70">
                                O cadastro é gratuito, não exige CNPJ e serve tanto para estabelecimentos quanto para
                                profissionais autônomos que atendem em Pitimbu.
                            </p>
                            <Link
                                to="/cadastrar-negocio"
                                className="mt-6 inline-flex items-center gap-2 rounded-full bg-turquoise px-6 py-3 font-bold text-sand"
                            >
                                Cadastrar meu negócio
                            </Link>
                        </div>
                    )}

                    {!loading && business && (
                        <div className="rounded-3xl bg-card p-6 shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="font-head text-xl font-bold text-foreground">{business.name}</h2>
                                        <span
                                            className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[business.status]}`}
                                        >
                                            {BUSINESS_STATUS_LABELS[business.status]}
                                        </span>
                                    </div>
                                    <p className="notranslate mt-1 text-sm text-dark-ocean/60" translate="no">
                                        {business.categoryNames.join(', ')}
                                    </p>
                                </div>
                                {business.status === 'active' && (
                                    <Link
                                        to={`/negocio/${business.slug}`}
                                        className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-dark-ocean shadow-sm"
                                    >
                                        Ver perfil público
                                        <ExternalLink size={14} aria-hidden="true" />
                                    </Link>
                                )}
                            </div>

                            <p className="mt-4 text-sm text-dark-ocean/80">{STATUS_EXPLANATION[business.status]}</p>

                            {business.moderation_reason && (
                                <div className="mt-4 flex gap-3 rounded-2xl bg-red-50 p-4">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
                                    <div>
                                        <p className="text-sm font-semibold text-red-700">
                                            {moderationReasonLabel(business.moderation_reason)}
                                        </p>
                                        <p className="mt-1 text-sm text-red-700/90">
                                            {moderationReasonForOwner(business.moderation_reason)}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {business.status === 'rejected' && (
                                <div className="mt-4">
                                    <button
                                        type="button"
                                        onClick={resubmit}
                                        disabled={resubmitting}
                                        className="flex items-center gap-2 rounded-full bg-turquoise px-6 py-3 font-bold text-sand disabled:opacity-70"
                                    >
                                        {resubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                                        Reenviar para análise
                                    </button>
                                    {resubmitError && <p className="mt-2 text-sm text-red-600">{resubmitError}</p>}
                                </div>
                            )}

                            {(business.status === 'pending' || business.status === 'rejected') && (
                                <DraftEditor business={business} categories={categories} onSaved={refetch} />
                            )}

                            {business.status === 'active' && (
                                <ActiveEditor
                                    business={business}
                                    categories={categories}
                                    changeRequest={changeRequest}
                                    onSaved={refetch}
                                />
                            )}

                            {business.status === 'suspended' && (
                                <p className="mt-6 border-t border-sand-dark pt-6 text-sm text-dark-ocean/70">
                                    Para resolver a suspensão, fale com a equipe do Farol pela página de{' '}
                                    <Link to="/contato" className="font-semibold text-turquoise">
                                        contato
                                    </Link>
                                    . Seus dados continuam guardados.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </section>
        </>
    );
}

export default MeuNegocio;
