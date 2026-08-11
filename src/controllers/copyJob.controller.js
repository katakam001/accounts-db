// controllers/copyJob.controller.js
const { getDb } = require("../utils/getDb");
const createJobService = require("../services/copyJob/stages/prestage/createJob.service");
const prepareStage1a = require("../services/copyJob/stages/stage1a/prepareTables.service");
const entryService = require('../services/entry.service');


// Get all jobs for an admin
exports.getAllJobs = async (req, res) => {
  try {
    const db = getDb();
    const CopyJob = db.copyJob;
    const Users = db.user;

    const adminId = req.userId;
    if (!adminId) {
      return res.status(400).json({ error: "adminId is required" });
    }

    const jobs = await CopyJob.findAll({
      where: { admin_id: adminId },
      include: [
        {
          model: Users,
          as: 'sourceUser',
          attributes: [['username', 'source_user_name']]
        },
        {
          model: Users,
          as: 'targetUser',
          attributes: [['username', 'target_user_name']]
        }
      ],
      order: [["createdAt", "DESC"]],
    });

    const formattedJobs = jobs.map(job => {
      const plain = job.get({ plain: true });
      return {
        id: plain.id,
        admin_id: plain.admin_id,
        source_user_id: plain.source_user_id,
        target_user_id: plain.target_user_id,
        from_date: plain.from_date,
        to_date: plain.to_date,
        financial_year: plain.financial_year,
        status: plain.status,
        current_stage: plain.current_stage,
        source_user_name: plain.sourceUser?.source_user_name,
        target_user_name: plain.targetUser?.target_user_name
      };
    });

    res.status(200).json(formattedJobs);
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).json({ error: error.message });
  }
};

// Create a new copy job (PreStage initialization)
exports.createJob = async (req, res) => {
  const db = getDb();
  const transaction = await db.sequelize.transaction();

  try {
    const adminId = req.userId;
    const jobId = await createJobService(adminId, req.body, db, transaction);

    await transaction.commit();

    let s3Key;
    let stage1aTx;   // ✅ declare outside

    try {
      stage1aTx = await db.sequelize.transaction();
      const result = await prepareStage1a(jobId, db, stage1aTx);
      await stage1aTx.commit();
      s3Key = result.s3Key;

      return res.status(201).json({ jobId, s3Key });
    } catch (stage1aError) {
      console.error("Stage1a failed:", stage1aError);

      // ✅ rollback only if still active
      if (stage1aTx && !stage1aTx.finished) {
        await stage1aTx.rollback();
      }

      const failedJob = await db.copyJob.findByPk(jobId);
      return res.status(202).json({
        jobId,
        stage1aStatus: "failed",
        status: failedJob.status,
        error: failedJob.error_message || stage1aError.message
      });
    }
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    console.error("Error creating job:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
    });
  }
};

exports.retryJob = async (req, res) => {
  try {
    const jobId = req.params.id;
    // Dummy retry logic for now
    console.log(`Retrying job ${jobId}...`);
    res.status(200).json({ message: `Retry triggered for job ${jobId}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.triggerLedgerForCopyJob = async (req, res) => {
  const jobId = req.params.id;

  const db = getDb();
  const CopyJob = db.copyJob; // 👈 use your copyJob model instead of uploadHistory
  const transaction = await db.sequelize.transaction();

  try {
    const job = await CopyJob.findByPk(jobId, { transaction });

    if (!job) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Copy job not found' });
    }

    // Only trigger ledger when stage is complete (status 7 for example)
    if (job.current_stage === 7 && job.status === 2) {
      // 👇 pass target_user_id and financial_year from job record
      await entryService.runCashSalesLedgerJob(job.target_user_id, job.financial_year, transaction);

      await job.update(
        { current_stage: 8, status: 2 },
        { transaction }
      ); // mark as ledger processed

      await transaction.commit();
      return res.json({ message: 'Ledger job triggered successfully' });
    }

    await transaction.rollback();
    return res.status(400).json({ error: 'Copy job not eligible for ledger job' });
  } catch (error) {
    await transaction.rollback();
    console.error('Ledger job error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


