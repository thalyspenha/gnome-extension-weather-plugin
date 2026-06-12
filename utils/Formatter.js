/**
 * @param {number} value
 * @param {'celsius'|'fahrenheit'} unit
 * @returns {string}
 */
export function formatTemp(value, unit) {
    if (unit === 'fahrenheit') {
        return `${Math.round(value * 9 / 5 + 32)}°F`;
    }
    return `${Math.round(value)}°C`;
}

/**
 * @param {string} isoString  ex: '2026-06-12T14:00'
 * @returns {string}          ex: '14:00'
 */
export function formatTime(isoString) {
    const t = isoString.split('T')[1];
    return t ? t.slice(0, 5) : isoString;
}

/**
 * @param {number} kmh  quilômetros por hora
 * @returns {string}
 */
export function formatWindSpeed(kmh) {
    return `${Math.round(kmh)} km/h`;
}
