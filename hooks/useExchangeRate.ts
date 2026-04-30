import { useState, useEffect } from 'react';

const CACHE_KEY = 'usd_brl_rate';
const CACHE_DURATION = 1000 * 60 * 60; // 1 hora

interface ExchangeRateCache {
    rate: number;
    timestamp: number;
}

interface AwesomeAPIResponse {
    USDBRL: {
        bid: string;
        ask: string;
    };
}

export function useExchangeRate() {
    const [rate, setRate] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchRate = async () => {
            try {
                // Check cache first
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    const data: ExchangeRateCache = JSON.parse(cached);
                    const isExpired = Date.now() - data.timestamp > CACHE_DURATION;

                    if (!isExpired) {
                        setRate(data.rate);
                        setIsLoading(false);
                        return;
                    }
                }

                // Fetch fresh data
                const response = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL');
                if (!response.ok) throw new Error('API indisponível');

                const data: AwesomeAPIResponse = await response.json();
                const newRate = parseFloat(data.USDBRL.bid);

                // Update state and cache
                setRate(newRate);
                setError(null);
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    rate: newRate,
                    timestamp: Date.now()
                }));
            } catch (err) {
                console.error('Failed to fetch exchange rate:', err);
                setError('Taxa de câmbio indisponível');
                setRate(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchRate();
    }, []);

    return { rate, isLoading, error, hasRate: rate !== null };
}
