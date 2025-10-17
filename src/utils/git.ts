import { execSync } from 'child_process';

export const GIT_COMMIT_SHA_LONG =
  process.env.GIT_COMMIT_SHA_LONG ??
  (() => {
    try {
      return execSync('git rev-parse HEAD').toString().trim();
    } catch {
      return null;
    }
  })();
