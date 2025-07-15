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

For schema validation, install a compatible validation library:

```bash
npm install zod valibot effect
# or your preferred validation library that supports Standard Schema
```

## Quick Start

```typescript
import { parseEnv } from 'envox';

const envContent = `
# Database configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myapp

# API settings
API_KEY="secret-key-123"
DEBUG=true
`;

const result = await parseEnv(envContent);

if (result.ok) {
  console.log(result.data);    // { DB_HOST: 'localhost', DB_PORT: '5432', ... }
  console.log(result.vars);    // Array of variables with line numbers
} else {
  console.error(result.errors); // Parse errors with line numbers
}
```

## Features

- **Flexible parsing** - Handle various .env file formats and process.env objects
- **Detailed error reporting** - Get line numbers and context for errors
- **Variable expansion** - Support for `${VAR}` and `$VAR` syntax
- **Quote handling** - Properly parse single and double quoted values
- **Export support** - Handle `export VAR=value` syntax
- **Schema validation** - Validate and transform parsed values with any [Standard Schema](https://standardschema.dev/) compatible library
- **TypeScript support** - Full type definitions included
- **Zero dependencies** - Lightweight and fast (validation libraries are optional)

## API Reference

### `parseEnv` Function

The main function for parsing environment variables.

```typescript
import { parseEnv } from 'envox';

const result = await parseEnv(source, options);
```

#### Function Options

```typescript
interface EnvoxOptions<T = Record<string, string>> {
  allowEmpty?: boolean;      // Default: true
  allowComments?: boolean;   // Default: true  
  allowExport?: boolean;     // Default: true
  trimValues?: boolean;      // Default: true
  expandVariables?: boolean; // Default: false
  schema?: StandardSchemaV1<Record<string, string>, T>; // Optional schema
}
```

#### `parseEnv(source, options)` Parameters

Parse environment variables from a string or object.

```typescript
// Parse from string
const result = await parseEnv(`
  DATABASE_URL=postgres://localhost/mydb
  PORT=3000
`);

// Parse from process.env or any object
const result = await parseEnv(process.env);
const result = await parseEnv({ API_KEY: 'secret', DEBUG: 'true' });
```

**Returns:**
```typescript
type ParseResult<T> = 
  | { ok: true; data: T; vars: EnvVariable[] }
  | { ok: false; errors: EnvoxParseError[] };

interface EnvVariable {
  key: string;
  value: string;
  line: number;
}

interface EnvoxParseError {
  line: number;
  message: string;
  content: string;
}
```

### Helper Functions

#### `isEnvFile(content)`

Check if content looks like an environment file.

```typescript
import { isEnvFile } from 'envox';

const content = `
  NODE_ENV=development
  PORT=3000
`;

console.log(isEnvFile(content)); // true
```

#### `fromObject(obj, { includeExport })`

Convert a plain object to environment variable format.

```typescript
import { fromObject } from 'envox';

const obj = { API_KEY: 'secret', DEBUG: 'true' };
const envString = fromObject(obj, { includeExport: true }); // Include 'export' prefix

console.log(envString);
// export API_KEY=secret
// export DEBUG=true
```

## Schema Validation

Envox supports any validation library that implements the [Standard Schema](https://standardschema.dev/) specification. This includes popular libraries like Zod, Valibot, and Effect Schema.

### With Zod

```typescript
import { z } from 'zod';
import { parseEnv } from 'envox';

// Define your schema
const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().int().positive(),
  DATABASE_URL: z.string().url(),
  DEBUG: z.coerce.boolean().default(false)
});

const envContent = `
  NODE_ENV=development
  PORT=3000
  DATABASE_URL=https://localhost/db
  DEBUG=true
`;

// Parse with validation
const result = await parseEnv(envContent, { schema: ConfigSchema });

if (result.ok) {
  console.log(result.data); // Fully typed and validated config
  console.log(result.data.PORT); // number (3000)
  console.log(result.data.DEBUG); // boolean (true)
} else {
  console.error('Validation errors:', result.errors);
}
```

### With Valibot

```typescript
import * as v from 'valibot';
import { parseEnv } from 'envox';

const ConfigSchema = v.object({
  API_KEY: v.string(),
  MAX_CONNECTIONS: v.pipe(v.string(), v.transform(Number), v.number()),
  ENABLE_SSL: v.pipe(v.string(), v.transform(val => val === 'true'), v.boolean())
});

const result = await parseEnv(envContent, { schema: ConfigSchema });
```

### Custom Schema

You can also create custom schemas that implement the Standard Schema interface:

```typescript
import type { StandardSchemaV1 } from '@standard-schema/spec';

interface MyConfig {
  name: string;
  version: number;
}

const customSchema: StandardSchemaV1<Record<string, string>, MyConfig> = {
  '~standard': {
    version: 1,
    vendor: 'my-validator',
    validate: (value) => {
      const obj = value as Record<string, string>;
      
      if (!obj.name || !obj.version) {
        return {
          issues: [
            { message: 'name is required', path: ['name'] },
            { message: 'version is required', path: ['version'] }
          ]
        };
      }

      const version = parseInt(obj.version, 10);
      if (isNaN(version)) {
        return {
          issues: [{ message: 'version must be a number', path: ['version'] }]
        };
      }

      return {
        value: {
          name: obj.name,
          version: version
        }
      };
    }
  }
};

const result = await parseEnv(envContent, { schema: customSchema });
```

## Options

### Option Details

- **`allowEmpty`** - When `true`, lines without `=` are ignored. When `false`, they cause parse errors.
- **`allowComments`** - When `true`, lines starting with `#` are treated as comments.
- **`allowExport`** - When `true`, supports `export VAR=value` syntax.
- **`trimValues`** - When `true`, removes leading/trailing whitespace from values.
- **`expandVariables`** - When `true`, expands `${VAR}` and `$VAR` references.
- **`schema`** - Optional Standard Schema for validation and transformation.

## Working with process.env

Envox can parse and validate variables directly from `process.env`:

```typescript
import { parseEnv } from 'envox';
import { z } from 'zod';

// Parse process.env with schema validation
const schema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  API_KEY: z.string().min(1)
});

const result = await parseEnv(process.env, { schema });

if (result.ok) {
  console.log(result.data); // Typed and validated config
}

// Variable expansion also works with process.env
process.env.API_HOST = 'api.example.com';
process.env.API_URL = 'https://${API_HOST}/v1';

const expanded = await parseEnv(process.env, { expandVariables: true });

if (expanded.ok) {
  console.log(expanded.data.API_URL); // "https://api.example.com/v1"
}
```

## Using with dotenv

Envox works great alongside dotenv for enhanced validation and type safety:

```typescript
import 'dotenv/config'; // Load .env file into process.env
import { parseEnv } from 'envox';
import { z } from 'zod';

// Define your configuration schema
const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(),
  API_KEY: z.string().min(32),
  DEBUG: z.coerce.boolean().default(false)
});

// Validate and transform process.env after dotenv loads it
const result = await parseEnv(process.env, { schema: ConfigSchema });

if (result.ok) {
  const config = result.data;
  
  // Now you have fully typed and validated configuration
  console.log(config.PORT); // TypeScript knows this is a number
  console.log(config.DEBUG); // TypeScript knows this is a boolean
  
  export default config;
} else {
  console.error('Configuration errors:', result.errors);
  process.exit(1);
}
```

### Advanced dotenv integration

```typescript
import dotenv from 'dotenv';
import { parseEnv } from 'envox';
import { z } from 'zod';

// Load different .env files based on environment
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: envFile });

const ConfigSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().default(3000),
  // Enable variable expansion for complex configurations
  API_ENDPOINT: z.string().url()
});

// Parse with detailed error reporting
const result = await parseEnv(process.env, { 
  schema: ConfigSchema,
  expandVariables: true 
});

if (!result.ok) {
  console.error('Configuration errors:');
  result.errors.forEach(error => {
    console.error(`- ${error.message} (line ${error.line})`);
  });
  process.exit(1);
}

const config = result.data;
```

## Variable Expansion

When `expandVariables` is enabled, you can reference previously defined variables:

```typescript
const content = `
  BASE_URL=https://api.example.com
  API_ENDPOINT=${BASE_URL}/v1
  FULL_URL=$API_ENDPOINT/users
`;

const result = await parseEnv(content, { expandVariables: true });

if (result.ok) {
  console.log(result.data.FULL_URL); // "https://api.example.com/v1/users"
}
```

## Quote Handling

Envox properly handles both single and double quotes:

```typescript
const content = `
  SINGLE='value with spaces'
  DOUBLE="value with $pecial chars"
  ESCAPED="value with \\"quotes\\""
`;

const result = await parseEnv(content);

if (result.ok) {
  console.log(result.data.SINGLE);  // "value with spaces"
  console.log(result.data.DOUBLE);  // "value with $pecial chars"
  console.log(result.data.ESCAPED); // "value with "quotes""
}
```

## Error Handling

Envox provides detailed error information for both parsing and validation errors:

```typescript
const result = await parseEnv(`
  VALID_VAR=okay
  123_INVALID=bad
  ANOTHER=fine
`);

if (!result.ok) {
  result.errors.forEach(error => {
    console.log(`Line ${error.line}: ${error.message}`);
    console.log(`Content: ${error.content}`);
  });
}
```

### Validation Error Handling

When using schemas, validation errors are included in the errors array:

```typescript
import { z } from 'zod';
import { parseEnv } from 'envox';

const schema = z.object({
  PORT: z.coerce.number().min(1000),
  API_KEY: z.string().min(10)
});

const result = await parseEnv(`
  PORT=80
  API_KEY=short
`, { schema });

if (!result.ok) {
  result.errors.forEach(error => {
    if (error.line === 0) {
      console.log(`Validation error: ${error.message}`);
    } else {
      console.log(`Parse error at line ${error.line}: ${error.message}`);
    }
  });
}
```

## Examples

### Basic Usage

```typescript
import { parseEnv } from 'envox';

const result = await parseEnv(`
  NODE_ENV=development
  PORT=3000
  DATABASE_URL=postgres://localhost/mydb
`);

if (result.ok) {
  // Use in your application
  const server = createServer();
  server.listen(parseInt(result.data.PORT));
}
```

### With Variable Expansion

```typescript
import { parseEnv } from 'envox';

const result = await parseEnv(`
  APP_NAME=myapp
  VERSION=1.0.0
  IMAGE_TAG=${APP_NAME}:${VERSION}
  CONTAINER_NAME=${APP_NAME}-container
`, { expandVariables: true });

if (result.ok) {
  console.log(result.data.IMAGE_TAG); // "myapp:1.0.0"
  console.log(result.vars.find(v => v.key === 'IMAGE_TAG')?.value); // "myapp:1.0.0"
}
```

### Comprehensive Example with Zod

```typescript
import { z } from 'zod';
import { parseEnv } from 'envox';

// Define a comprehensive schema
const AppConfigSchema = z.object({
  // Server settings
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('localhost'),
  
  // Database
  DATABASE_URL: z.string().url(),
  DB_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  
  // API settings
  API_KEY: z.string().min(32),
  API_TIMEOUT: z.coerce.number().int().min(1000).default(5000),
  
  // Feature flags
  ENABLE_LOGGING: z.coerce.boolean().default(true),
  ENABLE_METRICS: z.coerce.boolean().default(false),
  
  // Optional settings
  REDIS_URL: z.string().url().optional(),
  SENTRY_DSN: z.string().url().optional()
});

type AppConfig = z.infer<typeof AppConfigSchema>;

// Load and validate environment
const envContent = `
  NODE_ENV=production
  PORT=8080
  DATABASE_URL=postgres://user:pass@localhost:5432/myapp
  API_KEY=super-secret-api-key-that-is-long-enough
  ENABLE_LOGGING=true
  ENABLE_METRICS=true
`;

const result = await parseEnv(envContent, { schema: AppConfigSchema });

if (result.ok) {
  const config: AppConfig = result.data;
  
  console.log('Configuration loaded successfully:');
  console.log(`Server will run on ${config.HOST}:${config.PORT}`);
  console.log(`Environment: ${config.NODE_ENV}`);
  console.log(`Logging enabled: ${config.ENABLE_LOGGING}`);
  
  // All values are properly typed and validated
  startServer(config);
} else {
  console.error('Failed to load configuration:');
  result.errors.forEach(error => console.error(error.message));
  process.exit(1);
}

function startServer(config: AppConfig) {
  // Your application logic here
  // All config values are guaranteed to be valid
}
```

### Advanced Schema with Transformations

```typescript
import { z } from 'zod';
import { parseEnv } from 'envox';

const AdvancedSchema = z.object({
  // Transform comma-separated values to array
  ALLOWED_ORIGINS: z.string().transform(val => val.split(',').map(s => s.trim())),
  
  // Parse JSON configuration
  FEATURE_FLAGS: z.string().transform(val => {
    try {
      return JSON.parse(val);
    } catch {
      throw new Error('FEATURE_FLAGS must be valid JSON');
    }
  }),
  
  // Custom validation for log level
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  
  // Transform string to Date
  DEPLOYMENT_DATE: z.string().datetime().transform(val => new Date(val)),
  
  // Conditional validation
  CACHE_TTL: z.coerce.number().min(60).max(86400)
});

const result = await parseEnv(`
  ALLOWED_ORIGINS=https://example.com, https://app.example.com
  FEATURE_FLAGS={"newUI": true, "betaFeatures": false}
  LOG_LEVEL=info
  DEPLOYMENT_DATE=2024-01-15T10:30:00Z
  CACHE_TTL=3600
`, { schema: AdvancedSchema });

if (result.ok) {
  console.log(result.data.ALLOWED_ORIGINS); // ['https://example.com', 'https://app.example.com']
  console.log(result.data.FEATURE_FLAGS);   // { newUI: true, betaFeatures: false }
  console.log(result.data.DEPLOYMENT_DATE); // Date object
}
```

### Error Handling with Detailed Reporting

```typescript
import { z } from 'zod';
import { parseEnv } from 'envox';

const StrictSchema = z.object({
  API_URL: z.string().url('Must be a valid URL'),
  MAX_RETRIES: z.coerce.number().int().min(1).max(10),
  TIMEOUT_MS: z.coerce.number().int().min(100)
});

const problematicEnv = `
  # This will have multiple issues
  API_URL=not-a-url
  MAX_RETRIES=20
  TIMEOUT_MS=50
  123_INVALID=value
`;

const result = await parseEnv(problematicEnv, { schema: StrictSchema });

if (!result.ok) {
  console.log('Environment validation failed:');
  
  result.errors.forEach((error, index) => {
    if (error.line > 0) {
      console.log(`${index + 1}. Parse error (line ${error.line}): ${error.message}`);
    } else {
      console.log(`${index + 1}. Validation error: ${error.message}`);
    }
  });
  
  // Output might be:
  // 1. Parse error (line 6): Invalid environment variable key: 123_INVALID
  // 2. Validation error: Must be a valid URL
  // 3. Validation error: Number must be less than or equal to 10
  // 4. Validation error: Number must be greater than or equal to 100
}
```

## TypeScript Integration

Envox provides excellent TypeScript support with full type inference when using schemas:

```typescript
import { z } from 'zod';
import { parseEnv } from 'envox';

const ConfigSchema = z.object({
  API_KEY: z.string(),
  PORT: z.coerce.number(),
  DEBUG: z.coerce.boolean()
});

const result = await parseEnv(envContent, { schema: ConfigSchema });

if (result.ok) {
  // Type is automatically inferred as:
  // { API_KEY: string; PORT: number; DEBUG: boolean; }
  const config = result.data;

  // TypeScript knows the exact types
  config.PORT.toFixed(2);     // ✅ number method
  config.DEBUG ? 'yes' : 'no'; // ✅ boolean
  config.API_KEY.toLowerCase(); // ✅ string method
}
```

## Performance

Envox is designed to be fast and lightweight:

- Zero dependencies for core functionality
- Efficient parsing with minimal allocations
- Optional schema validation only when needed
- Supports both sync and async workflows

```typescript
// For performance-critical applications, you can skip validation
const result = await parseEnv(content); // No schema = faster parsing

// Or use validation only in development
const schema = process.env.NODE_ENV === 'development' ? MySchema : undefined;
const result = await parseEnv(content, { schema });
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](https://github.com/johnie/envox/blob/main/CONTRIBUTING.md) for details.

## License

MIT License. See the [LICENSE](https://github.com/johnie/envox/blob/main/LICENSE) file for details.
