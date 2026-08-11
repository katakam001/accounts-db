const { checkQueueDepth, monitorQueueAndConsume } = require("./sqs.service");

// src/services/monitor.service.js
let isMonitoringActive = false;

exports.startMonitoring = async function() { 
    if (isMonitoringActive) {
        console.log("Monitoring is already running!");
        return { message: "Monitoring is already running!" };
    }

    console.log("Starting queue monitoring...");
    isMonitoringActive = true;

    const resetMonitoringFlag = () => { isMonitoringActive = false; };

    const waitForMessages = async () => {
        let retries = 0;
        while (retries < 6) {
            const messageCount = await checkQueueDepth();
            if (messageCount > 0) {
                console.log("Messages detected in SQS. Starting consumer...");
                monitorQueueAndConsume(messageCount, resetMonitoringFlag);
                return;
            }
            console.log("Waiting for Lambda to complete processing...");
            await new Promise(resolve => setTimeout(resolve, 30000));
            retries++;
        }
        console.log("No messages found after retries. Monitoring skipped.");
        isMonitoringActive = false;
    };

    setTimeout(waitForMessages, 0);
    return { message: "Monitoring will start when messages are available in SQS!" };
};
