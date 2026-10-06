// Formulário da oferta ↔ payload das RPCs create_offer/update_offer_draft.
//
// As validações espelham as constraints de offer_versions e as exigências de
// submit_offer_for_review. O banco continua sendo a autoridade: isto existe
// para o erro aparecer no campo certo antes de enviar.
import { OFFER_UTC_OFFSET, VALUED_BENEFITS, isoDayInPitimbu } from './offers';

export const TITLE_MIN = 3;
export const TITLE_MAX = 80;
export const DESCRIPTION_MAX = 1000;
export const ELIGIBLE_ITEMS_MAX = 500;
export const CONDITIONS_MAX = 1000;

export const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

export const OFFER_STEPS = [
    { id: 1, label: 'Oferta' },
    { id: 2, label: 'Condições' },
    { id: 3, label: 'Cupons' },
    { id: 4, label: 'Revisão' },
];

/** @returns {Record<number, {start: string, end: string}[]>} */
function emptyWindows() {
    return Object.fromEntries(ALL_DAYS.map((day) => [day, []]));
}

export const emptyOfferForm = {
    title: '',
    description: '',
    benefitType: '',
    benefitValue: '',
    startDate: '',
    endDate: '',
    days: [...ALL_DAYS],
    hoursMode: 'all_day',
    windows: emptyWindows(),
    minimumPurchase: '',
    eligibleItems: '',
    stackable: false,
    conditions: '',
    // '' = ainda não escolhido. "Sem limite" precisa ser uma escolha explícita,
    // porque no banco é só a ausência de total_limit.
    limitMode: '',
    totalLimit: '',
    perUserLimit: '1',
    couponValidityMinutes: '',
};

function text(value) {
    return value === null || value === undefined ? '' : String(value);
}

/** Converte número do banco (string numeric) para o campo, com vírgula. */
function decimalField(value) {
    if (value === null || value === undefined || value === '') return '';
    return String(Number(value)).replace('.', ',');
}

// total_limit nulo significa "sem limite" — ou que o passo 3 ainda não foi
// preenchido. A validade do cupom é obrigatória nesse passo, então serve de
// sinal: sem ela, a escolha de quantidade ainda não foi feita.
function limitModeFromVersion(version) {
    if (version.total_limit !== null && version.total_limit !== undefined) return 'limited';
    return version.coupon_validity_minutes ? 'unlimited' : '';
}

export function offerFormFromVersion(version) {
    if (!version) return { ...emptyOfferForm, windows: emptyWindows() };
    const windows = emptyWindows();
    for (const window of version.time_windows ?? []) {
        windows[Number(window.day)]?.push({ start: window.start, end: window.end });
    }
    return {
        title: text(version.title),
        description: text(version.description),
        benefitType: text(version.benefit_type),
        benefitValue: decimalField(version.benefit_value),
        startDate: isoDayInPitimbu(version.starts_at),
        endDate: isoDayInPitimbu(version.ends_at),
        days: version.days_of_week?.length ? [...version.days_of_week].map(Number).sort() : [...ALL_DAYS],
        hoursMode: (version.time_windows ?? []).length > 0 ? 'windows' : 'all_day',
        windows,
        minimumPurchase: decimalField(version.minimum_purchase),
        eligibleItems: text(version.eligible_items),
        stackable: Boolean(version.stackable),
        conditions: text(version.conditions),
        limitMode: limitModeFromVersion(version),
        totalLimit: text(version.total_limit),
        perUserLimit: text(version.per_user_limit ?? 1),
        couponValidityMinutes: text(version.coupon_validity_minutes),
    };
}

/** "15,50" → 15.5; vazio → null; inválido → NaN (para a validação acusar). */
export function parseDecimal(value) {
    const raw = text(value).trim().replace(/\s/g, '').replace(/^R\$/i, '');
    if (!raw) return null;
    const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return Number.NaN;
    return Number(normalized);
}

export function parseInteger(value) {
    const raw = text(value).trim();
    if (!raw) return null;
    return /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
}

// Datas inteiras no fuso de Pitimbu: começa às 00:00 do dia inicial e termina
// às 23:59:59 do dia final.
export function startOfDayIso(date) {
    return date ? `${date}T00:00:00${OFFER_UTC_OFFSET}` : null;
}

export function endOfDayIso(date) {
    return date ? `${date}T23:59:59${OFFER_UTC_OFFSET}` : null;
}

function clean(value) {
    const trimmed = text(value).trim();
    return trimmed || null;
}

function sortedWindows(form) {
    if (form.hoursMode !== 'windows') return [];
    return [...form.days]
        .sort((a, b) => a - b)
        .flatMap((day) =>
            [...(form.windows[day] ?? [])]
                .sort((a, b) => a.start.localeCompare(b.start))
                .map((window) => ({ day, start: window.start, end: window.end }))
        );
}

/** Payload completo: cada salvamento envia o conjunto inteiro de campos editáveis. */
export function buildOfferPayload(form) {
    const valued = VALUED_BENEFITS.includes(form.benefitType);
    const benefitValue = valued ? parseDecimal(form.benefitValue) : null;
    const minimumPurchase = parseDecimal(form.minimumPurchase);
    const totalLimit = form.limitMode === 'limited' ? parseInteger(form.totalLimit) : null;
    const perUserLimit = parseInteger(form.perUserLimit);
    const validity = parseInteger(form.couponValidityMinutes);

    return {
        title: clean(form.title),
        description: clean(form.description),
        benefit_type: form.benefitType || null,
        benefit_value: Number.isNaN(benefitValue) ? null : benefitValue,
        starts_at: startOfDayIso(form.startDate),
        ends_at: endOfDayIso(form.endDate),
        days_of_week: [...form.days].sort((a, b) => a - b),
        time_windows: sortedWindows(form),
        minimum_purchase: Number.isNaN(minimumPurchase) ? null : minimumPurchase,
        eligible_items: clean(form.eligibleItems),
        stackable: Boolean(form.stackable),
        conditions: clean(form.conditions),
        total_limit: Number.isNaN(totalLimit) ? null : totalLimit,
        per_user_limit: Number.isNaN(perUserLimit) || perUserLimit === null ? 1 : perUserLimit,
        coupon_validity_minutes: Number.isNaN(validity) ? null : validity,
    };
}

function windowErrors(form) {
    if (form.hoursMode !== 'windows') return null;
    for (const day of form.days) {
        const windows = form.windows[day] ?? [];
        if (windows.length === 0) return 'Informe ao menos um horário para cada dia escolhido, ou marque “Dia inteiro”.';
        for (const window of windows) {
            if (!/^\d{2}:\d{2}$/.test(window.start) || !/^\d{2}:\d{2}$/.test(window.end)) {
                return 'Preencha o início e o fim de cada horário.';
            }
            if (window.start >= window.end) {
                return 'Cada horário precisa terminar depois de começar, no mesmo dia.';
            }
        }
        const ordered = [...windows].sort((a, b) => a.start.localeCompare(b.start));
        for (let index = 1; index < ordered.length; index += 1) {
            if (ordered[index].start < ordered[index - 1].end) return 'Os horários de um mesmo dia não podem se sobrepor.';
        }
    }
    return null;
}

/**
 * Valida os campos de uma etapa. `strict` cobra também o que é obrigatório
 * para avançar; sem ele, só barra o que o banco recusaria (forma e limites),
 * para "Salvar rascunho" aceitar uma oferta pela metade.
 * @param {typeof emptyOfferForm} form
 * @param {number} step 1–4 (4 valida tudo)
 * @returns {Record<string, string>}
 */
export function validateOfferStep(form, step, { strict = true } = {}) {
    const errors = {};
    const checks = step === 4 ? [1, 2, 3] : [step];

    if (checks.includes(1)) {
        const title = form.title.trim();
        if (strict && !title) errors.title = 'Informe o título da oferta.';
        else if (title && (title.length < TITLE_MIN || title.length > TITLE_MAX)) {
            errors.title = `O título precisa ter entre ${TITLE_MIN} e ${TITLE_MAX} caracteres.`;
        }
        const description = form.description.trim();
        if (strict && !description) errors.description = 'Descreva o benefício para quem vai usar o cupom.';
        else if (description.length > DESCRIPTION_MAX) errors.description = `Use no máximo ${DESCRIPTION_MAX} caracteres.`;

        if (strict && !form.benefitType) errors.benefitType = 'Escolha o tipo de benefício.';
        if (VALUED_BENEFITS.includes(form.benefitType)) {
            const value = parseDecimal(form.benefitValue);
            if (value === null) {
                if (strict) errors.benefitValue = 'Informe o valor do desconto.';
            } else if (Number.isNaN(value) || value <= 0) {
                errors.benefitValue = 'Informe um valor maior que zero.';
            } else if (form.benefitType === 'percentage_discount' && value > 100) {
                errors.benefitValue = 'O percentual vai de 0 a 100.';
            }
        }
    }

    if (checks.includes(2)) {
        if (strict && !form.startDate) errors.startDate = 'Informe a data inicial.';
        if (strict && !form.endDate) errors.endDate = 'Informe a data final.';
        if (form.startDate && form.endDate && form.endDate < form.startDate) {
            errors.endDate = 'A data final precisa ser igual ou posterior à inicial.';
        }
        if (form.days.length === 0) errors.days = 'Escolha ao menos um dia da semana.';
        const windows = windowErrors(form);
        if (windows) errors.windows = windows;
        const minimum = parseDecimal(form.minimumPurchase);
        if (minimum !== null && (Number.isNaN(minimum) || minimum <= 0)) {
            errors.minimumPurchase = 'Informe um valor maior que zero ou deixe em branco.';
        }
        if (form.eligibleItems.trim().length > ELIGIBLE_ITEMS_MAX) {
            errors.eligibleItems = `Use no máximo ${ELIGIBLE_ITEMS_MAX} caracteres.`;
        }
        if (form.conditions.trim().length > CONDITIONS_MAX) {
            errors.conditions = `Use no máximo ${CONDITIONS_MAX} caracteres.`;
        }
    }

    if (checks.includes(3)) {
        const perUser = parseInteger(form.perUserLimit);
        if (perUser === null) {
            if (strict) errors.perUserLimit = 'Informe quantas vezes cada pessoa pode usar.';
        } else if (Number.isNaN(perUser) || perUser < 1) {
            errors.perUserLimit = 'Use um número inteiro a partir de 1.';
        }
        if (!form.limitMode) {
            if (strict) errors.totalLimit = 'Escolha se a oferta tem quantidade limitada ou não.';
        } else if (form.limitMode === 'limited') {
            const total = parseInteger(form.totalLimit);
            if (total === null) {
                if (strict) errors.totalLimit = 'Informe a quantidade total ou escolha “Sem limite”.';
            } else if (Number.isNaN(total) || total < 1) {
                errors.totalLimit = 'Use um número inteiro maior que zero.';
            } else if (!errors.perUserLimit && perUser !== null && perUser > total) {
                errors.perUserLimit = 'O limite por pessoa não pode passar da quantidade total.';
            }
        }
        if (strict && !form.couponValidityMinutes) {
            errors.couponValidityMinutes = 'Escolha por quanto tempo o cupom vale depois de gerado.';
        }
    }

    return errors;
}

/** Envio exige o período ainda aberto (submit_offer_for_review). */
export function offerPeriodEnded(form, now = new Date()) {
    const end = endOfDayIso(form.endDate);
    return Boolean(end) && new Date(end) <= now;
}

/** Primeira etapa com erro, para levar a pessoa direto ao campo. */
export function firstStepWithErrors(form) {
    for (const step of [1, 2, 3]) {
        if (Object.keys(validateOfferStep(form, step)).length > 0) return step;
    }
    return null;
}
