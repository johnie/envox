import { fromObject, isEnvFile, toObject } from '@/helpers';
import { parse } from '@/parse';
import { runSchema } from '@/schema';
import type { EnvoxOptions, ParseResult } from '@/types';

const defaultOptions = {
  allowEmpty: true,
  allowComments: true,
  allowExport: true,
  trimValues: true,
  expandVariables: false,
} as const;

export function parseEnv<TOut = Record<string, string>>(
  source: string | Record<string, string | undefined>,
  options: EnvoxOptions<TOut> = {},
): ParseResult<TOut> {
  const mergedOptions = { ...defaultOptions, ...options };
  const { variables, errors } = parse(source, mergedOptions);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const obj = toObject(variables);

  if (mergedOptions.schema) {
    const validationResult = runSchema(mergedOptions.schema, obj);
    if (validationResult.success) {
      return { ok: true, data: validationResult.data, vars: variables };
    }
    return { ok: false, errors: validationResult.errors };
  }

  return { ok: true, data: obj as TOut, vars: variables };
}

export type {
  EnvoxOptions,
  EnvoxParseError,
  EnvVariable,
  ParseFailure,
  ParseResult,
  ParseSuccess,
} from '@/types';
export { fromObject, isEnvFile };
