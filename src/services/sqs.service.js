const { SQSClient, GetQueueAttributesCommand, ReceiveMessageCommand, DeleteMessageBatchCommand } = require("@aws-sdk/client-sqs");
const uploadService = require("../services/upload.service");
const sqs = new SQSClient({ region: "ap-south-2" });
require('dotenv').config();
const invoiceUtils = require('../utils/invoiceUtils');
const { fetchCategories } = require('../services/category.service');
const { getAllItems } = require('../services/items.service');
const cache = require("../services/cache.service"); // ✅ Import shared cache service

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
        const isInvoiceProcessing = attributes.type?.StringValue && attributes.taxType?.StringValue;
        const type = isInvoiceProcessing
            ? `${attributes.type.StringValue}-${attributes.taxType.StringValue}`
            : attributes.statementType?.StringValue;

        const transactionData = JSON.parse(message.Body);
        const isStatement = type === "bank";
        const key = isStatement
            ? `${userId}_${financialYear}_${parseInt(attributes.accountId.StringValue)}`
            : `${userId}_${financialYear}_${type}`;

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
    const [userId, financialYear, typeOrAccountId] = key.split("_").map(val => isNaN(val) ? val : parseInt(val));

    const validCSVIdentifiers = ['1-cgst', '1-igst', '2-cgst', '2-igst'];
    const isCSVInvoice = validCSVIdentifiers.includes(typeOrAccountId);
    const isTrailBalance = typeOrAccountId === "trialBalance";
    const accountId = isCSVInvoice || isTrailBalance ? null : typeOrAccountId;


    const validTypes = ['1', '2'];
    const validTaxTypes = ['cgst', 'igst'];

    let type = null;
    let taxType = null;



    if (isCSVInvoice && typeof typeOrAccountId === 'string') {
        const [typePart, taxPart] = typeOrAccountId.split('-');

        if (validTypes.includes(typePart) && validTaxTypes.includes(taxPart)) {
            type = parseInt(typePart, 10); // Now a proper number: 1 or 2
            taxType = taxPart;             // 'cgst' or 'igst'
        }
    }

    console.log(`Processing ${isCSVInvoice ? "CSV Invoices" : "PDF"} for User: ${userId}, Financial Year: ${financialYear}, Account ID: ${accountId || "N/A"}`);

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
            financialYear
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
    } else {
        // ✅ Process CSV invoices
        await loadAndCacheInvoiceData(userId, financialYear, type, cachedData);

        await uploadService.processInvoiceTransactions({
            extractedData: transactionRecords[typeOrAccountId],
            categoryAccountMap: cachedData[type === 1 ? "purchaseCategoryAccountMap" : "saleCategoryAccountMap"],
            accountMap: cachedData.accountMap,
            categoryMap: cachedData[type === 1 ? "purchaseCategoryMap" : "saleCategoryMap"],
            itemsMap: cachedData.itemsMap,
            unitIdMap: cachedData[type === 1 ? "purchaseUnitIdMap" : "saleUnitIdMap"],
            dynamicFieldsMap: cachedData[type === 1 ? "purchaseDynamicFieldsMap" : "saleDynamicFieldsMap"],
            suspenseAccountName: suspenseAccountName.toLowerCase(),
            userId,
            financialYear,
            type,
            taxType
        });
    }
}


// 🔹 Function to load and cache invoice data
async function loadAndCacheInvoiceData(userId, financialYear, type, cachedData) {
    const selectedPrefix = type === 1 ? "purchase" : "sale"; // ✅ Load only the required cache

    if (!cachedData[`${selectedPrefix}Account`]) {
        cachedData[`${selectedPrefix}Account`] = await uploadService.getAccountsByGroup({
            group_name: type === 1 ? "Purchase Account" : "Sale Account",
            user_id: userId,
            financial_year: financialYear
        });
        cachedData[`${selectedPrefix}CategoryAccountMap`] = invoiceUtils.categorizeAccountsByGstRate(cachedData[`${selectedPrefix}Account`]);
    }

    if (!cachedData[`${selectedPrefix}CategoryMap`]) {
        cachedData[`${selectedPrefix}Categories`] = await fetchCategories({ type, userId, financialYear });
        cachedData[`${selectedPrefix}CategoryMap`] = invoiceUtils.categorizeCategoriesByGstRate(cachedData[`${selectedPrefix}Categories`]);
    }

    if (!cachedData.itemsMap) {
        cachedData.items = await getAllItems({ userId, financialYear });
        cachedData.itemsMap = invoiceUtils.categorizeItemsByGstRate(cachedData.items);
    }

    const categoryIds = Array.from(cachedData[`${selectedPrefix}CategoryMap`]?.values() || []);

    if (!cachedData[`${selectedPrefix}UnitIdMap`]) {
        cachedData[`${selectedPrefix}UnitIdMap`] = await uploadService.fetchUnitIdsByCategoryIds({ categoryIds });
    }

    if (!cachedData[`${selectedPrefix}DynamicFieldsMap`]) {
        cachedData[`${selectedPrefix}DynamicFieldsMap`] = await uploadService.fetchDynamicFieldsByCategoryIds({ categoryIds });
    }

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
