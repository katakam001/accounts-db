const { getDb } = require("../utils/getDb");

exports.getAllConversions = async (req, res) => {
  try {
    const db = getDb();
    const Conversion = db.conversions;
    const { userId, financialYear } = req.query;

    const whereCondition = {
      ...(userId && { user_id: userId }),
      ...(financialYear && { financial_year: financialYear })
    };

    const conversions = await Conversion.findAll({
      where: whereCondition,
      include: [
        { model: db.units, as: 'fromUnit' },
        { model: db.units, as: 'toUnit' }
      ]
    });

    const formattedConversions = conversions.map(conversion => ({
      id: conversion.id,
      from_unit_id: conversion.from_unit_id,
      from_unit_name: conversion.fromUnit.name,
      to_unit_id: conversion.to_unit_id,
      to_unit_name: conversion.toUnit.name,
      rate: conversion.rate,
      user_id: conversion.user_id,
      financial_year: conversion.financial_year,
    }));

    res.json(formattedConversions);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

exports.createConversion = async (req, res) => {
  try {
    const db = getDb();
    const Conversion = db.conversions;
    const conversion = await Conversion.create(req.body);

    // Fetch the associated units
    const fromUnit = await db.units.findByPk(conversion.from_unit_id);
    const toUnit = await db.units.findByPk(conversion.to_unit_id);

    const formattedConversion = {
      id: conversion.id,
      from_unit_id: conversion.from_unit_id,
      from_unit_name: fromUnit.name,
      to_unit_id: conversion.to_unit_id,
      to_unit_name: toUnit.name,
      rate: conversion.rate,
      user_id: conversion.user_id,
      financial_year: conversion.financial_year,
    };

    res.status(201).json(formattedConversion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.updateConversion = async (req, res) => {
  try {
    const db = getDb();
    const Conversion = db.conversions;
    const { id } = req.params;
    const [updated] = await Conversion.update(req.body, { where: { id } });
    if (updated) {
      const updatedConversion = await Conversion.findOne({ where: { id }, include: [
        { model: db.units, as: 'fromUnit' },
        { model: db.units, as: 'toUnit' }
      ] });

      const formattedConversion = {
        id: updatedConversion.id,
        from_unit_id: updatedConversion.from_unit_id,
        from_unit_name: updatedConversion.fromUnit.name,
        to_unit_id: updatedConversion.to_unit_id,
        to_unit_name: updatedConversion.toUnit.name,
        rate: updatedConversion.rate,
        user_id: updatedConversion.user_id,
        financial_year: updatedConversion.financial_year,
      };

      res.status(200).json(formattedConversion);
    } else {
      throw new Error('Conversion not found');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.deleteConversion = async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();
    const Conversions = db.conversions;

    // Check if the conversion exists
    const conversion = await Conversions.findByPk(id);
    if (!conversion) {
      return res.status(404).json({ message: 'Conversion not found' });
    }

    // Attempt to delete the conversion
    await conversion.destroy();

    // Successful deletion
    res.status(200).json({ message: 'Conversion deleted successfully' });
  } catch (error) {
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      res.status(400).json({
        error: 'foreign key constraint',
        message: `Cannot delete conversion due to foreign key constraint.`,
        detail: error.parent.detail || error.message, // Provide only relevant database details
      });
    } else {
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  }
};
