const {getDb} = require("../utils/getDb");

exports.getAllBrokers = async (req, res) => {
  try {
    const db = getDb();
    const Broker = db.brokers;
    const brokers = await Broker.findAll();
    res.json(brokers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createBroker = async (req, res) => {
  try {
    const db = getDb();
    const Broker = db.brokers;
    const broker = await Broker.create(req.body);
    res.status(201).json(broker);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateBroker = async (req, res) => {
  try {
    const db = getDb();
    const Broker = db.brokers;
    const { id } = req.params;
    const [updated] = await Broker.update(req.body, { where: { id } });
    if (updated) {
      const updatedBroker = await Broker.findOne({ where: { id } });
      res.status(200).json(updatedBroker);
    } else {
      throw new Error('Broker not found');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteBroker = async (req, res) => {
  try {
    const db = getDb();
    const Broker = db.brokers;
    const { id } = req.params;
    const deleted = await Broker.destroy({ where: { id } });
    if (deleted) {
      res.status(204).send();
    } else {
      throw new Error('Broker not found');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
