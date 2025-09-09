// adapters/index.ts - Central registration point for all adapters
// Import and register all adapters so they are available in the registry

import './univ3'; // Registers the uniswap-v3 adapter
import './demosVerify'; // Registers the demos-verify adapter
import './aavev3'; // Registers the aave-v3 adapter
import './ichi'; // Registers the ichi adapter
import './univ2'; // Registers the uniswap-v2 adapter

// Future adapters can be imported here:
// import './compound';
// import './maker';
// etc.

// Export the registry for convenience
export {
  buildAdapter,
  getAvailableAdapters,
  getAdapterSchema,
  listAdapters,
} from '../adapter-registry';
