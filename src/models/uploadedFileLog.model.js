module.exports = (sequelize, Sequelize) => {
  const UploadedFileLog = sequelize.define("uploaded_file_log", {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.INTEGER
    },
    hash: {
      type: Sequelize.STRING(64),
      allowNull: false,
      unique: true,
    },
    transaction_id: {
      type: Sequelize.STRING(50),
      allowNull: false,
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    financial_year: {
      type: Sequelize.STRING(10),
      allowNull: false,
    },
    type: {
      type: Sequelize.INTEGER,
      allowNull: true
    }
  }, {
    tableName: 'uploaded_file_log',
  });

  return UploadedFileLog;
};
