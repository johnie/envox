import type { StandardSchemaV1 } from '@standard-schema/spec';

export interface EnvVariable {
  key: string;
  value: string;
  line: number;
}

export interface EnvoxParseError {
  line: number;
  message: string;
  content: string;
}

export type ParseSuccess<T> = {
  ok: true;
  data: T;
  vars: EnvVariable[];
};

export type ParseFailure = {
  ok: false;
  errors: EnvoxParseError[];
};

export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

export interface EnvoxParseResult<T = Record<string, string>> {
  variables: EnvVariable[];
  errors: EnvoxParseError[];
  isValid: boolean;
  env?: T;
}

export interface EnvoxOptions<T = Record<string, string>> {
  allowEmpty?: boolean;
  allowComments?: boolean;
  allowExport?: boolean;
  trimValues?: boolean;
  expandVariables?: boolean;
  schema?: StandardSchemaV1<Record<string, string>, T>;
}
