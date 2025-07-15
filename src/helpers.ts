import { REGEX } from '@/constants';
import type { EnvVariable } from '@/types';

export function isEnvFile(content: string): boolean {
  const lines = content.split('\n').filter((line) => line.trim());
  if (lines.length === 0) return false;

  let validLines = 0;
  let totalLines = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) continue;

    totalLines++;
    if (isLikeEnvVar(trimmed)) {
      validLines++;
    }
  }

  return totalLines > 0 && validLines / totalLines >= 0.5;
}

function isLikeEnvVar(line: string): boolean {
  const cleaned = line.replace(/^\s*export\s+/, '');
  const equalsIndex = cleaned.indexOf('=');
  if (equalsIndex === -1) return false;

  const key = cleaned.substring(0, equalsIndex).trim();
  return REGEX.ENV_VAR_LIKE.test(key);
}

export function toObject(variables: EnvVariable[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const variable of variables) {
    obj[variable.key] = variable.value;
  }
  return obj;
}

export function fromObject(
  obj: Record<string, string>,
  includeExport = false
): string {
  const prefix = includeExport ? 'export ' : '';
  return Object.entries(obj)
    .map(([key, value]) => {
      const quotedValue = REGEX.NEED_QUOTES.test(value)
        ? `"${value.replace(/"/g, '\\"')}"`
        : value;
      return `${prefix}${key}=${quotedValue}`;
    })
    .join('\n');
}
