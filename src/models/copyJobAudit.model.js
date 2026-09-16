module.exports = (sequelize, Sequelize, CopyJob) => {
    const CopyJobAudit = sequelize.define("CopyJobAudit", {
        id: {
            type: Sequelize.BIGINT,     // BIGINT for large audit volume
            primaryKey: true,
            autoIncrement: true,
        },
        job_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: CopyJob,   // references CopyJob table
                key: 'id'
            },
            onDelete: 'CASCADE'
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
        }
    }, {
        tableName: 'copy_job_audit'
    });

    return CopyJobAudit;
};
