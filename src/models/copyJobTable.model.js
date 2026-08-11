module.exports = (sequelize, Sequelize, CopyJob) => {
  const CopyJobTable = sequelize.define("CopyJobTable", {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    job_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: CopyJob,
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    table_name: {
      type: Sequelize.STRING(100),
      allowNull: false,
    },
    stage: {
      type: Sequelize.SMALLINT,   // 0=stage1a, 1=stage1b, 2=stage2, 3=finalize
      allowNull: false,
    },
    group_name: {
      type: Sequelize.STRING(50),
      allowNull: true,
    },
    order_index: {
      type: Sequelize.SMALLINT,   // position in stage order
      allowNull: false,
    },
    sub_order_index: {
      type: Sequelize.SMALLINT,   // position inside group
      allowNull: true,
    },
    total_count: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    },
    processed_count: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    },
    inserted_count: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    },
    deleted_count: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    },
    skipped_count: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    },
    status: {
      type: Sequelize.SMALLINT,   // 0=pending, 1=running, 2=completed, 3=failed
      defaultValue: 0,
    }
  }, {
    tableName: 'copy_job_tables'
  });

  return CopyJobTable;
};
