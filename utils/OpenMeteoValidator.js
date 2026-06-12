export class OpenMeteoValidationError extends Error {
    constructor(message) {
        super(`OpenMeteo validation failed: ${message}`);
        this.name = 'OpenMeteoValidationError';
    }
}

const CURRENT_NUMBERS = [
    'temperature_2m', 'apparent_temperature', 'weathercode',
    'windspeed_10m', 'windgusts_10m', 'relativehumidity_2m', 'precipitation',
];

const HOURLY_ARRAYS = [
    'time', 'temperature_2m', 'weathercode',
    'precipitation_probability', 'precipitation',
];

const DAILY_ARRAYS = [
    'time', 'weathercode', 'temperature_2m_max', 'temperature_2m_min',
    'precipitation_sum', 'precipitation_probability_max',
    'windspeed_10m_max', 'windgusts_10m_max',
];

function requireSection(raw, section) {
    if (!raw || typeof raw[section] !== 'object' || raw[section] === null)
        throw new OpenMeteoValidationError(`missing section "${section}"`);
}

function requireNumber(obj, section, field) {
    if (obj[field] === null || typeof obj[field] !== 'number')
        throw new OpenMeteoValidationError(`${section}.${field} must be a number, got ${obj[field] === null ? 'null' : typeof obj[field]}`);
}

function requireArray(obj, section, field) {
    if (!Array.isArray(obj[field]))
        throw new OpenMeteoValidationError(`${section}.${field} must be an array`);
    if (obj[field].length === 0)
        throw new OpenMeteoValidationError(`${section}.${field} must not be empty`);
}

export function validate(raw) {
    requireSection(raw, 'current');
    requireSection(raw, 'hourly');
    requireSection(raw, 'daily');

    for (const field of CURRENT_NUMBERS)
        requireNumber(raw.current, 'current', field);

    for (const field of HOURLY_ARRAYS)
        requireArray(raw.hourly, 'hourly', field);

    for (const field of DAILY_ARRAYS)
        requireArray(raw.daily, 'daily', field);
}
