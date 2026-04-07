import type { EnvoxOptions, EnvoxParseError, EnvVariable } from '@/types';

const REGEX = {
  VAR_EXPANSION: /\$\{([^}]+)\}|\$([A-Za-z_][A-Za-z0-9_]*?)(?=[^A-Za-z0-9]|$)/g,
  VALID_KEY: /^[A-Za-z_][A-Za-z0-9_]*$/,
} as const;

class EnvoxError extends Error {
  constructor(
    public readonly line: number,
    public readonly content: string,
    message: string,
  ) {
    super(message);
    this.name = 'EnvoxError';
  }
}

function expandValue(
  value: string,
  lookup: (key: string) => string | undefined,
): string {
  return value.replace(REGEX.VAR_EXPANSION, (_match, braced, simple) => {
    const varName = braced || simple;
    return lookup(varName) || '';
  });
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

function processValue(
  value: string,
  envMap: Map<string, string>,
  options: Required<Omit<EnvoxOptions, 'schema'>>,
): string {
  let processedValue = handleQuotes(value);

  if (options.trimValues) {
    processedValue = processedValue.trim();
  }

  if (options.expandVariables) {
    processedValue = expandValue(processedValue, (k) => envMap.get(k));
  }

  return processedValue;
}

function isValidKey(key: string): boolean {
  return REGEX.VALID_KEY.test(key) && !key.includes(' ');
}

function parseLine(
  line: string,
  lineNumber: number,
  envMap: Map<string, string>,
  options: Required<Omit<EnvoxOptions, 'schema'>>,
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
      `Invalid environment variable key: ${key}`,
    );
  }

  value = processValue(value, envMap, options);

  return { key, value, line: lineNumber };
}

export function parse(
  source: string | Record<string, string | undefined>,
  options: Required<Omit<EnvoxOptions, 'schema'>>,
): { variables: EnvVariable[]; errors: EnvoxParseError[] } {
  const variables: EnvVariable[] = [];
  const errors: EnvoxParseError[] = [];
  const envMap = new Map<string, string>();

  if (typeof source === 'string') {
    const lines = source.split('\n');
    for (const [index, line] of lines.entries()) {
      const lineNumber = index + 1;
      if (line === undefined) continue;

      try {
        const result = parseLine(line, lineNumber, envMap, options);
        if (result) {
          variables.push(result);
          envMap.set(result.key, result.value);
        }
      } catch (error) {
        if (error instanceof EnvoxError) {
          errors.push({
            line: error.line,
            message: error.message,
            content: error.content,
          });
        } else {
          errors.push({
            line: lineNumber,
            message: error instanceof Error ? error.message : 'Unknown error',
            content: line,
          });
        }
      }
    }
  } else if (typeof source === 'object' && source !== null) {
    for (const [key, value] of Object.entries(source)) {
      if (isValidKey(key) && value !== undefined) {
        envMap.set(key, value);
      }
    }

    for (const [key, value] of envMap.entries()) {
      const expandedValue = options.expandVariables
        ? expandValue(value, (k) => envMap.get(k))
        : value;
      variables.push({ key, value: expandedValue, line: 0 });
    }
  }

  return { variables, errors };
}
