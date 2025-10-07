// utils/cli-args.ts

export interface ParsedCliArgs {
  configPath: string | undefined;
  flags: Set<string>;
}

/**
 * Parse CLI arguments into flags and config file path.
 * Flags are any arguments starting with '-'.
 * The first non-flag argument is treated as the config file path.
 *
 * Examples:
 *   parseCliArgs(['config.json', '-r']) => { configPath: 'config.json', flags: Set(['-r']) }
 *   parseCliArgs(['-r', 'config.json']) => { configPath: 'config.json', flags: Set(['-r']) }
 *   parseCliArgs(['--reset-state', 'config.json']) => { configPath: 'config.json', flags: Set(['--reset-state']) }
 */
export function parseCliArgs(args: string[]): ParsedCliArgs {
  const flags = new Set<string>();
  let configPath: string | undefined;

  for (const arg of args) {
    if (arg.startsWith('-')) {
      flags.add(arg);
    } else if (!configPath) {
      // First non-flag argument is the config path
      configPath = arg;
    }
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
