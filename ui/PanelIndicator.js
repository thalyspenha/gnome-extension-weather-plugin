import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { formatTemp } from '../utils/Formatter.js';
import { getIconName } from '../utils/WeatherIcons.js';

export const PanelIndicator = GObject.registerClass(
class PanelIndicator extends PanelMenu.Button {
    _init(settings) {
        super._init(0.0, 'Weather Plugin');
        this._settings = settings;

        this._box = new St.BoxLayout({ styleClass: 'panel-status-menu-box' });

        this._icon = new St.Icon({
            iconName:   'weather-clear-symbolic',
            styleClass: 'system-status-icon',
        });

        this._label = new St.Label({
            text:   '...',
            yAlign: Clutter.ActorAlign.CENTER,
        });

        this._box.add_child(this._icon);
        this._box.add_child(this._label);
        this.add_child(this._box);
    }

    /**
     * @param {import('../data/WeatherModel.js').WeatherModel} model
     */
    update(model) {
        const unit = this._settings.get_string('temperature-unit');
        this._label.set_text(formatTemp(model.current.temperature, unit));
        this._icon.set_icon_name(getIconName(model.current.weatherCode));
        this.show();
    }

    goOffline() {
        this.hide();
    }
});
