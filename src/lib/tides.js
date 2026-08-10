const MARINE_API_URL = 'https://marine-api.open-meteo.com/v1/marine';

export const PITIMBU_COORDS = { latitude: -7.4699, longitude: -34.8143 };

// A Open-Meteo retorna sea_level_height_msl relativo ao nível médio do mar (MSL),
// que oscila em torno de zero e fica negativo na maré baixa. Tábuas de maré reais
// (Marinha, tabuademares.com) usam o datum de redução de carta, sempre positivo.
// Offset calibrado comparando a saída da API com tabuademares.com/Pitimbu em
// 10-11/08/2026 (diferença consistente de ~1.10 a 1.33 m, média ~1.2 m). É uma
// aproximação empírica, não harmônica oficial — revalidar se os números voltarem
// a divergir muito de uma fonte de referência.
const TIDE_DATUM_OFFSET_M = 1.2;

function getISODateInSaoPaulo(date = new Date()) {
    return date.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function addDays(isoDate, amount) {
    const [year, month, day] = isoDate.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
}

async function fetchTideCurve({ latitude, longitude, forecastDays }) {
    const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        hourly: 'sea_level_height_msl',
        timezone: 'America/Sao_Paulo',
        forecast_days: String(forecastDays + 1),
        past_days: '1',
    });

    const response = await fetch(`${MARINE_API_URL}?${params}`);
    if (!response.ok) {
        throw new Error(`Open-Meteo respondeu com status ${response.status}`);
    }

    const data = await response.json();
    return {
        time: data.hourly.time,
        height: data.hourly.sea_level_height_msl.map((h) => h + TIDE_DATUM_OFFSET_M),
    };
}

// A curva de maré é aproximadamente senoidal, então um pico/vale local no dado
// horário corresponde a uma maré alta/baixa real — não precisa de constantes harmônicas.
export function extractTideExtremes({ time, height }) {
    const extremes = [];

    for (let i = 1; i < height.length - 1; i += 1) {
        const prev = height[i - 1];
        const curr = height[i];
        const next = height[i + 1];

        if (curr > prev && curr > next) {
            extremes.push({ time: time[i], height: curr, type: 'alta' });
        } else if (curr < prev && curr < next) {
            extremes.push({ time: time[i], height: curr, type: 'baixa' });
        }
    }

    return extremes;
}

export async function fetchTideForecastByDay(coords = PITIMBU_COORDS, forecastDays = 3) {
    const curve = await fetchTideCurve({ ...coords, forecastDays });
    const extremes = extractTideExtremes(curve);

    const today = getISODateInSaoPaulo();
    return Array.from({ length: forecastDays }, (_, i) => {
        const date = addDays(today, i);
        return { date, extremes: extremes.filter((extreme) => extreme.time.startsWith(date)) };
    });
}
