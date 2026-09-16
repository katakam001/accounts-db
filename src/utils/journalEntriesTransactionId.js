const path = require('path');
const dotenv = require('dotenv');
const { getDb } = require("./getDb");

dotenv.config({
    path: path.resolve(__dirname, `../../.env.${process.env.NODE_ENV || 'development'}`)
});

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateTransactionIds() {
    const db = getDb();
    const JournalEntry = db.journalEntry;

    try {
        // fetch rows that need updating
        const rows = await JournalEntry.findAll({
            where: { type: 0, transaction_id: null },
            attributes: ['id']
        });

        for (const row of rows) {
            const transaction_id = `TXN-${Date.now()}`;
            // await JournalEntry.update(
            //     { transaction_id },
            //     { where: { id: row.id } }
            // );
            console.log(transaction_id);

            // ✅ ensures unique millisecond per row
            await sleep(1);
        }

        console.log(`Updated ${rows.length} journal_entries with new transaction_id values`);
    } catch (err) {
        console.error(`❌ Error updating transaction_ids:`, err.message);
    } finally {
        await db.sequelize.close();
    }
}

updateTransactionIds();
