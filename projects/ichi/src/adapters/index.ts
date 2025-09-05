// adapters/index.ts - Central registration point for all adapters
// Import and register all adapters so they are available in the registry

import './univ3'; // Registers the uniswap-v3 adapter

// Future adapters can be imported here:
// import './compound';
// import './aave';
// import './maker';
// etc.

// Export the registry for convenience
export {
  buildAdapter,
  getAvailableAdapters,
  getAdapterSchema,
  listAdapters,
} from '../adapter-registry';
