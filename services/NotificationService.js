export class NotificationService {
    /**
     * @param {string} title
     * @param {string} body
     */
    notify(title, body) {
        try {
            global.notify(title, body);
        } catch (e) {
            console.warn(`[WeatherPlugin] NotificationService.notify failed: ${e.message}`);
        }
    }
}
