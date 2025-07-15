export const REGEX = {
  VAR_EXPANSION: /\$\{([^}]+)\}|\$([A-Za-z_][A-Za-z0-9_]*?)(?=[^A-Za-z0-9]|$)/g,
  VALID_KEY: /^[A-Za-z_][A-Za-z0-9_]*$/,
  NEED_QUOTES: /[\s"'$\\]/,
  ENV_VAR_LIKE: /^[A-Za-z_][A-Za-z0-9_]*$/,
} as const;
