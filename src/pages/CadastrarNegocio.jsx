import { Check, ChevronRight, ImagePlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCategories } from '@/hooks/useCategories';
import { useMyBusiness } from '@/hooks/useMyBusiness';
import HoneypotField from '../components/HoneypotField';
import CategoryPicker from '../components/business/CategoryPicker';
import { usePageMeta } from '../hooks/usePageMeta';
import { staticPageMeta } from '../lib/siteMeta';
import { businessErrorMessage } from '../lib/businessErrors';
import {
    DESCRIPTION_MAX,
    DESCRIPTION_MIN,
    buildBusinessPayload,
    emptyBusinessForm,
    validateBusinessForm,
} from '../lib/businessForm';
import { uploadBusinessCoverImage } from '../lib/uploadBusinessCoverImage';

const steps = ['Sobre o negócio', 'Onde atende', 'Fotos', 'Contato'];

function StepIndicator({ current }) {
    return (
        <div className="flex items-center justify-center gap-2">
            {steps.map((label, index) => {
                const stepNumber = index + 1;
                const isActive = stepNumber === current;
                const isDone = stepNumber < current;
                return (
                    <div key={label} className="flex items-center gap-2">
                        <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                                isDone
                                    ? 'bg-turquoise text-sand'
                                    : isActive
                                      ? 'bg-white text-dark-ocean'
                                      : 'bg-white/20 text-card/70'
                            }`}
                        >
                            {isDone ? <Check size={16} aria-hidden="true" /> : stepNumber}
                        </div>
                        {index < steps.length - 1 && (
                            <div className={`h-0.5 w-8 sm:w-12 ${isDone ? 'bg-turquoise' : 'bg-white/20'}`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function FieldLabel({ htmlFor, children }) {
    return (
        <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-foreground">
            {children}
        </label>
    );
}

const inputClasses =
    'w-full rounded-2xl border border-sand-dark bg-white px-4 py-3 text-dark-ocean focus:border-turquoise focus:outline-none';

// Campos checados em cada passo, para o erro aparecer antes de o usuário
// chegar ao fim do formulário.
const STEP_FIELDS = {
    1: ['name', 'categories', 'primaryCategoryId', 'description'],
    2: ['street', 'serviceArea'],
    3: [],
    4: ['contact'],
};

function CadastrarNegocio() {
    usePageMeta(staticPageMeta('/cadastrar-negocio'));

    const { user } = useAuth();
    const { categories, loading: categoriesLoading } = useCategories();
    const { business: existingBusiness, loading: myBusinessLoading } = useMyBusiness();

    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState(emptyBusinessForm);
    const [photos, setPhotos] = useState([]);
    const [honeypot, setHoneypot] = useState('');
    const [errors, setErrors] = useState({});
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    useEffect(() => {
        return () => {
            photos.forEach((photo) => URL.revokeObjectURL(photo.url));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const updateField = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => ({ ...prev, [field]: undefined, contact: undefined }));
    };

    const handlePhotosSelected = (event) => {
        const files = Array.from(event.target.files ?? []);
        const newPhotos = files.map((file) => ({ file, url: URL.createObjectURL(file) }));
        setPhotos((prev) => [...prev, ...newPhotos]);
        event.target.value = '';
    };

    const removePhoto = (index) => {
        setPhotos((prev) => {
            const target = prev[index];
            if (target) URL.revokeObjectURL(target.url);
            return prev.filter((_, photoIndex) => photoIndex !== index);
        });
    };

    const validateStep = (currentStep) => {
        const all = validateBusinessForm(formData);
        const stepErrors = Object.fromEntries(
            Object.entries(all).filter(([field]) => STEP_FIELDS[currentStep].includes(field))
        );
        setErrors(stepErrors);
        return Object.keys(stepErrors).length === 0;
    };

    const goNext = () => {
        if (!validateStep(step)) return;
        setStep((current) => Math.min(current + 1, steps.length));
    };

    const goBack = () => setStep((current) => Math.max(current - 1, 1));

    const handleSubmit = async (event) => {
        event.preventDefault();

        const allErrors = validateBusinessForm(formData);
        if (Object.keys(allErrors).length > 0) {
            setErrors(allErrors);
            setSubmitError('Revise os campos destacados antes de enviar.');
            return;
        }

        if (honeypot) {
            // Bot: finge sucesso sem cadastrar nada de verdade.
            setSubmitted(true);
            return;
        }

        setSubmitting(true);
        setSubmitError('');

        // Uma chamada só: negócio + categorias + localização privada entram na
        // mesma transação, com slug único gerado no banco.
        const { data: businessId, error } = await supabase.rpc('submit_business', {
            p_payload: buildBusinessPayload(formData),
            p_category_ids: formData.categories,
            p_primary_category_id: formData.primaryCategoryId,
            p_private_address: formData.hasPublicAddress ? null : formData.privateAddress.trim() || null,
        });

        if (error) {
            setSubmitting(false);
            setSubmitError(businessErrorMessage(error, 'Não foi possível enviar seu cadastro. Tente novamente em instantes.'));
            return;
        }

        if (photos.length > 0) {
            const { url } = await uploadBusinessCoverImage(businessId, photos[0].file);
            if (url) {
                await supabase.rpc('set_business_cover_image', { p_business_id: businessId, p_url: url });
            }
        }

        setSubmitting(false);
        setSubmitted(true);
    };

    if (myBusinessLoading) {
        return <div className="min-h-screen bg-background" />;
    }

    // Uma conta possui zero ou um negócio: quem já cadastrou vai para a área de
    // acompanhamento em vez de abrir um segundo cadastro.
    if (existingBusiness && !submitted) {
        return <Navigate to="/meu-negocio" replace />;
    }

    if (submitted) {
        return (
            <section className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 py-32 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-turquoise/10 text-turquoise">
                    <Check size={32} aria-hidden="true" />
                </span>
                <h1 className="font-head text-3xl font-extrabold text-dark-ocean md:text-4xl">
                    Recebemos seu cadastro!
                </h1>
                <p className="max-w-md text-dark-ocean/70">
                    Nossa equipe vai revisar as informações de <strong>{formData.name}</strong> e publicar o perfil em
                    breve. Você acompanha a análise, e pode corrigir o cadastro enquanto isso, em Meu Negócio.
                </p>
                <Link
                    to="/meu-negocio"
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-turquoise px-6 py-3 font-bold text-sand"
                >
                    Ir para Meu Negócio
                </Link>
            </section>
        );
    }

    return (
        <>
            <section className="bg-gradient-ocean px-4 pt-28 pb-14 sm:px-6 lg:px-8 lg:pt-32">
                <div className="container mx-auto max-w-3xl">
                    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-card/70">
                        <Link to="/" className="hover:text-card">
                            Início
                        </Link>
                        <ChevronRight size={14} aria-hidden="true" />
                        <span className="text-card">Cadastrar negócio</span>
                    </nav>
                    <h1 className="font-head text-3xl font-extrabold text-card md:text-4xl">Cadastre seu negócio</h1>
                    <p className="mt-2 max-w-2xl text-card/80">
                        Divulgue no maior portal de Pitimbu. O cadastro é gratuito e não exige CNPJ.
                    </p>
                    <div className="mt-8">
                        <StepIndicator current={step} />
                    </div>
                </div>
            </section>

            <section className="bg-background px-4 py-10 sm:px-6 lg:px-8">
                <div className="container mx-auto max-w-3xl">
                    <form onSubmit={handleSubmit} className="rounded-3xl bg-card p-6 shadow-sm sm:p-8" noValidate>
                        <HoneypotField value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                        <h2 className="font-head text-xl font-bold text-foreground">{steps[step - 1]}</h2>

                        {step === 1 && (
                            <div className="mt-6 flex flex-col gap-5">
                                <div>
                                    <FieldLabel htmlFor="name">Nome do negócio</FieldLabel>
                                    <input
                                        id="name"
                                        type="text"
                                        value={formData.name}
                                        onChange={(event) => updateField('name', event.target.value)}
                                        className={inputClasses}
                                        placeholder="Ex: Pousada Beira Mar, ou seu nome profissional"
                                    />
                                    {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                                </div>

                                {categoriesLoading ? (
                                    <p className="text-sm text-dark-ocean/60">Carregando categorias...</p>
                                ) : (
                                    <CategoryPicker
                                        categories={categories}
                                        selected={formData.categories}
                                        primaryId={formData.primaryCategoryId}
                                        onChange={(nextCategories, nextPrimary) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                categories: nextCategories,
                                                primaryCategoryId: nextPrimary,
                                            }))
                                        }
                                        error={errors.categories}
                                        primaryError={errors.primaryCategoryId}
                                    />
                                )}

                                <div>
                                    <FieldLabel htmlFor="description">Descrição</FieldLabel>
                                    <textarea
                                        id="description"
                                        rows={4}
                                        value={formData.description}
                                        onChange={(event) => updateField('description', event.target.value)}
                                        className={inputClasses}
                                        placeholder="Conte o que você oferece, para quem, e o que diferencia o seu negócio."
                                    />
                                    <p className="mt-1 text-xs text-dark-ocean/60">
                                        {formData.description.trim().length}/{DESCRIPTION_MAX} caracteres · mínimo de{' '}
                                        {DESCRIPTION_MIN}
                                    </p>
                                    {errors.description && (
                                        <p className="mt-1 text-sm text-red-600">{errors.description}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="mt-6 flex flex-col gap-5">
                                {/* Serviço móvel e profissional autônomo não precisam publicar
                                    endereço: a ficha mostra a área de atendimento. */}
                                <div className="flex flex-col gap-2 rounded-2xl bg-sand-dark/40 p-4">
                                    <label className="flex items-start gap-3 text-sm text-dark-ocean">
                                        <input
                                            type="radio"
                                            name="location-mode"
                                            className="mt-1"
                                            checked={formData.hasPublicAddress}
                                            onChange={() => updateField('hasPublicAddress', true)}
                                        />
                                        <span>
                                            <strong className="font-semibold">Tenho um endereço para divulgar</strong>
                                            <br />
                                            Loja, restaurante, pousada, escritório.
                                        </span>
                                    </label>
                                    <label className="flex items-start gap-3 text-sm text-dark-ocean">
                                        <input
                                            type="radio"
                                            name="location-mode"
                                            className="mt-1"
                                            checked={!formData.hasPublicAddress}
                                            onChange={() => updateField('hasPublicAddress', false)}
                                        />
                                        <span>
                                            <strong className="font-semibold">Atendo sem endereço fixo</strong>
                                            <br />
                                            Profissional autônomo ou serviço que vai até o cliente.
                                        </span>
                                    </label>
                                </div>

                                {formData.hasPublicAddress ? (
                                    <>
                                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                                            <div className="sm:col-span-2">
                                                <FieldLabel htmlFor="street">Rua / Avenida</FieldLabel>
                                                <input
                                                    id="street"
                                                    type="text"
                                                    value={formData.street}
                                                    onChange={(event) => updateField('street', event.target.value)}
                                                    className={inputClasses}
                                                    placeholder="Av. Beira Mar"
                                                />
                                                {errors.street && (
                                                    <p className="mt-1 text-sm text-red-600">{errors.street}</p>
                                                )}
                                            </div>
                                            <div>
                                                <FieldLabel htmlFor="number">Número</FieldLabel>
                                                <input
                                                    id="number"
                                                    type="text"
                                                    value={formData.number}
                                                    onChange={(event) => updateField('number', event.target.value)}
                                                    className={inputClasses}
                                                    placeholder="s/n"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <FieldLabel htmlFor="neighborhood">Bairro / localidade</FieldLabel>
                                            <input
                                                id="neighborhood"
                                                type="text"
                                                value={formData.neighborhood}
                                                onChange={(event) => updateField('neighborhood', event.target.value)}
                                                className={inputClasses}
                                                placeholder="Centro, Acaú, Praia dos Mariscos..."
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <FieldLabel htmlFor="serviceArea">Área de atendimento</FieldLabel>
                                            <input
                                                id="serviceArea"
                                                type="text"
                                                value={formData.serviceArea}
                                                onChange={(event) => updateField('serviceArea', event.target.value)}
                                                className={inputClasses}
                                                placeholder="Ex: Pitimbu, Acaú e Praia dos Mariscos"
                                            />
                                            <p className="mt-1 text-xs text-dark-ocean/60">
                                                É isso que aparece na sua ficha no lugar do endereço.
                                            </p>
                                            {errors.serviceArea && (
                                                <p className="mt-1 text-sm text-red-600">{errors.serviceArea}</p>
                                            )}
                                        </div>
                                        <div>
                                            <FieldLabel htmlFor="privateAddress">
                                                Endereço para a equipe do Farol (opcional, não publicado)
                                            </FieldLabel>
                                            <input
                                                id="privateAddress"
                                                type="text"
                                                value={formData.privateAddress}
                                                onChange={(event) => updateField('privateAddress', event.target.value)}
                                                className={inputClasses}
                                                placeholder="Usado só para conferir que o atendimento é na região"
                                            />
                                            <p className="mt-1 text-xs text-dark-ocean/60">
                                                Fica visível apenas para você e para a equipe de análise. Não aparece no
                                                site, no mapa, nem em nenhuma consulta pública.
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {step === 3 && (
                            <div className="mt-6 flex flex-col gap-4">
                                <p className="text-sm text-muted-foreground">
                                    Adicione fotos do seu negócio (opcional). A primeira foto vira a capa do seu perfil
                                    assim que o cadastro for aprovado.
                                </p>
                                <label
                                    htmlFor="photos"
                                    className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sand-dark py-10 text-dark-ocean/70"
                                >
                                    <ImagePlus size={28} aria-hidden="true" />
                                    <span className="text-sm font-semibold">Clique para escolher fotos</span>
                                    <input
                                        id="photos"
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handlePhotosSelected}
                                        className="sr-only"
                                    />
                                </label>

                                {photos.length > 0 && (
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                        {photos.map((photo, index) => (
                                            <div
                                                key={photo.url}
                                                className="group relative aspect-square overflow-hidden rounded-2xl"
                                            >
                                                <img
                                                    src={photo.url}
                                                    alt={`Foto ${index + 1} do negócio`}
                                                    loading="lazy"
                                                    className="h-full w-full object-cover"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removePhoto(index)}
                                                    aria-label="Remover foto"
                                                    className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-dark-ocean/80 text-white"
                                                >
                                                    <X size={14} aria-hidden="true" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {step === 4 && (
                            <div className="mt-6 flex flex-col gap-5">
                                <p className="text-sm text-dark-ocean/70">
                                    Informe pelo menos um contato público: telefone, WhatsApp, e-mail, Instagram ou
                                    site. É por ele que quem encontrar seu perfil vai falar com você.
                                </p>
                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                    <div>
                                        <FieldLabel htmlFor="phone">Telefone</FieldLabel>
                                        <input
                                            id="phone"
                                            type="tel"
                                            value={formData.phone}
                                            onChange={(event) => updateField('phone', event.target.value)}
                                            className={inputClasses}
                                            placeholder="(83) 90000-0000"
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel htmlFor="whatsapp">WhatsApp</FieldLabel>
                                        <input
                                            id="whatsapp"
                                            type="tel"
                                            value={formData.whatsapp}
                                            onChange={(event) => updateField('whatsapp', event.target.value)}
                                            className={inputClasses}
                                            placeholder="(83) 90000-0000"
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel htmlFor="email">E-mail</FieldLabel>
                                        <input
                                            id="email"
                                            type="email"
                                            value={formData.email}
                                            onChange={(event) => updateField('email', event.target.value)}
                                            className={inputClasses}
                                            placeholder="contato@seunegocio.com.br"
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel htmlFor="instagram">Instagram</FieldLabel>
                                        <input
                                            id="instagram"
                                            type="text"
                                            value={formData.instagram}
                                            onChange={(event) => updateField('instagram', event.target.value)}
                                            className={inputClasses}
                                            placeholder="@seunegocio"
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <FieldLabel htmlFor="website">Site</FieldLabel>
                                        <input
                                            id="website"
                                            type="text"
                                            value={formData.website}
                                            onChange={(event) => updateField('website', event.target.value)}
                                            className={inputClasses}
                                            placeholder="seunegocio.com.br"
                                        />
                                    </div>
                                </div>
                                {errors.contact && <p className="text-sm text-red-600">{errors.contact}</p>}

                                <div className="rounded-2xl bg-sand-dark/50 p-5">
                                    <h3 className="font-head font-semibold text-foreground">Revisão</h3>
                                    <dl className="mt-3 flex flex-col gap-1.5 text-sm text-dark-ocean/80">
                                        <div className="flex justify-between gap-4">
                                            <dt>Nome</dt>
                                            <dd className="text-right font-medium">{formData.name || '—'}</dd>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                            <dt>Categorias</dt>
                                            <dd className="notranslate text-right font-medium" translate="no">
                                                {categories
                                                    .filter((category) => formData.categories.includes(category.id))
                                                    .map((category) =>
                                                        category.id === formData.primaryCategoryId
                                                            ? `${category.name} (principal)`
                                                            : category.name
                                                    )
                                                    .join(', ') || '—'}
                                            </dd>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                            <dt>{formData.hasPublicAddress ? 'Endereço' : 'Área de atendimento'}</dt>
                                            <dd className="text-right font-medium">
                                                {formData.hasPublicAddress
                                                    ? [formData.street, formData.number, formData.neighborhood]
                                                          .filter(Boolean)
                                                          .join(', ') || '—'
                                                    : formData.serviceArea || '—'}
                                            </dd>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                            <dt>Fotos</dt>
                                            <dd className="text-right font-medium">{photos.length}</dd>
                                        </div>
                                    </dl>
                                </div>
                            </div>
                        )}

                        {submitError && step === steps.length && (
                            <p className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</p>
                        )}

                        <div className="mt-8 flex items-center justify-between gap-4">
                            <button
                                type="button"
                                onClick={goBack}
                                disabled={step === 1}
                                className="rounded-full px-6 py-3 font-semibold text-dark-ocean disabled:opacity-0"
                            >
                                Voltar
                            </button>
                            {step < steps.length ? (
                                <button
                                    type="button"
                                    onClick={goNext}
                                    className="rounded-full bg-turquoise px-6 py-3 font-bold text-sand"
                                >
                                    Continuar
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={submitting || !user}
                                    className="rounded-full bg-turquoise px-6 py-3 font-bold text-sand disabled:opacity-70"
                                >
                                    {submitting ? 'Enviando...' : 'Enviar cadastro'}
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </section>
        </>
    );
}

export default CadastrarNegocio;
