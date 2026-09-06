// Normaliza texto pra busca: minúsculas + remove acentos, pra "pousada" achar
// "Pousada" e "café" achar "cafe".
export function normalize(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
}
