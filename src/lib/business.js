import { categoryLabels } from '../data/categoryLabels';

export function toWhatsappLink(phone) {
    const digits = phone.replace(/\D/g, '');
    return `https://wa.me/55${digits}`;
}

export function categoryLabel(slug) {
    return categoryLabels[slug] ?? slug;
}

// O slug é gerado no banco por generate_business_slug(): sufixo numérico só
// quando há colisão real, e o UNIQUE de businesses.slug como autoridade sob
// concorrência. A versão anterior aqui sempre acrescentava 5 caracteres
// aleatórios ao nome, o que deixava toda URL ilegível.
