const db = require("../models");
const PurchaseEntry = db.purchaseEntry;
const PurchaseEntryField = db.purchaseEntryField;
const PurchaseCategories=db.purchaseCategories;
const Account = db.account;

exports.getEntries = async (req, res) => {
  const user_id = req.query.userId;
  const financial_year = req.query.financialYear;
  if (!user_id) {
    return res.status(400).json({ error: 'userId query parameter is required' });
  }
  if (!financial_year) {
    return res.status(400).json({ error: 'financialYear query parameter is required' });
  }
  try {
    const entries = await PurchaseEntry.findAll({
      where: {
        user_id,
        financial_year
      },
      attributes: [
        'id',
        'category_id',
        'purchase_date',
        'account_id',
        'item_description',
        'quantity',
        'unit_price',
        'total_amount',
        'user_id',
        'financial_year',
        [db.sequelize.col('category.name'), 'category_name'],
        [db.sequelize.col('account.name'), 'account_name']
      ],
      include: [
        {
          model: PurchaseEntryField,
          as: 'fields',
          attributes: [
            'id',
            'entry_id',
            'field_name',
            'field_value'
          ]
        },
        {
          model: PurchaseCategories,
          as: 'category',
          attributes: []
        },
        {
          model: Account,
          as: 'account',
          attributes: []
        }
      ]
    });
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.addEntry = async (req, res) => {
  const { entry, dynamicFields } = req.body;
  try {
    const newEntry = await PurchaseEntry.create(entry);
    const entryFields = dynamicFields.map(field => ({
      ...field,
      entry_id: newEntry.id
    }));
    await PurchaseEntryField.bulkCreate(entryFields);
    res.status(201).json(newEntry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateEntry = async (req, res) => {
  const { id } = req.params;
  const { entry, dynamicFields } = req.body;
  try {
    await PurchaseEntry.update(entry, { where: { id } });
    await PurchaseEntryField.destroy({ where: { entry_id: id } });
    const entryFields = dynamicFields.map(field => ({
      ...field,
      entry_id: id
    }));
    await PurchaseEntryField.bulkCreate(entryFields);
    res.status(200).json({ message: 'Entry updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteEntry = async (req, res) => {
  const { id } = req.params;
  try {
    await PurchaseEntryField.destroy({ where: { entry_id: id } });
    await PurchaseEntry.destroy({ where: { id } });
    res.status(200).json({ message: 'Entry deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
