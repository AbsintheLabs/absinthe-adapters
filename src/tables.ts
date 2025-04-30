import { Table, Column, Compression, Types } from '@subsquid/file-store-parquet'

export const Tokens = new Table(
    'tokens.parquet',
    {
        blockNumber: Column(Types.Uint32()),
        from: Column(Types.String()),
        to: Column(Types.String()),
        value: Column(Types.Decimal(38, 0)),
        txnHash: Column(Types.String()),
        id: Column(Types.String()),
    },
    { compression: 'UNCOMPRESSED' }
    // // @ts-ignore -- known bug in file-store-parquet
    // { compression: 6 },
)

export const Balances = new Table(
    'balances.parquet',
    {
        address: Column(Types.String()),
        balance: Column(Types.Decimal(38, 0)),
        windowStartTs: Column(Types.Uint64()),
        windowEndTs: Column(Types.Uint64()),
    },
    { compression: 'UNCOMPRESSED' }
)