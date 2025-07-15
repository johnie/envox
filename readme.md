<p align="center">
  <h1 align="center">🌿<br/><code>envox</code></h1>
  <p align="center">Fast and flexible environment variable parser with detailed error reporting.</p>
</p>
<br/>

<p align="center">
<a href="https://opensource.org/licenses/MIT" rel="nofollow"><img src="https://img.shields.io/github/license/johnie/envox" alt="License"></a>
<a href="https://www.npmjs.com/package/envox" rel="nofollow"><img src="https://img.shields.io/npm/v/envox.svg" alt="npm"></a>
<a href="https://github.com/johnie/envox" rel="nofollow"><img src="https://img.shields.io/github/stars/johnie/envox" alt="stars"></a>
</p>

<br/>
<br/>

## Installation

Install envox with your preferred package manager:

```bash
npm install envox
# or
pnpm add envox
# or
bun add envox
```

## Quick Start

```typescript
import { parseEnv, envToObject } from 'envox';

const envContent = `
# Database configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myapp

# API settings
API_KEY="secret-key-123"
DEBUG=true
`;

const result = parseEnv(envContent);
console.log(result.variables); // Parsed variables with line numbers
console.log(result.isValid);   // true if no errors

// Convert to plain object
const env = envToObject(envContent);
console.log(env.DB_HOST); // "localhost"
```

## Features

- **Flexible parsing** - Handle various .env file formats
- **Detailed error reporting** - Get line numbers and context for errors
- **Variable expansion** - Support for `${VAR}` and `$VAR` syntax
- **Quote handling** - Properly parse single and double quoted values
- **Export support** - Handle `export VAR=value` syntax
- **TypeScript support** - Full type definitions included
- **Zero dependencies** - Lightweight and fast

## API Reference

### `parseEnv(content, options?)`

Parse environment variable content and return detailed results.

```typescript
import { parseEnv } from 'envox';

const result = parseEnv(content, {
  allowEmpty: true,        // Allow lines without equals sign
  allowComments: true,     // Allow # comments
  allowExport: true,       // Allow export prefix
  trimValues: true,        // Trim whitespace from values
  expandVariables: false   // Expand ${VAR} and $VAR references
});

// Result structure
interface EnvoxParseResult {
  variables: EnvVariable[];  // Successfully parsed variables
  errors: EnvoxParseError[]; // Parse errors with line numbers
  isValid: boolean;          // true if no errors occurred
}
```

### `envToObject(content, options?)`

Convert environment content directly to a plain object. Throws if parsing fails.

```typescript
import { envToObject } from 'envox';

const env = envToObject(`
  DATABASE_URL=postgres://localhost/mydb
  PORT=3000
`);

console.log(env.DATABASE_URL); // "postgres://localhost/mydb"
console.log(env.PORT);         // "3000"
```

### `objectToEnv(obj, includeExport?)`

Convert a plain object back to environment variable format.

```typescript
import { objectToEnv } from 'envox';

const obj = { API_KEY: 'secret', DEBUG: 'true' };
const envString = objectToEnv(obj, true); // Include 'export' prefix

console.log(envString);
// export API_KEY=secret
// export DEBUG=true
```

### `isEnvFile(content)`

Check if content looks like an environment file.

```typescript
import { isEnvFile } from 'envox';

const content = `
  NODE_ENV=development
  PORT=3000
`;

console.log(isEnvFile(content)); // true
```

### `Envox` Class

For advanced usage, you can use the `Envox` class directly:

```typescript
import { Envox } from 'envox';

const parser = new Envox({
  expandVariables: true,
  allowComments: true
});

const result = parser.parse(content);
```

## Options

All parsing functions accept an optional `EnvoxOptions` object:

```typescript
interface EnvoxOptions {
  allowEmpty?: boolean;      // Default: true
  allowComments?: boolean;   // Default: true  
  allowExport?: boolean;     // Default: true
  trimValues?: boolean;      // Default: true
  expandVariables?: boolean; // Default: false
}
```

### Option Details

- **`allowEmpty`** - When `true`, lines without `=` are ignored. When `false`, they cause parse errors.
- **`allowComments`** - When `true`, lines starting with `#` are treated as comments.
- **`allowExport`** - When `true`, supports `export VAR=value` syntax.
- **`trimValues`** - When `true`, removes leading/trailing whitespace from values.
- **`expandVariables`** - When `true`, expands `${VAR}` and `$VAR` references.

## Variable Expansion

When `expandVariables` is enabled, you can reference previously defined variables:

```typescript
const content = `
  BASE_URL=https://api.example.com
  API_ENDPOINT=${BASE_URL}/v1
  FULL_URL=$API_ENDPOINT/users
`;

const result = parseEnv(content, { expandVariables: true });
const env = envToObject(content, { expandVariables: true });

console.log(env.FULL_URL); // "https://api.example.com/v1/users"
```

## Quote Handling

Envox properly handles both single and double quotes:

```typescript
const content = `
  SINGLE='value with spaces'
  DOUBLE="value with $pecial chars"
  ESCAPED="value with \\"quotes\\""
`;

const env = envToObject(content);
console.log(env.SINGLE);  // "value with spaces"
console.log(env.DOUBLE);  // "value with $pecial chars"
console.log(env.ESCAPED); // "value with "quotes""
```

## Error Handling

Envox provides detailed error information:

```typescript
const result = parseEnv(`
  VALID_VAR=okay
  123_INVALID=bad
  ANOTHER=fine
`);

if (!result.isValid) {
  result.errors.forEach(error => {
    console.log(`Line ${error.line}: ${error.message}`);
    console.log(`Content: ${error.content}`);
  });
}
```

## Examples

### Basic Usage

```typescript
import { envToObject } from 'envox';

const env = envToObject(`
  NODE_ENV=development
  PORT=3000
  DATABASE_URL=postgres://localhost/mydb
`);

// Use in your application
const server = createServer();
server.listen(env.PORT);
```

### With Variable Expansion

```typescript
import { parseEnv } from 'envox';

const result = parseEnv(`
  APP_NAME=myapp
  VERSION=1.0.0
  IMAGE_TAG=${APP_NAME}:${VERSION}
  CONTAINER_NAME=${APP_NAME}-container
`, { expandVariables: true });

console.log(result.variables.find(v => v.key === 'IMAGE_TAG')?.value);
// "myapp:1.0.0"
```

### Error Handling

```typescript
import { parseEnv } from 'envox';

const result = parseEnv(`
  # Valid configuration
  API_KEY=secret123
  
  # This will cause an error
  123INVALID=value
`);

if (!result.isValid) {
  console.error('Environment file has errors:');
  result.errors.forEach(err => {
    console.error(`  Line ${err.line}: ${err.message}`);
  });
}
```

### Validating Environment with Zod

If you want to validate the parsed environment variables with strict types, you can use for example [zod](https://zod.dev/):

```typescript
import { z } from 'zod';
import { envToObject } from 'envox';

// Define schema
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().int().positive(),
  DATABASE_URL: z.string().url(),
  DEBUG: z.coerce.boolean().optional()
});

// Load and parse
const env = envToObject(`
  NODE_ENV=development
  PORT=3000
  DATABASE_URL=https://localhost/db
  DEBUG=true
`);

// Validate
const parsed = EnvSchema.parse(env);

console.log(parsed.PORT);  // 3000
console.log(parsed.DEBUG); // true
```

You’ll get helpful errors if something is missing or incorrectly typed.

## Contributing

We welcome contributions! Please see our [Contributing Guide](https://github.com/johnie/envox/blob/main/CONTRIBUTING.md) for details.

## License

MIT License. See the [LICENSE](https://github.com/johnie/envox/blob/main/LICENSE) file for details.
