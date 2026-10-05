import { categoryLabels } from '../data/categoryLabels';
import { SITE_NAME } from './siteMeta';

export function businessWhatsappMessage(business) {
    return `Olá! Encontrei ${business.name} no ${SITE_NAME} e gostaria de mais informações.`;
}

// Devolve `null` quando não há número: telefone é opcional no cadastro (basta
// um contato público qualquer — e-mail, Instagram, site), então esta função
// recebe `null` no uso normal. Enquanto ela assumia string, um único negócio
// sem telefone derrubava a tela inteira que o listasse.
export function toWhatsappLink(phone, message = '') {
    const digits = (phone ?? '').replace(/\D/g, '');

    if (!digits) return null;
    const link = `https://wa.me/55${digits}`;
    return message ? `${link}?text=${encodeURIComponent(message)}` : link;
}

export function categoryLabel(slug) {
    return categoryLabels[slug] ?? slug;
}

// O slug é gerado no banco por generate_business_slug(): sufixo numérico só
// quando há colisão real, e o UNIQUE de businesses.slug como autoridade sob
// concorrência. A versão anterior aqui sempre acrescentava 5 caracteres
// aleatórios ao nome, o que deixava toda URL ilegível.
