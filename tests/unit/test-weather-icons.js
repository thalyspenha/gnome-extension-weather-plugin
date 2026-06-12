import { assertEqual, summary } from './helpers.js';
import { getIconName } from '../../utils/WeatherIcons.js';

assertEqual(getIconName(0),   'weather-clear-symbolic',            'WMO 0: clear sky');
assertEqual(getIconName(1),   'weather-few-clouds-symbolic',       'WMO 1: mainly clear');
assertEqual(getIconName(2),   'weather-few-clouds-symbolic',       'WMO 2: partly cloudy');
assertEqual(getIconName(3),   'weather-overcast-symbolic',         'WMO 3: overcast');
assertEqual(getIconName(51),  'weather-showers-scattered-symbolic', 'WMO 51: drizzle light');
assertEqual(getIconName(61),  'weather-showers-symbolic',          'WMO 61: rain slight');
assertEqual(getIconName(71),  'weather-snow-symbolic',             'WMO 71: snow slight');
assertEqual(getIconName(95),  'weather-storm-symbolic',            'WMO 95: thunderstorm');
assertEqual(getIconName(999), 'weather-severe-alert-symbolic',     'unknown code fallback');

summary('WeatherIcons');
