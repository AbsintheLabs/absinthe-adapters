import { execSync } from 'node:child_process';

export default async function () {
  // Build common first (workspace dep) then this package
  try {
    execSync('pnpm --filter @absinthe/common build', { stdio: 'inherit', cwd: process.cwd() });
  } catch (e) {
    // Let vitest show the build failure
    throw e;
  }
  try {
    execSync('pnpm build', { stdio: 'inherit', cwd: process.cwd() });
  } catch (e) {
    throw e;
  }
}
