# Open-Meteo Integration — Design Spec
**Data:** 2026-06-12  
**Status:** Aprovado  
**Contexto:** Substitui `services/OpenMeteoClient.js` por implementação production-ready

---

## Decisões de Contexto

| Decisão | Valor |
|---|---|
| Estratégia | Substituir e renomear para `OpenMeteoService.js` |
| Timeout | Parâmetro do construtor |
| Retry | Rede + HTTP 5xx + HTTP 429 com `Retry-After` |
| Cache memória | TTL fixo 5min, chave por coords (2 decimais) |
| Novos campos | `precipitationProb`, `precipitation`, `windGust`, `windSpeedMax`, `windGustMax` |

---

## Arquivos Modificados/Criados

```
services/
├── OpenMeteoService.js         ← NOVO (substitui OpenMeteoClient.js)
├── WeatherService.js           ← MODIFICADO (import atualizado)
└── OpenMeteoClient.js          ← DELETADO

utils/
├── OpenMeteoMapper.js          ← NOVO
├── OpenMeteoValidator.js       ← NOVO
├── Formatter.js                ← inalterado
└── WeatherIcons.js             ← inalterado

data/
└── WeatherModel.js             ← MODIFICADO (novos campos)

tests/unit/
├── test-openmeteo-mapper.js    ← NOVO
└── test-openmeteo-validator.js ← NOVO
```

---

## Modelo de Dados

### `OpenMeteoRawResponse` (typedef — contrato da API)

```js
/**
 * @typedef {Object} OpenMeteoRawResponse
 * @property {{
 *   temperature_2m:        number,
 *   apparent_temperature:  number,
 *   weathercode:           number,
 *   windspeed_10m:         number,
 *   windgusts_10m:         number,
 *   relativehumidity_2m:   number,
 *   precipitation:         number,
 * }} current
 * @property {{
 *   time:                     string[],
 *   temperature_2m:           number[],
 *   weathercode:              number[],
 *   precipitation_probability: number[],
 *   precipitation:            number[],
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
```

### `WeatherModel` — campos adicionados

```
CurrentWeather:
  + precipitation:     number   mm na hora atual
  + windGust:          number   km/h

HourlySlot:
  + precipitationProb: number   0–100 %
  + precipitation:     number   mm

DailyDay:
  + precipitationSum:  number   mm total do dia
  + precipitationProb: number   0–100 % (max do dia)
  + windSpeedMax:      number   km/h
  + windGustMax:       number   km/h
```

---

## `OpenMeteoValidator` (`utils/OpenMeteoValidator.js`)

**Responsabilidade:** Verificar que a resposta da API contém todos os campos obrigatórios com tipos corretos antes do mapeamento.

**Interface:**
```js
export function validate(raw)        // throws OpenMeteoValidationError se inválido
export class OpenMeteoValidationError extends Error {}
```

**Campos validados (presença + tipo `number` ou `string[]`):**

| Seção | Campo | Tipo |
|---|---|---|
| `current` | `temperature_2m` | number |
| `current` | `apparent_temperature` | number |
| `current` | `weathercode` | number |
| `current` | `windspeed_10m` | number |
| `current` | `windgusts_10m` | number |
| `current` | `relativehumidity_2m` | number |
| `current` | `precipitation` | number |
| `hourly` | `time` | string[] (length > 0) |
| `hourly` | `temperature_2m` | number[] |
| `hourly` | `weathercode` | number[] |
| `hourly` | `precipitation_probability` | number[] |
| `hourly` | `precipitation` | number[] |
| `daily` | `time` | string[] (length > 0) |
| `daily` | `weathercode` | number[] |
| `daily` | `temperature_2m_max` | number[] |
| `daily` | `temperature_2m_min` | number[] |
| `daily` | `precipitation_sum` | number[] |
| `daily` | `precipitation_probability_max` | number[] |
| `daily` | `windspeed_10m_max` | number[] |
| `daily` | `windgusts_10m_max` | number[] |

**Regras:**
- `OpenMeteoValidationError` é **erro fatal** — não é retentado pelo `OpenMeteoService`
- Sem side effects — não modifica `raw`
- Zero imports de GNOME — testável com `gjs -m`

---

## `OpenMeteoMapper` (`utils/OpenMeteoMapper.js`)

**Responsabilidade:** Transformar `OpenMeteoRawResponse` em `WeatherModel`. Assume input já validado.

**Interface:**
```js
export function map(raw) → WeatherModel
```

**Conversões:**

| Campo API | Campo DTO | Conversão |
|---|---|---|
| `windspeed_10m` (km/h) | `windSpeed` | identidade |
| `windgusts_10m` (km/h) | `windGust` | identidade |
| `windspeed_10m_max` (km/h) | `windSpeedMax` | identidade |
| `windgusts_10m_max` (km/h) | `windGustMax` | identidade |
| `precipitation_probability` (0–100) | `precipitationProb` | identidade |
| `precipitation_probability_max` (0–100) | `precipitationProb` (daily) | identidade |
| `hourly.time` | `hourly[]` | `slice(0, 24)` |
| `daily.time` | `daily[]` | todos os dias |

> Open-Meteo retorna vento em km/h por default — sem conversão necessária.

**Regras:**
- Zero imports de GNOME — testável com `gjs -m`
- Sem side effects — não modifica `raw`
- `fetchedAt: Date.now()` gerado no map

---

## `OpenMeteoService` (`services/OpenMeteoService.js`)

**Responsabilidade:** Orquestrar cache em memória → HTTP request → retry com backoff → validação → mapeamento.

**Interface pública (compatível com `OpenMeteoClient`):**
```js
export class OpenMeteoService {
  constructor({ timeout = 10, maxRetries = 3, baseDelay = 1000 })
  async fetch(lat, lon) → Promise<WeatherModel>
  destroy()
}
```

### Cache em Memória

```js
this._cache = { key: null, model: null, fetchedAt: 0 }
```

- **Chave:** `${lat.toFixed(2)},${lon.toFixed(2)}` (~1.1km de precisão)
- **TTL:** 300.000ms (5 minutos) — fixo, independente do `refresh-interval`
- **Invalidação:** automática por TTL, automática por mudança de coords, manual via `destroy()`

**Fluxo:**
```
fetch(lat, lon)
  ├─► cache válido? → return cache.model (sem rede)
  └─► _fetchWithRetry(url)
        └─► success → atualiza cache → return model
        └─► falha → throw (cache NÃO atualizado)
```

### Retry + Backoff Exponencial

**Parâmetros padrão:** `maxRetries = 3`, `baseDelay = 1000ms`

**Delay por tentativa:**
```
delay(attempt) = baseDelay * 2^attempt + jitter
jitter = Math.random() * 200    // ms
```

| Tentativa | Delay base | Range com jitter |
|---|---|---|
| 1 | 1.000ms | 1.000–1.200ms |
| 2 | 2.000ms | 2.000–2.200ms |
| 3 | 4.000ms | 4.000–4.200ms |

**Erros retryáveis:**
- Exception de rede / timeout (`Soup.Session` lança exceção)
- HTTP 500, 502, 503, 504
- HTTP 429 → usa `Retry-After` header (segundos) se presente; fallback: backoff normal

**Erros fatais (não retenta):**
- HTTP 4xx exceto 429
- `JSON.parse` falha
- `OpenMeteoValidationError`

**`_delay(ms)`** usa `GLib.timeout_add` — não bloqueia o main loop do GNOME Shell.

### URL Request

```
GET https://api.open-meteo.com/v1/forecast?
  latitude={lat}
  &longitude={lon}
  &current=temperature_2m,apparent_temperature,weathercode,
           windspeed_10m,windgusts_10m,relativehumidity_2m,precipitation
  &hourly=temperature_2m,weathercode,precipitation_probability,precipitation
  &daily=weathercode,temperature_2m_max,temperature_2m_min,
         precipitation_sum,precipitation_probability_max,
         windspeed_10m_max,windgusts_10m_max
  &timezone=auto
  &forecast_days=7
  &wind_speed_unit=kmh
```

---

## Migração `WeatherService.js`

Única mudança: trocar import.

```js
// antes:
import { OpenMeteoClient } from './OpenMeteoClient.js';
// depois:
import { OpenMeteoService } from './OpenMeteoService.js';
```

Instanciação no `extension.js`:

```js
// antes:
weatherClient: new OpenMeteoClient(),
// depois:
weatherClient: new OpenMeteoService({ timeout: 10, maxRetries: 3, baseDelay: 1000 }),
```

`OpenMeteoService` expõe `fetch(lat, lon)` e `destroy()` — interface idêntica. Sem outras mudanças em `WeatherService.js`.

---

## Testes Unitários

### `tests/unit/test-openmeteo-validator.js`

- `validate(rawValido)` → sem throw
- `validate({})` → throws `OpenMeteoValidationError`
- `validate(semCampoObrigatorio)` → throws com mensagem descritiva
- `validate(tipoCampoErrado)` → throws `OpenMeteoValidationError`

### `tests/unit/test-openmeteo-mapper.js`

- `map(rawValido).current.temperature` → valor correto
- `map(rawValido).current.windGust` → mapeado de `windgusts_10m`
- `map(rawValido).current.precipitation` → mapeado corretamente
- `map(rawValido).hourly.length` → 24
- `map(rawValido).hourly[0].precipitationProb` → valor correto
- `map(rawValido).daily[0].precipitationProb` → mapeado de `precipitation_probability_max`
- `map(rawValido).daily[0].windGustMax` → mapeado de `windgusts_10m_max`
- `map(rawValido).fetchedAt` → número (timestamp)

---

## Critérios de Aceite

| Critério | Verificação |
|---|---|
| Testes unitários passando | `bash tests/unit/run.sh` → 100% |
| Cache em memória funciona | Segunda chamada com mesmas coords não faz HTTP |
| Retry em erro de rede | Mock de falha → 4 tentativas no total |
| Retry-After respeitado | Header `Retry-After: 5` → aguarda ~5s |
| 4xx fatal | HTTP 400 → throw imediato, sem retry |
| Validação rejeita resposta inválida | Campo ausente → `OpenMeteoValidationError` |
| Probabilidade de chuva presente | `model.hourly[0].precipitationProb` é number |
| Interface compatível | `WeatherService.js` funciona sem mudanças além do import |
