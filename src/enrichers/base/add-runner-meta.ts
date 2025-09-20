// enrichers/base/add-runner-meta.ts
import { Enricher } from '../core.ts';
import { getRuntime } from '../../runtime/context.ts';

type RunnerFields = {
  runner_version: string;
  runner_commitSha?: string;
  runner_apiKeyHash?: string;
  runner_configHash: string;
  runner_runnerId: string;
};

export const addRunnerMeta = <T extends object>(): Enricher<T, T & RunnerFields> => {
  return (item) => {
    const { version, commitSha, apiKeyHash, configHash, machineHostname } = getRuntime();
    return {
      ...item,
      runner_version: version,
      ...(commitSha && { runner_commitSha: commitSha }),
      ...(apiKeyHash && { runner_apiKeyHash: apiKeyHash }),
      runner_configHash: configHash,
      runner_runnerId: machineHostname,
    };
  };
};
