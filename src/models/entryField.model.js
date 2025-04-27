module.exports = (sequelize, Sequelize, Entry, Fields) => {
  const EntryField = sequelize.define('EntryField', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.INTEGER
    },
    entry_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: Entry,
        key: 'id'
      },
      onDelete: 'RESTRICT', // Change to ON DELETE RESTRICT
      onUpdate: 'CASCADE',  // Keep ON UPDATE CASCADE
    },
    field_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: Fields,
        key: 'id'
      },
      onDelete: 'RESTRICT', // Change to ON DELETE RESTRICT
      onUpdate: 'CASCADE',  // Keep ON UPDATE CASCADE
    },
    field_value: {
      type: Sequelize.TEXT,
      allowNull: false
    }
  }, {
    tableName: 'entry_fields',
  });

  return EntryField;
};
