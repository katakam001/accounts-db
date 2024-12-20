module.exports = (sequelize, Sequelize, Entry) => {
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
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    field_name: {
      type: Sequelize.STRING,
      allowNull: false
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
