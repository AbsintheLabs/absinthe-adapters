// enrichers/base/add-adapter-protocol.ts
import { Enricher } from '../core.ts';
import { getRuntime } from '../../runtime/context.ts';

type AdapterProtocolFields = {
  adapter_version: string;
  protocol_name: string;
};

export const addAdapterProtocolMeta = <T extends object>(): Enricher<
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
