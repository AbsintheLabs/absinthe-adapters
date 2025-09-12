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
      expect(stderr).toBe(''); // or expect(stderr).not.toMatch(/error/i)

      // 2) parse stdout if you pipe output, else parse CSV or other sink
      // placeholder: assume stdout is JSON lines
      const lines = stdout.split('\n').filter((l) => l.trim().length > 0);
      // optional: JSON parse each
      const rows = lines.map((l) => JSON.parse(l));

      // 3) make assertions
      expect(rows.length).toBeGreaterThan(0);
      // assert a known row
      const known = rows.find((r) => r.user === '0xabc...' && r.asset === '0xdef...');
      expect(known).toBeDefined();
      if (known) {
        expect(known.amount).toBeCloseTo(12345.67, 2);
      }

      // 4) snapshot of first few
      expect(rows.slice(0, 5)).toMatchSnapshot();
    });
  }
});
