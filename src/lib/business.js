import { categoryLabels } from '../data/categoryLabels';

// Devolve `null` quando não há número: telefone é opcional no cadastro (basta
// um contato público qualquer — e-mail, Instagram, site), então esta função
// recebe `null` no uso normal. Enquanto ela assumia string, um único negócio
// sem telefone derrubava a tela inteira que o listasse.
export function toWhatsappLink(phone) {
    const digits = (phone ?? '').replace(/\D/g, '');

    return digits ? `https://wa.me/55${digits}` : null;
}

export function categoryLabel(slug) {
    return categoryLabels[slug] ?? slug;
}

// O slug é gerado no banco por generate_business_slug(): sufixo numérico só
// quando há colisão real, e o UNIQUE de businesses.slug como autoridade sob
// concorrência. A versão anterior aqui sempre acrescentava 5 caracteres
// aleatórios ao nome, o que deixava toda URL ilegível.
