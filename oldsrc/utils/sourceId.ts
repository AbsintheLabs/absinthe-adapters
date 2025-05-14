import { createHash } from 'crypto';
import { DataSource } from '../interfaces';

/**
 * Generates a deterministic source ID from data source components
 * 
 * @param chainId The network ID
 * @param protocolName Protocol identifier
 * @param poolAddress Contract address of the pool/token (lowercased)
 * @param adapterVersion Adapter version string
 * @returns A deterministic source ID hash
 */
export function generateSourceId(
    chainId: number,
    protocolName: string,
    poolAddress: string,
    adapterVersion: string
): string {
    // Ensure consistent casing
    const normalizedPoolAddress = poolAddress.toLowerCase();
    const normalizedProtocolName = protocolName.toLowerCase();

    // Create a deterministic string to hash
    const sourceString = `${chainId}:${normalizedProtocolName}:${normalizedPoolAddress}:${adapterVersion}`;

    // Generate SHA-256 hash
    return createHash('sha256').update(sourceString).digest('hex');
}

/**
 * Creates a DataSource object with a deterministic sourceId
 * 
 * @param chainId The network ID
 * @param protocolName Protocol identifier
 * @param poolAddress Contract address of the pool/token
 * @param adapterVersion Adapter version string
 * @param runnerId Optional runner instance ID
 * @param metadata Optional metadata
 * @returns A complete DataSource object
 */
export function createDataSource<M = unknown>(
    chainId: number,
    protocolName: string,
    poolAddress: string,
    adapterVersion: string,
    runnerId?: string,
    metadata?: M
): DataSource<M> {
    // Normalize addresses and protocol names for consistency
    const normalizedPoolAddress = poolAddress.toLowerCase();
    const normalizedProtocolName = protocolName.toLowerCase();

    return {
        sourceId: generateSourceId(chainId, normalizedProtocolName, normalizedPoolAddress, adapterVersion),
        chainId,
        protocolName: normalizedProtocolName,
        poolAddress: normalizedPoolAddress,
        adapterVersion,
        runnerId,
        metadata
    };
}

// /**
//  * Validates if a data source is fully formed with required fields
//  * 
//  * @param source DataSource object to validate
//  * @returns True if the source has all required fields
//  */
// export function isValidDataSource(source: Partial<DataSource>): source is DataSource {
//     return !!(
//         source.sourceId &&
//         source.chainId !== undefined &&
//         source.protocolName &&
//         source.poolAddress &&
//         source.adapterVersion
//     );
// }

// /**
//  * Verifies the integrity of a data source by checking if the sourceId matches the expected hash
//  * 
//  * @param source DataSource to verify
//  * @returns True if the sourceId matches the expected hash
//  */
// export function verifyDataSourceIntegrity(source: DataSource): boolean {
//     const expectedSourceId = generateSourceId(
//         source.chainId,
//         source.protocolName,
//         source.poolAddress,
//         source.adapterVersion
//     );

//     return source.sourceId === expectedSourceId;
// } 