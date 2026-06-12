# Weather Plugin — GNOME Shell Extension
**Data:** 2026-06-12  
**Status:** Aprovado  
**Autor:** thalysvalisi

---

## Visão Geral

Extensão GNOME Shell de clima integrada à top bar, compatível com Ubuntu 26.04 / GNOME Shell 48+ / GJS ESModules. Exibe temperatura atual com ícone dinâmico, popup com previsão horária e diária, alertas INMET e notificações nativas.

---

## Restrições e Decisões de Contexto

| Decisão | Valor |
|---|---|
| Target OS | Ubuntu 26.04 |
| GNOME Shell | 48+ |
| GJS | ESModules (import/export) |
| Geolocalização | GeoClue2 automático (sem override manual) |
| Fonte clima | Open-Meteo (sem API key) |
| Alertas | INMET CAP/RSS (Brasil apenas, detecção por bbox) |
| Offline | Ocultar PanelIndicator |
| i18n | Nenhum (uso pessoal, strings PT-BR) |
| Distribuição | Uso pessoal (não submetido ao extensions.gnome.org) |

---

## Estrutura de Diretórios

```
gnome-extension-weather-plugin@thalysvalisi/
├── extension.js
├── prefs.js
├── metadata.json
├── schemas/
│   └── org.gnome.shell.extensions.weather-plugin.gschema.xml
├── ui/
│   ├── PanelIndicator.js
│   ├── WeatherPopup.js
│   ├── CurrentWeatherWidget.js
│   ├── HourlyForecastWidget.js
│   ├── DailyForecastWidget.js
│   ├── AlertBannerWidget.js
│   └── PreferencesWindow.js
├── services/
│   ├── WeatherService.js
│   ├── LocationService.js
│   ├── OpenMeteoClient.js
│   ├── InmetClient.js
│   └── NotificationService.js
├── data/
│   ├── WeatherModel.js
│   └── CacheStore.js
└── utils/
    ├── WeatherIcons.js
    └── Formatter.js
```

---

## Arquitetura

### Camadas

```
extension.js  ←  lifecycle only (enable/disable)
     │
     ├── ui/           ←  reage a sinais, nunca faz fetch
     ├── services/     ←  lógica de negócio, HTTP, polling
     ├── data/         ←  modelos + persistência
     └── utils/        ←  funções puras, sem estado
```

### Dependency Injection

`extension.js` instancia e injeta dependências em `WeatherService`:

```js
const service = new WeatherService({
  locationService: new LocationService(),
  weatherClient:   new OpenMeteoClient(),
  alertClient:     new InmetClient(),
  cache:           new CacheStore(),
});
```

### Comunicação UI ↔ Services

`WeatherService` emite sinais GObject. UI conecta via `.connect()`. UI nunca importa `WeatherService` diretamente.

```
WeatherService signals:
  'weather-updated'  →  payload: WeatherModel
  'offline'          →  sem payload
```

---

## Responsabilidades dos Módulos

### `extension.js`
- Lifecycle: `enable()` instancia + conecta sinais + inicia polling; `disable()` destrói + desconecta + limpa referências
- Sem lógica de negócio

### `prefs.js`
- Entry point da janela de preferências (exigido pelo GNOME Extensions framework)
- Instancia `PreferencesWindow`

---

### `ui/PanelIndicator.js`
- `PanelMenu.Button` na top bar
- Exibe temperatura + ícone dinâmico
- `.hide()` ao receber `offline`; `.show()` ao receber `weather-updated`
- Abre `WeatherPopup` ao clicar

### `ui/WeatherPopup.js`
- `PanelMenu.Menu` container
- Monta e ordena widgets filhos: `AlertBannerWidget`, `CurrentWeatherWidget`, `HourlyForecastWidget`, `DailyForecastWidget`
- Sem conhecimento de APIs

### `ui/CurrentWeatherWidget.js`
- Ícone grande, temperatura, sensação térmica, umidade, velocidade do vento, descrição textual
- Atualiza ao receber novo `WeatherModel`

### `ui/HourlyForecastWidget.js`
- `St.ScrollView` horizontal
- 24 slots: ícone + temperatura por hora
- Dados: primeiros 24 entradas de `WeatherModel.hourly`

### `ui/DailyForecastWidget.js`
- Lista vertical de 7 dias
- Por linha: dia da semana, ícone, mín/máx
- Dados: `WeatherModel.daily`

### `ui/AlertBannerWidget.js`
- Faixa colorida com título do alerta INMET
- Oculta quando `WeatherModel.alerts` está vazio
- Visível quando há alertas ativos

### `ui/PreferencesWindow.js`
- `Adw.PreferencesWindow` com uma `Adw.PreferencesPage`
- Configurações expostas: unidade de temperatura (°C/°F), intervalo de polling (minutos)
- Lê/escreve via GSettings

---

### `services/WeatherService.js`
- Orquestrador central
- `start()`: chama `LocationService.getLocation()`, serve cache imediatamente se válido, dispara fetch paralelo
- `stop()`: cancela polling, limpa timeout
- Agenda polling via `GLib.timeout_add_seconds(interval)`
- Não re-chama `LocationService` nos polls subsequentes (reutiliza coords da sessão)
- Emite `weather-updated` ou `offline`
- Dispara notificação nativa via `NotificationService.notify()` quando `AlertModel[]` muda (novos alertas chegam)

### `services/LocationService.js`
- Encapsula `Geoclue.Simple`
- `getLocation() → Promise<{lat, lon}>`
- Resolve na primeira fix do GeoClue2
- Reutiliza coords por sessão (sem re-fetch)
- Se GeoClue2 negar permissão → rejeita promise → `WeatherService` trata como offline

### `services/OpenMeteoClient.js`
- HTTP via `Soup.Session` (assíncrono)
- `fetch(lat, lon) → Promise<WeatherModel>`
- Monta URL com params: `current`, `hourly` (24h), `daily` (7 dias), `timezone=auto`
- Sem estado interno

### `services/NotificationService.js`
- Encapsula `Gio.Notification` + `Gio.Application` (padrão GNOME Shell extensions)
- `notify(title, body)` → dispara notificação nativa no sistema
- Sem estado — chamado por `WeatherService` quando detecta alertas INMET novos (compara IDs entre poll atual e anterior)

### `services/InmetClient.js`
- HTTP via `Soup.Session`
- `fetch(lat, lon) → Promise<AlertModel[]>`
- Retorna `[]` imediatamente se coords fora do bbox brasileiro (`lat ∈ [-33.75, 5.27]`, `lon ∈ [-73.99, -28.85]`)
- Parseia RSS CAP do endpoint INMET
- Filtra alertas cujo polígono contém as coords
- Sem estado interno

---

### `data/WeatherModel.js`
- JSDoc typedefs: `CurrentWeather`, `HourlySlot`, `DailyDay`, `AlertModel`, `WeatherModel`
- `WeatherModel` inclui campo `fetchedAt: number` (timestamp `Date.now()`) para validação de TTL no `CacheStore`
- Sem lógica — apenas contratos de dados

### `data/CacheStore.js`
- `save(model: WeatherModel) → void`: serializa JSON em `~/.cache/gnome-shell/weather-plugin/cache.json`
- `load() → WeatherModel | null`: desserializa + valida schema; retorna `null` se ausente ou corrompido
- TTL verificado pelo `WeatherService` (compara `model.fetchedAt` com `Date.now()`)

---

### `utils/WeatherIcons.js`
- Função pura: `getIconName(wmoCode: number) → string`
- Mapeia WMO weather codes para nomes de ícones do tema GNOME (`weather-clear-symbolic`, `weather-storm-symbolic`, etc.)

### `utils/Formatter.js`
- `formatTemp(value, unit)` → `"23°C"` ou `"73°F"`
- `formatTime(isoString)` → `"14:00"`
- `formatWindSpeed(ms)` → `"18 km/h"`
- Funções puras, sem estado

---

## Fluxo de Dados

### Startup

```
extension.enable()
  └─► WeatherService.start()
        └─► LocationService.getLocation()          [GeoClue2]
              └─► {lat, lon} resolvido
                    ├─► CacheStore.load()
                    │     └─► cache válido → emit 'weather-updated' (stale)
                    └─► fetch paralelo:
                          ├─► OpenMeteoClient.fetch(lat, lon)
                          └─► InmetClient.fetch(lat, lon)
                                └─► merge → WeatherModel
                                      ├─► CacheStore.save(model)
                                      └─► emit 'weather-updated' (fresh)
```

### Polling

```
GLib.timeout_add_seconds(interval)
  └─► OpenMeteoClient.fetch + InmetClient.fetch (paralelo)
        └─► emit 'weather-updated' | emit 'offline'
```

### Offline / Reconexão

```
fetch falha → emit 'offline' → PanelIndicator.hide()
fetch OK    → emit 'weather-updated' → PanelIndicator.show() + atualiza
```

---

## APIs Externas

### Open-Meteo

- **Endpoint:** `https://api.open-meteo.com/v1/forecast`
- **Auth:** Nenhuma
- **Params:** `latitude`, `longitude`, `current=temperature_2m,weathercode,windspeed_10m,relativehumidity_2m,apparent_temperature`, `hourly=temperature_2m,weathercode`, `daily=weathercode,temperature_2m_max,temperature_2m_min`, `timezone=auto`

### INMET

- **Endpoint:** `https://apiprevmet3.inmet.gov.br/avisos/rss`
- **Auth:** Nenhuma
- **Formato:** RSS/XML CAP
- **Cobertura:** Brasil apenas (bbox: lat -33.75 a 5.27, lon -73.99 a -28.85)

---

## GSettings Schema

```xml
<!-- org.gnome.shell.extensions.weather-plugin -->
<key name="temperature-unit" type="s">
  <default>'celsius'</default>
</key>
<key name="refresh-interval" type="i">
  <default>600</default>  <!-- segundos -->
</key>
```

---

## SOLID — Aplicação

| Princípio | Onde se aplica |
|---|---|
| **S** — Single Responsibility | Um motivo de mudança por módulo (ver tabela em seção responsabilidades) |
| **O** — Open/Closed | Novos clientes HTTP seguem contrato `fetch(lat,lon)→Promise<Model>` sem modificar `WeatherService` |
| **L** — Liskov | Widgets estendem `St.Widget` sem quebrar contratos do parent |
| **I** — Interface Segregation | UI vê só sinais; `extension.js` vê só `start()`/`stop()` |
| **D** — Dependency Inversion | `WeatherService` recebe clientes via construtor (não instancia internamente) |

**SOLID intencionalmente não aplicado em:** `WeatherModel.js` (typedefs), `Formatter.js`, `WeatherIcons.js` — funções puras stateless não se beneficiam de abstração.

---

## ADRs

### ADR-001: GJS ESModules
**Decisão:** `import`/`export` ES6 em todos os módulos.  
**Motivo:** GNOME Shell 45+ suporta nativamente; sintaxe legada será removida.  
**Trade-off:** Incompatível com GNOME < 45. Aceitável — target é 48+.

### ADR-002: GeoClue2 sem fallback manual
**Decisão:** `LocationService` usa `Geoclue.Simple` exclusivamente.  
**Motivo:** User optou por localização automática; GeoClue2 é o padrão GNOME.  
**Trade-off:** Sem GeoClue2 ou sem permissão → comportamento idêntico ao offline.

### ADR-003: Open-Meteo como fonte primária
**Decisão:** Única fonte de dados meteorológicos.  
**Motivo:** Gratuito, sem API key, cobertura global, WMO codes padronizados, hourly+daily em request única.  
**Trade-off:** Sem SLA. Aceitável para uso pessoal. Troca futura é isolada em `OpenMeteoClient`.

### ADR-004: Clientes HTTP injetáveis
**Decisão:** `WeatherService` recebe clientes via construtor.  
**Motivo:** Permite troca de provider e mock em teste sem alterar `WeatherService`.  
**Trade-off:** Bootstrap levemente mais verboso em `extension.js`.

### ADR-005: Cache em arquivo JSON
**Decisão:** `CacheStore` usa `~/.cache/gnome-shell/weather-plugin/cache.json`.  
**Motivo:** GSettings suporta apenas primitivos — inadequado para payload complexo.  
**Trade-off:** Necessário validar schema na leitura (payload pode ser de versão anterior).

### ADR-006: Comunicação via sinais GObject
**Decisão:** `WeatherService` emite sinais; UI conecta via `.connect()`.  
**Motivo:** Padrão idiomático GNOME/GJS. Desacoplamento total UI ↔ Services.  
**Trade-off:** Limpeza obrigatória em `disable()` via `.disconnect()` para evitar memory leak.

### ADR-007: Detecção Brasil por bounding box
**Decisão:** `InmetClient` verifica bbox antes de qualquer HTTP request.  
**Motivo:** INMET só cobre Brasil; evita requests inúteis para usuários fora do território.  
**Trade-off:** Ilhas oceânicas fora do bbox são falso-negativos. Aceitável.

### ADR-008: Sem i18n
**Decisão:** Strings hardcoded em PT-BR.  
**Motivo:** Uso pessoal, sem submissão ao extensions.gnome.org.  
**Trade-off:** Adicionar i18n futuramente é refactor mecânico (substituir strings por `_()`), sem impacto arquitetural.

### ADR-009: Ocultar PanelIndicator offline
**Decisão:** `.hide()` ao receber sinal `offline`.  
**Motivo:** Dados stale podem enganar sobre condições atuais.  
**Trade-off:** Usuário sem rede não vê nada — comportamento intencional.
