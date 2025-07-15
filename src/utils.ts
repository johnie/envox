import { REGEX } from '@/constants';
import { expandValue } from '@/expansions';
import { EnvoxError } from '@/errors';
import type { EnvoxOptions, EnvVariable } from '@/types';

export function parseLine(
  line: string,
  lineNumber: number,
  envMap: Map<string, string>,
  options: Required<Omit<EnvoxOptions, 'schema'>>
): EnvVariable | null {
  const trimmedLine = line.trim();

  if (!trimmedLine) return null;
  if (options.allowComments && trimmedLine.startsWith('#')) return null;

  let processedLine = trimmedLine;
  if (options.allowExport && trimmedLine.startsWith('export ')) {
    processedLine = trimmedLine.substring(7);
  }

  const equalsIndex = processedLine.indexOf('=');
  if (equalsIndex === -1) {
    if (!options.allowEmpty) {
      throw new EnvoxError(lineNumber, line, 'Missing equals sign');
    }
    return null;
  }

  const key = processedLine.substring(0, equalsIndex).trim();
  let value = processedLine.substring(equalsIndex + 1);

  if (!isValidKey(key)) {
    throw new EnvoxError(
      lineNumber,
      line,
      `Invalid environment variable key: ${key}`
    );
  }

  value = processValue(value, envMap, options);

  return { key, value, line: lineNumber };
}

function processValue(
  value: string,
  envMap: Map<string, string>,
  options: Required<Omit<EnvoxOptions, 'schema'>>
): string {
  let processedValue = value;

  processedValue = handleQuotes(processedValue);

  if (options.trimValues) {
    processedValue = processedValue.trim();
  }

  if (options.expandVariables) {
    processedValue = expandValue(processedValue, (k) => envMap.get(k));
  }

  return processedValue;
}

function handleQuotes(value: string): string {
  const trimmed = value.trim();

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }

  return value;
}

export function isValidKey(key: string): boolean {
  return REGEX.VALID_KEY.test(key) && !key.includes(' ');
}
