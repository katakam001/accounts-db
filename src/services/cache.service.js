const NodeCache = require("node-cache");

class CacheService {
    constructor() {
        if (!CacheService.instance) {
            this.cache = new NodeCache();
            CacheService.instance = this;
        }
        return CacheService.instance;
    }

    setCache(key, value, ttl = 3600) {
        this.cache.set(key, value, ttl);
    }

    getCache(key) {
        return this.cache.get(key);
    }

    deleteCache(key) {
        this.cache.del(key);
    }
}

const cacheInstance = new CacheService();
Object.freeze(cacheInstance); // Ensure only one instance exists

module.exports = cacheInstance;
