const { SQSClient, GetQueueAttributesCommand, ReceiveMessageCommand, DeleteMessageBatchCommand } = require("@aws-sdk/client-sqs");
const uploadService = require("../services/upload.service");
const sqs = new SQSClient({ region: process.env.AWS_REGION });
const invoiceUtils = require('../utils/invoiceUtils');
const { fetchCategories } = require('../services/category.service');
const { getAllItems } = require('../services/items.service');
const cache = require("../services/cache.service"); // ✅ Import shared cache service
const stageHelperService = require("./copyJob/stages/common/stageHelpers.service");
const processStage1aService = require("./copyJob/stages/stage1a/processStage.service");
const processStage1bService = require("./copyJob/stages/stage1b/processStage.service");
const processStage1cService = require("./copyJob/stages/stage1c/processStage.service");
const processStage2aService = require("./copyJob/stages/stage2a/processStage.service");
const processStage2bService = require("./copyJob/stages/stage2b/processStage.service");
const processStage2cService = require("./copyJob/stages/stage2c/processStage.service");
const processStage2dService = require("./copyJob/stages/stage2d/processStage.service");

async function monitorQueueAndConsume(messageCount, resetMonitoringFlag) {
    console.log(`Monitoring queue with ${messageCount} messages available...`);

    while (messageCount > 0) { // 🔹 Consumer starts processing based on initial count
        console.log(`${messageCount} messages detected! Starting consumer...`);
        await startConsumer();

        // 🔹 Check queue depth after processing to determine continuation
        messageCount = await checkQueueDepth();
    }

    console.log("Queue is empty. Stopping monitoring...");
    resetMonitoringFlag(); // ✅ Reset monitoring state here when queue is empty
}

async function startConsumer() {
    console.log("Consumer started. Polling messages...");

    while (true) {
        const params = {
            QueueUrl: process.env.SQS_QUEUE_URL,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 1,
            MessageAttributeNames: ["All"]
        };

        const { Messages } = await sqs.send(new ReceiveMessageCommand(params));

        if (!Messages?.length) {
            console.log("No new messages. Waiting...");
            break;
        }

        console.log(`Received ${Messages.length} messages`);

        const groupedMessages = groupMessages(Messages);

        // console.log(groupedMessages);

        for (const [key, transactionRecords] of groupedMessages) {
            await processGroupedTransactions(key, transactionRecords);
        }

        await deleteBatchMessages(Messages); // ✅ Batch delete after processing

        await new Promise(resolve => setTimeout(resolve, 5000)); // ✅ Dynamic backoff
    }
}

// 🔹 Function to group messages efficiently
function groupMessages(Messages) {
    const groupedMessages = new Map();

    Messages.forEach(message => {
        const attributes = message.MessageAttributes;
        const userId = parseInt(attributes.userId.StringValue);
        const financialYear = attributes.financialYear.StringValue;
        const fileType = attributes.fileType?.StringValue;
        const exportId = attributes.exportId?.StringValue;
        const stage = attributes.stage?.StringValue;
        const batchId = attributes.batchId?.StringValue;
        const messageType = attributes.messageType?.StringValue;
        const isInvoiceProcessing = attributes.type?.StringValue && attributes.taxType?.StringValue;

        let type = isInvoiceProcessing
            ? `${attributes.type.StringValue}-${attributes.taxType.StringValue}`
            : attributes.statementType?.StringValue;

        // ✅ Override type with fileType if exportId exists
        if (exportId) {
            type = parseInt(exportId);
        }
        if (messageType) {
            type = parseInt(batchId);
        }
        if (stage) {
            type = `${attributes.stage.StringValue}-${attributes.fileType.StringValue}`
        }
        if (stage && messageType) {
            type = `${attributes.stage.StringValue}-${attributes.batchId.StringValue}`
        }

        const transactionData = JSON.parse(message.Body);
        const isStatement = type === "bank";
        const key = exportId || messageType
            ? `${userId}_${financialYear}_${fileType}`
            : isStatement ? `${userId}_${financialYear}_${parseInt(attributes.accountId.StringValue)}_${parseInt(batchId)}`
                : `${userId}_${financialYear}_${type}_${parseInt(batchId)}`;

        if (!groupedMessages.has(key)) groupedMessages.set(key, {});

        const uniqueIdentifier = isStatement
            ? transactionData["TransactionId"]
            : type;

        if (!groupedMessages.get(key)[uniqueIdentifier]) {
            groupedMessages.get(key)[uniqueIdentifier] = [];
        }

        const dataToInsert = isStatement ? transactionData["Records"] : [transactionData]; // ✅ Wrap transactionData in an array

        groupedMessages.get(key)[uniqueIdentifier].push(...dataToInsert); // ✅ Spread only if `dataToInsert` is an array

    });

    return groupedMessages;
}

async function processGroupedTransactions(key, transactionRecords) {
    const suspenseAccountName = "Suspense Account";
    const exportTypes = ["daybook", "accountCopy", "ledger", "trailBalanceExport", "tradingAccount", "profitAndLoss", "tradingAccountProfitAndLoss", "horizontalBalanceSheet"];
    const uploadTypes = ["bankStatement", "trailBalanceUpload", "purchaseCgst", "purchaseIgst", "purchaseTcs", "creditSaleCgst", "creditSaleIgst", "cashSaleCgst", "cashSaleIgst", "creditNoteCgst", "creditNoteIgst", "debitNoteCgst", "debitNoteIgst", "carryForwardAccounts"];
    const excludeUploadTypesForSummary = ["carryForwardAccounts"];
    const [userId, financialYear, typeOrAccountId, batchId] = key.split("_").map(val => isNaN(val) ? val : parseInt(val));

    const validCSVIdentifiers = ['1-cgst', '1-igst', '1-tcs', '2-cgst', '2-igst', '5-cgst', '5-igst', '6-cgst', '6-igst', '8-cgst', '8-igst'];
    const validCopyJobStages = ['1-copyJob', '2-copyJob', '3-copyJob', '4-copyJob', '5-copyJob', '6-copyJob', '7-copyJob', '8-copyJob'];

    const isCSVInvoice = validCSVIdentifiers.includes(typeOrAccountId);
    const isTrailBalance = typeOrAccountId === "trailBalance";
    const iscarryForwardAccounts = typeOrAccountId === "carryForwardAccounts" && batchId;
    const isCopyJob = validCopyJobStages.includes(typeOrAccountId);
    const isExport = exportTypes.includes(typeOrAccountId);
    // 🔹 New exclusion list
    const isSummary = uploadTypes.includes(typeOrAccountId) && !excludeUploadTypesForSummary.includes(typeOrAccountId);
    const isCopySummary = typeOrAccountId === "copyJob";
    const isCarryForwardSummary = typeOrAccountId === "carryForwardAccounts" && !batchId;
    const accountId = isCSVInvoice || isTrailBalance || isExport || isSummary || isCopyJob || isCopySummary || iscarryForwardAccounts || isCarryForwardSummary ? null : typeOrAccountId;


    const validTypes = ['1', '2', '5', '6', '8'];
    const validTaxTypes = ['cgst', 'igst', 'tcs'];

    let type = null;
    let taxType = null;

    if (isCSVInvoice && typeof typeOrAccountId === 'string') {
        const [typePart, taxPart] = typeOrAccountId.split('-');

        if (validTypes.includes(typePart) && validTaxTypes.includes(taxPart)) {
            type = parseInt(typePart, 10); // Now a proper number: 1,2,5,6,8
            taxType = taxPart;             // 'cgst','igst','tcs'
        }
    }
    let stageNum = null;

    if (isCopyJob && typeof typeOrAccountId === 'string') {

        const parts = typeOrAccountId.split("-");
        const stageStr = parts[0];
        stageNum = parseInt(stageStr, 10);
    }


    console.log(`Processing ${isCSVInvoice ? "CSV Invoices" : "PDF"} for User: ${userId}, Financial Year: ${financialYear},batch Id :${batchId} || "N/A", Account ID: ${accountId || "N/A"}`);

    let cachedData;
    // console.log(cachedData);
    cachedData = cache.getCache(`${userId}_${financialYear}`) || {}
    // console.log(cachedData);
    await loadAndCacheAccountAndGroupMaps(userId, financialYear, cachedData);

    // console.log(accountMap);

    if (accountId !== null) {
        // ✅ Process PDFs
        await uploadService.processTransactions({
            groupedRecords: transactionRecords,
            accountMap: cachedData.accountMap,
            suspenseAccountName: suspenseAccountName.toLowerCase(),
            bankAccount: findBankAccountById(cachedData.accountMap, accountId),
            userId,
            financialYear,
            batchId
        });

    } else if (isTrailBalance) {
        await loadAndCacheMappingRuleMaps(userId, financialYear, cachedData);

        await uploadService.processOpeningBalance({
            trailBalanceRecords: transactionRecords[typeOrAccountId],
            userId,
            financialYear,
            accountMap: cachedData.accountMap,
            groupMap: cachedData.groupMap,
            groupMappingMap: cachedData.groupMappingMap,
            accountMappingMap: cachedData.accountMappingMap
        });
        cachedData.accountMap = await uploadService.loadAccountsWithGroupIds({ userId, financialYear });
        cache.setCache(`${userId}_${financialYear}`, cachedData, 3600);
    } else if (iscarryForwardAccounts) {

        await uploadService.processCarryForwardAccounts({
            carryForwardRecords: transactionRecords[typeOrAccountId],
            userId,
            financialYear,
            accountMap: cachedData.accountMap,
            groupMap: cachedData.groupMap,
            batchId
        });
        cachedData.accountMap = await uploadService.loadAccountsWithGroupIds({ userId, financialYear });
        cache.setCache(`${userId}_${financialYear}`, cachedData, 3600);
    } else if (isCarryForwardSummary) {

        await uploadService.processCarryForwardSummaryStatus({
            groupedRecords: transactionRecords
        });

    }else if (isExport) {

        await uploadService.processExportStatus({
            groupedRecords: transactionRecords,
            userId,
            financialYear,
        });

    } else if (isSummary) {

        await uploadService.processSummaryStatus({
            groupedRecords: transactionRecords
        });

    } else if (isCopyJob) {
        const records = transactionRecords[typeOrAccountId];

        if (stageNum === 1) {
            // Stage1a
            await processStage1aService.processStage1a({
                jobId: batchId,
                records
            });
        } else if (stageNum === 2) {
            // Stage1b
            await processStage1bService.processStage1b({
                jobId: batchId,
                records
            });
        } else if (stageNum === 3) {
            // Stage1c
            await processStage1cService.processStage1c({
                jobId: batchId,
                records
            });
        } else if (stageNum === 4) {
            // Stage2a
            await processStage2aService.processStage2a({
                jobId: batchId,
                records
            });
        } else if (stageNum === 5) {
            // Stage2b
            await processStage2bService.processStage2b({
                jobId: batchId,
                records
            });
        } else if (stageNum === 6) {
            // Stage2c
            await processStage2cService.processStage2c({
                jobId: batchId,
                records
            });
        } else if (stageNum === 7) {
            // Stage2c
            await processStage2dService.processStage2d({
                jobId: batchId,
                records
            });
        }
    } else if (isCopySummary) {
        await stageHelperService.processStageSummary({
            groupedRecords: transactionRecords
        });
    } else {
        // ✅ Process CSV invoices
        await loadAndCacheInvoiceData(userId, financialYear, type, cachedData);
        const accountPrefix =
            type === 1 ? "purchase" :
                type === 2 || type === 8 ? "sale" :
                    type === 5 ? "creditNote" :
                        type === 6 ? "debitNote" :
                            "unknown";

        await uploadService.processInvoiceTransactions({
            extractedData: transactionRecords[typeOrAccountId],
            categoryAccountMap: cachedData[`${accountPrefix}CategoryAccountMap`],
            accountMap: cachedData.accountMap,
            categoryMap: cachedData[type === 1 || type === 5 ? "purchaseCategoryMap" : "saleCategoryMap"],
            itemsMap: cachedData.itemsMap,
            unitIdMap: cachedData[type === 1 || type === 5 ? "purchaseUnitIdMap" : "saleUnitIdMap"],
            dynamicFieldsMap: cachedData[type === 1 || type === 5 ? "purchaseDynamicFieldsMap" : "saleDynamicFieldsMap"],
            suspenseAccountName: suspenseAccountName.toLowerCase(),
            userId,
            financialYear,
            type,
            taxType,
            batchId
        });
    }
}

// 🔹 Function to load and cache invoice data
async function loadAndCacheInvoiceData(userId, financialYear, type, cachedData) {
    // ✅ Prefix for account-related caching
    const accountPrefix =
        type === 1 ? "purchase" :
            type === 2 || type === 8 ? "sale" :
                type === 5 ? "creditNote" :
                    type === 6 ? "debitNote" :
                        "unknown";

    // ✅ Group name mapping for account fetch
    const groupName =
        type === 2 || type === 8 ? "Sale Account" :
            type === 1 ? "Purchase Account" :
                type === 6 ? "Debit Note Account" :
                    type === 5 ? "Credit Note Account" :
                        "Unknown Account";

    // ✅ Fetch and cache account data
    if (!cachedData[`${accountPrefix}Account`]) {
        cachedData[`${accountPrefix}Account`] = await uploadService.getAccountsByGroup({
            group_name: groupName,
            user_id: userId,
            financial_year: financialYear
        });
        cachedData[`${accountPrefix}CategoryAccountMap`] = invoiceUtils.categorizeAccountsByTaxRate(
            cachedData[`${accountPrefix}Account`]
        );
    }

    // ✅ Prefix for category/item/unit/dynamic field caching
    const selectedPrefix = type === 1 || type === 5 ? "purchase" : "sale";

    // ✅ Normalize type for category fetch
    const normalizedType = type === 2 || type === 6 || type === 8 ? 2 : 1;

    // ✅ Fetch and cache category data
    if (!cachedData[`${selectedPrefix}CategoryMap`]) {
        cachedData[`${selectedPrefix}Categories`] = await fetchCategories({
            type: normalizedType,
            userId,
            financialYear
        });
        cachedData[`${selectedPrefix}CategoryMap`] = invoiceUtils.categorizeCategoriesByTaxRate(
            cachedData[`${selectedPrefix}Categories`]
        );
    }

    // ✅ Fetch and cache item data
    if (!cachedData.itemsMap) {
        cachedData.items = await getAllItems({ userId, financialYear });
        cachedData.itemsMap = invoiceUtils.categorizeItemsByTaxRate(cachedData.items);
    }

    const categoryIds = Array.from(cachedData[`${selectedPrefix}CategoryMap`]?.values() || []);

    // ✅ Fetch and cache unit IDs
    if (!cachedData[`${selectedPrefix}UnitIdMap`]) {
        cachedData[`${selectedPrefix}UnitIdMap`] = await uploadService.fetchUnitIdsByCategoryIds({ categoryIds });
    }

    // ✅ Fetch and cache dynamic fields
    if (!cachedData[`${selectedPrefix}DynamicFieldsMap`]) {
        cachedData[`${selectedPrefix}DynamicFieldsMap`] = await uploadService.fetchDynamicFieldsByCategoryIds({ categoryIds });
    }

    // ✅ Final cache set
    cache.setCache(`${userId}_${financialYear}`, cachedData, 3600);
}

async function loadAndCacheAccountAndGroupMaps(userId, financialYear, cachedData) {


    if (!cachedData.accountMap) {
        cachedData.accountMap = await uploadService.loadAccountsWithGroupIds({ userId, financialYear });
    }

    if (!cachedData.groupMap) {
        cachedData.groupMap = await uploadService.loadGroupMap({ userId, financialYear });
    }

    // Save updated data back into cache
    cache.setCache(`${userId}_${financialYear}`, cachedData, 3600);

};

async function loadAndCacheMappingRuleMaps(userId, financialYear, cachedData) {
    if (!cachedData.groupMappingMap || !cachedData.accountMappingMap) {
        const records = await uploadService.loadMappingRuleRecords();

        const groupMappingMap = new Map();
        const accountMappingMap = new Map();

        for (const rule of records) {
            const normalizedSource = rule.source.toLowerCase().trim();
            const value = {
                target: rule.target,
                amount_mandatory: rule.amount_mandatory
            };

            if (rule.type === 0) {
                groupMappingMap.set(normalizedSource, value);
            } else if (rule.type === 1) {
                accountMappingMap.set(normalizedSource, value);
            }
        }

        cachedData.groupMappingMap = groupMappingMap;
        cachedData.accountMappingMap = accountMappingMap;

        cache.setCache(`${userId}_${financialYear}`, cachedData, 3600);
        console.log(`✅ Cached mappingRule maps for ${userId} ${financialYear}`);
    }
}

function findBankAccountById(accountMap, targetAccountId) {
    for (const [accountName, data] of accountMap) {
        if (data.accountId === targetAccountId) {
            return {
                accountId: data.accountId,
                accountName,
                groupId: data.groupId
            };
        }
    }
    return null; // Not found
}

async function checkQueueDepth() {
    try {
        const { Attributes } = await sqs.send(new GetQueueAttributesCommand({
            QueueUrl: process.env.SQS_QUEUE_URL,
            AttributeNames: ["ApproximateNumberOfMessages"]
        }));

        return parseInt(Attributes.ApproximateNumberOfMessages, 10) || 0; // Ensure valid number response
    } catch (error) {
        console.error("Error fetching queue depth:", error);
        return 0; // Return 0 if error occurs
    }
}

const deleteBatchMessages = async (Messages) => {
    const deleteParams = {
        QueueUrl: process.env.SQS_QUEUE_URL,
        Entries: Messages.map((message, index) => ({
            Id: index.toString(), // Unique ID for batch deletion
            ReceiptHandle: message.ReceiptHandle
        }))
    };

    if (deleteParams.Entries.length > 0) {
        await sqs.send(new DeleteMessageBatchCommand(deleteParams));
        console.log(`✅ Deleted ${deleteParams.Entries.length} messages in one request`);
    }
};

module.exports = { checkQueueDepth, monitorQueueAndConsume };
