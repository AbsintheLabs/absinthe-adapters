// Human-controlled account detector with Redis caching
// Determines if an address is controlled by humans vs. protocol contracts
//
// Includes:
// - Standard EOAs (0x code)
// - EIP-7702 Delegated EOAs (0xef01 prefix)
// - ERC-4337 Smart Accounts (validateUserOp selector)
//
// Excludes:
// - Protocol contracts (Uniswap pools, Aave vaults, etc.)

import { Redis } from 'ioredis';
import { createPublicClient, http, type Address } from 'viem';

export interface EoaDetector {
  isEoa(address: string): Promise<boolean>;
  isHumanControlled(address: string): Promise<boolean>;
}

export class RedisEoaDetector implements EoaDetector {
  private client: ReturnType<typeof createPublicClient>;

  // ERC-4337 validateUserOp function selector
  private static readonly VALIDATE_USER_OP_SELECTOR = '3a871cdd';

  // EIP-7702 delegation designation prefix
  private static readonly EIP_7702_PREFIX = '0xef01';

  // Redis cache key prefix for user-controlled accounts
  private static readonly USER_CONTROLLED_PREFIX = 'user-controlled';

  constructor(
    private redis: Redis,
    rpcUrl: string,
  ) {
    // Create viem public client for eth_getCode calls
    this.client = createPublicClient({
      transport: http(rpcUrl),
    });
  }

  /**
   * Check if an address is an EOA (Externally Owned Account).
   * Uses Redis sets for caching to avoid repeated RPC calls.
   *
   * @param address - The address to check (lowercase recommended)
   * @returns true if the address is an EOA (no bytecode), false if it's a contract
   * @deprecated Use isHumanControlled for better detection of user accounts
   */
  async isEoa(address: string): Promise<boolean> {
    const normalizedAddress = address.toLowerCase();

    // Check cache first - EOAs stored in set
    const isInEoaSet = await this.redis.sismember('eoa', normalizedAddress);
    if (isInEoaSet) {
      return true;
    }

    // Check if it's a known contract
    const isInContractSet = await this.redis.sismember('contract', normalizedAddress);
    if (isInContractSet) {
      return false;
    }

    // Not in cache - fetch from RPC
    const code = await this.client.getCode({
      address: normalizedAddress as Address,
      blockTag: 'latest',
    });

    // EOA has code "0x" or undefined
    const isEoa = !code || code === '0x';

    // Store in appropriate Redis set
    if (isEoa) {
      await this.redis.sadd('eoa', normalizedAddress);
    } else {
      await this.redis.sadd('contract', normalizedAddress);
    }

    return isEoa;
  }

  /**
   * Check if an address is human-controlled (EOA, EIP-7702, or ERC-4337 smart account).
   * Uses Redis sets for caching to avoid repeated RPC calls.
   *
   * Includes:
   * 1. Standard EOAs (no bytecode)
   * 2. EIP-7702 Delegated EOAs (0xef01 prefix)
   * 3. ERC-4337 Smart Accounts (validateUserOp selector present)
   *
   * Excludes:
   * - Protocol contracts (Uniswap pools, Aave vaults, DAOs, etc.)
   *
   * Redis Sets Used:
   * - 'user-controlled:eoa' - Standard EOAs
   * - 'user-controlled:eip7702' - EIP-7702 delegated EOAs
   * - 'user-controlled:erc4337' - ERC-4337 smart accounts
   * - 'protocol' - Protocol contracts
   *
   * @param address - The address to check (lowercase recommended)
   * @returns true if the address is human-controlled, false if it's a protocol contract
   */
  async isHumanControlled(address: string): Promise<boolean> {
    const normalizedAddress = address.toLowerCase();

    // Check cache first - check all user-controlled sets
    const [isEoa, isEip7702, isErc4337, isProtocol] = await Promise.all([
      this.redis.sismember(`${RedisEoaDetector.USER_CONTROLLED_PREFIX}:eoa`, normalizedAddress),
      this.redis.sismember(`${RedisEoaDetector.USER_CONTROLLED_PREFIX}:eip7702`, normalizedAddress),
      this.redis.sismember(`${RedisEoaDetector.USER_CONTROLLED_PREFIX}:erc4337`, normalizedAddress),
      this.redis.sismember('protocol', normalizedAddress),
    ]);

    // If found in any user-controlled set, return true
    if (isEoa || isEip7702 || isErc4337) {
      return true;
    }

    // If found in protocol set, return false
    if (isProtocol) {
      return false;
    }

    // Not in cache - fetch from RPC
    const code = await this.client.getCode({
      address: normalizedAddress as Address,
      blockTag: 'latest',
    });

    let accountType: 'eoa' | 'eip7702' | 'erc4337' | 'protocol';

    // Case 1: Standard EOA (no code)
    if (!code || code === '0x') {
      accountType = 'eoa';
    }
    // Case 2: EIP-7702 Delegated EOA
    else if (code.toLowerCase().startsWith(RedisEoaDetector.EIP_7702_PREFIX)) {
      accountType = 'eip7702';
    }
    // Case 3: ERC-4337 Smart Account
    // Check for validateUserOp selector in bytecode
    else if (code.toLowerCase().includes(RedisEoaDetector.VALIDATE_USER_OP_SELECTOR)) {
      accountType = 'erc4337';
    }
    // Everything else is a protocol contract
    else {
      accountType = 'protocol';
    }

    // Store in appropriate Redis set
    switch (accountType) {
      case 'eoa':
        await this.redis.sadd(`${RedisEoaDetector.USER_CONTROLLED_PREFIX}:eoa`, normalizedAddress);
        break;
      case 'eip7702':
        await this.redis.sadd(
          `${RedisEoaDetector.USER_CONTROLLED_PREFIX}:eip7702`,
          normalizedAddress,
        );
        break;
      case 'erc4337':
        await this.redis.sadd(
          `${RedisEoaDetector.USER_CONTROLLED_PREFIX}:erc4337`,
          normalizedAddress,
        );
        break;
      case 'protocol':
        await this.redis.sadd('protocol', normalizedAddress);
        break;
    }

    return accountType !== 'protocol';
  }
}
