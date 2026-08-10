import { useEffect, useState } from 'react';
import { fetchTideForecastByDay, PITIMBU_COORDS } from '../lib/tides';

const CACHE_KEY = 'farol-pitimbu:tide-forecast';

function readCache(todayKey) {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const cached = JSON.parse(raw);
        return cached.dateKey === todayKey ? cached.days : null;
    } catch {
        return null;
    }
}

function writeCache(todayKey, days) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ dateKey: todayKey, days }));
    } catch {
        // localStorage indisponível (modo privado, cota cheia); segue sem cache.
    }
}

export function useTideForecast(coords = PITIMBU_COORDS, forecastDays = 3) {
    const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const [days, setDays] = useState(() => readCache(todayKey));
    const [status, setStatus] = useState(() => (readCache(todayKey) ? 'success' : 'loading'));

    useEffect(() => {
        if (readCache(todayKey)) return;

        let cancelled = false;

        fetchTideForecastByDay(coords, forecastDays)
            .then((result) => {
                if (cancelled) return;
                setDays(result);
                setStatus('success');
                writeCache(todayKey, result);
            })
            .catch(() => {
                if (!cancelled) setStatus('error');
            });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [coords.latitude, coords.longitude, forecastDays, todayKey]);

    return { days, status };
}
