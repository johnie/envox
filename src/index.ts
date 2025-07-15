import type {
  EnvoxOptions,
  EnvoxParseResult,
  EnvoxParseError,
  ParseResult,
  EnvVariable,
} from '@/types';
import { REGEX } from '@/constants';
import { EnvoxError } from '@/errors';
import { expandValue } from '@/expansions';
import { runSchema } from '@/schema';
import { isEnvFile, toObject, fromObject } from '@/helpers';

const defaultOptions = {
  allowEmpty: true,
  allowComments: true,
  allowExport: true,
  trimValues: true,
  expandVariables: false,
} as const;

export class Envox<TOut = Record<string, string>> {
  private readonly options: Required<Omit<EnvoxOptions<TOut>, 'schema'>> &
    Pick<EnvoxOptions<TOut>, 'schema'>;

  constructor(options: EnvoxOptions<TOut> = {}) {
    this.options = { ...defaultOptions, ...options };
  }

  async parse(
    source: string | Record<string, string | undefined>
  ): Promise<ParseResult<TOut>> {
    const variables: EnvVariable[] = [];
    const errors: EnvoxParseError[] = [];
    const envMap = new Map<string, string>();

    if (typeof source === 'string') {
      const lines = source.split('\n');
      for (const [index, line] of lines.entries()) {
        const lineNumber = index + 1;
        if (line === undefined) continue;

        try {
          const result = this.parseLine(line, lineNumber, envMap);
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
        if (this.isValidKey(key) && value !== undefined) {
          tempMap.set(key, value);
        }
      }

      for (const [key, value] of tempMap.entries()) {
        const expandedValue = this.options.expandVariables
          ? expandValue(value, (k) => tempMap.get(k))
          : value;
        envMap.set(key, expandedValue);
        variables.push({ key, value: expandedValue, line: 0 });
      }
    }

    if (errors.length > 0) {
      return { ok: false, errors };
    }

    // Convert to plain object for schema validation
    const obj = toObject(variables);

    if (this.options.schema) {
      const validationResult = await runSchema(this.options.schema, obj);
      if (validationResult.success) {
        return { ok: true, data: validationResult.data, vars: variables };
      } else {
        return { ok: false, errors: validationResult.errors };
      }
    }

    return { ok: true, data: obj as TOut, vars: variables };
  }

  private parseLine(
    line: string,
    lineNumber: number,
    envMap: Map<string, string>
  ): EnvVariable | null {
    const trimmedLine = line.trim();

    if (!trimmedLine) return null;
    if (this.options.allowComments && trimmedLine.startsWith('#')) return null;

    let processedLine = trimmedLine;
    if (this.options.allowExport && trimmedLine.startsWith('export ')) {
      processedLine = trimmedLine.substring(7);
    }

    const equalsIndex = processedLine.indexOf('=');
    if (equalsIndex === -1) {
      if (!this.options.allowEmpty) {
        throw new EnvoxError(lineNumber, line, 'Missing equals sign');
      }
      return null;
    }

    const key = processedLine.substring(0, equalsIndex).trim();
    let value = processedLine.substring(equalsIndex + 1);

    if (!this.isValidKey(key)) {
      throw new EnvoxError(
        lineNumber,
        line,
        `Invalid environment variable key: ${key}`
      );
    }

    value = this.processValue(value, envMap);

    return { key, value, line: lineNumber };
  }

  private processValue(value: string, envMap: Map<string, string>): string {
    let processedValue = value;

    processedValue = this.handleQuotes(processedValue);

    if (this.options.trimValues) {
      processedValue = processedValue.trim();
    }

    if (this.options.expandVariables) {
      processedValue = expandValue(processedValue, (k) => envMap.get(k));
    }

    return processedValue;
  }

  private handleQuotes(value: string): string {
    const trimmed = value.trim();

    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }

    if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
      return trimmed.slice(1, -1);
    }

    return value;
  }

  private isValidKey(key: string): boolean {
    return REGEX.VALID_KEY.test(key) && !key.includes(' ');
  }
}

export { isEnvFile, toObject, fromObject };
