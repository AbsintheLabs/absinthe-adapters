// enrichers/base/add-runner-meta.ts
import { Enricher } from '../core.ts';
import { getRuntime } from '../../runtime/context.ts';

type RunnerFields = {
  runner_commit_sha: string | undefined;
  runner_api_key_hash: string | undefined;
  runner_config_hash: string;
  runner_runner_id: string;
};

export const addRunnerMeta = <T extends object>(): Enricher<T, T & RunnerFields> => {
  return (item) => {
    const { commitSha, apiKeyHash, configHash, machineHostname } = getRuntime();
    return {
      ...item,
      runner_commit_sha: commitSha ?? undefined,
      runner_api_key_hash: apiKeyHash ?? undefined,
      runner_config_hash: configHash,
      runner_runner_id: machineHostname,
    };
  };
};
