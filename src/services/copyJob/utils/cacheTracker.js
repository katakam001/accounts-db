const cache = require("../../cache.service");

class CacheTracker {
    static key(jobId, tableName, type) {
        return `job:${jobId}:table:${tableName}:${type}`;
    }

    // 🔹 Initialize table-level counters
    static initTable(jobId, tableName, totalCount = 0) {
        cache.setCache(this.key(jobId, tableName, "processed"), 0, 3600);
        cache.setCache(this.key(jobId, tableName, "inserted"), 0, 3600);
        cache.setCache(this.key(jobId, tableName, "deleted"), 0, 3600); // ✅ new
        cache.setCache(this.key(jobId, tableName, "skipped"), 0, 3600);
        cache.setCache(this.key(jobId, tableName, "failed"), 0, 3600);
        cache.setCache(this.key(jobId, tableName, "total"), totalCount, 3600);
        cache.setCache(this.key(jobId, tableName, "sourceToTarget"), {}, 3600);
    }

    static setChunkMeta(jobId, tableName, stage, s3Key, chunkIndex, rowCount) {
        // Store chunk-specific metadata with stage included
        cache.setCache(this.key(jobId, tableName, `stage:${stage}:chunk:${chunkIndex}:s3Key`), s3Key, 3600);
        cache.setCache(this.key(jobId, tableName, `stage:${stage}:chunk:${chunkIndex}:index`), chunkIndex, 3600);

        // Initialize chunk-level processed counter
        cache.setCache(this.key(jobId, tableName, `stage:${stage}:chunk:${chunkIndex}:processed`), 0, 3600);

        // 🔹 Store expected row count for this chunk
        cache.setCache(this.key(jobId, tableName, `stage:${stage}:chunk:${chunkIndex}:total`), Number(rowCount) || 0, 3600);
    }


    // 🔹 Increment chunk total per stage
    static incrementChunkTotal(jobId, tableName, stageNumber) {
        const totalKey = this.key(jobId, tableName, `stage:${stageNumber}:totalChunks`);
        const current = cache.getCache(totalKey) || 0;
        cache.setCache(totalKey, current + 1, 3600);
    }

    static incrementChunk(jobId, tableName, stage, chunkIndex) {
        const key = this.key(jobId, tableName, `stage:${stage}:chunk:${chunkIndex}:processed`);
        const current = cache.getCache(key) || 0;
        cache.setCache(key, current + 1, 3600);
        return current + 1;
    }

    // 🔹 Retrieve chunk total per stage
    static getTotalChunks(jobId, tableName, stageNumber) {
        return cache.getCache(this.key(jobId, tableName, `stage:${stageNumber}:totalChunks`)) || 0;
    }

    // 🔹 Mark that a chunk summary has been received
    static setChunkSummaryReceived(jobId, tableName, stage, chunkIndex, received, generatedCount) {
        const key = `job:${jobId}:stage:${stage}:table:${tableName}:chunk:${chunkIndex}:summary`;
        cache.setCache(key, { received, generatedCount: Number(generatedCount) || 0 }, 3600);
        // Track how many chunks have reported for this table+stage
        const receivedKey = `job:${jobId}:stage:${stage}:table:${tableName}:receivedChunks`;
        const current = cache.getCache(receivedKey) || 0;
        cache.setCache(receivedKey, current + 1, 3600);
    }

    // 🔹 How many chunks have reported so far
    static getReceivedChunks(jobId, tableName, stage) {
        const key = `job:${jobId}:stage:${stage}:table:${tableName}:receivedChunks`;
        return cache.getCache(key) || 0;
    }

    // 🔹 Retrieve a specific chunk’s summary
    static getChunkSummary(jobId, tableName, stage, chunkIndex) {
        const s3Key = cache.getCache(this.key(jobId, tableName, `stage:${stage}:chunk:${chunkIndex}:s3Key`));
        const processed = cache.getCache(this.key(jobId, tableName, `stage:${stage}:chunk:${chunkIndex}:processed`)) || 0;
        const rowCount = cache.getCache(this.key(jobId, tableName, `stage:${stage}:chunk:${chunkIndex}:total`)) || 0;

        const summaryKey = `job:${jobId}:stage:${stage}:table:${tableName}:chunk:${chunkIndex}:summary`;
        const summary = cache.getCache(summaryKey) || {};

        return {
            s3Key,
            chunkIndex,
            processed,
            rowCount,
            received: summary.received || false,
            generatedCount: Number(summary.generatedCount) || 0
        };
    }

    // 🔹 Increment table-level counters
    static increment(jobId, tableName, type) {
        const key = this.key(jobId, tableName, type);
        const current = cache.getCache(key) || 0;
        cache.setCache(key, current + 1, 3600);
        return current + 1;
    }

    static incrementBy(jobId, tableName, type, amount) {
        const key = this.key(jobId, tableName, type);
        const current = cache.getCache(key) || 0;
        cache.setCache(key, current + amount, 3600);
        return current + amount;
    }

    // 🔹 Add source→target mapping
    static addMapping(jobId, tableName, sourceId, targetId) {
        const key = this.key(jobId, tableName, "sourceToTarget");
        const map = cache.getCache(key) || {};
        map[sourceId] = targetId;
        cache.setCache(key, map, 3600);
    }

    // 🔹 NEW: Get source→target mapping
    static getMapping(jobId, tableName, sourceId) {
        const key = this.key(jobId, tableName, "sourceToTarget");
        const map = cache.getCache(key) || {};
        return map[sourceId];
    }

    // 🔹 Get table-level summary
    static getSummary(jobId, tableName) {
        return {
            processed: cache.getCache(this.key(jobId, tableName, "processed")) || 0,
            inserted: cache.getCache(this.key(jobId, tableName, "inserted")) || 0,
            deleted: cache.getCache(this.key(jobId, tableName, "deleted")) || 0, // ✅ new
            skipped: cache.getCache(this.key(jobId, tableName, "skipped")) || 0,
            failed: cache.getCache(this.key(jobId, tableName, "failed")) || 0,
            total: cache.getCache(this.key(jobId, tableName, "total")) || 0,
            sourceToTarget: cache.getCache(this.key(jobId, tableName, "sourceToTarget")) || {}
        };
    }

    // 🔹 Check if table is complete

    static isComplete(jobId, tableName, totalChunks) {
        const { total, processed, inserted, deleted, skipped, failed } = this.getSummary(jobId, tableName);
        const outcomesMatch = processed === (inserted + deleted + skipped + failed);
        const totalsMatch = processed === total;

        if (!(total > 0 && outcomesMatch && totalsMatch)) {
            return false;
        }

        // 🔹 Verify each chunk
        for (let i = 0; i < totalChunks; i++) {
            const chunkSummary = this.getChunkSummary(jobId, tableName, i);
            if (!chunkSummary) return false;
            if (chunkSummary.processed !== chunkSummary.rowCount) {
                return false; // chunk not fully processed
            }
        }

        return true; // all chunks complete
    }

    // 🔹 Cleanup cache keys after flush
    static cleanup(jobId, tableName, totalChunks) {
        // Remove global counters
        ["processed", "inserted", "deleted", "skipped", "failed", "total"].forEach(type => {
            cache.deleteCache(this.key(jobId, tableName, type));
        });

        // Remove chunk-specific metadata
        for (let i = 0; i < totalChunks; i++) {
            const s3Key = cache.getCache(this.key(jobId, tableName, `chunk:${i}:s3Key`));
            cache.deleteCache(this.key(jobId, tableName, `chunk:${i}:s3Key`));
            cache.deleteCache(this.key(jobId, tableName, `chunk:${i}:index`));
            cache.deleteCache(this.key(jobId, tableName, `chunk:${i}:processed`));
            cache.deleteCache(this.key(jobId, tableName, `chunk:${i}:total`));

            if (s3Key) {
                // If you stored other per-chunk counters keyed by s3Key, clear them too
                cache.deleteCache(this.key(jobId, tableName, `${s3Key}:${i}:processed`));
            }
        }
    }

    // 🔹 NEW: Mark that a summary has been received for a stage
    static setSummary(jobId, stage, summaryData = true) {
        const key = `job:${jobId}:stage:${stage}:summary`;
        cache.setCache(key, summaryData, 3600); // store summary or just a flag
    }

    // 🔹 NEW: Check if summary has been received for a stage
    static hasSummary(jobId, stage) {
        const key = `job:${jobId}:stage:${stage}:summary`;
        return !!cache.getCache(key);
    }
}

module.exports = CacheTracker;
