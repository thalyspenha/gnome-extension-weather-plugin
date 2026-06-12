import Soup from 'gi://Soup';
import GLib from 'gi://GLib';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

export class OpenMeteoClient {
    constructor() {
        this._session = new Soup.Session();
        this._session.timeout = 10;
    }

    /**
     * @param {number} lat
     * @param {number} lon
     * @returns {Promise<import('../data/WeatherModel.js').WeatherModel>}
     */
    async fetch(lat, lon) {
        const params = new URLSearchParams({
            latitude:       lat.toString(),
            longitude:      lon.toString(),
            current:        'temperature_2m,weathercode,windspeed_10m,relativehumidity_2m,apparent_temperature',
            hourly:         'temperature_2m,weathercode',
            daily:          'weathercode,temperature_2m_max,temperature_2m_min',
            timezone:       'auto',
            forecast_days:  '7',
        });

        const uri     = GLib.Uri.parse(`${BASE_URL}?${params}`, GLib.UriFlags.NONE);
        const message = new Soup.Message({ method: 'GET', uri });

        const bytes = await this._session.send_and_read_async(
            message, GLib.PRIORITY_DEFAULT, null);

        if (message.get_status() !== Soup.Status.OK)
            throw new Error(`OpenMeteo HTTP ${message.get_status()}`);

        const data = JSON.parse(new TextDecoder().decode(bytes.get_data()));
        return this._parse(data);
    }

    /** @private */
    _parse(data) {
        const c = data.current;
        const current = {
            temperature:         c.temperature_2m,
            apparentTemperature: c.apparent_temperature,
            humidity:            c.relativehumidity_2m,
            windSpeed:           c.windspeed_10m,
            weatherCode:         c.weathercode,
        };

        const hourly = data.hourly.time.slice(0, 24).map((time, i) => ({
            time,
            temperature: data.hourly.temperature_2m[i],
            weatherCode: data.hourly.weathercode[i],
        }));

        const daily = data.daily.time.map((date, i) => ({
            date,
            tempMax:     data.daily.temperature_2m_max[i],
            tempMin:     data.daily.temperature_2m_min[i],
            weatherCode: data.daily.weathercode[i],
        }));

        return { current, hourly, daily, alerts: [], fetchedAt: Date.now() };
    }

    destroy() {
        this._session.abort();
    }
}
