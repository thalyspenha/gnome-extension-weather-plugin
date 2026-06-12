import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

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

        this._service.start().catch(e =>
            console.error('[WeatherPlugin] start error:', e.message));
    }

    disable() {
        if (this._service) {
            this._service.disconnect(this._updatedId);
            this._service.disconnect(this._offlineId);
            this._service.stop();
            this._service = null;
        }
        this._updatedId = null;
        this._offlineId = null;
    }
}
