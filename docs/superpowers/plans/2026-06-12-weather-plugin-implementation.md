# Weather Plugin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar extensão GNOME Shell de clima com temperatura na top bar, popup com previsão 24h/7d, alertas INMET e notificações nativas.

**Architecture:** Camadas modulares (ui / services / data / utils) com `extension.js` como orquestrador fino. `WeatherService` emite sinais GObject; UI reage passivamente. Clientes HTTP injetados via construtor em `WeatherService` (DI).

**Tech Stack:** GJS ESModules, GNOME Shell 48+, GTK4, LibAdwaita, Soup 3, GeoClue2, GLib, Gio, Open-Meteo API (sem auth), INMET CAP RSS (sem auth).

**Spec:** `docs/superpowers/specs/2026-06-12-weather-plugin-design.md`

---

## Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| GeoClue2 indisponível ou permissão negada | Média | Alto | Tratar como offline; sem crash |
| INMET API muda endpoint/formato | Alta | Médio | `InmetClient` isolado; retorna `[]` em falha |
| Soup.Session async — API ligeiramente diferente entre versões GNOME | Baixa | Alto | Testar no GNOME 48 alvo desde Task 7 |
| Memory leak por signal não desconectado | Média | Alto | `disable()` obrigatório — checklist de cleanup |
| GJS ESModule import paths — extensão não carrega | Baixa | Alto | Verificar UUID + paths na Task 1 |
| GSettings schema não compilado | Média | Alto | Script `compile-schemas` na Task 1 |
| INMET XML parse sem DOMParser no GJS | Alta | Médio | Usar `GLib.Markup` ou regex conservador |

---

## Estratégias

### Cache
- **Armazenamento:** `~/.cache/gnome-shell/weather-plugin/cache.json`
- **Conteúdo:** `WeatherModel` completo serializado como JSON, incluindo campo `fetchedAt: number` (timestamp ms)
- **TTL:** Igual ao `refresh-interval` lido do GSettings (padrão: 600s)
- **Startup:** Carregar cache → servir imediatamente se `Date.now() - fetchedAt < ttl` → fetch paralelo em background de qualquer forma
- **Falha de fetch:** Manter cache existente; emitir `offline`
- **Invalidação:** Nenhuma manual; sobreescrito a cada fetch bem-sucedido

### Atualização de Dados
- **Mecanismo:** `GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, intervalSeconds, callback)`
- **Armazenar:** `this._sourceId = GLib.timeout_add_seconds(...)` para cancelar em `stop()`
- **Cancelamento:** `GLib.Source.remove(this._sourceId)` em `WeatherService.stop()`
- **Intervalo padrão:** 600s (configurável em prefs: 300 / 600 / 900 / 1800s)
- **Re-fetch de coords:** Não — GeoClue2 resolvido uma vez por sessão do shell

### Notificações
- **Trigger:** `WeatherService` compara `AlertModel[].id` do poll atual vs anterior (mantido em memória como `this._previousAlertIds`)
- **Disparo:** Apenas para IDs novos (não re-notifica mesmo alerta)
- **API:** `NotificationService.notify(title, body)` → usa `global.notify(title, body)` (GNOME Shell built-in) para notificações simples
- **Reset:** `_previousAlertIds` zerado quando extensão reinicia (sem persistência entre sessões do shell)

### Integração INMET
- **Detecção Brasil:** Verificação de bbox pura antes de qualquer I/O — `lat ∈ [-33.75, 5.27] && lon ∈ [-73.99, -28.85]`
- **Endpoint:** `https://apiprevmet3.inmet.gov.br/avisos/rss` (RSS/XML CAP)
- **Parse XML:** `GLib.MarkupParser` para XML seguro; fallback regex para campos simples
- **Campos extraídos:** `id`, `title`, `severity`, `description`, `onset`, `expires`
- **Filtragem por área:** Verificar se coords do usuário estão no `<cap:polygon>` do alerta — implementar point-in-polygon simplificado (bounding box do polígono é suficiente para alertas estaduais)
- **Falha HTTP:** Retorna `[]` silenciosamente; log via `console.warn()`

---

## Milestones

### M1 — Foundation (Tasks 1–5)
Projeto instalável no GNOME Shell, schemas compilados, utilities com testes passando.  
**Critério:** `gnome-extensions enable weather-plugin@thalysvalisi` sem erros em `journalctl`.

### M2 — Data Layer (Tasks 6–9)
Todos os clientes HTTP funcionando, cache lendo/escrevendo, location resolvendo.  
**Critério:** Script manual consegue fazer fetch de clima e alertas com coords fixas.

### M3 — Service Layer (Tasks 10–11)
`WeatherService` orquestrando polling completo, sinais emitindo corretamente.  
**Critério:** `journalctl` mostra dados frescos a cada ciclo; sinal `offline` ao desligar rede.

### M4 — UI Layer (Tasks 12–19)
Todos os widgets visíveis e corretos. Popup abre com dados reais.  
**Critério:** Temperatura + ícone na top bar; popup mostra current + hourly + daily + alertas.

### M5 — Preferences + Polish (Tasks 20–21)
Janela de preferências funcional. Unidade e intervalo persistem entre sessões.  
**Critério:** Trocar unidade em prefs → temperatura na top bar atualiza no próximo poll.

---

## Roadmap

```
M1: Foundation          ████████░░░░░░░░░░░░  Tasks 1-5
M2: Data Layer          ░░░░████████░░░░░░░░  Tasks 6-9
M3: Service Layer       ░░░░░░░░████░░░░░░░░  Tasks 10-11
M4: UI Layer            ░░░░░░░░░░░░████████  Tasks 12-19
M5: Prefs + Polish      ░░░░░░░░░░░░░░░░████  Tasks 20-21
```

**Ordem crítica:** M1 → M2 → M3 → M4 → M5. Cada milestone depende do anterior. Dentro de M4, as tasks de widgets são independentes entre si (Tasks 13–17 podem ser paralelizadas).

---

## Backlog de Tarefas

---

### Task 1: Skeleton do Projeto + GSettings Schema

**Milestone:** M1  
**Files:**
- Create: `metadata.json`
- Create: `extension.js` (stub)
- Create: `prefs.js` (stub)
- Create: `schemas/org.gnome.shell.extensions.weather-plugin.gschema.xml`
- Create: `install.sh`

- [ ] **Step 1: Criar `metadata.json`**

```json
{
  "name": "Weather Plugin",
  "description": "Clima na top bar com previsão e alertas INMET",
  "uuid": "weather-plugin@thalysvalisi",
  "version": 1,
  "shell-version": ["48"],
  "url": ""
}
```

- [ ] **Step 2: Criar `extension.js` stub**

```js
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class WeatherExtension extends Extension {
    enable() {
        console.log('[WeatherPlugin] enabled');
    }

    disable() {
        console.log('[WeatherPlugin] disabled');
    }
}
```

- [ ] **Step 3: Criar `prefs.js` stub**

```js
import { ExtensionPreferences } from 'resource:///org/gnome/shell/extensions/prefs.js';

export default class WeatherPreferences extends ExtensionPreferences {
    fillPreferencesWindow(_window) {}
}
```

- [ ] **Step 4: Criar GSettings schema**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<schemalist>
  <schema id="org.gnome.shell.extensions.weather-plugin"
          path="/org/gnome/shell/extensions/weather-plugin/">
    <key name="temperature-unit" type="s">
      <default>'celsius'</default>
      <summary>Unidade de temperatura</summary>
      <description>celsius ou fahrenheit</description>
    </key>
    <key name="refresh-interval" type="i">
      <default>600</default>
      <summary>Intervalo de atualização em segundos</summary>
      <description>300, 600, 900 ou 1800</description>
    </key>
  </schema>
</schemalist>
```

- [ ] **Step 5: Criar `install.sh`**

```bash
#!/usr/bin/env bash
set -e
UUID="weather-plugin@thalysvalisi"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

mkdir -p "$DEST"
cp -r . "$DEST"

glib-compile-schemas "$DEST/schemas/"

echo "Instalado em $DEST"
echo "Execute: gnome-extensions enable $UUID"
echo "Reinicie o GNOME Shell: Alt+F2 → r → Enter (X11) ou logout/login (Wayland)"
```

- [ ] **Step 6: Tornar executável e instalar**

```bash
chmod +x install.sh && bash install.sh
```

- [ ] **Step 7: Verificar extensão carregada sem erros**

```bash
journalctl -f -o cat /usr/share/gnome-shell/gnome-shell 2>/dev/null | grep -i weather &
gnome-extensions enable weather-plugin@thalysvalisi
```

Esperado: `[WeatherPlugin] enabled` no journal.

- [ ] **Step 8: Commit**

```bash
git add metadata.json extension.js prefs.js schemas/ install.sh
git commit -m "feat: project skeleton with GSettings schema and install script"
```

**Critério de aceite:** Extensão habilita e desabilita sem erro. `glib-compile-schemas` não reporta warnings.

---

### Task 2: `data/WeatherModel.js` — Contratos de Dados

**Milestone:** M1  
**Files:**
- Create: `data/WeatherModel.js`

- [ ] **Step 1: Criar typedefs JSDoc**

```js
// data/WeatherModel.js

/**
 * @typedef {Object} CurrentWeather
 * @property {number} temperature
 * @property {number} apparentTemperature
 * @property {number} humidity
 * @property {number} windSpeed
 * @property {number} weatherCode
 */

/**
 * @typedef {Object} HourlySlot
 * @property {string} time        ISO 8601
 * @property {number} temperature
 * @property {number} weatherCode
 */

/**
 * @typedef {Object} DailyDay
 * @property {string} date        YYYY-MM-DD
 * @property {number} tempMax
 * @property {number} tempMin
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

- [ ] **Step 2: Commit**

```bash
git add data/WeatherModel.js
git commit -m "feat: WeatherModel JSDoc typedefs"
```

**Critério de aceite:** Arquivo importável sem erros (`gjs -m data/WeatherModel.js` sai sem mensagem).

---

### Task 3: Test Runner Setup

**Milestone:** M1  
**Files:**
- Create: `tests/unit/run.sh`
- Create: `tests/unit/helpers.js`

- [ ] **Step 1: Criar `tests/unit/helpers.js`**

```js
// tests/unit/helpers.js
let _passed = 0;
let _failed = 0;

export function assert(condition, msg) {
    if (condition) {
        print(`  ✓ ${msg}`);
        _passed++;
    } else {
        print(`  ✗ ${msg}`);
        _failed++;
    }
}

export function assertEqual(actual, expected, msg) {
    const ok = actual === expected;
    if (!ok) print(`    got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)}`);
    assert(ok, msg);
}

export function summary(suiteName) {
    print(`\n${suiteName}: ${_passed} passed, ${_failed} failed`);
    if (_failed > 0) imports.system.exit(1);
}
```

- [ ] **Step 2: Criar `tests/unit/run.sh`**

```bash
#!/usr/bin/env bash
set -e
PASS=0
FAIL=0

for f in tests/unit/test-*.js; do
    echo "Running $f..."
    if gjs -m "$f"; then
        PASS=$((PASS+1))
    else
        FAIL=$((FAIL+1))
    fi
done

echo ""
echo "Suites: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
```

- [ ] **Step 3: Tornar executável**

```bash
chmod +x tests/unit/run.sh
```

- [ ] **Step 4: Verificar runner funciona (sem testes ainda)**

```bash
bash tests/unit/run.sh
```

Esperado: `Suites: 0 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add tests/
git commit -m "feat: GJS unit test runner setup"
```

**Critério de aceite:** `run.sh` executa sem erro com zero arquivos `test-*.js`.

---

### Task 4: `utils/Formatter.js` + Testes

**Milestone:** M1  
**Files:**
- Create: `utils/Formatter.js`
- Create: `tests/unit/test-formatter.js`

- [ ] **Step 1: Escrever teste antes da implementação**

```js
// tests/unit/test-formatter.js
import { assertEqual, summary } from './helpers.js';
import { formatTemp, formatTime, formatWindSpeed } from '../../utils/Formatter.js';

assertEqual(formatTemp(23, 'celsius'),     '23°C',      'celsius integer');
assertEqual(formatTemp(23.7, 'celsius'),   '24°C',      'celsius rounds');
assertEqual(formatTemp(0, 'celsius'),      '0°C',       'celsius zero');
assertEqual(formatTemp(23, 'fahrenheit'),  '73°F',      'fahrenheit convert');
assertEqual(formatTemp(-10, 'celsius'),    '-10°C',     'negative celsius');

assertEqual(formatTime('2026-06-12T14:00'), '14:00',    'time HH:MM');
assertEqual(formatTime('2026-06-12T09:05'), '09:05',    'time zero-padded');

assertEqual(formatWindSpeed(0),   '0 km/h',   'wind zero');
assertEqual(formatWindSpeed(5),   '18 km/h',  'wind 5m/s → 18km/h');
assertEqual(formatWindSpeed(10),  '36 km/h',  'wind 10m/s');

summary('Formatter');
```

- [ ] **Step 2: Rodar teste — deve falhar**

```bash
gjs -m tests/unit/test-formatter.js
```

Esperado: Erro de importação (módulo não existe).

- [ ] **Step 3: Implementar `utils/Formatter.js`**

```js
// utils/Formatter.js

/**
 * @param {number} value
 * @param {'celsius'|'fahrenheit'} unit
 * @returns {string}
 */
export function formatTemp(value, unit) {
    if (unit === 'fahrenheit') {
        return `${Math.round(value * 9 / 5 + 32)}°F`;
    }
    return `${Math.round(value)}°C`;
}

/**
 * @param {string} isoString  ex: '2026-06-12T14:00'
 * @returns {string}          ex: '14:00'
 */
export function formatTime(isoString) {
    const t = isoString.split('T')[1];
    return t ? t.slice(0, 5) : isoString;
}

/**
 * @param {number} ms  metros por segundo
 * @returns {string}
 */
export function formatWindSpeed(ms) {
    return `${Math.round(ms * 3.6)} km/h`;
}
```

- [ ] **Step 4: Rodar teste — deve passar**

```bash
gjs -m tests/unit/test-formatter.js
```

Esperado: todos `✓`, `Formatter: 9 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add utils/Formatter.js tests/unit/test-formatter.js
git commit -m "feat: Formatter utility with unit tests"
```

**Critério de aceite:** `bash tests/unit/run.sh` passa 100%.

---

### Task 5: `utils/WeatherIcons.js` + Testes

**Milestone:** M1  
**Files:**
- Create: `utils/WeatherIcons.js`
- Create: `tests/unit/test-weather-icons.js`

- [ ] **Step 1: Escrever teste**

```js
// tests/unit/test-weather-icons.js
import { assertEqual, summary } from './helpers.js';
import { getIconName } from '../../utils/WeatherIcons.js';

assertEqual(getIconName(0),   'weather-clear-symbolic',           'WMO 0: clear sky');
assertEqual(getIconName(1),   'weather-few-clouds-symbolic',      'WMO 1: mainly clear');
assertEqual(getIconName(2),   'weather-few-clouds-symbolic',      'WMO 2: partly cloudy');
assertEqual(getIconName(3),   'weather-overcast-symbolic',        'WMO 3: overcast');
assertEqual(getIconName(51),  'weather-showers-scattered-symbolic','WMO 51: drizzle light');
assertEqual(getIconName(61),  'weather-showers-symbolic',         'WMO 61: rain slight');
assertEqual(getIconName(71),  'weather-snow-symbolic',            'WMO 71: snow slight');
assertEqual(getIconName(95),  'weather-storm-symbolic',           'WMO 95: thunderstorm');
assertEqual(getIconName(999), 'weather-severe-alert-symbolic',    'unknown code fallback');

summary('WeatherIcons');
```

- [ ] **Step 2: Rodar — deve falhar**

```bash
gjs -m tests/unit/test-weather-icons.js
```

- [ ] **Step 3: Implementar `utils/WeatherIcons.js`**

```js
// utils/WeatherIcons.js

const WMO_MAP = new Map([
    [0,  'weather-clear-symbolic'],
    [1,  'weather-few-clouds-symbolic'],
    [2,  'weather-few-clouds-symbolic'],
    [3,  'weather-overcast-symbolic'],
    [45, 'weather-fog-symbolic'],
    [48, 'weather-fog-symbolic'],
    [51, 'weather-showers-scattered-symbolic'],
    [53, 'weather-showers-scattered-symbolic'],
    [55, 'weather-showers-scattered-symbolic'],
    [61, 'weather-showers-symbolic'],
    [63, 'weather-showers-symbolic'],
    [65, 'weather-showers-symbolic'],
    [71, 'weather-snow-symbolic'],
    [73, 'weather-snow-symbolic'],
    [75, 'weather-snow-symbolic'],
    [80, 'weather-showers-symbolic'],
    [81, 'weather-showers-symbolic'],
    [82, 'weather-showers-symbolic'],
    [95, 'weather-storm-symbolic'],
    [96, 'weather-storm-symbolic'],
    [99, 'weather-storm-symbolic'],
]);

const FALLBACK = 'weather-severe-alert-symbolic';

/**
 * @param {number} wmoCode
 * @returns {string} icon name compatível com tema GNOME
 */
export function getIconName(wmoCode) {
    return WMO_MAP.get(wmoCode) ?? FALLBACK;
}
```

- [ ] **Step 4: Rodar — deve passar**

```bash
gjs -m tests/unit/test-weather-icons.js
```

- [ ] **Step 5: Rodar todos os testes**

```bash
bash tests/unit/run.sh
```

Esperado: `Suites: 2 passed, 0 failed`

- [ ] **Step 6: Commit**

```bash
git add utils/WeatherIcons.js tests/unit/test-weather-icons.js
git commit -m "feat: WeatherIcons WMO code mapper with unit tests"
```

**Critério de aceite:** 100% dos testes passando. Todos os WMO codes usados pelo Open-Meteo mapeados.

---

### Task 6: `data/CacheStore.js`

**Milestone:** M2  
**Files:**
- Create: `data/CacheStore.js`

> Nota: `CacheStore` usa `GLib` e `Gio` — não testável com runner GJS puro. Verificação manual.

- [ ] **Step 1: Implementar `data/CacheStore.js`**

```js
// data/CacheStore.js
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const CACHE_DIR  = GLib.build_filenamev([GLib.get_user_cache_dir(), 'gnome-shell', 'weather-plugin']);
const CACHE_FILE = GLib.build_filenamev([CACHE_DIR, 'cache.json']);

export class CacheStore {
    /**
     * @param {import('./WeatherModel.js').WeatherModel} model
     */
    save(model) {
        try {
            GLib.mkdir_with_parents(CACHE_DIR, 0o755);
            const file = Gio.File.new_for_path(CACHE_FILE);
            const bytes = new TextEncoder().encode(JSON.stringify(model));
            file.replace_contents(bytes, null, false,
                Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        } catch (e) {
            console.warn(`[WeatherPlugin] CacheStore.save failed: ${e.message}`);
        }
    }

    /**
     * @returns {import('./WeatherModel.js').WeatherModel | null}
     */
    load() {
        try {
            const file = Gio.File.new_for_path(CACHE_FILE);
            const [, contents] = file.load_contents(null);
            const model = JSON.parse(new TextDecoder().decode(contents));
            if (typeof model?.fetchedAt !== 'number') return null;
            return model;
        } catch (_e) {
            return null;
        }
    }
}
```

- [ ] **Step 2: Verificar manualmente via `gjs`**

```bash
gjs -m - << 'EOF'
import { CacheStore } from './data/CacheStore.js';

const store = new CacheStore();
const model = {
    current: { temperature: 22, apparentTemperature: 20, humidity: 65, windSpeed: 5, weatherCode: 1 },
    hourly: [], daily: [], alerts: [],
    fetchedAt: Date.now()
};

store.save(model);
const loaded = store.load();
print('fetchedAt matches:', loaded?.fetchedAt === model.fetchedAt);
print('temperature matches:', loaded?.current?.temperature === 22);
EOF
```

Esperado: ambas as linhas `true`.

- [ ] **Step 3: Verificar arquivo criado**

```bash
ls ~/.cache/gnome-shell/weather-plugin/cache.json
cat ~/.cache/gnome-shell/weather-plugin/cache.json | python3 -m json.tool | head -5
```

- [ ] **Step 4: Commit**

```bash
git add data/CacheStore.js
git commit -m "feat: CacheStore JSON persistence in user cache dir"
```

**Critério de aceite:** `load()` após `save()` retorna modelo idêntico. `load()` retorna `null` para arquivo ausente ou corrompido.

---

### Task 7: `services/OpenMeteoClient.js`

**Milestone:** M2  
**Files:**
- Create: `services/OpenMeteoClient.js`

> Requer GNOME Shell runtime (Soup 3). Teste manual via script GJS com `gi://Soup`.

- [ ] **Step 1: Implementar `services/OpenMeteoClient.js`**

```js
// services/OpenMeteoClient.js
import Soup from 'gi://Soup';
import GLib from 'gi://GLib';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

export class OpenMeteoClient {
    constructor() {
        this._session = new Soup.Session();
        this._session.timeout = 10;
    }

    /**
     * @param {number} lat
     * @param {number} lon
     * @returns {Promise<import('../data/WeatherModel.js').WeatherModel>}
     */
    async fetch(lat, lon) {
        const params = new URLSearchParams({
            latitude:  lat.toString(),
            longitude: lon.toString(),
            current:   'temperature_2m,weathercode,windspeed_10m,relativehumidity_2m,apparent_temperature',
            hourly:    'temperature_2m,weathercode',
            daily:     'weathercode,temperature_2m_max,temperature_2m_min',
            timezone:  'auto',
            forecast_days: '7',
        });

        const uri     = GLib.Uri.parse(`${BASE_URL}?${params}`, GLib.UriFlags.NONE);
        const message = new Soup.Message({ method: 'GET', uri });

        const bytes = await this._session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);
        if (message.status_code !== 200)
            throw new Error(`OpenMeteo HTTP ${message.status_code}`);

        const data = JSON.parse(new TextDecoder().decode(bytes.get_data()));
        return this._parse(data);
    }

    /** @private */
    _parse(data) {
        const c = data.current;
        const current = {
            temperature:         c.temperature_2m,
            apparentTemperature: c.apparent_temperature,
            humidity:            c.relativehumidity_2m,
            windSpeed:           c.windspeed_10m,
            weatherCode:         c.weathercode,
        };

        const hourly = data.hourly.time.slice(0, 24).map((time, i) => ({
            time,
            temperature: data.hourly.temperature_2m[i],
            weatherCode: data.hourly.weathercode[i],
        }));

        const daily = data.daily.time.map((date, i) => ({
            date,
            tempMax:     data.daily.temperature_2m_max[i],
            tempMin:     data.daily.temperature_2m_min[i],
            weatherCode: data.daily.weathercode[i],
        }));

        return { current, hourly, daily, alerts: [], fetchedAt: Date.now() };
    }

    destroy() {
        this._session.abort();
    }
}
```

- [ ] **Step 2: Testar manualmente**

```bash
gjs -m - << 'EOF'
import { OpenMeteoClient } from './services/OpenMeteoClient.js';

const client = new OpenMeteoClient();
client.fetch(-23.55, -46.63).then(model => {
    print('temperature:', model.current.temperature);
    print('hourly slots:', model.hourly.length);
    print('daily days:', model.daily.length);
    print('fetchedAt:', new Date(model.fetchedAt).toISOString());
    client.destroy();
}).catch(e => { print('ERROR:', e.message); imports.system.exit(1); });
EOF
```

Esperado: temperatura numérica, 24 slots horários, 7 dias.

- [ ] **Step 3: Commit**

```bash
git add services/OpenMeteoClient.js
git commit -m "feat: OpenMeteoClient HTTP fetch with response parsing"
```

**Critério de aceite:** Retorna `WeatherModel` com `current`, `hourly[24]`, `daily[7]`. Lança `Error` em HTTP não-200.

---

### Task 8: `services/InmetClient.js`

**Milestone:** M2  
**Files:**
- Create: `services/InmetClient.js`

- [ ] **Step 1: Implementar `services/InmetClient.js`**

```js
// services/InmetClient.js
import Soup from 'gi://Soup';
import GLib from 'gi://GLib';

const INMET_RSS = 'https://apiprevmet3.inmet.gov.br/avisos/rss';

const BRAZIL_BBOX = { latMin: -33.75, latMax: 5.27, lonMin: -73.99, lonMax: -28.85 };

export class InmetClient {
    constructor() {
        this._session = new Soup.Session();
        this._session.timeout = 10;
    }

    /**
     * @param {number} lat
     * @param {number} lon
     * @returns {Promise<import('../data/WeatherModel.js').AlertModel[]>}
     */
    async fetch(lat, lon) {
        if (!this._isInBrazil(lat, lon)) return [];

        const uri     = GLib.Uri.parse(INMET_RSS, GLib.UriFlags.NONE);
        const message = new Soup.Message({ method: 'GET', uri });

        let bytes;
        try {
            bytes = await this._session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);
        } catch (e) {
            console.warn(`[WeatherPlugin] InmetClient fetch failed: ${e.message}`);
            return [];
        }

        if (message.status_code !== 200) {
            console.warn(`[WeatherPlugin] InmetClient HTTP ${message.status_code}`);
            return [];
        }

        return this._parseAlerts(new TextDecoder().decode(bytes.get_data()), lat, lon);
    }

    /** @private */
    _isInBrazil(lat, lon) {
        return lat  >= BRAZIL_BBOX.latMin && lat  <= BRAZIL_BBOX.latMax
            && lon >= BRAZIL_BBOX.lonMin && lon <= BRAZIL_BBOX.lonMax;
    }

    /** @private */
    _parseAlerts(xml, lat, lon) {
        const alerts = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;

        while ((match = itemRegex.exec(xml)) !== null) {
            const item = match[1];
            const get  = (tag) => {
                const m = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`).exec(item);
                return m ? (m[1] ?? m[2] ?? '').trim() : '';
            };

            const title       = get('title');
            const description = get('description');
            const id          = get('guid') || get('link') || `${Date.now()}-${alerts.length}`;
            const onset       = get('pubDate');
            const expires     = get('cap:expires') || '';
            const severity    = get('cap:severity') || 'Unknown';

            // Bbox filtragem por polígono do alerta (bounding box simplificado)
            const polygon = get('cap:polygon');
            if (polygon && !this._pointInPolygonBbox(lat, lon, polygon)) continue;

            if (title) {
                alerts.push({ id, title, severity, description, onset, expires });
            }
        }

        return alerts;
    }

    /** @private */
    _pointInPolygonBbox(lat, lon, polygonStr) {
        const coords = polygonStr.trim().split(/\s+/).map(pair => {
            const [la, lo] = pair.split(',').map(Number);
            return { lat: la, lon: lo };
        }).filter(c => !isNaN(c.lat) && !isNaN(c.lon));

        if (coords.length === 0) return true; // sem polígono → incluir

        const lats = coords.map(c => c.lat);
        const lons = coords.map(c => c.lon);
        const minLat = Math.min(...lats), maxLat = Math.max(...lats);
        const minLon = Math.min(...lons), maxLon = Math.max(...lons);

        return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
    }

    destroy() {
        this._session.abort();
    }
}
```

- [ ] **Step 2: Testar fora do Brasil (deve retornar `[]` sem HTTP)**

```bash
gjs -m - << 'EOF'
import { InmetClient } from './services/InmetClient.js';

const client = new InmetClient();

// Londres — fora do Brasil
client.fetch(51.5, -0.1).then(alerts => {
    print('London alerts (expect 0):', alerts.length);
    // São Paulo — dentro do Brasil
    return client.fetch(-23.55, -46.63);
}).then(alerts => {
    print('SP alerts fetched:', alerts.length, '(pode ser 0 se sem alertas ativos)');
    client.destroy();
}).catch(e => print('ERROR:', e.message));
EOF
```

- [ ] **Step 3: Commit**

```bash
git add services/InmetClient.js
git commit -m "feat: InmetClient CAP RSS parser with Brazil bbox detection"
```

**Critério de aceite:** `fetch(51.5, -0.1)` retorna `[]` sem fazer HTTP request. `fetch(-23.55, -46.63)` retorna array (vazio ou com alertas). Falha de rede retorna `[]` sem crash.

---

### Task 9: `services/LocationService.js`

**Milestone:** M2  
**Files:**
- Create: `services/LocationService.js`

- [ ] **Step 1: Implementar `services/LocationService.js`**

```js
// services/LocationService.js
import Geoclue from 'gi://Geoclue';

export class LocationService {
    constructor() {
        this._client = null;
        this._coords = null;
    }

    /**
     * @returns {Promise<{lat: number, lon: number}>}
     */
    async getLocation() {
        if (this._coords) return this._coords;

        return new Promise((resolve, reject) => {
            Geoclue.Simple.new(
                'weather-plugin@thalysvalisi',
                Geoclue.AccuracyLevel.CITY,
                null,
                (_, result) => {
                    try {
                        this._client = Geoclue.Simple.new_finish(result);
                        const loc = this._client.get_location();
                        this._coords = {
                            lat: loc.get_latitude(),
                            lon: loc.get_longitude(),
                        };
                        resolve(this._coords);
                    } catch (e) {
                        reject(new Error(`GeoClue2 failed: ${e.message}`));
                    }
                }
            );
        });
    }

    destroy() {
        this._client = null;
        this._coords = null;
    }
}
```

- [ ] **Step 2: Testar manualmente**

```bash
gjs -m - << 'EOF'
import { LocationService } from './services/LocationService.js';
import GLib from 'gi://GLib';

const loop = GLib.MainLoop.new(null, false);
const svc  = new LocationService();

svc.getLocation().then(coords => {
    print('lat:', coords.lat, 'lon:', coords.lon);
    svc.destroy();
    loop.quit();
}).catch(e => {
    print('ERROR (GeoClue2 pode não estar disponível neste ambiente):', e.message);
    loop.quit();
});

loop.run();
EOF
```

Esperado: coordenadas válidas, ou mensagem de erro de GeoClue2 (aceitável em ambientes sem daemon).

- [ ] **Step 3: Commit**

```bash
git add services/LocationService.js
git commit -m "feat: LocationService GeoClue2 wrapper"
```

**Critério de aceite:** Resolve com `{lat, lon}` em sistema com GeoClue2 ativo. Rejeita promise com mensagem descritiva em caso de falha (não crasha).

---

### Task 10: `services/NotificationService.js`

**Milestone:** M3  
**Files:**
- Create: `services/NotificationService.js`

- [ ] **Step 1: Implementar `services/NotificationService.js`**

```js
// services/NotificationService.js

export class NotificationService {
    /**
     * Dispara notificação nativa GNOME Shell.
     * Deve ser chamado apenas de dentro do contexto de extensão (após enable()).
     * @param {string} title
     * @param {string} body
     */
    notify(title, body) {
        try {
            // global.notify é a API de notificação de extensões GNOME Shell
            global.notify(title, body);
        } catch (e) {
            console.warn(`[WeatherPlugin] NotificationService.notify failed: ${e.message}`);
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add services/NotificationService.js
git commit -m "feat: NotificationService wrapping global.notify"
```

**Critério de aceite:** `notify()` chama `global.notify()` sem crash. Falha silenciosa com `console.warn`.

---

### Task 11: `services/WeatherService.js`

**Milestone:** M3  
**Files:**
- Create: `services/WeatherService.js`

> Este é o módulo mais complexo — orquestra todos os outros. Verificação via `journalctl` no GNOME Shell real.

- [ ] **Step 1: Implementar `services/WeatherService.js`**

```js
// services/WeatherService.js
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';

export const WeatherService = GObject.registerClass({
    Signals: {
        'weather-updated': {
            param_types: [GObject.TYPE_JSOBJECT],
        },
        'offline': {},
    },
}, class WeatherService extends GObject.Object {

    /**
     * @param {{
     *   locationService: import('./LocationService.js').LocationService,
     *   weatherClient:   import('./OpenMeteoClient.js').OpenMeteoClient,
     *   alertClient:     import('./InmetClient.js').InmetClient,
     *   cache:           import('../data/CacheStore.js').CacheStore,
     *   notificationSvc: import('./NotificationService.js').NotificationService,
     *   settings:        Gio.Settings,
     * }} deps
     */
    _init(deps) {
        super._init();
        this._location    = deps.locationService;
        this._weather     = deps.weatherClient;
        this._alerts      = deps.alertClient;
        this._cache       = deps.cache;
        this._notif       = deps.notificationSvc;
        this._settings    = deps.settings;
        this._sourceId    = null;
        this._coords      = null;
        this._prevAlertIds = new Set();
    }

    async start() {
        try {
            this._coords = await this._location.getLocation();
        } catch (e) {
            console.warn(`[WeatherPlugin] Location failed: ${e.message}`);
            this.emit('offline');
            return;
        }

        const cached = this._cache.load();
        const interval = this._settings.get_int('refresh-interval');

        if (cached && (Date.now() - cached.fetchedAt) < interval * 1000) {
            this.emit('weather-updated', cached);
        }

        await this._fetchAndEmit();

        this._sourceId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            interval,
            () => { this._fetchAndEmit(); return GLib.SOURCE_CONTINUE; }
        );
    }

    stop() {
        if (this._sourceId !== null) {
            GLib.Source.remove(this._sourceId);
            this._sourceId = null;
        }
        this._location.destroy();
        this._weather.destroy();
        this._alerts.destroy();
    }

    /** @private */
    async _fetchAndEmit() {
        try {
            const [weatherModel, newAlerts] = await Promise.all([
                this._weather.fetch(this._coords.lat, this._coords.lon),
                this._alerts.fetch(this._coords.lat, this._coords.lon),
            ]);

            weatherModel.alerts = newAlerts;
            this._cache.save(weatherModel);
            this._notifyNewAlerts(newAlerts);
            this.emit('weather-updated', weatherModel);
        } catch (e) {
            console.warn(`[WeatherPlugin] Fetch failed: ${e.message}`);
            this.emit('offline');
        }
    }

    /** @private */
    _notifyNewAlerts(alerts) {
        for (const alert of alerts) {
            if (!this._prevAlertIds.has(alert.id)) {
                this._notif.notify(`Alerta: ${alert.title}`, alert.description || '');
            }
        }
        this._prevAlertIds = new Set(alerts.map(a => a.id));
    }
});
```

- [ ] **Step 2: Atualizar `extension.js` para usar `WeatherService`**

```js
// extension.js
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import Gio from 'gi://Gio';

import { WeatherService }      from './services/WeatherService.js';
import { LocationService }     from './services/LocationService.js';
import { OpenMeteoClient }     from './services/OpenMeteoClient.js';
import { InmetClient }         from './services/InmetClient.js';
import { NotificationService } from './services/NotificationService.js';
import { CacheStore }          from './data/CacheStore.js';

export default class WeatherExtension extends Extension {
    enable() {
        const settings = this.getSettings('org.gnome.shell.extensions.weather-plugin');

        this._service = new WeatherService({
            locationService: new LocationService(),
            weatherClient:   new OpenMeteoClient(),
            alertClient:     new InmetClient(),
            cache:           new CacheStore(),
            notificationSvc: new NotificationService(),
            settings,
        });

        this._updatedId = this._service.connect('weather-updated', (_, model) => {
            console.log(`[WeatherPlugin] weather-updated: ${model.current.temperature}°C`);
        });
        this._offlineId = this._service.connect('offline', () => {
            console.log('[WeatherPlugin] offline');
        });

        this._service.start().catch(e => console.error('[WeatherPlugin] start error:', e));
    }

    disable() {
        if (this._service) {
            this._service.disconnect(this._updatedId);
            this._service.disconnect(this._offlineId);
            this._service.stop();
            this._service = null;
        }
    }
}
```

- [ ] **Step 3: Reinstalar e testar no GNOME Shell**

```bash
bash install.sh
journalctl -f -o cat /usr/share/gnome-shell/gnome-shell 2>/dev/null &
gnome-extensions disable weather-plugin@thalysvalisi
gnome-extensions enable weather-plugin@thalysvalisi
```

Esperado: `[WeatherPlugin] weather-updated: <número>°C` no journal em ~5s.

- [ ] **Step 4: Testar offline**

Desligar rede → aguardar próximo poll → verificar `[WeatherPlugin] offline` no journal.

- [ ] **Step 5: Commit**

```bash
git add services/WeatherService.js extension.js
git commit -m "feat: WeatherService orchestrator with polling, cache and signals"
```

**Critério de aceite:** Sinal `weather-updated` emitido no startup e a cada `refresh-interval`. Sinal `offline` emitido em falha de rede. Extension habilita/desabilita sem crash.

---

### Task 12: `ui/PreferencesWindow.js` + `prefs.js`

**Milestone:** M5  
**Files:**
- Create: `ui/PreferencesWindow.js`
- Modify: `prefs.js`

- [ ] **Step 1: Implementar `ui/PreferencesWindow.js`**

```js
// ui/PreferencesWindow.js
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

export class PreferencesWindow {
    /**
     * @param {Adw.PreferencesWindow} window
     * @param {Gio.Settings} settings
     */
    build(window, settings) {
        const page  = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({ title: 'Geral' });
        page.add(group);

        // Unidade de temperatura
        const unitRow = new Adw.ComboRow({
            title: 'Unidade de temperatura',
            model: Gtk.StringList.new(['Celsius (°C)', 'Fahrenheit (°F)']),
        });
        const unit = settings.get_string('temperature-unit');
        unitRow.set_selected(unit === 'fahrenheit' ? 1 : 0);
        unitRow.connect('notify::selected', () => {
            settings.set_string('temperature-unit',
                unitRow.get_selected() === 1 ? 'fahrenheit' : 'celsius');
        });
        group.add(unitRow);

        // Intervalo de atualização
        const intervalRow = new Adw.ComboRow({
            title: 'Atualizar a cada',
            model: Gtk.StringList.new(['5 minutos', '10 minutos', '15 minutos', '30 minutos']),
        });
        const intervals = [300, 600, 900, 1800];
        const currentInterval = settings.get_int('refresh-interval');
        intervalRow.set_selected(intervals.indexOf(currentInterval) >= 0
            ? intervals.indexOf(currentInterval) : 1);
        intervalRow.connect('notify::selected', () => {
            settings.set_int('refresh-interval', intervals[intervalRow.get_selected()]);
        });
        group.add(intervalRow);

        window.add(page);
    }
}
```

- [ ] **Step 2: Atualizar `prefs.js`**

```js
// prefs.js
import { ExtensionPreferences } from 'resource:///org/gnome/shell/extensions/prefs.js';
import { PreferencesWindow } from './ui/PreferencesWindow.js';

export default class WeatherPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings('org.gnome.shell.extensions.weather-plugin');
        new PreferencesWindow().build(window, settings);
    }
}
```

- [ ] **Step 3: Reinstalar e abrir preferências**

```bash
bash install.sh
gnome-extensions prefs weather-plugin@thalysvalisi
```

Esperado: janela Adwaita com dois ComboRow visíveis. Mudança persiste após fechar (verificar via `gsettings get org.gnome.shell.extensions.weather-plugin temperature-unit`).

- [ ] **Step 4: Commit**

```bash
git add ui/PreferencesWindow.js prefs.js
git commit -m "feat: PreferencesWindow with temperature unit and refresh interval"
```

**Critério de aceite:** Trocar unidade → `gsettings get` reflete valor novo. Janela abre sem erro.

---

### Task 13: `ui/PanelIndicator.js`

**Milestone:** M4  
**Files:**
- Create: `ui/PanelIndicator.js`

- [ ] **Step 1: Implementar `ui/PanelIndicator.js`**

```js
// ui/PanelIndicator.js
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { formatTemp } from '../utils/Formatter.js';
import { getIconName } from '../utils/WeatherIcons.js';

export const PanelIndicator = GObject.registerClass(
class PanelIndicator extends PanelMenu.Button {

    _init(settings) {
        super._init(0.0, 'Weather Plugin');
        this._settings = settings;

        this._box = new St.BoxLayout({ styleClass: 'panel-status-menu-box' });

        this._icon = new St.Icon({
            iconName: 'weather-clear-symbolic',
            styleClass: 'system-status-icon',
        });

        this._label = new St.Label({
            text: '...',
            yAlign: Clutter.ActorAlign.CENTER,
        });

        this._box.add_child(this._icon);
        this._box.add_child(this._label);
        this.add_child(this._box);
    }

    /**
     * @param {import('../data/WeatherModel.js').WeatherModel} model
     */
    update(model) {
        const unit = this._settings.get_string('temperature-unit');
        this._label.set_text(formatTemp(model.current.temperature, unit));
        this._icon.set_icon_name(getIconName(model.current.weatherCode));
        this.show();
    }

    goOffline() {
        this.hide();
    }
}
```

- [ ] **Step 2: Atualizar `extension.js` — adicionar `PanelIndicator` à `Main.panel`**

```js
// Adicionar em extension.js (dentro de enable())
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { PanelIndicator } from './ui/PanelIndicator.js';

// Dentro de enable():
this._indicator = new PanelIndicator(settings);
Main.panel.addToStatusArea('weather-plugin', this._indicator);

this._updatedId = this._service.connect('weather-updated', (_, model) => {
    this._indicator.update(model);
});
this._offlineId = this._service.connect('offline', () => {
    this._indicator.goOffline();
});

// Dentro de disable():
this._indicator.destroy();
this._indicator = null;
```

- [ ] **Step 3: Reinstalar e verificar**

```bash
bash install.sh
# Reabilitar extensão
```

Esperado: temperatura + ícone visíveis na top bar direita.

- [ ] **Step 4: Commit**

```bash
git add ui/PanelIndicator.js extension.js
git commit -m "feat: PanelIndicator shows temperature and weather icon in top bar"
```

**Critério de aceite:** Temperatura real (em °C ou °F conforme prefs) visível na top bar. `goOffline()` oculta o botão.

---

### Task 14: `ui/CurrentWeatherWidget.js`

**Milestone:** M4  
**Files:**
- Create: `ui/CurrentWeatherWidget.js`

- [ ] **Step 1: Implementar `ui/CurrentWeatherWidget.js`**

```js
// ui/CurrentWeatherWidget.js
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import { formatTemp, formatWindSpeed } from '../utils/Formatter.js';
import { getIconName } from '../utils/WeatherIcons.js';

export const CurrentWeatherWidget = GObject.registerClass(
class CurrentWeatherWidget extends St.BoxLayout {
    _init(settings) {
        super._init({ vertical: true, styleClass: 'weather-current', xExpand: true });
        this._settings = settings;

        this._icon = new St.Icon({ iconSize: 64, styleClass: 'weather-current-icon' });

        this._tempLabel    = new St.Label({ styleClass: 'weather-temp-large' });
        this._feelsLabel   = new St.Label({ styleClass: 'weather-feels-like' });
        this._humidLabel   = new St.Label({ styleClass: 'weather-detail' });
        this._windLabel    = new St.Label({ styleClass: 'weather-detail' });

        const topRow = new St.BoxLayout({ xAlign: Clutter.ActorAlign.CENTER });
        topRow.add_child(this._icon);
        topRow.add_child(this._tempLabel);

        this.add_child(topRow);
        this.add_child(this._feelsLabel);
        this.add_child(this._humidLabel);
        this.add_child(this._windLabel);
    }

    /**
     * @param {import('../data/WeatherModel.js').WeatherModel} model
     */
    update(model) {
        const unit = this._settings.get_string('temperature-unit');
        const c = model.current;
        this._icon.set_icon_name(getIconName(c.weatherCode));
        this._tempLabel.set_text(formatTemp(c.temperature, unit));
        this._feelsLabel.set_text(`Sensação: ${formatTemp(c.apparentTemperature, unit)}`);
        this._humidLabel.set_text(`Umidade: ${c.humidity}%`);
        this._windLabel.set_text(`Vento: ${formatWindSpeed(c.windSpeed)}`);
    }
});

```

- [ ] **Step 2: Commit**

```bash
git add ui/CurrentWeatherWidget.js
git commit -m "feat: CurrentWeatherWidget with temperature, feels-like, humidity, wind"
```

**Critério de aceite:** Exibe ícone 64px + temperatura + sensação + umidade + vento. Atualiza sem recriar widgets.

---

### Task 15: `ui/HourlyForecastWidget.js`

**Milestone:** M4  
**Files:**
- Create: `ui/HourlyForecastWidget.js`

- [ ] **Step 1: Implementar `ui/HourlyForecastWidget.js`**

```js
// ui/HourlyForecastWidget.js
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import { formatTemp, formatTime } from '../utils/Formatter.js';
import { getIconName } from '../utils/WeatherIcons.js';

export const HourlyForecastWidget = GObject.registerClass(
class HourlyForecastWidget extends St.BoxLayout {
    _init(settings) {
        super._init({ vertical: true, styleClass: 'weather-hourly-section' });
        this._settings = settings;

        const label = new St.Label({ text: 'Próximas 24 horas', styleClass: 'weather-section-title' });
        this.add_child(label);

        this._scroll = new St.ScrollView({ hscrollbar_policy: St.PolicyType.AUTOMATIC,
                                           vscrollbar_policy: St.PolicyType.NEVER });
        this._slots = new St.BoxLayout({ styleClass: 'weather-hourly-slots' });
        this._scroll.set_child(this._slots);
        this.add_child(this._scroll);
    }

    /**
     * @param {import('../data/WeatherModel.js').WeatherModel} model
     */
    update(model) {
        this._slots.destroy_all_children();
        const unit = this._settings.get_string('temperature-unit');

        for (const slot of model.hourly) {
            const box = new St.BoxLayout({ vertical: true, xAlign: Clutter.ActorAlign.CENTER,
                                           styleClass: 'weather-hourly-slot' });
            box.add_child(new St.Label({ text: formatTime(slot.time), styleClass: 'weather-hour' }));
            box.add_child(new St.Icon({ iconName: getIconName(slot.weatherCode), iconSize: 24 }));
            box.add_child(new St.Label({ text: formatTemp(slot.temperature, unit) }));
            this._slots.add_child(box);
        }
    }
});
```

- [ ] **Step 2: Commit**

```bash
git add ui/HourlyForecastWidget.js
git commit -m "feat: HourlyForecastWidget 24h horizontal scroll"
```

**Critério de aceite:** 24 slots renderizados com hora, ícone e temperatura. Scroll horizontal funcional.

---

### Task 16: `ui/DailyForecastWidget.js`

**Milestone:** M4  
**Files:**
- Create: `ui/DailyForecastWidget.js`

- [ ] **Step 1: Implementar `ui/DailyForecastWidget.js`**

```js
// ui/DailyForecastWidget.js
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import { formatTemp } from '../utils/Formatter.js';
import { getIconName } from '../utils/WeatherIcons.js';

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const DailyForecastWidget = GObject.registerClass(
class DailyForecastWidget extends St.BoxLayout {
    _init(settings) {
        super._init({ vertical: true, styleClass: 'weather-daily-section' });
        this._settings = settings;

        const label = new St.Label({ text: 'Próximos 7 dias', styleClass: 'weather-section-title' });
        this.add_child(label);

        this._rows = new St.BoxLayout({ vertical: true, styleClass: 'weather-daily-rows' });
        this.add_child(this._rows);
    }

    /**
     * @param {import('../data/WeatherModel.js').WeatherModel} model
     */
    update(model) {
        this._rows.destroy_all_children();
        const unit = this._settings.get_string('temperature-unit');

        for (const day of model.daily) {
            const row  = new St.BoxLayout({ xExpand: true, styleClass: 'weather-daily-row' });
            const date = new Date(`${day.date}T12:00:00`);
            const name = DAY_NAMES[date.getDay()];

            row.add_child(new St.Label({ text: name, xExpand: true }));
            row.add_child(new St.Icon({ iconName: getIconName(day.weatherCode), iconSize: 20 }));
            row.add_child(new St.Label({
                text: `${formatTemp(day.tempMin, unit)} / ${formatTemp(day.tempMax, unit)}`,
            }));
            this._rows.add_child(row);
        }
    }
});
```

- [ ] **Step 2: Commit**

```bash
git add ui/DailyForecastWidget.js
git commit -m "feat: DailyForecastWidget 7-day forecast with min/max"
```

**Critério de aceite:** 7 linhas com dia da semana, ícone, mín/máx. Correto em PT-BR.

---

### Task 17: `ui/AlertBannerWidget.js`

**Milestone:** M4  
**Files:**
- Create: `ui/AlertBannerWidget.js`

- [ ] **Step 1: Implementar `ui/AlertBannerWidget.js`**

```js
// ui/AlertBannerWidget.js
import St from 'gi://St';
import GObject from 'gi://GObject';

export const AlertBannerWidget = GObject.registerClass(
class AlertBannerWidget extends St.BoxLayout {
    _init() {
        super._init({ vertical: true, styleClass: 'weather-alert-banner' });
        this.hide();
    }

    /**
     * @param {import('../data/WeatherModel.js').WeatherModel} model
     */
    update(model) {
        this.destroy_all_children();

        if (!model.alerts || model.alerts.length === 0) {
            this.hide();
            return;
        }

        for (const alert of model.alerts) {
            const row = new St.BoxLayout({ styleClass: 'weather-alert-row' });
            row.add_child(new St.Icon({
                iconName: 'weather-severe-alert-symbolic',
                iconSize: 16,
                styleClass: 'weather-alert-icon',
            }));
            row.add_child(new St.Label({
                text: alert.title,
                styleClass: 'weather-alert-title',
                xExpand: true,
            }));
            this.add_child(row);
        }

        this.show();
    }
});
```

- [ ] **Step 2: Commit**

```bash
git add ui/AlertBannerWidget.js
git commit -m "feat: AlertBannerWidget shows INMET alerts or hides when none"
```

**Critério de aceite:** Oculto quando `alerts === []`. Visível com uma linha por alerta quando há alertas ativos.

---

### Task 18: `ui/WeatherPopup.js` — Assembla os Widgets

**Milestone:** M4  
**Files:**
- Create: `ui/WeatherPopup.js`

- [ ] **Step 1: Implementar `ui/WeatherPopup.js`**

```js
// ui/WeatherPopup.js
import St from 'gi://St';
import GObject from 'gi://GObject';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { AlertBannerWidget }    from './AlertBannerWidget.js';
import { CurrentWeatherWidget } from './CurrentWeatherWidget.js';
import { HourlyForecastWidget } from './HourlyForecastWidget.js';
import { DailyForecastWidget }  from './DailyForecastWidget.js';

export class WeatherPopup extends PopupMenu.PopupMenuSection {
    /**
     * @param {Gio.Settings} settings
     */
    constructor(settings) {
        super();

        this._alertBanner = new AlertBannerWidget();
        this._current     = new CurrentWeatherWidget(settings);
        this._hourly      = new HourlyForecastWidget(settings);
        this._daily       = new DailyForecastWidget(settings);

        const container = new St.BoxLayout({
            vertical: true,
            styleClass: 'weather-popup-container',
            width: 340,
        });

        container.add_child(this._alertBanner);
        container.add_child(this._current);
        container.add_child(new St.Widget({ styleClass: 'popup-separator-menu-item', height: 1 }));
        container.add_child(this._hourly);
        container.add_child(new St.Widget({ styleClass: 'popup-separator-menu-item', height: 1 }));
        container.add_child(this._daily);

        const item = new PopupMenu.PopupBaseMenuItem({ reactive: false, canFocus: false });
        item.add_child(container);
        this.addMenuItem(item);
    }

    /**
     * @param {import('../data/WeatherModel.js').WeatherModel} model
     */
    update(model) {
        this._alertBanner.update(model);
        this._current.update(model);
        this._hourly.update(model);
        this._daily.update(model);
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/WeatherPopup.js
git commit -m "feat: WeatherPopup assembles all weather widgets"
```

**Critério de aceite:** Popup instancia sem erro. `update(model)` propaga para todos os widgets filhos.

---

### Task 19: `extension.js` — Integração Final da UI

**Milestone:** M4  
**Files:**
- Modify: `extension.js`

- [ ] **Step 1: Atualizar `extension.js` com popup completo**

```js
// extension.js — versão final
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { WeatherService }      from './services/WeatherService.js';
import { LocationService }     from './services/LocationService.js';
import { OpenMeteoClient }     from './services/OpenMeteoClient.js';
import { InmetClient }         from './services/InmetClient.js';
import { NotificationService } from './services/NotificationService.js';
import { CacheStore }          from './data/CacheStore.js';
import { PanelIndicator }      from './ui/PanelIndicator.js';
import { WeatherPopup }        from './ui/WeatherPopup.js';

export default class WeatherExtension extends Extension {
    enable() {
        const settings = this.getSettings('org.gnome.shell.extensions.weather-plugin');

        this._service = new WeatherService({
            locationService: new LocationService(),
            weatherClient:   new OpenMeteoClient(),
            alertClient:     new InmetClient(),
            cache:           new CacheStore(),
            notificationSvc: new NotificationService(),
            settings,
        });

        this._indicator = new PanelIndicator(settings);
        this._popup     = new WeatherPopup(settings);
        this._indicator.menu.addMenuItem(this._popup);

        Main.panel.addToStatusArea('weather-plugin', this._indicator);

        this._updatedId = this._service.connect('weather-updated', (_, model) => {
            this._indicator.update(model);
            this._popup.update(model);
        });

        this._offlineId = this._service.connect('offline', () => {
            this._indicator.goOffline();
        });

        this._service.start().catch(e =>
            console.error('[WeatherPlugin] start failed:', e));
    }

    disable() {
        if (this._service) {
            this._service.disconnect(this._updatedId);
            this._service.disconnect(this._offlineId);
            this._service.stop();
            this._service = null;
        }
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        this._popup = null;
    }
}
```

- [ ] **Step 2: Reinstalar**

```bash
bash install.sh
gnome-extensions disable weather-plugin@thalysvalisi
gnome-extensions enable weather-plugin@thalysvalisi
```

- [ ] **Step 3: Verificar popup completo**

1. Temperatura + ícone visíveis na top bar
2. Clicar abre popup
3. Popup contém: condição atual, scroll 24h, previsão 7 dias
4. Banner de alerta oculto (se não houver alertas ativos)

- [ ] **Step 4: Testar offline**

```bash
# Desligar rede → aguardar próximo poll → verificar que indicador some
nmcli networking off
sleep 30  # aguardar poll
# Indicador deve desaparecer
nmcli networking on
sleep 30  # aguardar reconexão
# Indicador deve reaparecer
```

- [ ] **Step 5: Verificar limpeza de memória**

```bash
# Desabilitar extensão
gnome-extensions disable weather-plugin@thalysvalisi
# Reabilitar
gnome-extensions enable weather-plugin@thalysvalisi
# Repetir 3x — sem crashes ou erros no journal
```

- [ ] **Step 6: Commit**

```bash
git add extension.js
git commit -m "feat: complete UI integration — popup with all weather widgets"
```

**Critério de aceite (M4 completo):**
- Temperatura + ícone na top bar
- Popup abre com current + hourly (scroll) + daily
- AlertBanner aparece apenas quando há alertas
- Disable → Enable sem crash ou memory leak

---

### Task 20: Preferências — Integração com Live Update

**Milestone:** M5  
**Files:**
- Modify: `extension.js`

- [ ] **Step 1: Escutar mudança de unidade em `extension.js`**

```js
// Dentro de enable(), após criar o service:
this._unitChangedId = settings.connect('changed::temperature-unit', () => {
    // Força re-render com último modelo (se disponível do cache)
    const cached = new CacheStore().load();
    if (cached) {
        this._indicator.update(cached);
        this._popup.update(cached);
    }
});

// Dentro de disable():
settings.disconnect(this._unitChangedId);
```

- [ ] **Step 2: Testar live update**

1. Abrir preferências: `gnome-extensions prefs weather-plugin@thalysvalisi`
2. Trocar de Celsius para Fahrenheit
3. Fechar prefs
4. Verificar que indicador na top bar mostra valor em °F imediatamente

- [ ] **Step 3: Testar mudança de intervalo**

1. Prefs → mudar para 5 minutos
2. Verificar `gsettings get org.gnome.shell.extensions.weather-plugin refresh-interval` → `300`
3. Restart da extensão para novo intervalo ter efeito

> Nota: intervalo novo só entra em vigor no próximo `enable()`. Documentar isso como comportamento esperado — não é bug.

- [ ] **Step 4: Commit**

```bash
git add extension.js
git commit -m "feat: live temperature unit update on settings change"
```

**Critério de aceite:** Mudar unidade nas prefs atualiza a top bar imediatamente (sem reiniciar extensão).

---

### Task 21: Polish Final + Verificação Completa

**Milestone:** M5  
**Files:**
- Modify: `install.sh` (adicionar reinstall conveniente)

- [ ] **Step 1: Verificar todos os testes unitários**

```bash
bash tests/unit/run.sh
```

Esperado: `Suites: 2 passed, 0 failed`

- [ ] **Step 2: Verificar journal sem erros**

```bash
journalctl -b 0 -o cat /usr/share/gnome-shell/gnome-shell 2>/dev/null | grep -i weather
```

Esperado: apenas logs `[WeatherPlugin]` informativos, sem `Error` ou `undefined`.

- [ ] **Step 3: Ciclo de enable/disable 5x**

```bash
for i in $(seq 1 5); do
    gnome-extensions disable weather-plugin@thalysvalisi
    sleep 2
    gnome-extensions enable weather-plugin@thalysvalisi
    sleep 3
done
```

Esperado: sem crashes, sem erros de "signal handler not disconnected" no journal.

- [ ] **Step 4: Commit final**

```bash
git add .
git commit -m "chore: final polish and verification"
```

**Critério de aceite (M5 / projeto completo):**
- Todos os testes passando
- Zero erros no journal em uso normal
- Enable/disable estável
- Temperatura na top bar, popup completo, prefs funcionais, notificações INMET quando alertas ativos
- Comportamento offline correto (indicador some / volta)

---

## Resumo dos Critérios de Aceite por Milestone

| Milestone | Critério |
|---|---|
| **M1** | `gnome-extensions enable` sem erros; `run.sh` 100% |
| **M2** | Fetch manual retorna dados reais; cache lê/escreve; location resolve |
| **M3** | `journalctl` mostra dados frescos por ciclo; sinal `offline` ao desligar rede |
| **M4** | Temperatura + ícone na top bar; popup completo com current + hourly + daily + alertas |
| **M5** | Prefs persistem; unidade muda live; zero erros em enable/disable 5x |
