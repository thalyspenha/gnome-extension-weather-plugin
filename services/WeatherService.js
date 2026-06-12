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
     *   locationService:  import('./LocationService.js').LocationService,
     *   weatherClient:    import('./OpenMeteoService.js').OpenMeteoService,
     *   alertClient:      import('./InmetClient.js').InmetClient,
     *   cache:            import('../data/CacheStore.js').CacheStore,
     *   notificationSvc:  import('./NotificationService.js').NotificationService,
     *   settings:         Gio.Settings,
     * }} deps
     */
    _init(deps) {
        super._init();
        this._location  = deps.locationService;
        this._weather   = deps.weatherClient;
        this._alerts    = deps.alertClient;
        this._cache     = deps.cache;
        this._notif     = deps.notificationSvc;
        this._settings  = deps.settings;
        this._sourceId  = null;
        this._coords    = null;
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

        const cached   = this._cache.load();
        const interval = this._settings.get_int('refresh-interval');

        if (cached && (Date.now() - cached.fetchedAt) < interval * 1000)
            this.emit('weather-updated', cached);

        await this._fetchAndEmit();

        this._sourceId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            interval,
            () => {
                this._fetchAndEmit();
                return GLib.SOURCE_CONTINUE;
            }
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
            if (!this._prevAlertIds.has(alert.id))
                this._notif.notify(`Alerta: ${alert.title}`, alert.description || '');
        }
        this._prevAlertIds = new Set(alerts.map(a => a.id));
    }
});
