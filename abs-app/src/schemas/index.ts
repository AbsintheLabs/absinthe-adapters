import * as fs from 'fs';
import * as path from 'path';
import * as avro from 'avsc';

const schemaPath = path.join(__dirname); // assumes the .avsc files are here

export const baseSchema = avro.parse(fs.readFileSync(path.join(schemaPath, 'base.avsc'), 'utf8'));

export const transactionSchema = avro.parse(
  fs.readFileSync(path.join(schemaPath, 'transaction.avsc'), 'utf8'),
);

export const timeWeightedBalanceSchema = avro.parse(
  fs.readFileSync(path.join(schemaPath, 'timeWeightedBalance.avsc'), 'utf8'),
);
