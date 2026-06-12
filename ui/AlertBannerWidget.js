import St from 'gi://St';
import GObject from 'gi://GObject';

export const AlertBannerWidget = GObject.registerClass(
class AlertBannerWidget extends St.BoxLayout {
    _init() {
        super._init({ vertical: true, styleClass: 'weather-alert-banner' });
        this.hide();
    }

    /**
     * @param {import('../data/WeatherModel.js').WeatherModel} model
     */
    update(model) {
        this.destroy_all_children();

        if (!model.alerts || model.alerts.length === 0) {
            this.hide();
            return;
        }

        const counts = new Map();
        for (const alert of model.alerts)
            counts.set(alert.title, (counts.get(alert.title) ?? 0) + 1);

        for (const [title, count] of counts) {
            const row = new St.BoxLayout({ styleClass: 'weather-alert-row' });
            row.add_child(new St.Icon({
                iconName:   'weather-severe-alert-symbolic',
                iconSize:   16,
                styleClass: 'weather-alert-icon',
            }));
            row.add_child(new St.Label({
                text:       count > 1 ? `${title} (${count})` : title,
                styleClass: 'weather-alert-title',
                xExpand:    true,
            }));
            this.add_child(row);
        }

        this.show();
    }
});
