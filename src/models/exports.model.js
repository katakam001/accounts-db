module.exports = (sequelize, Sequelize) => {
  const Export = sequelize.define('Export', {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    file_name: {
      type: Sequelize.STRING(255),
      allowNull: true
    },
    file_type: {
      type: Sequelize.STRING(50),
      allowNull: false
    },
    financial_year: {
      type: Sequelize.STRING(10),
      allowNull: false
    },
    status: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    input_key: {
      type: Sequelize.TEXT,
      allowNull: true
    },
    input_key_timestamp: {
      type: Sequelize.DATE,
      allowNull: true
    },
    output_key: {
      type: Sequelize.TEXT,
      allowNull: true
    },
    output_key_timestamp: {
      type: Sequelize.DATE,
      allowNull: true
    }
  }, {
    tableName: 'exports'
  });

  return Export;
};
