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