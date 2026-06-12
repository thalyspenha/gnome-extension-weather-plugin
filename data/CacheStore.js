import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const CACHE_DIR  = GLib.build_filenamev([GLib.get_user_cache_dir(), 'gnome-shell', 'weather-plugin']);
const CACHE_FILE = GLib.build_filenamev([CACHE_DIR, 'cache.json']);

export class CacheStore {
    /**
     * @param {import('./WeatherModel.js').WeatherModel} model
     */
    save(model) {
        try {
            GLib.mkdir_with_parents(CACHE_DIR, 0o755);
            const file  = Gio.File.new_for_path(CACHE_FILE);
            const bytes = new TextEncoder().encode(JSON.stringify(model));
            file.replace_contents(bytes, null, false,
                Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        } catch (e) {
            console.warn(`[WeatherPlugin] CacheStore.save failed: ${e.message}`);
        }
    }

    /**
     * @returns {import('./WeatherModel.js').WeatherModel | null}
     */
    load() {
        try {
            const file = Gio.File.new_for_path(CACHE_FILE);
            const [, contents] = file.load_contents(null);
            const model = JSON.parse(new TextDecoder().decode(contents));
            if (typeof model?.fetchedAt !== 'number') return null;
            return model;
        } catch (_e) {
            return null;
        }
    }
}
