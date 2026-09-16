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

    getTtl(key) {
        const ttl = this.cache.getTtl(key);
        return ttl ? Math.floor(ttl / 1000) : null;
    }

    ttl(key, seconds) {
        return this.cache.ttl(key, seconds);
    }

    has(key) {
        return this.cache.has(key);
    }
}

const cacheInstance = new CacheService();
Object.freeze(cacheInstance); // Ensure only one instance exists

module.exports = cacheInstance;
