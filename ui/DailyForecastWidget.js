import St from 'gi://St';
import GObject from 'gi://GObject';
import { formatTemp } from '../utils/Formatter.js';
import { getIconName } from '../utils/WeatherIcons.js';

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const DailyForecastWidget = GObject.registerClass(
class DailyForecastWidget extends St.BoxLayout {
    _init(settings) {
        super._init({ vertical: true, styleClass: 'weather-daily-section' });
        this._settings = settings;

        this.add_child(new St.Label({
            text: 'Próximos 7 dias',
            styleClass: 'weather-section-title',
        }));

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
            row.add_child(new St.Label({ text: DAY_NAMES[date.getDay()], xExpand: true }));
            row.add_child(new St.Icon({ iconName: getIconName(day.weatherCode), iconSize: 20 }));
            row.add_child(new St.Label({
                text: `${day.precipitationProb}%`,
                styleClass: 'weather-precip-prob',
            }));
            row.add_child(new St.Label({
                text: `${formatTemp(day.tempMin, unit)} / ${formatTemp(day.tempMax, unit)}`,
            }));
            this._rows.add_child(row);
        }
    }
});
