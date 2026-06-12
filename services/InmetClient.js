import Soup from 'gi://Soup';
import GLib from 'gi://GLib';

const INMET_RSS = 'https://apiprevmet3.inmet.gov.br/avisos/rss';

const BRAZIL_BBOX = { latMin: -33.75, latMax: 5.27, lonMin: -73.99, lonMax: -28.85 };

export class InmetClient {
    constructor() {
        this._session = new Soup.Session();
        this._session.timeout = 10;
    }

    /**
     * @param {number} lat
     * @param {number} lon
     * @returns {Promise<import('../data/WeatherModel.js').AlertModel[]>}
     */
    async fetch(lat, lon) {
        if (!this._isInBrazil(lat, lon)) return [];

        const uri     = GLib.Uri.parse(INMET_RSS, GLib.UriFlags.NONE);
        const message = new Soup.Message({ method: 'GET', uri });

        let bytes;
        try {
            bytes = await this._session.send_and_read_async(
                message, GLib.PRIORITY_DEFAULT, null);
        } catch (e) {
            console.warn(`[WeatherPlugin] InmetClient fetch failed: ${e.message}`);
            return [];
        }

        if (message.get_status() !== Soup.Status.OK) {
            console.warn(`[WeatherPlugin] InmetClient HTTP ${message.get_status()}`);
            return [];
        }

        return this._parseAlerts(new TextDecoder().decode(bytes.get_data()), lat, lon);
    }

    /** @private */
    _isInBrazil(lat, lon) {
        return lat  >= BRAZIL_BBOX.latMin && lat  <= BRAZIL_BBOX.latMax
            && lon >= BRAZIL_BBOX.lonMin && lon <= BRAZIL_BBOX.lonMax;
    }

    /** @private */
    _parseAlerts(xml, lat, lon) {
        const alerts    = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;

        while ((match = itemRegex.exec(xml)) !== null) {
            const item = match[1];
            const get  = tag => {
                const m = new RegExp(
                    `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>` +
                    `|<${tag}[^>]*>([^<]*)<\\/${tag}>`
                ).exec(item);
                return m ? (m[1] ?? m[2] ?? '').trim() : '';
            };

            const title       = get('title');
            const description = get('description');
            const id          = get('guid') || get('link') || `inmet-${alerts.length}`;
            const onset       = get('pubDate');
            const expires     = get('cap:expires') || '';
            const severity    = get('cap:severity') || 'Unknown';

            const polygon = get('cap:polygon');
            if (polygon && !this._pointInPolygonBbox(lat, lon, polygon)) continue;

            if (title) alerts.push({ id, title, severity, description, onset, expires });
        }

        return alerts;
    }

    /** @private */
    _pointInPolygonBbox(lat, lon, polygonStr) {
        const coords = polygonStr.trim().split(/\s+/).map(pair => {
            const [la, lo] = pair.split(',').map(Number);
            return { lat: la, lon: lo };
        }).filter(c => !isNaN(c.lat) && !isNaN(c.lon));

        if (coords.length === 0) return true;

        const lats   = coords.map(c => c.lat);
        const lons   = coords.map(c => c.lon);
        const minLat = Math.min(...lats), maxLat = Math.max(...lats);
        const minLon = Math.min(...lons), maxLon = Math.max(...lons);

        return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
    }

    destroy() {
        this._session.abort();
    }
}
