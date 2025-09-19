// enrichers/base/add-adapter-protocol.ts
import { Enricher } from '../core.ts';
import { getRuntime } from '../../runtime/context.ts';

type AdapterProtocolFields = {
  adapter_version: string | undefined; // keep shape you used
  protocol_name: string | undefined;
};

export const addAdapterProtocolMeta = <T extends object = any>(): Enricher<
  T,
  T & AdapterProtocolFields
> => {
  return (item) => {
    const { adapterVersion, adapterName } = getRuntime();
    return {
      ...item,
      adapter_version: adapterVersion,
      protocol_name: adapterName,
    };
  };
};
