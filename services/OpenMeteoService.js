import Soup from 'gi://Soup';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { validate, OpenMeteoValidationError } from '../utils/OpenMeteoValidator.js';
import { map } from '../utils/OpenMeteoMapper.js';

const BASE_URL       = 'https://api.open-meteo.com/v1/forecast';
const CACHE_TTL_MS   = 300_000; // 5 minutos

class HttpError extends Error {
    constructor(status, retryAfter = 0) {
        super(`HTTP ${status}`);
        this.status     = status;
        this.retryAfter = retryAfter;
    }
}

export class OpenMeteoService {
    /**
     * @param {{
     *   timeout?:    number,
     *   maxRetries?: number,
     *   baseDelay?:  number,
     * }} [opts]
     */
    constructor({ timeout = 10, maxRetries = 3, baseDelay = 1000 } = {}) {
        this._session    = new Soup.Session();
        this._session.timeout = timeout;
        this._maxRetries = maxRetries;
        this._baseDelay  = baseDelay;
        this._cache      = { key: null, model: null, fetchedAt: 0 };
    }

    async fetch(lat, lon) {
        const key = this._cacheKey(lat, lon);
        if (this._isCacheValid(key)) return this._cache.model;

        const url   = this._buildUrl(lat, lon);
        const model = await this._fetchWithRetry(url);

        this._cache = { key, model, fetchedAt: Date.now() };
        return model;
    }

    destroy() {
        this._session.abort();
        this._cache = { key: null, model: null, fetchedAt: 0 };
    }

    async _fetchWithRetry(url) {
        let lastError;
        for (let attempt = 0; attempt <= this._maxRetries; attempt++) {
            if (attempt > 0)
                await this._delay(this._backoffMs(attempt - 1, lastError));
            try {
                const raw = await this._httpGet(url);
                validate(raw);
                return map(raw);
            } catch (e) {
                if (!this._isRetryable(e)) throw e;
                lastError = e;
                console.warn(`[OpenMeteoService] attempt ${attempt + 1} failed: ${e.message}`);
            }
        }
        throw lastError;
    }

    _httpGet(url) {
        const uri     = GLib.Uri.parse(url, GLib.UriFlags.NONE);
        const message = new Soup.Message({ method: 'GET', uri });
        const cancel  = new Gio.Cancellable();

        return new Promise((resolve, reject) => {
            this._session.send_and_read_async(
                message, GLib.PRIORITY_DEFAULT, cancel,
                (session, result) => {
                    let bytes;
                    try {
                        bytes = session.send_and_read_finish(result);
                    } catch (e) {
                        reject(e);
                        return;
                    }

                    const status = message.get_status();

                    if (status !== Soup.Status.OK) {
                        const retryAfter = this._parseRetryAfter(message);
                        reject(new HttpError(status, retryAfter));
                        return;
                    }

                    try {
                        resolve(JSON.parse(new TextDecoder().decode(bytes.get_data())));
                    } catch (e) {
                        reject(new Error(`JSON parse failed: ${e.message}`));
                    }
                }
            );
        });
    }

    _parseRetryAfter(message) {
        try {
            const headers = message.get_response_headers();
            const value   = headers.get_one('Retry-After');
            if (value) {
                const secs = parseInt(value, 10);
                if (!isNaN(secs) && secs > 0) return secs;
            }
        } catch (_) {}
        return 0;
    }

    _isRetryable(e) {
        if (e instanceof OpenMeteoValidationError) return false;
        if (e instanceof SyntaxError)             return false;
        if (e.message?.startsWith('JSON parse'))  return false;
        if (e instanceof HttpError) {
            return e.status === 429
                || (e.status >= 500 && e.status <= 504);
        }
        return true;
    }

    _backoffMs(attempt, e) {
        if (e instanceof HttpError && e.retryAfter > 0)
            return e.retryAfter * 1000;
        return this._baseDelay * Math.pow(2, attempt) + Math.random() * 200;
    }

    _delay(ms) {
        return new Promise(resolve => {
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, Math.ceil(ms), () => {
                resolve();
                return GLib.SOURCE_REMOVE;
            });
        });
    }

    _buildUrl(lat, lon) {
        const parts = [
            `latitude=${encodeURIComponent(lat.toString())}`,
            `longitude=${encodeURIComponent(lon.toString())}`,
            `current=${encodeURIComponent('temperature_2m,apparent_temperature,weathercode,' +
                             'windspeed_10m,windgusts_10m,relativehumidity_2m,precipitation')}`,
            `hourly=${encodeURIComponent('temperature_2m,weathercode,' +
                             'precipitation_probability,precipitation')}`,
            `daily=${encodeURIComponent('weathercode,temperature_2m_max,temperature_2m_min,' +
                             'precipitation_sum,precipitation_probability_max,' +
                             'windspeed_10m_max,windgusts_10m_max')}`,
            `timezone=auto`,
            `forecast_days=7`,
            `wind_speed_unit=kmh`,
        ];
        return `${BASE_URL}?${parts.join('&')}`;
    }

    _cacheKey(lat, lon) {
        return `${lat.toFixed(2)},${lon.toFixed(2)}`;
    }

    _isCacheValid(key) {
        return this._cache.key === key
            && this._cache.model !== null
            && (Date.now() - this._cache.fetchedAt) < CACHE_TTL_MS;
    }
}
