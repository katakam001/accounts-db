module.exports = (sequelize, Sequelize) => {
  const MappingRule = sequelize.define('mapping_rule', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    source: {
      type: Sequelize.STRING(255),
      allowNull: false,
    },
    target: {
      type: Sequelize.STRING(255),
      allowNull: false,
    },
    type: {
      type: Sequelize.INTEGER,
      allowNull: false, // 0 = Group, 1 = Account
    },
    statement_type: {
      type: Sequelize.INTEGER,
      allowNull: false, // 0 = Trail Balance, 1 = Bank Statement, 2 = Credit Card Statement
    },
    statement_provider: {
      type: Sequelize.STRING(50),
      allowNull: false,
    },
    amount_mandatory: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    }
  }, {
    tableName: 'mapping_rules'
  });

  return MappingRule;
};
