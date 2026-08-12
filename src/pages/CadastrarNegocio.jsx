import {
    ChevronRight,
    Waves,
    UtensilsCrossed,
    BedDouble,
    Wrench,
    ShoppingBag,
    Moon,
    Sparkles,
    Check,
    ImagePlus,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const businessCategories = [
    { value: 'passeios', label: 'Passeios', icon: Waves },
    { value: 'gastronomia', label: 'Gastronomia', icon: UtensilsCrossed },
    { value: 'hospedagem', label: 'Hospedagem', icon: BedDouble },
    { value: 'servicos', label: 'Serviços', icon: Wrench },
    { value: 'compras', label: 'Compras', icon: ShoppingBag },
    { value: 'vida-noturna', label: 'Vida noturna', icon: Moon },
    { value: 'bem-estar', label: 'Bem-estar', icon: Sparkles },
];

const steps = ['Sobre o negócio', 'Endereço', 'Fotos', 'Contato'];

const initialFormData = {
    name: '',
    category: '',
    description: '',
    street: '',
    number: '',
    neighborhood: '',
    zipCode: '',
    phone: '',
    whatsapp: '',
    instagram: '',
};

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

function CadastrarNegocio() {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState(initialFormData);
    const [photos, setPhotos] = useState([]);
    const [errors, setErrors] = useState({});
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        return () => {
            photos.forEach((photo) => URL.revokeObjectURL(photo.url));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const updateField = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => ({ ...prev, [field]: undefined }));
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
        const nextErrors = {};
        if (currentStep === 1) {
            if (!formData.name.trim()) nextErrors.name = 'Informe o nome do negócio.';
            if (!formData.category) nextErrors.category = 'Selecione uma categoria.';
        }
        if (currentStep === 2) {
            if (!formData.street.trim()) nextErrors.street = 'Informe a rua ou avenida.';
            if (!formData.neighborhood.trim()) nextErrors.neighborhood = 'Informe o bairro.';
        }
        if (currentStep === 4) {
            if (!formData.phone.trim()) nextErrors.phone = 'Informe um telefone de contato.';
        }
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const goNext = () => {
        if (!validateStep(step)) return;
        setStep((current) => Math.min(current + 1, steps.length));
    };

    const goBack = () => {
        setStep((current) => Math.max(current - 1, 1));
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        if (!validateStep(4)) return;
        setSubmitting(true);
        setTimeout(() => {
            setSubmitting(false);
            setSubmitted(true);
        }, 900);
    };

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
                    Nossa equipe vai revisar as informações de <strong>{formData.name}</strong> e ativar o perfil em
                    breve. Assim que a integração com o painel do dono estiver pronta, você poderá acompanhar tudo por
                    aqui.
                </p>
                <Link to="/" className="mt-4 inline-flex items-center gap-2 rounded-full bg-turquoise px-6 py-3 font-bold text-sand">
                    Voltar para a home
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
                    <p className="mt-2 max-w-2xl text-card/80">Divulgue no maior portal de Pitimbu.</p>
                    <div className="mt-8">
                        <StepIndicator current={step} />
                    </div>
                </div>
            </section>

            <section className="bg-background px-4 py-10 sm:px-6 lg:px-8">
                <div className="container mx-auto max-w-3xl">
                    <form
                        onSubmit={handleSubmit}
                        className="rounded-3xl bg-card p-6 shadow-sm sm:p-8"
                        noValidate
                    >
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
                                        placeholder="Ex: Pousada Beira Mar"
                                    />
                                    {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                                </div>

                                <div>
                                    <FieldLabel>Categoria</FieldLabel>
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                        {businessCategories.map((category) => {
                                            const Icon = category.icon;
                                            const isSelected = formData.category === category.value;
                                            return (
                                                <button
                                                    key={category.value}
                                                    type="button"
                                                    onClick={() => updateField('category', category.value)}
                                                    aria-pressed={isSelected}
                                                    className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-sm font-semibold transition-colors ${
                                                        isSelected
                                                            ? 'border-turquoise bg-turquoise/10 text-turquoise'
                                                            : 'border-sand-dark bg-white text-dark-ocean'
                                                    }`}
                                                >
                                                    <Icon size={22} aria-hidden="true" />
                                                    <span className="notranslate" translate="no">
                                                        {category.label}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category}</p>}
                                </div>

                                <div>
                                    <FieldLabel htmlFor="description">Descrição (opcional)</FieldLabel>
                                    <textarea
                                        id="description"
                                        rows={4}
                                        value={formData.description}
                                        onChange={(event) => updateField('description', event.target.value)}
                                        className={inputClasses}
                                        placeholder="Conte um pouco sobre o seu negócio"
                                    />
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="mt-6 flex flex-col gap-5">
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
                                        {errors.street && <p className="mt-1 text-sm text-red-600">{errors.street}</p>}
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
                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                    <div>
                                        <FieldLabel htmlFor="neighborhood">Bairro</FieldLabel>
                                        <input
                                            id="neighborhood"
                                            type="text"
                                            value={formData.neighborhood}
                                            onChange={(event) => updateField('neighborhood', event.target.value)}
                                            className={inputClasses}
                                            placeholder="Centro"
                                        />
                                        {errors.neighborhood && (
                                            <p className="mt-1 text-sm text-red-600">{errors.neighborhood}</p>
                                        )}
                                    </div>
                                    <div>
                                        <FieldLabel htmlFor="zipCode">CEP (opcional)</FieldLabel>
                                        <input
                                            id="zipCode"
                                            type="text"
                                            value={formData.zipCode}
                                            onChange={(event) => updateField('zipCode', event.target.value)}
                                            className={inputClasses}
                                            placeholder="58325-000"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="mt-6 flex flex-col gap-4">
                                <p className="text-sm text-muted-foreground">
                                    Adicione fotos do seu negócio (opcional nesta etapa de teste — nenhum arquivo é
                                    enviado a um servidor).
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
                                            <div key={photo.url} className="group relative aspect-square overflow-hidden rounded-2xl">
                                                <img
                                                    src={photo.url}
                                                    alt={`Foto ${index + 1} do negócio`}
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
                                        {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
                                    </div>
                                    <div>
                                        <FieldLabel htmlFor="whatsapp">WhatsApp (opcional)</FieldLabel>
                                        <input
                                            id="whatsapp"
                                            type="tel"
                                            value={formData.whatsapp}
                                            onChange={(event) => updateField('whatsapp', event.target.value)}
                                            className={inputClasses}
                                            placeholder="(83) 90000-0000"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <FieldLabel htmlFor="instagram">Instagram (opcional)</FieldLabel>
                                    <input
                                        id="instagram"
                                        type="text"
                                        value={formData.instagram}
                                        onChange={(event) => updateField('instagram', event.target.value)}
                                        className={inputClasses}
                                        placeholder="@seunegocio"
                                    />
                                </div>

                                <div className="rounded-2xl bg-sand-dark/50 p-5">
                                    <h3 className="font-head font-semibold text-foreground">Revisão</h3>
                                    <dl className="mt-3 flex flex-col gap-1.5 text-sm text-dark-ocean/80">
                                        <div className="flex justify-between gap-4">
                                            <dt>Nome</dt>
                                            <dd className="text-right font-medium">{formData.name || '—'}</dd>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                            <dt>Categoria</dt>
                                            <dd className="notranslate text-right font-medium" translate="no">
                                                {businessCategories.find((c) => c.value === formData.category)?.label ?? '—'}
                                            </dd>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                            <dt>Endereço</dt>
                                            <dd className="text-right font-medium">
                                                {[formData.street, formData.number, formData.neighborhood]
                                                    .filter(Boolean)
                                                    .join(', ') || '—'}
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
                                    disabled={submitting}
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
