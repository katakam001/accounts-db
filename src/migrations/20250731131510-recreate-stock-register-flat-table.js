'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 🔻 Drop child partitions
    const partitionTables = await queryInterface.sequelize.query(
      `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename LIKE 'stock_register_%'
        AND tablename != 'stock_register'
      `,
      { type: Sequelize.QueryTypes.SELECT }
    );

    for (const { tablename } of partitionTables) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS public."${tablename}" CASCADE`);
    }

    // 🔻 Drop parent partitioned table
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS public.stock_register CASCADE`);
    await queryInterface.sequelize.query(`DROP SEQUENCE IF EXISTS stock_register_new_id_seq CASCADE;`);

    // ✅ Recreate flat table with updated data types and new column
    await queryInterface.createTable('stock_register', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      item_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'items',
          key: 'id',
        },
      },
      entry_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      opening_balance: {
        type: Sequelize.NUMERIC(10, 4),
        allowNull: false,
      },
      quantity: {
        type: Sequelize.NUMERIC(10, 4),
        allowNull: false,
      },
      closing_balance: {
        type: Sequelize.NUMERIC(10, 4),
        allowNull: false,
      },
      entry_type: {
        type: Sequelize.STRING(20),
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
      dispatch_to_process: {
        type: Sequelize.NUMERIC(10, 4),
        allowNull: false,
        defaultValue: 0,
      },
      received_from_process: {
        type: Sequelize.NUMERIC(10, 4),
        allowNull: false,
        defaultValue: 0,
      },
      purchase: {
        type: Sequelize.NUMERIC(10, 4),
        allowNull: false,
        defaultValue: 0,
      },
      sales: {
        type: Sequelize.NUMERIC(10, 4),
        allowNull: false,
        defaultValue: 0,
      },
      sale_return: {
        type: Sequelize.NUMERIC(10, 4),
        allowNull: false,
        defaultValue: 0,
      },
      purchase_return: {
        type: Sequelize.NUMERIC(10, 4),
        allowNull: false,
        defaultValue: 0,
      }
    });

    // 🔒 Composite uniqueness constraint
    await queryInterface.addConstraint('stock_register', {
      fields: ['item_id', 'entry_date', 'user_id', 'financial_year'],
      type: 'unique',
      name: 'unique_stock_register',
    });

    // 📈 Indexes for performance
    await queryInterface.addIndex('stock_register', ['item_id'], {
      name: 'idx_stock_register_item_id',
    });

    await queryInterface.addIndex('stock_register', ['user_id'], {
      name: 'idx_stock_register_user_id',
    });

    await queryInterface.addIndex('stock_register', ['entry_date'], {
      name: 'idx_stock_register_entry_date',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('stock_register');
  },
};
