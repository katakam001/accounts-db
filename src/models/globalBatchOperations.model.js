module.exports = (sequelize, Sequelize) => {
    const GlobalBatchOperations = sequelize.define('GlobalBatchOperations', {
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      financial_year: {
        type: Sequelize.STRING(10),
        allowNull: false,
        primaryKey: true,
      },
      is_batch: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    }, {
      tableName: 'global_batch_operations',
    });
  
    return GlobalBatchOperations;
  };
  