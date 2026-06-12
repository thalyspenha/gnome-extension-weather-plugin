import St from 'gi://St';
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
            vertical:   true,
            styleClass: 'weather-popup-container',
            width:      340,
        });

        container.add_child(this._current);
        container.add_child(this._alertBanner);
        container.add_child(new St.Widget({
            styleClass: 'popup-separator-menu-item',
            height:     1,
        }));
        container.add_child(this._hourly);
        container.add_child(new St.Widget({
            styleClass: 'popup-separator-menu-item',
            height:     1,
        }));
        container.add_child(this._daily);

        const item = new PopupMenu.PopupBaseMenuItem({ reactive: false });
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
