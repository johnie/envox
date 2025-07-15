import { EnvoxError } from '@/errors';
import { expandValue } from '@/expansions';
import { fromObject, isEnvFile, toObject } from '@/helpers';
import { runSchema } from '@/schema';
import { parseLine, isValidKey } from '@/utils';
import type {
  EnvoxOptions,
  EnvoxParseError,
  EnvVariable,
  ParseResult,
} from '@/types';

const defaultOptions = {
  allowEmpty: true,
  allowComments: true,
  allowExport: true,
  trimValues: true,
  expandVariables: false,
} as const;

export async function parseEnv<TOut = Record<string, string>>(
  source: string | Record<string, string | undefined>,
  options: EnvoxOptions<TOut> = {}
): Promise<ParseResult<TOut>> {
  const mergedOptions = { ...defaultOptions, ...options };
  const variables: EnvVariable[] = [];
  const errors: EnvoxParseError[] = [];
  const envMap = new Map<string, string>();

  if (typeof source === 'string') {
    const lines = source.split('\n');
    for (const [index, line] of lines.entries()) {
      const lineNumber = index + 1;
      if (line === undefined) continue;

      try {
        const result = parseLine(line, lineNumber, envMap, mergedOptions);
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
    const tempMap = new Map<string, string>();
    for (const [key, value] of Object.entries(source)) {
      if (isValidKey(key) && value !== undefined) {
        tempMap.set(key, value);
      }
    }

    for (const [key, value] of tempMap.entries()) {
      const expandedValue = mergedOptions.expandVariables
        ? expandValue(value, (k) => tempMap.get(k))
        : value;
      envMap.set(key, expandedValue);
      variables.push({ key, value: expandedValue, line: 0 });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const obj = toObject(variables);

  if (mergedOptions.schema) {
    const validationResult = await runSchema(mergedOptions.schema, obj);
    if (validationResult.success) {
      return { ok: true, data: validationResult.data, vars: variables };
    } else {
      return { ok: false, errors: validationResult.errors };
    }
  }

  return { ok: true, data: obj as TOut, vars: variables };
}

export { isEnvFile, fromObject };

export type {
  EnvVariable,
  EnvoxOptions,
  EnvoxParseError,
  ParseResult,
  ParseSuccess,
  ParseFailure,
} from '@/types';
