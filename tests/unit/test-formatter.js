import { assertEqual, summary } from './helpers.js';
import { formatTemp, formatTime, formatWindSpeed } from '../../utils/Formatter.js';

assertEqual(formatTemp(23, 'celsius'),     '23°C',      'celsius integer');
assertEqual(formatTemp(23.7, 'celsius'),   '24°C',      'celsius rounds');
assertEqual(formatTemp(0, 'celsius'),      '0°C',       'celsius zero');
assertEqual(formatTemp(23, 'fahrenheit'),  '73°F',      'fahrenheit convert');
assertEqual(formatTemp(-10, 'celsius'),    '-10°C',     'negative celsius');

assertEqual(formatTime('2026-06-12T14:00'), '14:00',    'time HH:MM');
assertEqual(formatTime('2026-06-12T09:05'), '09:05',    'time zero-padded');

assertEqual(formatWindSpeed(0),   '0 km/h',   'wind zero');
assertEqual(formatWindSpeed(5),   '18 km/h',  'wind 5m/s → 18km/h');
assertEqual(formatWindSpeed(10),  '36 km/h',  'wind 10m/s');

summary('Formatter');
