export function map(raw) {
    const c = raw.current;

    const current = {
        temperature:         c.temperature_2m,
        apparentTemperature: c.apparent_temperature,
        humidity:            c.relativehumidity_2m,
        windSpeed:           c.windspeed_10m,
        windGust:            c.windgusts_10m,
        precipitation:       c.precipitation,
        weatherCode:         c.weathercode,
    };

    const hourly = raw.hourly.time.slice(0, 24).map((time, i) => ({
        time,
        temperature:        raw.hourly.temperature_2m[i],
        precipitationProb:  raw.hourly.precipitation_probability[i],
        precipitation:      raw.hourly.precipitation[i],
        weatherCode:        raw.hourly.weathercode[i],
    }));

    const daily = raw.daily.time.map((date, i) => ({
        date,
        tempMax:            raw.daily.temperature_2m_max[i],
        tempMin:            raw.daily.temperature_2m_min[i],
        precipitationSum:   raw.daily.precipitation_sum[i],
        precipitationProb:  raw.daily.precipitation_probability_max[i],
        windSpeedMax:       raw.daily.windspeed_10m_max[i],
        windGustMax:        raw.daily.windgusts_10m_max[i],
        weatherCode:        raw.daily.weathercode[i],
    }));

    return { current, hourly, daily, alerts: [], fetchedAt: Date.now() };
}
