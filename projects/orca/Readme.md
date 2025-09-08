## 🚀 **ENG-2165: Implement Modular Instruction Processing Architecture for Orca Protocol**

### 📋 **Overview**

This PR implements a comprehensive refactoring of the Orca protocol adapter to support modular instruction processing, enabling better maintainability, extensibility, and testing capabilities for different types of Whirlpool instructions.

### �� **Core Changes**

#### **1. BatchProcessor.ts - Major Architecture Overhaul**

- **Refactored class structure**: Converted from functional approach to class-based `OrcaProcessor` with proper dependency injection
- **Modular instruction handling**: Implemented separate processing methods for different instruction types:
  - `processSwapInstructions()` - Handles swap and two-hop swap operations
  - `processLiquidityInstructions()` - Manages liquidity increase/decrease operations
  - `processFeeInstructions()` - Processes fee collection operations
  - `processPositionInstructions()` - Handles position opening/closing operations
  - `processPoolInstructions()` - Manages pool initialization and management
  - `processTransferInstructions()` - Processes token transfer operations
- **Enhanced logging**: Added comprehensive logging for batch processing with block-level granularity
- **Schema management**: Implemented dynamic schema name generation using MD5 hash of protocol configuration

#### **2. Main.ts - Entry Point Refactoring**

- **Cleaner initialization**: Streamlined environment validation and processor instantiation
- **Configuration management**: Improved chain configuration handling with proper typing
- **Processor lifecycle**: Better management of processor instance and execution flow

#### **3. Processor.ts - Data Source Configuration**

- **Comprehensive instruction coverage**: Added support for all major Whirlpool instruction types:
  - Swap operations (swap, swapV2, twoHopSwap, twoHopSwapV2)
  - Liquidity operations (increaseLiquidity, decreaseLiquidity, V2 variants)
  - Fee operations (collectFees, collectProtocolFees, collectReward, V2 variants)
  - Position operations (openPosition, closePosition, with extensions and metadata)
  - Pool operations (initializePool, initializePoolV2)
- **Enhanced data selection**: Improved instruction filtering and data inclusion for better processing efficiency

#### **4. Schema.ts - Configuration Validation**

- **Zod schema implementation**: Added robust configuration validation using Zod for type safety
- **Protocol configuration**: Defined schema for Orca protocol-specific configuration parameters
- **Required fields**: Ensures all necessary configuration parameters are present and valid

#### **5. Types.ts - Comprehensive Type System**

- **Enhanced type definitions**: Added detailed interfaces for all instruction types:
  - `BaseInstructionData` - Common instruction properties
  - `SwapData` - Swap-specific instruction data
  - `TwoHopSwapData` - Two-hop swap instruction data
  - `LiquidityData` - Liquidity management instruction data
  - `FeeData` - Fee collection instruction data
  - `RewardData` - Reward collection instruction data
  - `PositionData` - Position management instruction data
  - `TransferData` - Token transfer instruction data
- **Protocol state management**: Added `ProtocolStateOrca` interface for managing balance windows and transactions
- **Token balance tracking**: Enhanced `TokenBalance` interface for comprehensive balance monitoring
