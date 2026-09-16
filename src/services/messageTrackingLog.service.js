const { getDb } = require("../utils/getDb");

async function insertTrackingRecord(data, transaction = null) {
    const db = getDb();
    const MessageTrackingLog = db.messageTrackingLog;

    try {
        const {
            batchId,
            transactionId,
            userId,
            financialYear,
            type,
            status
        } = data;

        const record = await MessageTrackingLog.create({
            batch_id: batchId,
            transaction_id: transactionId,
            user_id: userId,
            financial_year: financialYear,
            type,
            status
        }, { transaction });


        console.log(`✅ MessageTrackingLog inserted: ID ${record.id}`);
        return record;
    } catch (error) {
        console.error('❌ Error inserting MessageTrackingLog:', error.message);
        throw error;
    }
}

module.exports = {
    insertTrackingRecord
};
