import { assertEqual, summary } from './helpers.js';
import { getIconName, getDescription } from '../../utils/WeatherIcons.js';

assertEqual(getIconName(0),   'weather-clear-symbolic',            'WMO 0: clear sky');
assertEqual(getIconName(1),   'weather-few-clouds-symbolic',       'WMO 1: mainly clear');
assertEqual(getIconName(2),   'weather-few-clouds-symbolic',       'WMO 2: partly cloudy');
assertEqual(getIconName(3),   'weather-overcast-symbolic',         'WMO 3: overcast');
assertEqual(getIconName(51),  'weather-showers-scattered-symbolic', 'WMO 51: drizzle light');
assertEqual(getIconName(61),  'weather-showers-symbolic',          'WMO 61: rain slight');
assertEqual(getIconName(71),  'weather-snow-symbolic',             'WMO 71: snow slight');
assertEqual(getIconName(95),  'weather-storm-symbolic',            'WMO 95: thunderstorm');
assertEqual(getIconName(999), 'weather-severe-alert-symbolic',     'unknown code fallback');

assertEqual(getDescription(0),   'Céu Limpo',           'desc WMO 0');
assertEqual(getDescription(1),   'Quase Limpo',          'desc WMO 1');
assertEqual(getDescription(2),   'Parcialmente Nublado', 'desc WMO 2');
assertEqual(getDescription(3),   'Nublado',              'desc WMO 3');
assertEqual(getDescription(45),  'Neblina',              'desc WMO 45');
assertEqual(getDescription(51),  'Garoa Leve',           'desc WMO 51');
assertEqual(getDescription(61),  'Chuva Leve',           'desc WMO 61');
assertEqual(getDescription(65),  'Chuva Forte',          'desc WMO 65');
assertEqual(getDescription(71),  'Neve Leve',            'desc WMO 71');
assertEqual(getDescription(80),  'Pancadas de Chuva',    'desc WMO 80');
assertEqual(getDescription(95),  'Tempestade',           'desc WMO 95');
assertEqual(getDescription(999), 'Condição Desconhecida','desc unknown fallback');

summary('WeatherIcons');
