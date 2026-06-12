import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class WeatherExtension extends Extension {
    enable() {
        console.log('[WeatherPlugin] enabled');
    }

    disable() {
        console.log('[WeatherPlugin] disabled');
    }
}
