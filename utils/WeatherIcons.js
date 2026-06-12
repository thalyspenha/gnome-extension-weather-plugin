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

const DESC_MAP = new Map([
    [0,  'Céu Limpo'],
    [1,  'Quase Limpo'],
    [2,  'Parcialmente Nublado'],
    [3,  'Nublado'],
    [45, 'Neblina'],
    [48, 'Neblina com Gelo'],
    [51, 'Garoa Leve'],
    [53, 'Garoa Moderada'],
    [55, 'Garoa Densa'],
    [61, 'Chuva Leve'],
    [63, 'Chuva Moderada'],
    [65, 'Chuva Forte'],
    [71, 'Neve Leve'],
    [73, 'Neve Moderada'],
    [75, 'Neve Forte'],
    [80, 'Pancadas de Chuva'],
    [81, 'Pancadas Moderadas'],
    [82, 'Pancadas Fortes'],
    [85, 'Pancadas de Neve'],
    [86, 'Pancadas Fortes de Neve'],
    [95, 'Tempestade'],
    [96, 'Tempestade com Granizo'],
    [99, 'Tempestade com Granizo Forte'],
]);

const FALLBACK_ICON = 'weather-severe-alert-symbolic';
const FALLBACK_DESC = 'Condição Desconhecida';

/**
 * @param {number} wmoCode
 * @returns {string} icon name compatível com tema GNOME
 */
export function getIconName(wmoCode) {
    return WMO_MAP.get(wmoCode) ?? FALLBACK_ICON;
}

/**
 * @param {number} wmoCode
 * @returns {string} descrição em PT-BR
 */
export function getDescription(wmoCode) {
    return DESC_MAP.get(wmoCode) ?? FALLBACK_DESC;
}
