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

        this.add_child(new St.Label({
            text:       'Próximas 24 horas',
            styleClass: 'weather-section-title',
        }));

        this._scroll = new St.ScrollView({
            hscrollbar_policy: St.PolicyType.AUTOMATIC,
            vscrollbar_policy: St.PolicyType.NEVER,
        });
        this._slots = new St.BoxLayout({ styleClass: 'weather-hourly-slots' });
        this._scroll.set_child(this._slots);
        this.add_child(this._scroll);
    }

    update(model) {
        this._slots.destroy_all_children();
        const unit = this._settings.get_string('temperature-unit');

        for (const slot of model.hourly) {
            const box = new St.BoxLayout({
                vertical:   true,
                xAlign:     Clutter.ActorAlign.CENTER,
                styleClass: 'weather-hourly-slot',
            });

            box.add_child(new St.Label({
                text:       formatTime(slot.time),
                styleClass: 'weather-hour dim-label',
                xAlign:     Clutter.ActorAlign.CENTER,
            }));
            box.add_child(new St.Icon({
                iconName: getIconName(slot.weatherCode),
                iconSize: 28,
                xAlign:   Clutter.ActorAlign.CENTER,
            }));
            box.add_child(new St.Label({
                text:   formatTemp(slot.temperature, unit),
                xAlign: Clutter.ActorAlign.CENTER,
            }));

            const precipCss = slot.precipitationProb > 30
                ? 'weather-precip-high'
                : 'weather-precip-low dim-label';
            box.add_child(new St.Label({
                text:       `${slot.precipitationProb}%`,
                styleClass: precipCss,
                xAlign:     Clutter.ActorAlign.CENTER,
            }));

            this._slots.add_child(box);
        }
    }
});
