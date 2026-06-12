import { assertEqual, assert, summary } from './helpers.js';
import { map } from '../../utils/OpenMeteoMapper.js';

const VALID_RAW = {
    current: {
        temperature_2m: 22.5,
        apparent_temperature: 20.1,
        weathercode: 1,
        windspeed_10m: 15.0,
        windgusts_10m: 22.0,
        relativehumidity_2m: 70,
        precipitation: 0.5,
    },
    hourly: {
        time:                      Array.from({ length: 30 }, (_, i) => `2026-06-12T${String(i % 24).padStart(2,'0')}:00`),
        temperature_2m:            Array.from({ length: 30 }, (_, i) => 20 + i * 0.1),
        weathercode:               Array.from({ length: 30 }, () => 1),
        precipitation_probability: Array.from({ length: 30 }, (_, i) => i * 2),
        precipitation:             Array.from({ length: 30 }, (_, i) => i * 0.05),
    },
    daily: {
        time:                          ['2026-06-12', '2026-06-13', '2026-06-14'],
        weathercode:                   [1, 3, 61],
        temperature_2m_max:            [28.0, 25.0, 22.0],
        temperature_2m_min:            [18.0, 16.0, 14.0],
        precipitation_sum:             [0.0, 2.5, 8.0],
        precipitation_probability_max: [10, 60, 90],
        windspeed_10m_max:             [20.0, 18.0, 25.0],
        windgusts_10m_max:             [35.0, 28.0, 40.0],
    },
};

const model = map(VALID_RAW);

// current fields
assertEqual(model.current.temperature,         22.5,  'current.temperature');
assertEqual(model.current.apparentTemperature, 20.1,  'current.apparentTemperature');
assertEqual(model.current.humidity,            70,    'current.humidity');
assertEqual(model.current.windSpeed,           15.0,  'current.windSpeed');
assertEqual(model.current.windGust,            22.0,  'current.windGust');
assertEqual(model.current.precipitation,       0.5,   'current.precipitation');
assertEqual(model.current.weatherCode,         1,     'current.weatherCode');

// hourly slice
assertEqual(model.hourly.length, 24, 'hourly sliced to 24');
assertEqual(model.hourly[0].temperature,        20.0, 'hourly[0].temperature');
assertEqual(model.hourly[0].precipitationProb,  0,    'hourly[0].precipitationProb');
assertEqual(model.hourly[0].precipitation,      0.0,  'hourly[0].precipitation');
assertEqual(model.hourly[0].weatherCode,        1,    'hourly[0].weatherCode');
assertEqual(model.hourly[5].precipitationProb,  10,   'hourly[5].precipitationProb');
assertEqual(model.hourly[0].time,  '2026-06-12T00:00', 'hourly[0].time');
assertEqual(model.hourly[23].weatherCode, 1,            'hourly[23] exists (last slot)');
assertEqual(model.hourly[24],             undefined,     'hourly[24] absent');

// daily
assertEqual(model.daily.length,              3,    'daily length');
assertEqual(model.daily[0].date, '2026-06-12', 'daily[0].date');
assertEqual(model.daily[0].tempMax,          28.0, 'daily[0].tempMax');
assertEqual(model.daily[0].tempMin,          18.0, 'daily[0].tempMin');
assertEqual(model.daily[0].precipitationSum, 0.0,  'daily[0].precipitationSum');
assertEqual(model.daily[0].precipitationProb,10,   'daily[0].precipitationProb');
assertEqual(model.daily[0].windSpeedMax,     20.0, 'daily[0].windSpeedMax');
assertEqual(model.daily[0].windGustMax,      35.0, 'daily[0].windGustMax');
assertEqual(model.daily[0].weatherCode,      1,    'daily[0].weatherCode');
assertEqual(model.daily[1].precipitationProb,60,   'daily[1].precipitationProb');

// metadata
assert(typeof model.fetchedAt === 'number', 'fetchedAt is number');
assert(model.fetchedAt > 0,                 'fetchedAt > 0');
assert(Array.isArray(model.alerts),         'alerts is array');
assertEqual(model.alerts.length, 0,         'alerts empty');

summary('OpenMeteoMapper');
