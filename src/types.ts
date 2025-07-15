import type { StandardSchemaV1 } from "@standard-schema/spec";

export interface EnvVariable {
  key: string;
  value: string;
  line: number;
}

export interface EnvoxParseResult<T = Record<string, string>> {
  variables: EnvVariable[];
  errors: EnvoxParseError[];
  isValid: boolean;
  /** Validated environment when schema is provided */
  env?: T;
}

export interface EnvoxParseError {
  line: number;
  message: string;
  content: string;
}

export interface EnvoxOptions<T = Record<string, string>> {
  allowEmpty?: boolean;
  allowComments?: boolean;
  allowExport?: boolean;
  trimValues?: boolean;
  expandVariables?: boolean;
  schema?: StandardSchemaV1<Record<string, string>, T>;
}

export interface EnvoxValidationError {
  type: "validation";
  message: string;
  path?: ReadonlyArray<PropertyKey | StandardSchemaV1.PathSegment>;
}

export interface EnvoxError extends EnvoxParseError {
  type: "parse";
}

export type EnvoxAllErrors = EnvoxError | EnvoxValidationError;
