import * as fs from 'fs';
import * as path from 'path';

// Load and export Avro schemas as JSON objects
const schemaPath = __dirname;

export const baseSchema = JSON.parse(
    fs.readFileSync(path.join(schemaPath, 'base.avsc'), 'utf8')
);

export const transactionSchema = JSON.parse(
    fs.readFileSync(path.join(schemaPath, 'transaction.avsc'), 'utf8')
);

export const timeWeightedBalanceSchema = JSON.parse(
    fs.readFileSync(path.join(schemaPath, 'timeWeightedBalance.avsc'), 'utf8')
);

// Export all schemas as a collection
export const schemas = {
    base: baseSchema,
    transaction: transactionSchema,
    timeWeightedBalance: timeWeightedBalanceSchema
};

// Export schema file paths for direct file access
export const schemaPaths = {
    base: path.join(schemaPath, 'base.avsc'),
    transaction: path.join(schemaPath, 'transaction.avsc'),
    timeWeightedBalance: path.join(schemaPath, 'timeWeightedBalance.avsc')
};