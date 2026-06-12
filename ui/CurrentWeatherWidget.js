import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import { formatTemp, formatWindSpeed } from '../utils/Formatter.js';
import { getIconName, getDescription } from '../utils/WeatherIcons.js';

export const CurrentWeatherWidget = GObject.registerClass(
class CurrentWeatherWidget extends St.BoxLayout {
    _init(settings) {
        super._init({ vertical: true, styleClass: 'weather-current', xExpand: true });
        this._settings = settings;

        this._icon = new St.Icon({
            iconSize: 64,
            xAlign:   Clutter.ActorAlign.CENTER,
            xExpand:  true,
        });
        this._tempLabel = new St.Label({
            styleClass: 'weather-temp-large',
            xAlign:     Clutter.ActorAlign.CENTER,
            xExpand:    true,
        });
        this._descLabel = new St.Label({
            styleClass: 'weather-temp-desc dim-label',
            xAlign:     Clutter.ActorAlign.CENTER,
            xExpand:    true,
        });

        this.add_child(this._icon);
        this.add_child(this._tempLabel);
        this.add_child(this._descLabel);

        this._humidLabel = new St.Label({ styleClass: 'weather-detail-value' });
        this._feelsLabel = new St.Label({ styleClass: 'weather-detail-value' });
        this._windLabel  = new St.Label({ styleClass: 'weather-detail-value' });
        this._gustLabel  = new St.Label({ styleClass: 'weather-detail-value' });
        this._precipLabel = new St.Label({ styleClass: 'weather-detail-value' });

        const leftCol  = new St.BoxLayout({ vertical: true, xExpand: true });
        const rightCol = new St.BoxLayout({ vertical: true, xExpand: true });

        leftCol.add_child(this._makeCell('Umidade',  this._humidLabel));
        leftCol.add_child(this._makeCell('Sensação', this._feelsLabel));
        rightCol.add_child(this._makeCell('Vento',   this._windLabel));
        rightCol.add_child(this._makeCell('Rajada',  this._gustLabel));

        const grid = new St.BoxLayout({ styleClass: 'weather-details-grid', xExpand: true });
        grid.add_child(leftCol);
        grid.add_child(rightCol);
        this.add_child(grid);

        const precipRow = new St.BoxLayout({ xExpand: true });
        precipRow.add_child(this._makeCell('Precipitação', this._precipLabel, true));
        this.add_child(precipRow);
    }

    _makeCell(labelText, valueLabel, xExpand = false) {
        const cell = new St.BoxLayout({
            vertical:   true,
            xExpand,
            styleClass: 'weather-detail-cell',
        });
        cell.add_child(new St.Label({
            text:       labelText,
            styleClass: 'weather-detail-label dim-label',
        }));
        cell.add_child(valueLabel);
        return cell;
    }

    update(model) {
        const unit = this._settings.get_string('temperature-unit');
        const c    = model.current;
        this._icon.set_icon_name(getIconName(c.weatherCode));
        this._tempLabel.set_text(formatTemp(c.temperature, unit));
        this._descLabel.set_text(getDescription(c.weatherCode));
        this._humidLabel.set_text(`${c.humidity}%`);
        this._feelsLabel.set_text(formatTemp(c.apparentTemperature, unit));
        this._windLabel.set_text(formatWindSpeed(c.windSpeed));
        this._gustLabel.set_text(formatWindSpeed(c.windGust));
        this._precipLabel.set_text(`${c.precipitation} mm`);
    }
});
