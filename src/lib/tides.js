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

// A curva de maré é aproximadamente senoidal, então uma mudança de direção (subindo
// -> descendo ou vice-versa) no dado horário corresponde a uma maré alta/baixa real —
// não precisa de constantes harmônicas. Detectamos a mudança de sinal da variação
// hora a hora em vez de comparar só os vizinhos imediatos (curr > prev && curr > next)
// porque em torno do pico/vale a maré por vezes fica "achatada" por 2h com a mesma
// altura (empate) na resolução horária da API — a comparação estrita não detectava
// esse platô e o evento inteiro sumia do dia (mostrando só 3 medições em vez de 4).
export function extractTideExtremes({ time, height }) {
    const extremes = [];
    let prevSign = 0;

    for (let i = 1; i < height.length; i += 1) {
        const diff = height[i] - height[i - 1];
        if (diff === 0) continue;

        const sign = diff > 0 ? 1 : -1;
        if (prevSign !== 0 && sign !== prevSign) {
            extremes.push({ time: time[i - 1], height: height[i - 1], type: prevSign > 0 ? 'alta' : 'baixa' });
        }
        prevSign = sign;
    }

    return extremes;
}

// O ciclo de maré semidiurno dura ~24h50min, um pouco mais que o dia de calendário
// (24h). Isso faz com que, filtrando estritamente por data, alguns dias fiquem com
// só 3 eventos e outros acumulem 5 — o 4º evento "escorrega" para o dia vizinho.
// Para manter sempre 4 medições por dia, pegamos os 4 eventos mais próximos do
// meio-dia de cada data (podendo pegar emprestado um evento do dia anterior/seguinte
// quando necessário) em vez de exigir que caiam dentro do dia exato.
function pickClosestExtremes(extremes, referenceTime, count) {
    return [...extremes]
        .sort((a, b) => Math.abs(new Date(a.time) - referenceTime) - Math.abs(new Date(b.time) - referenceTime))
        .slice(0, count)
        .sort((a, b) => a.time.localeCompare(b.time));
}

export async function fetchTideForecastByDay(coords = PITIMBU_COORDS, forecastDays = 3) {
    const curve = await fetchTideCurve({ ...coords, forecastDays });
    const extremes = extractTideExtremes(curve);

    const today = getISODateInSaoPaulo();
    return Array.from({ length: forecastDays }, (_, i) => {
        const date = addDays(today, i);
        const referenceTime = new Date(`${date}T12:00:00`).getTime();
        return { date, extremes: pickClosestExtremes(extremes, referenceTime, 4) };
    });
}
