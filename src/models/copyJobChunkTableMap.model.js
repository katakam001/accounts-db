module.exports = (sequelize, Sequelize, CopyJobTable) => {
  const CopyJobChunkTableMap = sequelize.define("CopyJobChunkTableMap", {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    copy_job_table_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: CopyJobTable,   // references CopyJobTable
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    chunk_index: {
      type: Sequelize.SMALLINT,
      allowNull: false,
    },
    s3_key: {
      type: Sequelize.STRING(255),
      allowNull: false,
    },
    row_count: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    processed_count: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    },
    status: {
      type: Sequelize.SMALLINT, // 0=pending, 1=prepared, 2=processed, 3=failed
      defaultValue: 0,
    }
  }, {
    tableName: 'copy_job_chunk_table_map'
  });

  return CopyJobChunkTableMap;
};
