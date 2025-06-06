import { TypeormDatabase } from "@subsquid/typeorm-store";
import { processor } from "./processor";

import { validateEnv, AbsintheApiClient } from "@absinthe/common";
import { logger } from "@absinthe/common";
import * as hemiStakingAbi from './abi/launchPool';
import fs from 'fs';
import path from 'path';

// Validate environment variables at the start
const env = validateEnv();
// Create Absinthe API client for sending data
const apiClient = new AbsintheApiClient({
    baseUrl: env.absintheApiUrl,
    apiKey: env.absintheApiKey
});

// Extract processor configuration for JSON files
const processorConfig = {
    rpcEndpoint: "https://rpc.hemi.network/rpc",
    blockRange: { 
        from: 1931561, 
        to: 1931630 
    },
    contractAddress: "0x4f5e928763cbfaf5ffd8907ebbb0dabd5f78ba83",
    monitoredEvents: [
        hemiStakingAbi.events.Deposit.topic, 
        hemiStakingAbi.events.Withdraw.topic
    ]
};

// Set environment variables for file writers
process.env.FROM_BLOCK = processorConfig.blockRange.from.toString();
process.env.TO_BLOCK = processorConfig.blockRange.to.toString();
process.env.CONTRACT_ADDRESS = processorConfig.contractAddress;

// Define function to write JSON to file
function writeJsonToFile(filename: string, data: any): void {
    try {
        const dir = path.dirname(filename);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filename, JSON.stringify(data, null, 2));
        console.log(`Data written to ${filename}`);
    } catch (error) {
        console.error(`Error writing to file ${filename}:`, error);
    }
}

const db = new TypeormDatabase({ supportHotBlocks: false });
processor.run(db, async (ctx) => {
    // [INIT] batch state
    logger.info(`Processing batch with ${ctx.blocks.length} blocks`);

    // Prepare data for transaction file
    let transactions = [];
    let blockInfo = {
        startBlock: ctx.blocks.length > 0 ? ctx.blocks[0].header.height : 0,
        endBlock: ctx.blocks.length > 0 ? ctx.blocks[ctx.blocks.length - 1].header.height : 0,
        totalBlocks: ctx.blocks.length,
        blockWithLogs: 0
    };

    // [LOOP] process each block
    for (let block of ctx.blocks) {
        logger.info(`Processing block #${block.header.height} with ${block.logs.length} logs`);
        
        if (block.logs.length > 0) {
            blockInfo.blockWithLogs += 1;
        }

        for (let log of block.logs) {
            // Detailed logging of each log entry
            logger.info(`Log data: ${JSON.stringify({
                address: log.address,
                transactionHash: log.transactionHash,
                topics: log.topics,
                blockNumber: block.header.height
            })}`);
            
            // Try to decode events based on topic signatures
            try {
                if (log.topics[0] === hemiStakingAbi.events.Deposit.topic) {
                    const decodedData = hemiStakingAbi.events.Deposit.decode(log);
                    logger.info(`Decoded Deposit event: ${JSON.stringify({
                        eventId: decodedData.eventId.toString(),
                        depositor: decodedData.depositor,
                        token: decodedData.token,
                        amount: decodedData.amount.toString()
                    })}`);
                    
                    // Add to transactions array for JSON file
                    transactions.push({
                        blockNumber: block.header.height,
                        transactionHash: log.transactionHash,
                        event: "Deposit",
                        data: {
                            token: decodedData.token,
                            amount: decodedData.amount.toString(),
                            depositor: decodedData.depositor
                        },
                        timestamp: new Date().toISOString(),
                        status: "processed"
                    });
                } 
                else if (log.topics[0] === hemiStakingAbi.events.Withdraw.topic) {
                    const decodedData = hemiStakingAbi.events.Withdraw.decode(log);
                    logger.info(`Decoded Withdraw event: ${JSON.stringify({
                        eventId: decodedData.eventId.toString(),
                        withdrawer: decodedData.withdrawer,
                        token: decodedData.token,
                        amount: decodedData.amount.toString()
                    })}`);
                    
                    // Add to transactions array for JSON file
                    transactions.push({
                        blockNumber: block.header.height,
                        transactionHash: log.transactionHash,
                        event: "Withdraw",
                        data: {
                            token: decodedData.token,
                            amount: decodedData.amount.toString(),
                            withdrawer: decodedData.withdrawer
                        },
                        timestamp: new Date().toISOString(),
                        status: "processed"
                    });
                }
            } catch (error) {
                logger.error(`Failed to decode event data: ${error}`);
            }
        }
    }

    // [FINAL] save state
    logger.info(`Finished processing batch`);
    
    // Update JSON files
    const callData = {
        processorConfig: {
            rpcEndpoint: processorConfig.rpcEndpoint,
            blockRange: processorConfig.blockRange,
            contractAddress: processorConfig.contractAddress,
            monitoredEvents: processorConfig.monitoredEvents,
        },
        blocksProcessed: blockInfo,
        environment: {
            db: { url: process.env.DB_URL },
            rpc: { url: process.env.RPC_URL },
        },
        stakingProtocol: {
            type: "hemi",
            name: "HEMI Staking",
            contractAddress: processorConfig.contractAddress,
            fromBlock: processorConfig.blockRange.from,
            token: { coingeckoId: "weth", decimals: 18 },
        },
        timestamp: new Date().toISOString(),
        status: "success"
    };
    
    const transactionData = {
        transactions: transactions.length > 0 ? transactions : [{
            blockNumber: 0,
            transactionHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
            event: "Deposit",
            data: {
                token: "0x4200000000000000000000000000000000000006",
                amount: "0",
                depositor: "0x0000000000000000000000000000000000000000"
            },
            timestamp: new Date().toISOString(),
            status: "no_logs_found"
        }],
        summary: {
            blockRange: processorConfig.blockRange,
            contractAddress: processorConfig.contractAddress,
            totalTransactions: transactions.length,
            note: transactions.length > 0 
                ? "Transaction logs were found and processed successfully" 
                : "No transaction logs were found in the processed blocks"
        }
    };    
    // send events to API
})