// adapters/index.ts - Central registration point for all adapters
// Import and register all adapters so they are available in the registry

// XXX: rather than importing, we should dynamically load the adapters by calling require and registering them
// XXX: out of a directory
// import './univ3'; // Registers the uniswap-v3 adapter
// import './demosVerify'; // Registers the demos-verify adapter
import './aavev3.ts'; // Registers the aave-v3 adapter
// import './ichi'; // Registers the ichi adapter
import './univ2.ts'; // Registers the uniswap-v2 adapter

// Export the registry for convenience
export {
  buildAdapter,
  getAvailableAdapters,
  getAdapterSchema,
  listAdapters,
} from '../adapter-registry.ts';
