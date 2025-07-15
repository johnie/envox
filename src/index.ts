import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
  EnvoxOptions,
  EnvoxParseError,
  EnvoxParseResult,
  EnvVariable,
} from "@/types";

const VAR_EXPANSION_REGEX = /\$\{([^}]+)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g;
const VALID_KEY_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;
const NEED_QUOTES_REGEX = /[\s"'$\\]/;

export class Envox {
  private options: Required<Omit<EnvoxOptions, "schema">> &
    Pick<EnvoxOptions, "schema">;

  constructor(options: EnvoxOptions = {}) {
    this.options = {
      allowEmpty: options.allowEmpty ?? true,
      allowComments: options.allowComments ?? true,
      allowExport: options.allowExport ?? true,
      trimValues: options.trimValues ?? true,
      expandVariables: options.expandVariables ?? false,
      schema: options.schema,
    };
  }

  async parse<T = Record<string, string>>(
    content: string,
  ): Promise<EnvoxParseResult<T>> {
    const lines = content.split("\n");
    const variables: EnvVariable[] = [];
    const errors: EnvoxParseError[] = [];
    const envMap = new Map<string, string>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      if (line === undefined) continue;

      try {
        const result = this.parseLine(line, lineNumber, envMap);
        if (result) {
          variables.push(result);
          envMap.set(result.key, result.value);
        }
      } catch (error) {
        errors.push({
          line: lineNumber,
          message:
            error instanceof Error ? error.message : "Envox: Unknown error",
          content: line,
        });
      }
    }

    const result: EnvoxParseResult<T> = {
      variables,
      errors,
      isValid: errors.length === 0,
    };

    if (this.options.schema && result.isValid) {
      const obj = Envox.toObject(variables);
      const validationResult = await this.validateWithSchema(
        obj,
        this.options.schema,
      );

      if (validationResult.success) {
        result.env = validationResult.data as T;
      } else {
        result.errors.push(...validationResult.errors);
        result.isValid = false;
      }
    }

    return result;
  }

  private async validateWithSchema<T>(
    obj: Record<string, string>,
    schema: StandardSchemaV1<Record<string, string>, T>,
  ): Promise<
    { success: true; data: T } | { success: false; errors: EnvoxParseError[] }
  > {
    try {
      const validation = await schema["~standard"].validate(obj);

      if ("issues" in validation) {
        const errors: EnvoxParseError[] =
          validation.issues?.map((issue) => ({
            line: 0,
            message: issue.message,
            content: issue.path
              ? `Path: ${this.formatPath(issue.path)}`
              : "Schema validation failed",
          })) || [];

        return { success: false, errors };
      }

      return { success: true, data: validation.value };
    } catch (error) {
      return {
        success: false,
        errors: [
          {
            line: 0,
            message:
              error instanceof Error
                ? error.message
                : "Schema validation failed",
            content: "Schema validation error",
          },
        ],
      };
    }
  }

  private formatPath(
    path: ReadonlyArray<PropertyKey | StandardSchemaV1.PathSegment>,
  ): string {
    return path
      .map((segment) => {
        if (typeof segment === "object" && "key" in segment) {
          return String(segment.key);
        }
        return String(segment);
      })
      .join(".");
  }

  private parseLine(
    line: string,
    lineNumber: number,
    envMap: Map<string, string>,
  ): EnvVariable | null {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      return null;
    }
    if (this.options.allowComments && trimmedLine.startsWith("#")) {
      return null;
    }

    let processedLine = trimmedLine;
    if (this.options.allowExport && trimmedLine.startsWith("export ")) {
      processedLine = trimmedLine.substring(7);
    }

    const equalsIndex = processedLine.indexOf("=");
    if (equalsIndex === -1) {
      if (!this.options.allowEmpty) {
        throw new Error("Missing equals sign");
      }
      return null;
    }

    const key = processedLine.substring(0, equalsIndex).trim();
    let value = processedLine.substring(equalsIndex + 1);

    if (!this.isValidKey(key)) {
      throw new Error(`Invalid environment variable key: ${key}`);
    }

    value = this.processValue(value, envMap);

    return {
      key,
      value,
      line: lineNumber,
    };
  }

  private processValue(value: string, envMap: Map<string, string>): string {
    let processedValue = value;

    if (this.options.trimValues) {
      processedValue = processedValue.trim();
    }

    processedValue = this.handleQuotes(processedValue);

    if (this.options.expandVariables) {
      processedValue = this.expandVariables(processedValue, envMap);
    }

    return processedValue;
  }

  private handleQuotes(value: string): string {
    const trimmed = value.trim();

    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }

    if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
      return trimmed.slice(1, -1);
    }

    return value;
  }

  private expandVariables(value: string, envMap: Map<string, string>): string {
    return value.replace(VAR_EXPANSION_REGEX, (_match, braced, simple) => {
      const varName = braced || simple;
      return envMap.get(varName) || "";
    });
  }

  private isValidKey(key: string): boolean {
    return VALID_KEY_REGEX.test(key) && !key.includes(" ");
  }

  static isEnvFile(content: string): boolean {
    const lines = content.split("\n").filter((line) => line.trim());

    if (lines.length === 0) return false;

    let validLines = 0;
    let totalLines = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith("#")) continue;

      totalLines++;

      if (Envox.looksLikeEnvVar(trimmed)) {
        validLines++;
      }
    }

    return totalLines > 0 && validLines / totalLines >= 0.5;
  }

  private static looksLikeEnvVar(line: string): boolean {
    const cleaned = line.replace(/^\s*export\s+/, "");

    const equalsIndex = cleaned.indexOf("=");
    if (equalsIndex === -1) return false;

    const key = cleaned.substring(0, equalsIndex).trim();
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key);
  }

  static toObject(variables: EnvVariable[]): Record<string, string> {
    const obj: Record<string, string> = {};
    for (const variable of variables) {
      obj[variable.key] = variable.value;
    }
    return obj;
  }

  static fromObject(
    obj: Record<string, string>,
    includeExport = false,
  ): string {
    const prefix = includeExport ? "export " : "";
    return Object.entries(obj)
      .map(([key, value]) => {
        const quotedValue = NEED_QUOTES_REGEX.test(value)
          ? `"${value.replace(/"/g, '\\"')}"`
          : value;
        return `${prefix}${key}=${quotedValue}`;
      })
      .join("\n");
  }
}

// Convenience functions
export async function parseEnv<T = Record<string, string>>(
  content: string,
  options?: EnvoxOptions<T>,
): Promise<EnvoxParseResult<T>> {
  const parser = new Envox(options as EnvoxOptions);
  return parser.parse<T>(content);
}

export function isEnvFile(content: string): boolean {
  return Envox.isEnvFile(content);
}

export async function envToObject<T = Record<string, string>>(
  content: string,
  options?: EnvoxOptions<T>,
): Promise<T extends Record<string, string> ? Record<string, string> : T> {
  const result = await parseEnv(content, options);
  if (!result.isValid) {
    throw new Error(
      `Invalid environment file: ${result.errors
        .map((e) => e.message)
        .join(", ")}`,
    );
  }

  if (result.env !== undefined) {
    return result.env as T extends Record<string, string>
      ? Record<string, string>
      : T;
  }

  return Envox.toObject(result.variables) as T extends Record<string, string>
    ? Record<string, string>
    : T;
}

export function objectToEnv(
  obj: Record<string, string>,
  includeExport = false,
): string {
  return Envox.fromObject(obj, includeExport);
}
