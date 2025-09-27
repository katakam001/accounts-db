module.exports = (sequelize, Sequelize, UploadHistory) => {
  const MessageTrackingLog = sequelize.define('MessageTrackingLog', {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    batch_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: UploadHistory,
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    },
    transaction_id: {
      type: Sequelize.STRING(50),
      allowNull: false
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    financial_year: {
      type: Sequelize.STRING(10),
      allowNull: false
    },
    type: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    status: {
      type: Sequelize.INTEGER,
      allowNull: false
    }
  }, {
    tableName: 'message_tracking_log'
  });

  return MessageTrackingLog;
};
