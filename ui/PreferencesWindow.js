import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

export class PreferencesWindow {
    /**
     * @param {Adw.PreferencesWindow} window
     * @param {Gio.Settings} settings
     */
    build(window, settings) {
        const page  = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({ title: 'Geral' });
        page.add(group);

        const unitRow = new Adw.ComboRow({
            title: 'Unidade de temperatura',
            model: Gtk.StringList.new(['Celsius (°C)', 'Fahrenheit (°F)']),
        });
        unitRow.set_selected(settings.get_string('temperature-unit') === 'fahrenheit' ? 1 : 0);
        unitRow.connect('notify::selected', () => {
            settings.set_string('temperature-unit',
                unitRow.get_selected() === 1 ? 'fahrenheit' : 'celsius');
        });
        group.add(unitRow);

        const INTERVALS   = [300, 600, 900, 1800];
        const intervalRow = new Adw.ComboRow({
            title: 'Atualizar a cada',
            model: Gtk.StringList.new(['5 minutos', '10 minutos', '15 minutos', '30 minutos']),
        });
        const currentIdx = INTERVALS.indexOf(settings.get_int('refresh-interval'));
        intervalRow.set_selected(currentIdx >= 0 ? currentIdx : 1);
        intervalRow.connect('notify::selected', () => {
            settings.set_int('refresh-interval', INTERVALS[intervalRow.get_selected()]);
        });
        group.add(intervalRow);

        window.add(page);
    }
}
