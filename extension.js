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
            console.error('[WeatherPlugin] start error:', e.message));
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
        this._popup     = null;
        this._updatedId = null;
        this._offlineId = null;
    }
}
