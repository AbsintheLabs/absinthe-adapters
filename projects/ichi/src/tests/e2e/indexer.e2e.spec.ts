// tests/e2e/indexer.spec.ts

import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { join } from 'path';

// Helper to run your indexer CLI
async function runIndexer(
  configPath: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [join(__dirname, '../../../lib/main.js'), configPath], {
      cwd: process.cwd(),
    });
    let stdout = '';
    let stderr = '';

    // Pipe child process output to parent process so we can see it in real-time during testing
    proc.stdout.pipe(process.stdout);
    proc.stderr.pipe(process.stderr);

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('close', (code) => {
      resolve({ exitCode: code ?? -1, stdout, stderr });
    });
    proc.on('error', (err) => {
      reject(err);
    });
  });
}

describe('Indexer E2E', () => {
  const cases = [
    // fixme: move the example config under the tests directory so it's more semantically clear what's going on here
    { name: 'aavev3', config: 'exampleConfigs/aavev3.absinthe.json' },
    // { name: 'univ3', config: 'exampleConfigs/univ3.hemi.json' },
    // add more
  ];

  for (const c of cases) {
    it(`runs indexer for config ${c.name} and returns expected output`, async () => {
      const { exitCode, stdout, stderr } = await runIndexer(c.config);

      // Debug output to see what's happening
      if (exitCode !== 0) {
        console.log('Exit code:', exitCode);
        console.log('STDOUT:', stdout);
        console.log('STDERR:', stderr);
      }

      // 1) it should exit cleanly
      expect(exitCode).toBe(0);
      // expect(stderr).toBe(''); // or expect(stderr).not.toMatch(/error/i)

      // 2) parse stdout if you pipe output, else parse CSV or other sink
      // placeholder: assume stdout is JSON lines
      const lines = stdout.split('\n').filter((l) => l.trim().length > 0);
      // optional: JSON parse each
      const rows = lines
        .map((l) => {
          try {
            return JSON.parse(l);
          } catch (e) {
            return null;
          }
        })
        .filter((row) => row !== null);

      // 3) make assertions
      expect(rows.length).toBeGreaterThan(0);
      // assert a known row
      const known = rows.find(
        (r) =>
          r.user === '0x000000c77ab4952aa5c43ee8047bca9ca7265b3d' &&
          r.asset === '0x05e08702028de6aad395dc6478b554a56920b9ad' &&
          r.activity === 'borrow' &&
          r.startTxRef === '0xb25212d21c8656b03be871ca4fc22d5e55da2052ef688f0623a8e95c56a46179' &&
          r.endTxRef === '0x6bfbd6568b07a42861578308607c217d263fc6b486d22814f21a0e2836afc103' &&
          r.rawAfter === '0', // fixme: this should be a number!!! Need to make sure json types are correct
      );
      expect(known).toBeDefined();

      const notKnown = rows.find(
        (r) =>
          r.user === '0x000000c77ab4952aa5c43ee8047bca9ca7265b3d' &&
          r.asset === '0x05e08702028de6aad395dc6478b554a56920b9ad' &&
          r.trigger === 'FINAL',
      );
      expect(notKnown).toBeUndefined();
    });
  }
});
