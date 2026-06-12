/**
 * @typedef {Object} CurrentWeather
 * @property {number} temperature
 * @property {number} apparentTemperature
 * @property {number} humidity
 * @property {number} windSpeed
 * @property {number} weatherCode
 */

/**
 * @typedef {Object} HourlySlot
 * @property {string} time        ISO 8601
 * @property {number} temperature
 * @property {number} weatherCode
 */

/**
 * @typedef {Object} DailyDay
 * @property {string} date        YYYY-MM-DD
 * @property {number} tempMax
 * @property {number} tempMin
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
