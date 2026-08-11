// constantsUtils.js

const Constants = {
  AUDIT_ACTIONS: {
    STAGE1A: {
      INSERT_COPYJOB: 0,
      DELETE_COPYJOB: 1,
      SKIP_COPYJOB: 2,
      FAIL_COPYJOB: 3
    },
    STAGE1B: {
      INSERT_COPYJOB: 0,
      DELETE_COPYJOB: 1,
      SKIP_COPYJOB: 2,
      FAIL_COPYJOB: 3
    },
    STAGE1C: {
      INSERT_COPYJOB: 0,
      DELETE_COPYJOB: 1,
      SKIP_COPYJOB: 2,
      FAIL_COPYJOB: 3
    },
    STAGE2A: {
      INSERT_COPYJOB: 0,
      DELETE_COPYJOB: 1,
      SKIP_COPYJOB: 2,
      FAIL_COPYJOB: 3
    },
    STAGE2B: {
      INSERT_COPYJOB: 0,
      DELETE_COPYJOB: 1,
      SKIP_COPYJOB: 2,
      FAIL_COPYJOB: 3
    },
    STAGE2C: {
      INSERT_COPYJOB: 0,
      DELETE_COPYJOB: 1,
      SKIP_COPYJOB: 2,
      FAIL_COPYJOB: 3
    },
    STAGE2D: {
      INSERT_COPYJOB: 0,
      DELETE_COPYJOB: 1,
      SKIP_COPYJOB: 2,
      FAIL_COPYJOB: 3
    }
  },

  STAGE_IDS: {
    PRESTAGE: 0,
    STAGE1A: 1,
    STAGE1B: 2,
    STAGE1C: 3,
    STAGE2A: 4,
    STAGE2B: 5,
    STAGE2C: 6,
    STAGE2D: 7
  },

  JOB_STATUS: {
    PENDING: 0,       // Stage not yet prepared
    IN_PROGRESS: 1,   // Stage prepared, consumer processing ongoing
    SUCCESS: 2,       // Stage completed successfully
    FAILURE: 3        // Stage failed
  }

  // 🔹 Add more constant groups here as needed
};

module.exports = Constants;
