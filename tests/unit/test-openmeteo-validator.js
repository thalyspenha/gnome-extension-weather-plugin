import { assertEqual, assert, summary } from './helpers.js';
import { validate, OpenMeteoValidationError } from '../../utils/OpenMeteoValidator.js';

const VALID_RAW = {
    current: {
        temperature_2m: 22.5,
        apparent_temperature: 20.1,
        weathercode: 1,
        windspeed_10m: 15.0,
        windgusts_10m: 22.0,
        relativehumidity_2m: 70,
        precipitation: 0.0,
    },
    hourly: {
        time:                      ['2026-06-12T00:00', '2026-06-12T01:00'],
        temperature_2m:            [22.0, 21.5],
        weathercode:               [1, 2],
        precipitation_probability: [10, 20],
        precipitation:             [0.0, 0.1],
    },
    daily: {
        time:                          ['2026-06-12', '2026-06-13'],
        weathercode:                   [1, 3],
        temperature_2m_max:            [28.0, 25.0],
        temperature_2m_min:            [18.0, 16.0],
        precipitation_sum:             [0.0, 2.5],
        precipitation_probability_max: [10, 60],
        windspeed_10m_max:             [20.0, 18.0],
        windgusts_10m_max:             [35.0, 28.0],
    },
};

// valid passes
let threw = false;
try { validate(VALID_RAW); } catch (_) { threw = true; }
assert(!threw, 'valid raw does not throw');

// missing top-level section
threw = false;
try { validate({}); } catch (e) { threw = e instanceof OpenMeteoValidationError; }
assert(threw, 'empty object throws OpenMeteoValidationError');

// missing current field
threw = false;
const missingField = JSON.parse(JSON.stringify(VALID_RAW));
delete missingField.current.windgusts_10m;
try { validate(missingField); } catch (e) { threw = e instanceof OpenMeteoValidationError; }
assert(threw, 'missing current.windgusts_10m throws');

// wrong type in current
threw = false;
const wrongType = JSON.parse(JSON.stringify(VALID_RAW));
wrongType.current.temperature_2m = 'hot';
try { validate(wrongType); } catch (e) { threw = e instanceof OpenMeteoValidationError; }
assert(threw, 'string where number expected throws');

// missing hourly array
threw = false;
const noHourly = JSON.parse(JSON.stringify(VALID_RAW));
delete noHourly.hourly.precipitation_probability;
try { validate(noHourly); } catch (e) { threw = e instanceof OpenMeteoValidationError; }
assert(threw, 'missing hourly.precipitation_probability throws');

// missing daily array
threw = false;
const noDaily = JSON.parse(JSON.stringify(VALID_RAW));
delete noDaily.daily.windgusts_10m_max;
try { validate(noDaily); } catch (e) { threw = e instanceof OpenMeteoValidationError; }
assert(threw, 'missing daily.windgusts_10m_max throws');

// empty hourly.time array
threw = false;
const emptyTime = JSON.parse(JSON.stringify(VALID_RAW));
emptyTime.hourly.time = [];
try { validate(emptyTime); } catch (e) { threw = e instanceof OpenMeteoValidationError; }
assert(threw, 'empty hourly.time throws');

summary('OpenMeteoValidator');
