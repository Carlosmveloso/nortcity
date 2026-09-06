import { AlertTriangle, ChevronRight, Copy, ImagePlus, Link2, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePageMeta } from '../hooks/usePageMeta';
import { staticPageMeta } from '../lib/siteMeta';
import CategoryPicker from '../components/business/CategoryPicker';
import { businessErrorMessage } from '../lib/businessErrors';
import { buildBusinessPayload, businessFormFromRow, emptyBusinessForm, validateBusinessForm } from '../lib/businessForm';
import { BUSINESS_STATUS_LABELS, MODERATION_REASONS, moderationReasonLabel } from '../lib/moderation';
import { normalize } from '../lib/text';
import { reviewImageSignedUrl, uploadBusinessCoverImage } from '../lib/uploadBusinessCoverImage';
import { useAdminBusinesses } from '../hooks/useAdminBusinesses';
import { useAdminCategories } from '../hooks/useAdminCategories';
import { useAdminChangeRequests } from '../hooks/useAdminChangeRequests';

const inputClasses =
    'w-full rounded-2xl border border-sand-dark bg-white px-4 py-2.5 text-sm text-dark-ocean focus:border-turquoise focus:outline-none';

const STATUS_BADGE = {
    pending: 'bg-sun/10 text-sun',
    active: 'bg-turquoise/10 text-turquoise',
    suspended: 'bg-red-100 text-red-700',
    rejected: 'bg-red-100 text-red-700',
};

function StatusBadge({ status }) {
    return (
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[status] ?? ''}`}>
            {BUSINESS_STATUS_LABELS[status] ?? status}
        </span>
    );
}

/** Rejeitar e suspender exigem motivo estruturado; aprovar e reativar, não. */
function ModerationDialog({ action, onConfirm, onCancel }) {
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const confirm = async () => {
        if (!reason) {
            setError('Escolha o motivo da decisão.');
            return;
        }
        setSaving(true);
        const result = await onConfirm(reason, note);
        setSaving(false);
        if (result?.error) setError(businessErrorMessage(result.error));
    };

    return (
        <div className="mt-4 rounded-2xl bg-sand-dark/40 p-4">
            <p className="text-sm font-semibold text-foreground">
                {action === 'reject' ? 'Motivo da rejeição' : 'Motivo da suspensão'}
            </p>
            <select className={`${inputClasses} mt-2`} value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="">Selecione...</option>
                {MODERATION_REASONS.map((item) => (
                    <option key={item.value} value={item.value}>
                        {item.label}
                    </option>
                ))}
            </select>
            <textarea
                className={`${inputClasses} mt-2`}
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Observação interna (opcional, não é mostrada ao proprietário)"
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-3 flex gap-2">
                <button
                    type="button"
                    onClick={confirm}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-70"
                >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    Confirmar
                </button>
                <button type="button" onClick={onCancel} className="rounded-full px-5 py-2.5 text-sm font-semibold text-dark-ocean/70">
                    Cancelar
                </button>
            </div>
        </div>
    );
}

/** Vínculo manual de proprietário: só para negócio sem dono (PRO-03). */
function OwnerLinker({ business, onLink }) {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState({ loading: false, error: '', found: null });

    const search = async () => {
        setStatus({ loading: true, error: '', found: null });
        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .ilike('email', email.trim())
            .maybeSingle();

        if (error || !data) {
            setStatus({ loading: false, error: 'Nenhuma conta encontrada com esse e-mail.', found: null });
            return;
        }
        setStatus({ loading: false, error: '', found: data });
    };

    const link = async () => {
        const result = await onLink(business.id, status.found.id);
        if (result?.error) setStatus((prev) => ({ ...prev, error: businessErrorMessage(result.error) }));
    };

    return (
        <div className="mt-4 rounded-2xl bg-sand-dark/40 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Link2 className="h-4 w-4" aria-hidden="true" /> Vincular proprietário
            </p>
            <p className="mt-1 text-xs text-dark-ocean/60">
                Use depois de confirmar por fora que a pessoa responde pelo negócio. A conta não pode já ser dona de
                outro cadastro.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
                <input
                    className={`${inputClasses} sm:max-w-xs`}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e-mail da conta"
                />
                <button
                    type="button"
                    onClick={search}
                    disabled={status.loading}
                    className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-dark-ocean shadow-sm"
                >
                    Buscar conta
                </button>
            </div>
            {status.found && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                    <span className="text-sm text-dark-ocean/80">
                        {status.found.full_name ?? 'Sem nome'} · {status.found.email}
                    </span>
                    <button
                        type="button"
                        onClick={link}
                        className="rounded-full bg-turquoise px-5 py-2.5 text-sm font-bold text-sand"
                    >
                        Vincular
                    </button>
                </div>
            )}
            {status.error && <p className="mt-2 text-sm text-red-600">{status.error}</p>}
        </div>
    );
}

/** Suspeita de duplicidade: decisão humana, nunca fusão automática. */
function DuplicateAlert({ business, businesses, onResolve, onReviewed }) {
    const [error, setError] = useState('');

    const resolve = async (originalId) => {
        const result = await onResolve(originalId, business.id);
        if (result?.error) setError(businessErrorMessage(result.error));
    };

    return (
        <div className="mt-4 rounded-2xl border border-sun/40 bg-sun/10 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Copy className="h-4 w-4" aria-hidden="true" /> Possível duplicata
            </p>
            <ul className="mt-2 flex flex-col gap-2">
                {business.duplicateAlert.map((candidate) => {
                    const original = businesses.find((item) => item.id === candidate.id);
                    return (
                        <li key={candidate.id} className="flex flex-wrap items-center gap-2 text-sm text-dark-ocean/80">
                            <span className="font-semibold">{candidate.name}</span>
                            <StatusBadge status={candidate.status} />
                            {original && !original.owner_id && business.owner_id && (
                                <button
                                    type="button"
                                    onClick={() => resolve(candidate.id)}
                                    className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-dark-ocean shadow-sm"
                                >
                                    Este é o original: apagar duplicata e vincular a conta
                                </button>
                            )}
                        </li>
                    );
                })}
            </ul>
            <button
                type="button"
                onClick={() => onReviewed(business.id)}
                className="mt-3 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-dark-ocean shadow-sm"
            >
                Não é duplicata
            </button>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
    );
}

function BusinessEditor({ business, categories, onSave, onCancel }) {
    const [form, setForm] = useState(businessFormFromRow(business));
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [uploading, setUploading] = useState(false);

    const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

    const handleImageChange = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setUploading(true);
        const { url, error: uploadError } = await uploadBusinessCoverImage(business.id, file);
        setUploading(false);
        if (uploadError) {
            setError('Não foi possível enviar a imagem.');
            return;
        }
        await supabase.rpc('set_business_cover_image', { p_business_id: business.id, p_url: url });
        await onSave(null);
    };

    const handleSave = async () => {
        const validation = validateBusinessForm(form);
        // Cadastro ainda em análise pode ficar incompleto; publicado, não.
        if (business.status === 'active' && Object.keys(validation).length > 0) {
            setErrors(validation);
            setError('O negócio está publicado: corrija os campos antes de salvar.');
            return;
        }
        setErrors(validation);

        setSaving(true);
        const result = await onSave({
            payload: buildBusinessPayload(form),
            categoryIds: form.categories.length > 0 ? form.categories : null,
            primaryCategoryId: form.primaryCategoryId,
        });
        setSaving(false);
        if (result?.error) setError(businessErrorMessage(result.error));
    };

    return (
        <div className="mt-4 grid gap-3 border-t border-sand-dark pt-4">
            <div className="flex items-center gap-4">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-sand-dark">
                    {business.cover_image && <img src={business.cover_image} alt="" className="h-full w-full object-cover" />}
                </div>
                <label className="flex w-fit cursor-pointer items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-dark-ocean shadow-sm">
                    {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                        <ImagePlus className="h-4 w-4" aria-hidden="true" />
                    )}
                    {uploading ? 'Enviando...' : 'Trocar imagem'}
                    <input type="file" accept="image/*" onChange={handleImageChange} disabled={uploading} className="sr-only" />
                </label>
            </div>

            <input className={inputClasses} value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Nome" />
            {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}

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

            <textarea
                className={inputClasses}
                rows={3}
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Descrição"
            />
            {errors.description && <p className="text-sm text-red-600">{errors.description}</p>}

            <div className="grid gap-3 sm:grid-cols-2">
                <input className={inputClasses} value={form.street} onChange={(e) => update('street', e.target.value)} placeholder="Endereço" />
                <input
                    className={inputClasses}
                    value={form.neighborhood}
                    onChange={(e) => update('neighborhood', e.target.value)}
                    placeholder="Bairro"
                />
                <input
                    className={inputClasses}
                    value={form.serviceArea}
                    onChange={(e) => update('serviceArea', e.target.value)}
                    placeholder="Área de atendimento"
                />
                <input className={inputClasses} value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="Telefone" />
                <input className={inputClasses} value={form.whatsapp} onChange={(e) => update('whatsapp', e.target.value)} placeholder="WhatsApp" />
                <input className={inputClasses} value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="E-mail" />
                <input className={inputClasses} value={form.instagram} onChange={(e) => update('instagram', e.target.value)} placeholder="Instagram" />
                <input className={inputClasses} value={form.website} onChange={(e) => update('website', e.target.value)} placeholder="Website" />
            </div>
            {errors.contact && <p className="text-sm text-red-600">{errors.contact}</p>}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-full bg-turquoise px-5 py-2.5 text-sm font-bold text-sand disabled:opacity-70"
                >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    Salvar
                </button>
                <button type="button" onClick={onCancel} className="rounded-full px-5 py-2.5 text-sm font-semibold text-dark-ocean/70">
                    Cancelar
                </button>
            </div>
        </div>
    );
}

function BusinessCreateForm({ categories, onCreate, onCancel }) {
    const [form, setForm] = useState(emptyBusinessForm);
    const [status, setStatus] = useState('pending');
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

    const handleSave = async () => {
        const validation = validateBusinessForm(form);
        if (Object.keys(validation).length > 0 && status === 'active') {
            setErrors(validation);
            setError('Para publicar direto, o cadastro precisa atender aos critérios de aprovação.');
            return;
        }
        if (!form.name.trim() || form.categories.length === 0) {
            setErrors(validation);
            setError('Nome e ao menos uma categoria são obrigatórios.');
            return;
        }

        setSaving(true);
        setError('');
        const result = await onCreate(buildBusinessPayload(form), form.categories, form.primaryCategoryId, status);
        setSaving(false);
        if (result?.error) {
            setError(businessErrorMessage(result.error));
            return;
        }
        onCancel();
    };

    return (
        <div className="mb-6 rounded-3xl bg-card p-5 shadow-sm">
            <h3 className="flex items-center gap-2 font-head text-lg font-bold text-foreground">
                <Plus className="h-4 w-4" aria-hidden="true" /> Adicionar negócio
            </h3>
            <p className="mt-1 text-xs text-dark-ocean/60">
                Negócio criado aqui fica sem proprietário. Se o responsável aparecer depois, use “Vincular
                proprietário”.
            </p>
            <div className="mt-4 grid gap-3">
                <input className={inputClasses} value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Nome" />
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
                <textarea
                    className={inputClasses}
                    rows={3}
                    value={form.description}
                    onChange={(e) => update('description', e.target.value)}
                    placeholder="Descrição"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                    <input className={inputClasses} value={form.street} onChange={(e) => update('street', e.target.value)} placeholder="Endereço" />
                    <input
                        className={inputClasses}
                        value={form.neighborhood}
                        onChange={(e) => update('neighborhood', e.target.value)}
                        placeholder="Bairro"
                    />
                    <input className={inputClasses} value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="Telefone" />
                    <input className={inputClasses} value={form.whatsapp} onChange={(e) => update('whatsapp', e.target.value)} placeholder="WhatsApp" />
                    <input className={inputClasses} value={form.instagram} onChange={(e) => update('instagram', e.target.value)} placeholder="Instagram" />
                    <input className={inputClasses} value={form.website} onChange={(e) => update('website', e.target.value)} placeholder="Website" />
                    <select className={inputClasses} value={status} onChange={(e) => setStatus(e.target.value)}>
                        <option value="pending">Entra pendente</option>
                        <option value="active">Publicar direto</option>
                    </select>
                </div>
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="mt-4 flex gap-2">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-full bg-turquoise px-5 py-2.5 text-sm font-bold text-sand disabled:opacity-70"
                >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    Salvar
                </button>
                <button type="button" onClick={onCancel} className="rounded-full px-5 py-2.5 text-sm font-semibold text-dark-ocean/70">
                    Cancelar
                </button>
            </div>
        </div>
    );
}

function BusinessesTab() {
    const {
        businesses,
        loading,
        error,
        moderate,
        updateBusiness,
        createBusiness,
        deleteBusiness,
        linkOwner,
        resolveDuplicate,
        markDuplicateReviewed,
    } = useAdminBusinesses();
    const { categories } = useAdminCategories();
    const [statusFilter, setStatusFilter] = useState('pending');
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [creating, setCreating] = useState(false);
    const [moderating, setModerating] = useState(null);
    const [actionError, setActionError] = useState('');

    const byStatus = statusFilter === 'all' ? businesses : businesses.filter((b) => b.status === statusFilter);
    const normalizedSearch = normalize(search.trim());
    const filtered = normalizedSearch ? byStatus.filter((b) => normalize(b.name).includes(normalizedSearch)) : byStatus;

    const quickModerate = async (id, action) => {
        setActionError('');
        const result = await moderate(id, action);
        if (result?.error) setActionError(businessErrorMessage(result.error));
    };

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative max-w-sm flex-1">
                    <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-dark-ocean/40" aria-hidden="true" />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar negócio pelo nome..."
                        className="w-full rounded-full border border-sand-dark bg-white py-2.5 pr-4 pl-10 text-sm text-dark-ocean focus:border-turquoise focus:outline-none"
                    />
                </div>
                <button
                    type="button"
                    onClick={() => setCreating((prev) => !prev)}
                    className="flex items-center gap-2 rounded-full bg-turquoise px-5 py-2.5 text-sm font-bold text-sand"
                >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    {creating ? 'Fechar' : 'Adicionar negócio'}
                </button>
            </div>

            {creating && (
                <div className="mt-4">
                    <BusinessCreateForm categories={categories} onCreate={createBusiness} onCancel={() => setCreating(false)} />
                </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
                {['pending', 'active', 'suspended', 'rejected', 'all'].map((value) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => setStatusFilter(value)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold ${
                            statusFilter === value ? 'bg-turquoise text-sand' : 'bg-white text-dark-ocean shadow-sm'
                        }`}
                    >
                        {value === 'all' ? 'Todos' : BUSINESS_STATUS_LABELS[value]}
                    </button>
                ))}
            </div>

            {loading && <p className="mt-6 text-sm text-dark-ocean/60">Carregando...</p>}
            {error && <p className="mt-6 text-sm text-red-600">Não foi possível carregar os negócios.</p>}
            {actionError && <p className="mt-6 text-sm text-red-600">{actionError}</p>}

            {!loading && filtered.length === 0 && <p className="mt-6 text-sm text-dark-ocean/60">Nenhum negócio nesse filtro.</p>}

            <div className="mt-6 flex flex-col gap-4">
                {filtered.map((business) => (
                    <div key={business.id} className="rounded-3xl bg-card p-5 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-sand-dark">
                                    {business.cover_image && <img src={business.cover_image} alt="" className="h-full w-full object-cover" />}
                                </div>
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="font-head text-lg font-bold text-foreground">{business.name}</h3>
                                        <StatusBadge status={business.status} />
                                        {business.duplicateAlert && (
                                            <span className="flex items-center gap-1 rounded-full bg-sun/15 px-3 py-1 text-xs font-semibold text-sun">
                                                <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Possível duplicata
                                            </span>
                                        )}
                                        {!business.owner_id && (
                                            <span className="rounded-full bg-sand-dark px-3 py-1 text-xs font-semibold text-dark-ocean/70">
                                                Sem proprietário
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-1 text-sm text-dark-ocean/60">
                                        {business.categories.join(', ') || 'Sem categoria'} ·{' '}
                                        {business.address || business.service_area || 'Sem endereço'}
                                    </p>
                                    {business.moderation_reason && (
                                        <p className="mt-1 text-sm text-red-700">
                                            {moderationReasonLabel(business.moderation_reason)}
                                            {business.moderation_note ? ` — ${business.moderation_note}` : ''}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {business.status === 'pending' && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => quickModerate(business.id, 'approve')}
                                            className="rounded-full bg-turquoise px-4 py-2 text-sm font-semibold text-sand"
                                        >
                                            Aprovar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setModerating({ id: business.id, action: 'reject' })}
                                            className="rounded-full bg-red-100 px-4 py-2 text-sm font-semibold text-red-700"
                                        >
                                            Rejeitar
                                        </button>
                                    </>
                                )}
                                {business.status === 'active' && (
                                    <button
                                        type="button"
                                        onClick={() => setModerating({ id: business.id, action: 'suspend' })}
                                        className="rounded-full bg-red-100 px-4 py-2 text-sm font-semibold text-red-700"
                                    >
                                        Suspender
                                    </button>
                                )}
                                {business.status === 'suspended' && (
                                    <button
                                        type="button"
                                        onClick={() => quickModerate(business.id, 'reactivate')}
                                        className="rounded-full bg-turquoise px-4 py-2 text-sm font-semibold text-sand"
                                    >
                                        Reativar
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setEditingId(editingId === business.id ? null : business.id)}
                                    className="rounded-full px-4 py-2 text-sm font-semibold text-dark-ocean shadow-sm"
                                >
                                    {editingId === business.id ? 'Fechar' : 'Editar'}
                                </button>
                                {business.status !== 'active' && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (window.confirm(`Excluir "${business.name}" definitivamente?`)) {
                                                deleteBusiness(business.id);
                                            }
                                        }}
                                        aria-label={`Excluir ${business.name}`}
                                        className="flex h-9 w-9 items-center justify-center rounded-full text-red-600 hover:bg-red-50"
                                    >
                                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {moderating?.id === business.id && (
                            <ModerationDialog
                                action={moderating.action}
                                onCancel={() => setModerating(null)}
                                onConfirm={async (reason, note) => {
                                    const result = await moderate(business.id, moderating.action, reason, note);
                                    if (!result?.error) setModerating(null);
                                    return result;
                                }}
                            />
                        )}

                        {business.duplicateAlert && (
                            <DuplicateAlert
                                business={business}
                                businesses={businesses}
                                onResolve={resolveDuplicate}
                                onReviewed={markDuplicateReviewed}
                            />
                        )}

                        {!business.owner_id && <OwnerLinker business={business} onLink={linkOwner} />}

                        {editingId === business.id && (
                            <BusinessEditor
                                business={business}
                                categories={categories}
                                onCancel={() => setEditingId(null)}
                                onSave={async (patch) => {
                                    if (!patch) return { error: null };
                                    const result = await updateBusiness(
                                        business.id,
                                        patch.payload,
                                        patch.categoryIds,
                                        patch.primaryCategoryId
                                    );
                                    if (!result?.error) setEditingId(null);
                                    return result;
                                }}
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Fila de alterações sensíveis de negócios publicados (EDI-02/EDI-03). */
function ChangeRequestsTab() {
    const { requests, loading, review } = useAdminChangeRequests();
    const [error, setError] = useState('');
    const [previews, setPreviews] = useState({});

    const showCover = async (request) => {
        const { url } = await reviewImageSignedUrl(request.cover_image_path);
        if (url) setPreviews((prev) => ({ ...prev, [request.id]: url }));
    };

    const decide = async (request, action) => {
        setError('');
        const reason = action === 'reject' ? window.prompt('Motivo da recusa (opcional):') : null;
        const result = await review(request, action, reason);
        if (result?.error) setError(businessErrorMessage(result.error));
    };

    if (loading) return <p className="text-sm text-dark-ocean/60">Carregando...</p>;

    if (requests.length === 0) {
        return <p className="text-sm text-dark-ocean/60">Nenhuma alteração aguardando análise.</p>;
    }

    return (
        <div className="flex flex-col gap-4">
            {error && <p className="text-sm text-red-600">{error}</p>}
            {requests.map((request) => (
                <div key={request.id} className="rounded-3xl bg-card p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-head text-lg font-bold text-foreground">{request.businesses?.name}</h3>
                        <span className="text-xs text-dark-ocean/60">
                            Enviada em {new Date(request.created_at).toLocaleDateString('pt-BR')}
                        </span>
                    </div>

                    <dl className="mt-3 flex flex-col gap-2 text-sm">
                        {Object.entries(request.changes ?? {}).map(([field, value]) => (
                            <div key={field} className="rounded-2xl bg-sand-dark/40 p-3">
                                <dt className="font-semibold text-foreground">{field}</dt>
                                <dd className="mt-1 text-dark-ocean/70 line-through">
                                    {String(request.base_values?.[field] ?? '—')}
                                </dd>
                                <dd className="text-dark-ocean">{String(value ?? '—')}</dd>
                            </div>
                        ))}
                        {request.category_ids && (
                            <div className="rounded-2xl bg-sand-dark/40 p-3 text-dark-ocean">Categorias alteradas</div>
                        )}
                        {request.cover_image_path && (
                            <div className="rounded-2xl bg-sand-dark/40 p-3">
                                <p className="font-semibold text-foreground">Nova imagem de capa</p>
                                {previews[request.id] ? (
                                    <img
                                        src={previews[request.id]}
                                        alt="Capa proposta"
                                        className="mt-2 h-40 w-full rounded-xl object-cover"
                                    />
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => showCover(request)}
                                        className="mt-2 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-dark-ocean shadow-sm"
                                    >
                                        Ver imagem proposta
                                    </button>
                                )}
                            </div>
                        )}
                    </dl>

                    <div className="mt-4 flex gap-2">
                        <button
                            type="button"
                            onClick={() => decide(request, 'approve')}
                            className="rounded-full bg-turquoise px-5 py-2.5 text-sm font-bold text-sand"
                        >
                            Aprovar
                        </button>
                        <button
                            type="button"
                            onClick={() => decide(request, 'reject')}
                            className="rounded-full bg-red-100 px-5 py-2.5 text-sm font-semibold text-red-700"
                        >
                            Recusar
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}

const emptyCategory = { slug: '', name: '', description: '', icon: '', image_url: '', featured: false, order_index: 0 };

function CategoriesTab() {
    const { categories, loading, error, createCategory, updateCategory, deleteCategory } = useAdminCategories();
    const [editingId, setEditingId] = useState(null);
    const [newCategory, setNewCategory] = useState(emptyCategory);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');
    const [deleteError, setDeleteError] = useState('');

    const handleCreate = async (event) => {
        event.preventDefault();
        if (!newCategory.slug.trim() || !newCategory.name.trim()) {
            setCreateError('Preencha ao menos slug e nome.');
            return;
        }
        setCreating(true);
        setCreateError('');
        const { error: createErr } = await createCategory({
            ...newCategory,
            order_index: Number(newCategory.order_index) || 0,
        });
        setCreating(false);
        if (createErr) {
            setCreateError('Não foi possível criar (slug já existe?).');
            return;
        }
        setNewCategory(emptyCategory);
    };

    const handleDelete = async (id) => {
        setDeleteError('');
        const { error: deleteErr } = await deleteCategory(id);
        if (deleteErr) {
            setDeleteError('Não foi possível excluir: existem negócios usando essa categoria.');
        }
    };

    return (
        <div>
            {loading && <p className="text-sm text-dark-ocean/60">Carregando...</p>}
            {error && <p className="text-sm text-red-600">Não foi possível carregar as categorias.</p>}
            {deleteError && <p className="mb-4 text-sm text-red-600">{deleteError}</p>}

            <p className="mb-4 text-sm text-dark-ocean/60">
                Categoria criada aqui aparece imediatamente no formulário público de cadastro.
            </p>

            <div className="flex flex-col gap-3">
                {categories.map((category) => (
                    <div key={category.id} className="rounded-3xl bg-card p-5 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="font-head font-bold text-foreground">
                                    {category.name}{' '}
                                    <span className="notranslate text-sm font-normal text-dark-ocean/50">({category.slug})</span>
                                </p>
                                <p className="text-sm text-dark-ocean/60">
                                    Ordem: {category.order_index} {category.featured && '· Em destaque'}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingId(editingId === category.id ? null : category.id)}
                                    className="rounded-full px-4 py-2 text-sm font-semibold text-dark-ocean shadow-sm"
                                >
                                    {editingId === category.id ? 'Fechar' : 'Editar'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDelete(category.id)}
                                    aria-label={`Excluir ${category.name}`}
                                    className="flex h-9 w-9 items-center justify-center rounded-full text-red-600 hover:bg-red-50"
                                >
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </button>
                            </div>
                        </div>

                        {editingId === category.id && (
                            <CategoryEditForm
                                category={category}
                                onCancel={() => setEditingId(null)}
                                onSave={async (patch) => {
                                    await updateCategory(category.id, patch);
                                    setEditingId(null);
                                }}
                            />
                        )}
                    </div>
                ))}
            </div>

            <form onSubmit={handleCreate} className="mt-6 rounded-3xl bg-card p-5 shadow-sm">
                <h3 className="flex items-center gap-2 font-head font-bold text-foreground">
                    <Plus className="h-4 w-4" aria-hidden="true" /> Nova categoria
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input
                        className={inputClasses}
                        placeholder="Slug (ex: pesca)"
                        value={newCategory.slug}
                        onChange={(e) => setNewCategory((prev) => ({ ...prev, slug: e.target.value }))}
                    />
                    <input
                        className={inputClasses}
                        placeholder="Nome (ex: Pesca)"
                        value={newCategory.name}
                        onChange={(e) => setNewCategory((prev) => ({ ...prev, name: e.target.value }))}
                    />
                    <input
                        className={`${inputClasses} sm:col-span-2`}
                        placeholder="Descrição (opcional)"
                        value={newCategory.description}
                        onChange={(e) => setNewCategory((prev) => ({ ...prev, description: e.target.value }))}
                    />
                    <input
                        className={inputClasses}
                        placeholder="Ícone lucide (opcional, ex: Fish)"
                        value={newCategory.icon}
                        onChange={(e) => setNewCategory((prev) => ({ ...prev, icon: e.target.value }))}
                    />
                    <input
                        type="number"
                        className={inputClasses}
                        placeholder="Ordem"
                        value={newCategory.order_index}
                        onChange={(e) => setNewCategory((prev) => ({ ...prev, order_index: e.target.value }))}
                    />
                </div>
                {createError && <p className="mt-2 text-sm text-red-600">{createError}</p>}
                <button
                    type="submit"
                    disabled={creating}
                    className="mt-3 rounded-full bg-turquoise px-5 py-2.5 text-sm font-bold text-sand disabled:opacity-70"
                >
                    {creating ? 'Criando...' : 'Criar categoria'}
                </button>
            </form>
        </div>
    );
}

function CategoryEditForm({ category, onSave, onCancel }) {
    const [form, setForm] = useState({
        name: category.name,
        description: category.description ?? '',
        icon: category.icon ?? '',
        image_url: category.image_url ?? '',
        featured: category.featured,
        order_index: category.order_index,
    });
    const [saving, setSaving] = useState(false);

    const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

    const handleSave = async () => {
        setSaving(true);
        await onSave({ ...form, order_index: Number(form.order_index) || 0 });
        setSaving(false);
    };

    return (
        <div className="mt-4 grid gap-3 border-t border-sand-dark pt-4 sm:grid-cols-2">
            <input className={inputClasses} value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Nome" />
            <input className={inputClasses} value={form.icon} onChange={(e) => update('icon', e.target.value)} placeholder="Ícone lucide" />
            <textarea
                className={`${inputClasses} sm:col-span-2`}
                rows={2}
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Descrição"
            />
            <input
                type="number"
                className={inputClasses}
                value={form.order_index}
                onChange={(e) => update('order_index', e.target.value)}
                placeholder="Ordem"
            />
            <label className="flex items-center gap-2 text-sm text-dark-ocean">
                <input type="checkbox" checked={form.featured} onChange={(e) => update('featured', e.target.checked)} />
                Em destaque
            </label>

            <div className="flex gap-2 sm:col-span-2">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-full bg-turquoise px-5 py-2.5 text-sm font-bold text-sand disabled:opacity-70"
                >
                    Salvar
                </button>
                <button type="button" onClick={onCancel} className="rounded-full px-5 py-2.5 text-sm font-semibold text-dark-ocean/70">
                    Cancelar
                </button>
            </div>
        </div>
    );
}

const TABS = [
    { value: 'businesses', label: 'Negócios' },
    { value: 'requests', label: 'Alterações' },
    { value: 'categories', label: 'Categorias' },
];

function Admin() {
    usePageMeta(staticPageMeta('/admin'));

    const [tab, setTab] = useState('businesses');

    return (
        <>
            <section className="bg-gradient-ocean px-4 pt-28 pb-14 sm:px-6 lg:px-8 lg:pt-32">
                <div className="container mx-auto max-w-5xl">
                    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-card/70">
                        <Link to="/" className="hover:text-card">
                            Início
                        </Link>
                        <ChevronRight size={14} aria-hidden="true" />
                        <span className="text-card">Admin</span>
                    </nav>
                    <h1 className="font-head text-3xl font-extrabold text-card md:text-4xl">Painel Admin</h1>
                    <p className="mt-2 max-w-2xl text-card/80">
                        Aprove cadastros, revise alterações de negócios publicados e gerencie categorias.
                    </p>
                </div>
            </section>

            <section className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
                <div className="container mx-auto max-w-5xl">
                    <div className="flex flex-wrap gap-2">
                        {TABS.map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                onClick={() => setTab(item.value)}
                                className={`rounded-full px-5 py-2.5 text-sm font-bold ${
                                    tab === item.value ? 'bg-turquoise text-sand' : 'bg-white text-dark-ocean shadow-sm'
                                }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    <div className="mt-8">
                        {tab === 'businesses' && <BusinessesTab />}
                        {tab === 'requests' && <ChangeRequestsTab />}
                        {tab === 'categories' && <CategoriesTab />}
                    </div>
                </div>
            </section>
        </>
    );
}

export default Admin;
