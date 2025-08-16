const { Client } = require('pg');
const pLimit = require('p-limit');
const { getDb } = require("../utils/getDb");

exports.generateClosingStockValuation = async (req, res) => {
    const user_id = parseInt(req.query.userId, 10);
    const financial_year = req.query.financialYear;
    const start_date = req.query.startDate;
    const end_date = req.query.endDate;

    if (isNaN(user_id)) {
        return res.status(400).json({ error: 'userId must be an integer' });
    }
    if (!financial_year || !start_date || !end_date) {
        return res.status(400).json({ error: 'financialYear, startDate, and endDate are required' });
    }

    try {
        const db = getDb();
        const ClosingStockValuation = db.closing_stock_valulation;

        const existingManual = await ClosingStockValuation.findOne({
            where: {
                user_id,
                financial_year,
                is_manual: true
            }
        });

        if (existingManual) {
            const valuations = await ClosingStockValuation.findAll({
                where: { user_id, financial_year },
                attributes: [
                    'id',
                    'item_id',
                    'start_date',
                    'end_date',
                    'is_manual',
                    'value',
                    [db.sequelize.col('item.name'), 'item_name']
                ],
                include: [
                    { model: db.items, as: 'item' },
                ],
                order: [['item_id', 'ASC']]
            });

            return res.status(200).json(valuations);
        }

        const valuations = await generateClosingStockValuationData(user_id, financial_year, start_date, end_date);
        res.status(200).json(valuations);
    } catch (error) {
        console.error('Error generating closing stock:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.fetchClosingStockValuation = async (req, res) => {
    const user_id = parseInt(req.query.userId, 10);
    const financial_year = req.query.financialYear;
    const start_date = req.query.startDate;
    const end_date = req.query.endDate;

    if (isNaN(user_id)) {
        return res.status(400).json({ error: 'userId must be an integer' });
    }
    if (!financial_year || !start_date || !end_date) {
        return res.status(400).json({ error: 'financialYear, startDate, and endDate are required' });
    }

    try {
        const db = getDb();
        const ClosingStockValuation = db.closing_stock_valulation;


        let valuations = await ClosingStockValuation.findAll({
            where: { user_id, financial_year },
            attributes: [
                'id',
                'item_id',
                'start_date',
                'end_date',
                'value',
                'is_manual',
                [db.sequelize.col('item.name'), 'item_name']
            ],
            include: [
                { model: db.items, as: 'item' },
            ],
            order: [['item_id', 'ASC']]
        });

        if (valuations.length === 0) {
            valuations = await generateClosingStockValuationData(user_id, financial_year, start_date, end_date);
        }

        res.status(200).json(valuations);
    } catch (error) {
        console.error('Error fetching closing stock valuation:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.updateClosingStockValuation = async (req, res) => {
    try {
        const db = getDb();
        const ClosingStockValuation = db.closing_stock_valulation;
        const { id } = req.params;

        const [updated] = await ClosingStockValuation.update(req.body, { where: { id } });

        if (updated) {
            const updatedValuation = await ClosingStockValuation.findOne({
                where: { id },
                attributes: [
                    'id',
                    'item_id',
                    'start_date',
                    'end_date',
                    'value',
                    'is_manual',
                    [db.sequelize.col('item.name'), 'item_name']
                ],
                include: [
                    { model: db.items, as: 'item' },
                ]
            });

            res.status(200).json(updatedValuation);
        } else {
            throw new Error("Closing Stock Valuation not found");
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

async function generateClosingStockValuationData(user_id, financial_year, start_date, end_date) {
    const db = getDb();
    const sequelize = db.sequelize;

    // Get the connection details from Sequelize
    const config = sequelize.config;

    const ClosingStockValuation = db.closing_stock_valulation;

    // 🧹 Delete existing valuations
    await ClosingStockValuation.destroy({
        where: { user_id, financial_year }
    });

    const client = new Client({
        user: config.username,
        host: config.host,
        database: config.database,
        password: config.password,
        port: config.port
    });

    await client.connect();

    client.on('notice', (msg) => {
        console.log('Notice:', msg.message);
    });

    await client.query(
        'CALL generate_closing_stock_for_all_items($1, $2, $3, $4)',
        [user_id, financial_year, start_date, end_date]
    );

    await client.end();

    return await ClosingStockValuation.findAll({
        where: { user_id, financial_year },
        attributes: [
            'id',
            'item_id',
            'start_date',
            'end_date',
            'value',
            'is_manual',
            [db.sequelize.col('item.name'), 'item_name']
        ],
        include: [
            { model: db.items, as: 'item' },
        ],
        order: [['item_id', 'ASC']]
    });
}

// async function generateClosingStockValuationData(user_id, financial_year, start_date, end_date) {
//   const db = getDb();
//   const sequelize = db.sequelize;
//   const config = sequelize.config;
//   const ClosingStockValuation = db.closing_stock_valulation;

//   // 🧹 Step 1: Delete existing valuations
//   await ClosingStockValuation.destroy({
//     where: { user_id, financial_year }
//   });

//   // 🧠 Step 2: Fetch item IDs
//   const itemIds = await sequelize.query(`
//     SELECT DISTINCT item_id FROM (
//       SELECT item_id FROM entries WHERE user_id = :userId AND financial_year = :year
//       UNION
//       SELECT item_id FROM opening_stock WHERE user_id = :userId AND financial_year = :year
//     ) AS combined_items
//   `, {
//     replacements: { userId: user_id, year: financial_year },
//     type: sequelize.QueryTypes.SELECT
//   });

//   console.log(`Found ${itemIds.length} items for stock register generation.`);

//   // 🔄 Step 3: Limit parallel connections to 5
//   const limit = pLimit(5);

//   await Promise.all(itemIds.map(({ item_id }) =>
//     limit(() => {
//       const client = new Client({
//         user: config.username,
//         host: config.host,
//         database: config.database,
//         password: config.password,
//         port: config.port
//       });

//       client.on('notice', (msg) => {
//         console.log(`Notice [item ${item_id}]:`, msg.message);
//       });

//       return client.connect()
//         .then(() => client.query('CALL generate_stock_register($1, $2, $3)', [item_id, user_id, financial_year]))
//         .then(() => {
//           console.log(`✅ Completed stock register for item_id: ${item_id}`);
//         })
//         .catch(err => {
//           console.error(`❌ Error for item_id ${item_id}:`, err.message);
//         })
//         .finally(() => client.end());
//     })
//   ));

//   console.log('🧮 All stock registers completed. Now populating closing stock ledger...');

//   // 📦 Step 4: Final ledger population
//   const finalClient = new Client({
//     user: config.username,
//     host: config.host,
//     database: config.database,
//     password: config.password,
//     port: config.port
//   });

//   finalClient.on('notice', (msg) => {
//     console.log('Notice [ledger]:', msg.message);
//   });

//   await finalClient.connect();
//   await finalClient.query('CALL populate_temp_stock_ledger($1, $2, $3, $4)', [user_id, financial_year, start_date, end_date]);
//   await finalClient.end();

//   console.log('✅ Closing stock ledger populated.');

//   // 📊 Step 5: Return final valuation data
//   return await ClosingStockValuation.findAll({
//     where: { user_id, financial_year },
//     attributes: [
//       'id',
//       'item_id',
//       'start_date',
//       'end_date',
//       'value',
//       'is_manual',
//       [db.sequelize.col('item.name'), 'item_name']
//     ],
//     include: [
//       { model: db.items, as: 'item' },
//     ],
//     order: [['item_id', 'ASC']]
//   });
// }
