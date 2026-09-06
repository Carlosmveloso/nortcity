import {
    BedDouble,
    HardHat,
    Palette,
    PartyPopper,
    ShoppingBag,
    Star,
    Store,
    UtensilsCrossed,
    Waves,
    Wrench,
} from 'lucide-react';
import { MAX_CATEGORIES, nextPrimaryCategory } from '@/lib/businessForm';

// Registro estático de ícones: importar o lucide inteiro para resolver
// `category.icon` em runtime traria o pacote todo para o bundle. Categoria
// criada pelo admin sem ícone conhecido cai no Store — aparece na hora, só sem
// ícone dedicado.
const ICONS = {
    gastronomia: UtensilsCrossed,
    hospedagem: BedDouble,
    passeios: Waves,
    servicos: Wrench,
    negocio: Store,
    eventos: PartyPopper,
    lojas: ShoppingBag,
    construcao: HardHat,
    artesanato: Palette,
};

export default function CategoryPicker({ categories, selected, primaryId, onChange, error, primaryError }) {
    const toggle = (id) => {
        const isSelected = selected.includes(id);
        if (!isSelected && selected.length >= MAX_CATEGORIES) return;
        const next = isSelected ? selected.filter((value) => value !== id) : [...selected, id];
        onChange(next, nextPrimaryCategory(next, primaryId));
    };

    const chosen = categories.filter((category) => selected.includes(category.id));

    return (
        <div>
            <p className="mb-1.5 block text-sm font-semibold text-foreground">Categorias</p>
            <p className="-mt-1 mb-2 text-xs text-dark-ocean/60">
                Escolha de uma a {MAX_CATEGORIES} categorias que combinam com o seu negócio.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {categories.map((category) => {
                    const Icon = ICONS[category.slug] ?? Store;
                    const isSelected = selected.includes(category.id);
                    const isFull = !isSelected && selected.length >= MAX_CATEGORIES;
                    return (
                        <button
                            key={category.id}
                            type="button"
                            onClick={() => toggle(category.id)}
                            aria-pressed={isSelected}
                            disabled={isFull}
                            className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-sm font-semibold transition-colors ${
                                isSelected
                                    ? 'border-turquoise bg-turquoise/10 text-turquoise'
                                    : 'border-sand-dark bg-white text-dark-ocean'
                            } ${isFull ? 'opacity-40' : ''}`}
                        >
                            <Icon size={22} aria-hidden="true" />
                            <span className="notranslate" translate="no">
                                {category.name}
                            </span>
                        </button>
                    );
                })}
            </div>
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

            {/* Com mais de uma categoria a principal é escolha explícita, nunca
                a primeira que foi clicada. */}
            {chosen.length > 1 && (
                <fieldset className="mt-4 rounded-2xl bg-sand-dark/40 p-4">
                    <legend className="px-1 text-sm font-semibold text-foreground">Categoria principal</legend>
                    <p className="mb-2 text-xs text-dark-ocean/60">
                        É ela que aparece no destaque do perfil e na navegação do site.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {chosen.map((category) => (
                            <label
                                key={category.id}
                                className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                                    primaryId === category.id
                                        ? 'border-turquoise bg-turquoise/10 text-turquoise'
                                        : 'border-sand-dark bg-white text-dark-ocean'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="primary-category"
                                    className="sr-only"
                                    checked={primaryId === category.id}
                                    onChange={() => onChange(selected, category.id)}
                                />
                                {primaryId === category.id && <Star size={14} aria-hidden="true" />}
                                <span className="notranslate" translate="no">
                                    {category.name}
                                </span>
                            </label>
                        ))}
                    </div>
                    {primaryError && <p className="mt-2 text-sm text-red-600">{primaryError}</p>}
                </fieldset>
            )}
        </div>
    );
}
