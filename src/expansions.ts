import { REGEX } from '@/constants';

export function expandValue(
  value: string,
  lookup: (key: string) => string | undefined
): string {
  return value.replace(REGEX.VAR_EXPANSION, (_match, braced, simple) => {
    const varName = braced || simple;
    return lookup(varName) || '';
  });
}
