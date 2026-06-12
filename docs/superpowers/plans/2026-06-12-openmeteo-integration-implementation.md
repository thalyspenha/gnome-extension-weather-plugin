# Open-Meteo Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir `OpenMeteoClient.js` por `OpenMeteoService.js` production-ready com retry/backoff exponencial, cache em memória, validação de schema e mapeamento tipado, adicionando probabilidade de chuva e rajadas de vento ao modelo.

**Architecture:** `OpenMeteoService` orquestra cache → HTTP → retry. `OpenMeteoValidator` e `OpenMeteoMapper` são funções puras sem imports de GNOME — testáveis com `gjs -m`. `WeatherModel` recebe novos campos. `WeatherService` sofre apenas troca de import.

**Tech Stack:** GJS ESModules, Soup 3 (`gi://Soup`), GLib (`gi://GLib`), Open-Meteo API v1.

**Spec:** `docs/superpowers/specs/2026-06-12-openmeteo-integration-design.md`

---

## Arquivos

| Ação | Arquivo |
|---|---|
| MODIFICAR | `data/WeatherModel.js` |
| CRIAR | `utils/OpenMeteoValidator.js` |
| CRIAR | `utils/OpenMeteoMapper.js` |
| CRIAR | `services/OpenMeteoService.js` |
| DELETAR | `services/OpenMeteoClient.js` |
| MODIFICAR | `services/WeatherService.js` (import only) |
| MODIFICAR | `extension.js` (instanciação) |
| CRIAR | `tests/unit/test-openmeteo-validator.js` |
| CRIAR | `tests/unit/test-openmeteo-mapper.js` |

---

### Task 1: Atualizar `data/WeatherModel.js`

**Files:**
- Modify: `data/WeatherModel.js`

- [ ] **Step 1: Adicionar `OpenMeteoRawResponse` typedef e atualizar typedefs existentes**

Substituir o conteúdo de `data/WeatherModel.js` por:

```js
/**
 * @typedef {Object} OpenMeteoRawResponse
 * @property {{
 *   temperature_2m:         number,
 *   apparent_temperature:   number,
 *   weathercode:            number,
 *   windspeed_10m:          number,
 *   windgusts_10m:          number,
 *   relativehumidity_2m:    number,
 *   precipitation:          number,
 * }} current
 * @property {{
 *   time:                      string[],
 *   temperature_2m:            number[],
 *   weathercode:               number[],
 *   precipitation_probability: number[],
 *   precipitation:             number[],
 * }} hourly
 * @property {{
 *   time:                          string[],
 *   weathercode:                   number[],
 *   temperature_2m_max:            number[],
 *   temperature_2m_min:            number[],
 *   precipitation_sum:             number[],
 *   precipitation_probability_max: number[],
 *   windspeed_10m_max:             number[],
 *   windgusts_10m_max:             number[],
 * }} daily
 */

/**
 * @typedef {Object} CurrentWeather
 * @property {number} temperature
 * @property {number} apparentTemperature
 * @property {number} humidity
 * @property {number} windSpeed           km/h
 * @property {number} windGust            km/h
 * @property {number} precipitation       mm
 * @property {number} weatherCode
 */

/**
 * @typedef {Object} HourlySlot
 * @property {string} time               ISO 8601
 * @property {number} temperature
 * @property {number} precipitationProb  0–100 %
 * @property {number} precipitation      mm
 * @property {number} weatherCode
 */

/**
 * @typedef {Object} DailyDay
 * @property {string} date              YYYY-MM-DD
 * @property {number} tempMax
 * @property {number} tempMin
 * @property {number} precipitationSum  mm
 * @property {number} precipitationProb 0–100 %
 * @property {number} windSpeedMax      km/h
 * @property {number} windGustMax       km/h
 * @property {number} weatherCode
 */

/**
 * @typedef {Object} AlertModel
 * @property {string} id
 * @property {string} title
 * @property {string} severity
 * @property {string} description
 * @property {string} onset      ISO 8601
 * @property {string} expires    ISO 8601
 */

/**
 * @typedef {Object} WeatherModel
 * @property {CurrentWeather}  current
 * @property {HourlySlot[]}    hourly     primeiras 24 entradas
 * @property {DailyDay[]}      daily      7 dias
 * @property {AlertModel[]}    alerts
 * @property {number}          fetchedAt  Date.now()
 */

export {};
```

- [ ] **Step 2: Verificar que carrega sem erros**

```bash
gjs -m data/WeatherModel.js && echo OK
```

Esperado: `OK`

- [ ] **Step 3: Commit**

```bash
git add data/WeatherModel.js
git commit -m "feat: expand WeatherModel with precipitation and wind gust fields"
```

**Critério de aceite:** `gjs -m data/WeatherModel.js` exits 0. Todos os 8 campos novos presentes nos typedefs.

---

### Task 2: `utils/OpenMeteoValidator.js` (TDD)

**Files:**
- Create: `utils/OpenMeteoValidator.js`
- Create: `tests/unit/test-openmeteo-validator.js`

- [ ] **Step 1: Escrever fixture de raw response válida**

Criar `tests/unit/test-openmeteo-validator.js`:

```js
import { assertEqual, assert, summary } from './helpers.js';
import { validate, OpenMeteoValidationError } from '../../utils/OpenMeteoValidator.js';

const VALID_RAW = {
    current: {
        temperature_2m: 22.5,
        apparent_temperature: 20.1,
        weathercode: 1,
        windspeed_10m: 15.0,
        windgusts_10m: 22.0,
        relativehumidity_2m: 70,
        precipitation: 0.0,
    },
    hourly: {
        time:                      ['2026-06-12T00:00', '2026-06-12T01:00'],
        temperature_2m:            [22.0, 21.5],
        weathercode:               [1, 2],
        precipitation_probability: [10, 20],
        precipitation:             [0.0, 0.1],
    },
    daily: {
        time:                          ['2026-06-12', '2026-06-13'],
        weathercode:                   [1, 3],
        temperature_2m_max:            [28.0, 25.0],
        temperature_2m_min:            [18.0, 16.0],
        precipitation_sum:             [0.0, 2.5],
        precipitation_probability_max: [10, 60],
        windspeed_10m_max:             [20.0, 18.0],
        windgusts_10m_max:             [35.0, 28.0],
    },
};

// valid passes
let threw = false;
try { validate(VALID_RAW); } catch (_) { threw = true; }
assert(!threw, 'valid raw does not throw');

// missing top-level section
threw = false;
try { validate({}); } catch (e) { threw = e instanceof OpenMeteoValidationError; }
assert(threw, 'empty object throws OpenMeteoValidationError');

// missing current field
threw = false;
const missingField = JSON.parse(JSON.stringify(VALID_RAW));
delete missingField.current.windgusts_10m;
try { validate(missingField); } catch (e) { threw = e instanceof OpenMeteoValidationError; }
assert(threw, 'missing current.windgusts_10m throws');

// wrong type in current
threw = false;
const wrongType = JSON.parse(JSON.stringify(VALID_RAW));
wrongType.current.temperature_2m = 'hot';
try { validate(wrongType); } catch (e) { threw = e instanceof OpenMeteoValidationError; }
assert(threw, 'string where number expected throws');

// missing hourly array
threw = false;
const noHourly = JSON.parse(JSON.stringify(VALID_RAW));
delete noHourly.hourly.precipitation_probability;
try { validate(noHourly); } catch (e) { threw = e instanceof OpenMeteoValidationError; }
assert(threw, 'missing hourly.precipitation_probability throws');

// missing daily array
threw = false;
const noDaily = JSON.parse(JSON.stringify(VALID_RAW));
delete noDaily.daily.windgusts_10m_max;
try { validate(noDaily); } catch (e) { threw = e instanceof OpenMeteoValidationError; }
assert(threw, 'missing daily.windgusts_10m_max throws');

// empty hourly.time array
threw = false;
const emptyTime = JSON.parse(JSON.stringify(VALID_RAW));
emptyTime.hourly.time = [];
try { validate(emptyTime); } catch (e) { threw = e instanceof OpenMeteoValidationError; }
assert(threw, 'empty hourly.time throws');

summary('OpenMeteoValidator');
```

- [ ] **Step 2: Rodar — deve falhar (módulo não existe)**

```bash
gjs -m tests/unit/test-openmeteo-validator.js 2>&1 | head -4
```

Esperado: erro de import.

- [ ] **Step 3: Implementar `utils/OpenMeteoValidator.js`**

```js
export class OpenMeteoValidationError extends Error {
    constructor(message) {
        super(`OpenMeteo validation failed: ${message}`);
        this.name = 'OpenMeteoValidationError';
    }
}

const CURRENT_NUMBERS = [
    'temperature_2m', 'apparent_temperature', 'weathercode',
    'windspeed_10m', 'windgusts_10m', 'relativehumidity_2m', 'precipitation',
];

const HOURLY_ARRAYS = [
    'time', 'temperature_2m', 'weathercode',
    'precipitation_probability', 'precipitation',
];

const DAILY_ARRAYS = [
    'time', 'weathercode', 'temperature_2m_max', 'temperature_2m_min',
    'precipitation_sum', 'precipitation_probability_max',
    'windspeed_10m_max', 'windgusts_10m_max',
];

function requireSection(raw, section) {
    if (!raw || typeof raw[section] !== 'object' || raw[section] === null)
        throw new OpenMeteoValidationError(`missing section "${section}"`);
}

function requireNumber(obj, section, field) {
    if (typeof obj[field] !== 'number')
        throw new OpenMeteoValidationError(`${section}.${field} must be a number, got ${typeof obj[field]}`);
}

function requireArray(obj, section, field) {
    if (!Array.isArray(obj[field]))
        throw new OpenMeteoValidationError(`${section}.${field} must be an array`);
    if (field === 'time' && obj[field].length === 0)
        throw new OpenMeteoValidationError(`${section}.time must not be empty`);
}

/**
 * @param {import('../data/WeatherModel.js').OpenMeteoRawResponse} raw
 * @throws {OpenMeteoValidationError}
 */
export function validate(raw) {
    requireSection(raw, 'current');
    requireSection(raw, 'hourly');
    requireSection(raw, 'daily');

    for (const field of CURRENT_NUMBERS)
        requireNumber(raw.current, 'current', field);

    for (const field of HOURLY_ARRAYS)
        requireArray(raw.hourly, 'hourly', field);

    for (const field of DAILY_ARRAYS)
        requireArray(raw.daily, 'daily', field);
}
```

- [ ] **Step 4: Rodar testes — devem passar**

```bash
gjs -m tests/unit/test-openmeteo-validator.js
```

Esperado: `OpenMeteoValidator: 7 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add utils/OpenMeteoValidator.js tests/unit/test-openmeteo-validator.js
git commit -m "feat: OpenMeteoValidator with schema validation and unit tests"
```

**Critério de aceite:** 7/7 testes passando. `validate(valid)` não lança. `validate(inválido)` lança `OpenMeteoValidationError`.

---

### Task 3: `utils/OpenMeteoMapper.js` (TDD)

**Files:**
- Create: `utils/OpenMeteoMapper.js`
- Create: `tests/unit/test-openmeteo-mapper.js`

- [ ] **Step 1: Escrever testes**

Criar `tests/unit/test-openmeteo-mapper.js`:

```js
import { assertEqual, assert, summary } from './helpers.js';
import { map } from '../../utils/OpenMeteoMapper.js';

const VALID_RAW = {
    current: {
        temperature_2m: 22.5,
        apparent_temperature: 20.1,
        weathercode: 1,
        windspeed_10m: 15.0,
        windgusts_10m: 22.0,
        relativehumidity_2m: 70,
        precipitation: 0.5,
    },
    hourly: {
        time:                      Array.from({ length: 30 }, (_, i) => `2026-06-12T${String(i % 24).padStart(2,'0')}:00`),
        temperature_2m:            Array.from({ length: 30 }, (_, i) => 20 + i * 0.1),
        weathercode:               Array.from({ length: 30 }, () => 1),
        precipitation_probability: Array.from({ length: 30 }, (_, i) => i * 2),
        precipitation:             Array.from({ length: 30 }, (_, i) => i * 0.05),
    },
    daily: {
        time:                          ['2026-06-12', '2026-06-13', '2026-06-14'],
        weathercode:                   [1, 3, 61],
        temperature_2m_max:            [28.0, 25.0, 22.0],
        temperature_2m_min:            [18.0, 16.0, 14.0],
        precipitation_sum:             [0.0, 2.5, 8.0],
        precipitation_probability_max: [10, 60, 90],
        windspeed_10m_max:             [20.0, 18.0, 25.0],
        windgusts_10m_max:             [35.0, 28.0, 40.0],
    },
};

const model = map(VALID_RAW);

// current fields
assertEqual(model.current.temperature,         22.5,  'current.temperature');
assertEqual(model.current.apparentTemperature, 20.1,  'current.apparentTemperature');
assertEqual(model.current.humidity,            70,    'current.humidity');
assertEqual(model.current.windSpeed,           15.0,  'current.windSpeed');
assertEqual(model.current.windGust,            22.0,  'current.windGust');
assertEqual(model.current.precipitation,       0.5,   'current.precipitation');
assertEqual(model.current.weatherCode,         1,     'current.weatherCode');

// hourly slice
assertEqual(model.hourly.length, 24, 'hourly sliced to 24');
assertEqual(model.hourly[0].temperature,        20.0, 'hourly[0].temperature');
assertEqual(model.hourly[0].precipitationProb,  0,    'hourly[0].precipitationProb');
assertEqual(model.hourly[0].precipitation,      0.0,  'hourly[0].precipitation');
assertEqual(model.hourly[0].weatherCode,        1,    'hourly[0].weatherCode');
assertEqual(model.hourly[5].precipitationProb,  10,   'hourly[5].precipitationProb');

// daily
assertEqual(model.daily.length,              3,    'daily length');
assertEqual(model.daily[0].tempMax,          28.0, 'daily[0].tempMax');
assertEqual(model.daily[0].tempMin,          18.0, 'daily[0].tempMin');
assertEqual(model.daily[0].precipitationSum, 0.0,  'daily[0].precipitationSum');
assertEqual(model.daily[0].precipitationProb,10,   'daily[0].precipitationProb');
assertEqual(model.daily[0].windSpeedMax,     20.0, 'daily[0].windSpeedMax');
assertEqual(model.daily[0].windGustMax,      35.0, 'daily[0].windGustMax');
assertEqual(model.daily[0].weatherCode,      1,    'daily[0].weatherCode');
assertEqual(model.daily[1].precipitationProb,60,   'daily[1].precipitationProb');

// metadata
assert(typeof model.fetchedAt === 'number', 'fetchedAt is number');
assert(model.fetchedAt > 0,                 'fetchedAt > 0');
assert(Array.isArray(model.alerts),         'alerts is array');
assertEqual(model.alerts.length, 0,         'alerts empty');

summary('OpenMeteoMapper');
```

- [ ] **Step 2: Rodar — deve falhar**

```bash
gjs -m tests/unit/test-openmeteo-mapper.js 2>&1 | head -4
```

Esperado: erro de import.

- [ ] **Step 3: Implementar `utils/OpenMeteoMapper.js`**

```js
/**
 * @param {import('../data/WeatherModel.js').OpenMeteoRawResponse} raw
 * @returns {import('../data/WeatherModel.js').WeatherModel}
 */
export function map(raw) {
    const c = raw.current;

    const current = {
        temperature:         c.temperature_2m,
        apparentTemperature: c.apparent_temperature,
        humidity:            c.relativehumidity_2m,
        windSpeed:           c.windspeed_10m,
        windGust:            c.windgusts_10m,
        precipitation:       c.precipitation,
        weatherCode:         c.weathercode,
    };

    const hourly = raw.hourly.time.slice(0, 24).map((time, i) => ({
        time,
        temperature:        raw.hourly.temperature_2m[i],
        precipitationProb:  raw.hourly.precipitation_probability[i],
        precipitation:      raw.hourly.precipitation[i],
        weatherCode:        raw.hourly.weathercode[i],
    }));

    const daily = raw.daily.time.map((date, i) => ({
        date,
        tempMax:            raw.daily.temperature_2m_max[i],
        tempMin:            raw.daily.temperature_2m_min[i],
        precipitationSum:   raw.daily.precipitation_sum[i],
        precipitationProb:  raw.daily.precipitation_probability_max[i],
        windSpeedMax:       raw.daily.windspeed_10m_max[i],
        windGustMax:        raw.daily.windgusts_10m_max[i],
        weatherCode:        raw.daily.weathercode[i],
    }));

    return { current, hourly, daily, alerts: [], fetchedAt: Date.now() };
}
```

- [ ] **Step 4: Rodar testes — devem passar**

```bash
gjs -m tests/unit/test-openmeteo-mapper.js
```

Esperado: `OpenMeteoMapper: 21 passed, 0 failed`

- [ ] **Step 5: Rodar todos os testes**

```bash
bash tests/unit/run.sh
```

Esperado: `Suites: 4 passed, 0 failed`

- [ ] **Step 6: Commit**

```bash
git add utils/OpenMeteoMapper.js tests/unit/test-openmeteo-mapper.js
git commit -m "feat: OpenMeteoMapper raw API response to WeatherModel with unit tests"
```

**Critério de aceite:** 21/21 testes do mapper passando. `hourly.length === 24`. Todos os campos novos mapeados corretamente.

---

### Task 4: `services/OpenMeteoService.js`

**Files:**
- Create: `services/OpenMeteoService.js`

> Este módulo usa `Soup` e `GLib` — não testável com o runner GJS puro. Verificação manual via script.

- [ ] **Step 1: Implementar `services/OpenMeteoService.js`**

```js
import Soup from 'gi://Soup';
import GLib from 'gi://GLib';
import { validate, OpenMeteoValidationError } from '../utils/OpenMeteoValidator.js';
import { map } from '../utils/OpenMeteoMapper.js';

const BASE_URL       = 'https://api.open-meteo.com/v1/forecast';
const CACHE_TTL_MS   = 300_000; // 5 minutos

class HttpError extends Error {
    /**
     * @param {number} status
     * @param {number} retryAfter  seconds (0 = não presente)
     */
    constructor(status, retryAfter = 0) {
        super(`HTTP ${status}`);
        this.status     = status;
        this.retryAfter = retryAfter;
    }
}

export class OpenMeteoService {
    /**
     * @param {{
     *   timeout?:    number,   segundos (padrão: 10)
     *   maxRetries?: number,   (padrão: 3)
     *   baseDelay?:  number,   ms (padrão: 1000)
     * }} [opts]
     */
    constructor({ timeout = 10, maxRetries = 3, baseDelay = 1000 } = {}) {
        this._session    = new Soup.Session();
        this._session.timeout = timeout;
        this._maxRetries = maxRetries;
        this._baseDelay  = baseDelay;
        this._cache      = { key: null, model: null, fetchedAt: 0 };
    }

    /**
     * @param {number} lat
     * @param {number} lon
     * @returns {Promise<import('../data/WeatherModel.js').WeatherModel>}
     */
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

    // ── private ────────────────────────────────────────────────────────────

    /** @private */
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

    /** @private */
    async _httpGet(url) {
        const uri     = GLib.Uri.parse(url, GLib.UriFlags.NONE);
        const message = new Soup.Message({ method: 'GET', uri });

        let bytes;
        try {
            bytes = await this._session.send_and_read_async(
                message, GLib.PRIORITY_DEFAULT, null);
        } catch (e) {
            // rede / timeout — retryável
            throw e;
        }

        const status = message.get_status();

        if (status !== Soup.Status.OK) {
            const retryAfter = this._parseRetryAfter(message);
            throw new HttpError(status, retryAfter);
        }

        try {
            return JSON.parse(new TextDecoder().decode(bytes.get_data()));
        } catch (e) {
            throw new Error(`JSON parse failed: ${e.message}`);
        }
    }

    /** @private */
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

    /** @private */
    _isRetryable(e) {
        if (e instanceof OpenMeteoValidationError) return false;
        if (e instanceof SyntaxError)             return false;
        if (e.message?.startsWith('JSON parse'))  return false;
        if (e instanceof HttpError) {
            return e.status === 429
                || (e.status >= 500 && e.status <= 504);
        }
        return true; // network / timeout exception
    }

    /** @private */
    _backoffMs(attempt, e) {
        if (e instanceof HttpError && e.retryAfter > 0)
            return e.retryAfter * 1000;
        return this._baseDelay * Math.pow(2, attempt) + Math.random() * 200;
    }

    /** @private */
    _delay(ms) {
        return new Promise(resolve => {
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, Math.ceil(ms), () => {
                resolve();
                return GLib.SOURCE_REMOVE;
            });
        });
    }

    /** @private */
    _buildUrl(lat, lon) {
        const params = new URLSearchParams({
            latitude:      lat.toString(),
            longitude:     lon.toString(),
            current:       'temperature_2m,apparent_temperature,weathercode,' +
                           'windspeed_10m,windgusts_10m,relativehumidity_2m,precipitation',
            hourly:        'temperature_2m,weathercode,' +
                           'precipitation_probability,precipitation',
            daily:         'weathercode,temperature_2m_max,temperature_2m_min,' +
                           'precipitation_sum,precipitation_probability_max,' +
                           'windspeed_10m_max,windgusts_10m_max',
            timezone:      'auto',
            forecast_days: '7',
            wind_speed_unit: 'kmh',
        });
        return `${BASE_URL}?${params}`;
    }

    /** @private */
    _cacheKey(lat, lon) {
        return `${lat.toFixed(2)},${lon.toFixed(2)}`;
    }

    /** @private */
    _isCacheValid(key) {
        return this._cache.key === key
            && this._cache.model !== null
            && (Date.now() - this._cache.fetchedAt) < CACHE_TTL_MS;
    }
}
```

- [ ] **Step 2: Testar fetch real (requer rede)**

Criar arquivo de teste temporário na raiz do projeto:

```bash
python3 -c "
content = '''
import { OpenMeteoService } from \"./services/OpenMeteoService.js\";
import GLib from \"gi://GLib\";

const loop = GLib.MainLoop.new(null, false);
const svc  = new OpenMeteoService({ timeout: 10, maxRetries: 2, baseDelay: 500 });

// São Paulo
svc.fetch(-23.55, -46.63).then(model => {
    print(\"temperature:\",        model.current.temperature);
    print(\"windGust:\",           model.current.windGust);
    print(\"precipitation:\",      model.current.precipitation);
    print(\"hourly.length:\",      model.hourly.length);
    print(\"hourly[0].precipProb:\",model.hourly[0].precipitationProb);
    print(\"daily.length:\",       model.daily.length);
    print(\"daily[0].precipSum:\", model.daily[0].precipitationSum);
    print(\"daily[0].windGustMax:\",model.daily[0].windGustMax);

    // segunda chamada deve usar cache
    return svc.fetch(-23.55, -46.63);
}).then(cached => {
    print(\"cache hit (same fetchedAt):\", typeof cached.fetchedAt === \"number\");
    svc.destroy();
    loop.quit();
}).catch(e => {
    print(\"ERROR:\", e.message);
    loop.quit();
    imports.system.exit(1);
});

loop.run();
'''
open('test-service-manual.mjs', 'w').write(content)
" && gjs -m test-service-manual.mjs && rm test-service-manual.mjs
```

Esperado: temperatura numérica, `hourly.length` = 24, `precipitationProb` numérico, `cache hit: true`.

- [ ] **Step 3: Commit**

```bash
git add services/OpenMeteoService.js
git commit -m "feat: OpenMeteoService with retry/backoff, memory cache, validation and mapping"
```

**Critério de aceite:** fetch real retorna modelo com todos os novos campos. Segunda chamada com mesmas coords retorna cache sem HTTP adicional. Falha de rede retenta até `maxRetries`.

---

### Task 5: Migração — Deletar `OpenMeteoClient.js`, atualizar imports

**Files:**
- Delete: `services/OpenMeteoClient.js`
- Modify: `services/WeatherService.js`
- Modify: `extension.js`

- [ ] **Step 1: Deletar `services/OpenMeteoClient.js`**

```bash
git rm services/OpenMeteoClient.js
```

- [ ] **Step 2: Atualizar import em `services/WeatherService.js`**

Localizar linha:
```js
import { OpenMeteoClient } from './OpenMeteoClient.js';
```

Substituir por:
```js
import { OpenMeteoService } from './OpenMeteoService.js';
```

> `WeatherService.js` usa `deps.weatherClient.fetch(lat, lon)` e `deps.weatherClient.destroy()` — interface idêntica, nenhuma outra mudança necessária.

- [ ] **Step 3: Atualizar instanciação em `extension.js`**

Localizar linha:
```js
import { OpenMeteoClient } from './services/OpenMeteoClient.js';
```

Substituir por:
```js
import { OpenMeteoService } from './services/OpenMeteoService.js';
```

Localizar linha de instanciação:
```js
weatherClient: new OpenMeteoClient(),
```

Substituir por:
```js
weatherClient: new OpenMeteoService({ timeout: 10, maxRetries: 3, baseDelay: 1000 }),
```

- [ ] **Step 4: Rodar todos os testes unitários**

```bash
bash tests/unit/run.sh
```

Esperado: `Suites: 4 passed, 0 failed`

- [ ] **Step 5: Verificar que `OpenMeteoClient` não é mais referenciado**

```bash
grep -r "OpenMeteoClient" . --include="*.js" --exclude-dir=".git"
```

Esperado: nenhuma saída.

- [ ] **Step 6: Commit**

```bash
git add services/WeatherService.js extension.js
git commit -m "feat: migrate from OpenMeteoClient to OpenMeteoService"
```

**Critério de aceite:** zero referências a `OpenMeteoClient`. Todos os 4 suites de teste passando. `extension.js` usa `OpenMeteoService` com parâmetros explícitos.

---

## Self-Review

### Cobertura do spec

| Requisito do spec | Task |
|---|---|
| Substituir e renomear para `OpenMeteoService.js` | Task 4 + 5 |
| Timeout como parâmetro do construtor | Task 4 |
| Retry rede + 5xx + 429 com Retry-After | Task 4 |
| Backoff exponencial com jitter | Task 4 |
| Cache em memória TTL 5min | Task 4 |
| Chave por coords (2 decimais) | Task 4 |
| `OpenMeteoValidator` + testes | Task 2 |
| `OpenMeteoMapper` + testes | Task 3 |
| `OpenMeteoRawResponse` typedef | Task 1 |
| Campos novos em WeatherModel | Task 1 |
| `precipitationProb` em hourly + daily | Task 1 + 3 |
| `windGust`, `windGustMax`, `windSpeedMax` | Task 1 + 3 |
| Deletar `OpenMeteoClient.js` | Task 5 |
| Migrar imports em WeatherService + extension.js | Task 5 |
| `wind_speed_unit=kmh` na URL | Task 4 |

Cobertura: 100%.
