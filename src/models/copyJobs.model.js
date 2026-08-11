module.exports = (sequelize, Sequelize, Users) => {
    const CopyJob = sequelize.define("CopyJob", {
        id: {
            type: Sequelize.INTEGER,   // INT is enough
            primaryKey: true,
            autoIncrement: true,
        },
        admin_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: Users,
                key: 'id'
            }
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
            type: Sequelize.STRING(10),   // e.g. "2024-2025"
            allowNull: true,
        },
        status: {
            type: Sequelize.SMALLINT,   // 0=pending, 1=running, 2=completed, 3=failed
            defaultValue: 0,
        },
        current_stage: {
            type: Sequelize.SMALLINT,   // 0=stage1a, 1=stage1b, 2=stage2, 3=finalize
            allowNull: true,
        }
    }, {
        tableName: 'copy_jobs'
    });

    return CopyJob;
};
