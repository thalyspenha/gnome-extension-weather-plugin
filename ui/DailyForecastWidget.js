import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import { formatTemp } from '../utils/Formatter.js';
import { getIconName } from '../utils/WeatherIcons.js';

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const DailyForecastWidget = GObject.registerClass(
class DailyForecastWidget extends St.BoxLayout {
    _init(settings) {
        super._init({ vertical: true, styleClass: 'weather-daily-section' });
        this._settings = settings;

        this.add_child(new St.Label({
            text:       'Próximos 7 dias',
            styleClass: 'weather-section-title',
        }));

        this._rows = new St.BoxLayout({ vertical: true, styleClass: 'weather-daily-rows' });
        this.add_child(this._rows);
    }

    update(model) {
        this._rows.destroy_all_children();
        const unit = this._settings.get_string('temperature-unit');

        for (const day of model.daily) {
            const date = new Date(`${day.date}T12:00:00`);
            const row  = new St.BoxLayout({
                xExpand:    true,
                styleClass: 'weather-daily-row',
                yAlign:     Clutter.ActorAlign.CENTER,
            });

            // Col 1: nome completo do dia
            row.add_child(new St.Label({
                text:    DAY_NAMES[date.getDay()],
                xExpand: true,
                yAlign:  Clutter.ActorAlign.CENTER,
            }));

            // Col 2: ícone + probabilidade de chuva (largura fixa 80px)
            const midBox = new St.BoxLayout({
                width:  80,
                yAlign: Clutter.ActorAlign.CENTER,
            });
            midBox.add_child(new St.Icon({
                iconName: getIconName(day.weatherCode),
                iconSize: 20,
                yAlign:   Clutter.ActorAlign.CENTER,
            }));
            midBox.add_child(new St.Label({
                text:       `${day.precipitationProb}%`,
                styleClass: 'weather-precip-prob dim-label',
                yAlign:     Clutter.ActorAlign.CENTER,
            }));
            row.add_child(midBox);

            // Col 3: mínima / máxima
            const tempBox = new St.BoxLayout({
                xAlign: Clutter.ActorAlign.END,
                yAlign: Clutter.ActorAlign.CENTER,
            });
            tempBox.add_child(new St.Label({
                text:       formatTemp(day.tempMin, unit),
                styleClass: 'weather-temp-min',
                yAlign:     Clutter.ActorAlign.CENTER,
            }));
            tempBox.add_child(new St.Label({
                text:   ' / ',
                yAlign: Clutter.ActorAlign.CENTER,
            }));
            tempBox.add_child(new St.Label({
                text:       formatTemp(day.tempMax, unit),
                styleClass: 'weather-temp-max',
                yAlign:     Clutter.ActorAlign.CENTER,
            }));
            row.add_child(tempBox);

            this._rows.add_child(row);
        }
    }
});
