/**
 * @typedef {Object} OpenMeteoRawResponse
 * @property {{
 *   temperature_2m:         number,
 *   apparent_temperature:   number,
 *   weathercode:            number,
 *   windspeed_10m:          number,
 *   windgusts_10m:          number,
 *   relativehumidity_2m:    number,
 *   precipitation:          number,
 * }} current
 * @property {{
 *   time:                      string[],
 *   temperature_2m:            number[],
 *   weathercode:               number[],
 *   precipitation_probability: number[],
 *   precipitation:             number[],
 * }} hourly
 * @property {{
 *   time:                          string[],
 *   weathercode:                   number[],
 *   temperature_2m_max:            number[],
 *   temperature_2m_min:            number[],
 *   precipitation_sum:             number[],
 *   precipitation_probability_max: number[],
 *   windspeed_10m_max:             number[],
 *   windgusts_10m_max:             number[],
 * }} daily
 */

/**
 * @typedef {Object} CurrentWeather
 * @property {number} temperature
 * @property {number} apparentTemperature
 * @property {number} humidity
 * @property {number} windSpeed           km/h
 * @property {number} windGust            km/h
 * @property {number} precipitation       mm
 * @property {number} weatherCode
 */

/**
 * @typedef {Object} HourlySlot
 * @property {string} time               ISO 8601
 * @property {number} temperature
 * @property {number} precipitationProb  0–100 %
 * @property {number} precipitation      mm
 * @property {number} weatherCode
 */

/**
 * @typedef {Object} DailyDay
 * @property {string} date              YYYY-MM-DD
 * @property {number} tempMax
 * @property {number} tempMin
 * @property {number} precipitationSum  mm
 * @property {number} precipitationProb 0–100 %
 * @property {number} windSpeedMax      km/h
 * @property {number} windGustMax       km/h
 * @property {number} weatherCode
 */

/**
 * @typedef {Object} AlertModel
 * @property {string} id
 * @property {string} title
 * @property {string} severity
 * @property {string} description
 * @property {string} onset      ISO 8601
 * @property {string} expires    ISO 8601
 */

/**
 * @typedef {Object} WeatherModel
 * @property {CurrentWeather}  current
 * @property {HourlySlot[]}    hourly     primeiras 24 entradas
 * @property {DailyDay[]}      daily      7 dias
 * @property {AlertModel[]}    alerts
 * @property {number}          fetchedAt  Date.now()
 */

export {};
