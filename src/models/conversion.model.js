module.exports = (sequelize, Sequelize, Units) => {
    const Conversion = sequelize.define("Conversion", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      from_unit_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: Units,
          key: 'id'
        }
      },
      to_unit_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: Units,
          key: 'id'
        }
      },
      rate: {
        type: Sequelize.FLOAT,
        allowNull: false
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      financial_year: {
        type: Sequelize.STRING(10),
        allowNull: false
      }
    }, {
      tableName: 'conversions',
    });
 
    return Conversion;
  };
  