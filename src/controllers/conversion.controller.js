const { getDb } = require("../utils/getDb");

exports.getAllConversions = async (req, res) => {
  try {
    const db = getDb();
    const Conversion = db.conversions;
    const conversions = await Conversion.findAll({
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
      createdAt: conversion.createdAt,
      updatedAt: conversion.updatedAt
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
      createdAt: conversion.createdAt,
      updatedAt: conversion.updatedAt
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
        createdAt: updatedConversion.createdAt,
        updatedAt: updatedConversion.updatedAt
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
  try {
    const db = getDb();
    const Conversion = db.conversions;
    const { id } = req.params;
    const deleted = await Conversion.destroy({ where: { id } });
    if (deleted) {
      res.status(204).send();
    } else {
      throw new Error('Conversion not found');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
