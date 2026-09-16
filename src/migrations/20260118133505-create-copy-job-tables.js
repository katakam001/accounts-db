'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. copy_jobs
    await queryInterface.createTable('copy_jobs', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      admin_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',   // assuming admins are also in users table
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      source_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      target_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      from_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      to_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      financial_year: {
        type: Sequelize.STRING(10),
        allowNull: true,
      },
      status: {
        type: Sequelize.SMALLINT,   // 0=pending, 1=running, 2=completed, 3=failed
        defaultValue: 0,
      },
      current_stage: {
        type: Sequelize.SMALLINT,   // 0=stage1a, 1=stage1b, 2=stage2, 3=finalize
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      }
    });

    // 2. copy_job_tables
    await queryInterface.createTable('copy_job_tables', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      job_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'copy_jobs',
          key: 'id',
        },
        onDelete: 'CASCADE',
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
        type: Sequelize.STRING(50), // optional grouping label
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
      skipped_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      status: {
        type: Sequelize.SMALLINT,   // 0=pending, 1=running, 2=completed, 3=failed
        defaultValue: 0,
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      }
    });

    // 3. copy_job_audit
    await queryInterface.createTable('copy_job_audit', {
      id: {
        type: Sequelize.BIGINT,     // BIGINT for large audit volume
        autoIncrement: true,
        primaryKey: true,
      },
      job_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'copy_jobs',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      table_name: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      source_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      target_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      action: {
        type: Sequelize.SMALLINT,    // 0=inserted, 1=skipped, 2=failed
        allowNull: true,
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      }
    });

    // 4. copy_job_chunk_table_map
    await queryInterface.createTable('copy_job_chunk_table_map', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      copy_job_table_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'copy_job_tables',   // assumes your parent table is named copy_job_tables
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
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('copy_job_audit');
    await queryInterface.dropTable('copy_job_tables');
    await queryInterface.dropTable('copy_jobs');
    await queryInterface.dropTable('copy_job_chunk_table_map');

  }
};
