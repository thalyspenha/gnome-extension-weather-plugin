const WMO_MAP = new Map([
    [0,  'weather-clear-symbolic'],
    [1,  'weather-few-clouds-symbolic'],
    [2,  'weather-few-clouds-symbolic'],
    [3,  'weather-overcast-symbolic'],
    [45, 'weather-fog-symbolic'],
    [48, 'weather-fog-symbolic'],
    [51, 'weather-showers-scattered-symbolic'],
    [53, 'weather-showers-scattered-symbolic'],
    [55, 'weather-showers-scattered-symbolic'],
    [61, 'weather-showers-symbolic'],
    [63, 'weather-showers-symbolic'],
    [65, 'weather-showers-symbolic'],
    [71, 'weather-snow-symbolic'],
    [73, 'weather-snow-symbolic'],
    [75, 'weather-snow-symbolic'],
    [80, 'weather-showers-symbolic'],
    [81, 'weather-showers-symbolic'],
    [82, 'weather-showers-symbolic'],
    [95, 'weather-storm-symbolic'],
    [96, 'weather-storm-symbolic'],
    [99, 'weather-storm-symbolic'],
]);

const FALLBACK = 'weather-severe-alert-symbolic';

/**
 * @param {number} wmoCode
 * @returns {string} icon name compatível com tema GNOME
 */
export function getIconName(wmoCode) {
    return WMO_MAP.get(wmoCode) ?? FALLBACK;
}
