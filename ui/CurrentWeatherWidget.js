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

        this._icon       = new St.Icon({ iconSize: 64, styleClass: 'weather-current-icon' });
        this._tempLabel  = new St.Label({ styleClass: 'weather-temp-large' });
        this._feelsLabel = new St.Label({ styleClass: 'weather-feels-like' });
        this._humidLabel = new St.Label({ styleClass: 'weather-detail' });
        this._windLabel  = new St.Label({ styleClass: 'weather-detail' });
        this._gustLabel  = new St.Label({ styleClass: 'weather-detail' });
        this._precipLabel = new St.Label({ styleClass: 'weather-detail' });

        const topRow = new St.BoxLayout({ xAlign: Clutter.ActorAlign.CENTER });
        topRow.add_child(this._icon);
        topRow.add_child(this._tempLabel);

        this.add_child(topRow);
        this.add_child(this._feelsLabel);
        this.add_child(this._humidLabel);
        this.add_child(this._windLabel);
        this.add_child(this._gustLabel);
        this.add_child(this._precipLabel);
    }

    /**
     * @param {import('../data/WeatherModel.js').WeatherModel} model
     */
    update(model) {
        const unit = this._settings.get_string('temperature-unit');
        const c    = model.current;
        this._icon.set_icon_name(getIconName(c.weatherCode));
        this._tempLabel.set_text(formatTemp(c.temperature, unit));
        this._feelsLabel.set_text(`Sensação: ${formatTemp(c.apparentTemperature, unit)}`);
        this._humidLabel.set_text(`Umidade: ${c.humidity}%`);
        this._windLabel.set_text(`Vento: ${formatWindSpeed(c.windSpeed)}`);
        this._gustLabel.set_text(`Rajada: ${formatWindSpeed(c.windGust)}`);
        this._precipLabel.set_text(`Precipitação: ${c.precipitation} mm`);
    }
});
