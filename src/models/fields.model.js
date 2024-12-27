module.exports = (sequelize, Sequelize) => {
    const Fields = sequelize.define("Fields", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      field_name: {
        type: Sequelize.STRING,
        allowNull: false
      }
    }, {
      tableName: 'fields',
    });
  
    return Fields;
  };
  