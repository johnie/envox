export interface EnvVariable {
  key: string;
  value: string;
  line: number;
}

export interface EnvoxParseResult {
  variables: EnvVariable[];
  errors: EnvoxParseError[];
  isValid: boolean;
}

export interface EnvoxParseError {
  line: number;
  message: string;
  content: string;
}

export interface EnvoxOptions {
  allowEmpty?: boolean;
  allowComments?: boolean;
  allowExport?: boolean;
  trimValues?: boolean;
  expandVariables?: boolean;
}
