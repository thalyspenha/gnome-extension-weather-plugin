import { ExtensionPreferences } from 'resource:///org/gnome/shell/extensions/prefs.js';
import { PreferencesWindow } from './ui/PreferencesWindow.js';

export default class WeatherPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings('org.gnome.shell.extensions.weather-plugin');
        new PreferencesWindow().build(window, settings);
    }
}
