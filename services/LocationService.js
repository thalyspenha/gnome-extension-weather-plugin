import Geoclue from 'gi://Geoclue';

export class LocationService {
    constructor() {
        this._client = null;
        this._coords = null;
    }

    /**
     * @returns {Promise<{lat: number, lon: number}>}
     */
    async getLocation() {
        if (this._coords) return this._coords;

        return new Promise((resolve, reject) => {
            Geoclue.Simple.new(
                'weather-plugin@thalysvalisi',
                Geoclue.AccuracyLevel.CITY,
                null,
                (_, result) => {
                    try {
                        this._client = Geoclue.Simple.new_finish(result);
                        const loc    = this._client.get_location();
                        this._coords = {
                            lat: loc.get_latitude(),
                            lon: loc.get_longitude(),
                        };
                        resolve(this._coords);
                    } catch (e) {
                        reject(new Error(`GeoClue2 failed: ${e.message}`));
                    }
                }
            );
        });
    }

    destroy() {
        this._client = null;
        this._coords = null;
    }
}
