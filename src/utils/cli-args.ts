// utils/cli-args.ts

export interface ParsedCliArgs {
  configPath: string | undefined;
  flags: Set<string>;
}

/**
 * Known valid flags for the application
 */
const KNOWN_FLAGS = new Set(['--reset-state']);

/**
 * Parse CLI arguments into flags and config file path.
 * Flags are any arguments starting with '-'.
 * The first non-flag argument is treated as the config file path.
 *
 * Throws an error if an unknown flag is provided.
 *
 * Examples:
 *   parseCliArgs(['config.json', '--reset-state']) => { configPath: 'config.json', flags: Set(['--reset-state']) }
 *   parseCliArgs(['--reset-state', 'config.json']) => { configPath: 'config.json', flags: Set(['--reset-state']) }
 */
export function parseCliArgs(args: string[]): ParsedCliArgs {
  const flags = new Set<string>();
  let configPath: string | undefined;
  const unknownFlags: string[] = [];

  for (const arg of args) {
    if (arg.startsWith('-')) {
      flags.add(arg);
      if (!KNOWN_FLAGS.has(arg)) {
        unknownFlags.push(arg);
      }
    } else if (!configPath) {
      // First non-flag argument is the config path
      configPath = arg;
    }
  }

  if (unknownFlags.length > 0) {
    const knownFlagsList = Array.from(KNOWN_FLAGS).join(', ');
    throw new Error(
      `Unknown flag${unknownFlags.length > 1 ? 's' : ''}: ${unknownFlags.join(', ')}\n` +
        `Valid flags are: ${knownFlagsList}`,
    );
  }

  return { configPath, flags };
}

/**
 * Check if a flag is present in the parsed flags set.
 * Supports checking multiple flag variations at once.
 */
export function hasFlag(flags: Set<string>, ...flagVariations: string[]): boolean {
  return flagVariations.some((flag) => flags.has(flag));
}
