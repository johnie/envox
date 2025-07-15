import type {
  EnvoxOptions,
  EnvoxParseError,
  EnvoxParseResult,
  EnvVariable,
} from "@/types";

export class Envox {
  private options: Required<EnvoxOptions>;

  constructor(options: EnvoxOptions = {}) {
    this.options = {
      allowEmpty: options.allowEmpty ?? true,
      allowComments: options.allowComments ?? true,
      allowExport: options.allowExport ?? true,
      trimValues: options.trimValues ?? true,
      expandVariables: options.expandVariables ?? false,
    };
  }

  parse(content: string): EnvoxParseResult {
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
          message: error instanceof Error ? error.message : "Unknown error",
          content: line,
        });
      }
    }

    return {
      variables,
      errors,
      isValid: errors.length === 0,
    };
  }

  private parseLine(
    line: string,
    lineNumber: number,
    envMap: Map<string, string>,
  ): EnvVariable | null {
    if (!line.trim()) {
      return null;
    }

    if (this.options.allowComments && line.trim().startsWith("#")) {
      return null;
    }

    let processedLine = line;
    if (this.options.allowExport && line.trim().startsWith("export ")) {
      processedLine = line.replace(/^\s*export\s+/, "");
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
    return value.replace(
      /\$\{([^}]+)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g,
      (_match, braced, simple) => {
        const varName = braced || simple;
        return envMap.get(varName) || "";
      },
    );
  }

  private isValidKey(key: string): boolean {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key);
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
        // Quote value if it contains spaces or special characters
        const quotedValue = /[\s"'$\\]/.test(value)
          ? `"${value.replace(/"/g, '\\"')}"`
          : value;
        return `${prefix}${key}=${quotedValue}`;
      })
      .join("\n");
  }
}

export function parseEnv(
  content: string,
  options?: EnvoxOptions,
): EnvoxParseResult {
  const parser = new Envox(options);
  return parser.parse(content);
}

export function isEnvFile(content: string): boolean {
  return Envox.isEnvFile(content);
}

export function envToObject(
  content: string,
  options?: EnvoxOptions,
): Record<string, string> {
  const result = parseEnv(content, options);
  if (!result.isValid) {
    throw new Error(
      `Invalid environment file: ${result.errors
        .map((e) => e.message)
        .join(", ")}`,
    );
  }
  return Envox.toObject(result.variables);
}

export function objectToEnv(
  obj: Record<string, string>,
  includeExport = false,
): string {
  return Envox.fromObject(obj, includeExport);
}
