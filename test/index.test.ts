import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { Envox, parseEnv, objectToEnv, envToObject } from '@/index';

// Mock schema for testing
const createMockSchema = <T>(
  validate: (
    value: unknown
  ) => StandardSchemaV1.Result<T> | Promise<StandardSchemaV1.Result<T>>
): StandardSchemaV1<Record<string, string>, T> => ({
  '~standard': {
    version: 1,
    vendor: 'test',
    validate,
  },
});

describe('Envox basic parsing', () => {
  const parser = new Envox({ expandVariables: true });

  it('parses simple key=value pairs', async () => {
    const result = await parser.parse('FOO=bar\nBAZ=qux');
    expect(result.isValid).toBe(true);
    const vars = Object.fromEntries(
      result.variables.map((v) => [v.key, v.value])
    );
    expect(vars).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('ignores empty lines and comments when allowed', async () => {
    const content = `
      # comment
      FOO=1

      # another
      BAR=2
    `;
    const r = await new Envox({ allowComments: true }).parse(content);
    expect(r.isValid).toBe(true);
    expect(r.variables.map((v) => v.key)).toEqual(['FOO', 'BAR']);
  });

  it('supports export prefix', async () => {
    const r = await new Envox({ allowExport: true }).parse('export X=42');
    expect(r.isValid).toBe(true);
    expect(r.variables[0]!.key).toBe('X');
  });

  it('trims values when trimValues=true', async () => {
    const r = await new Envox({ trimValues: true }).parse('X=  spaced  ');
    expect(r.variables[0]!.value).toBe('spaced');
  });

  it('handles single and double quotes in values', async () => {
    const r = await new Envox().parse(`A="hello world"\nB='hi there'`);
    const vars = Object.fromEntries(r.variables.map((v) => [v.key, v.value]));
    expect(vars).toEqual({ A: 'hello world', B: 'hi there' });
  });
});

describe('Envox variable expansion', () => {
  it('expands ${VAR} and $VAR', async () => {
    const p = new Envox({ expandVariables: true });
    const input = ['FOO=foo', 'BAR=${FOO}-bar', 'BAZ=$BAR-baz'].join('\n');
    const r = await p.parse(input);
    expect(r.isValid).toBe(true);
    const vars = Object.fromEntries(r.variables.map((v) => [v.key, v.value]));
    expect(vars.FOO).toBe('foo');
    expect(vars.BAR).toBe('foo-bar');
    expect(vars.BAZ).toBe('foo-bar-baz');
  });
});

describe('Error handling', () => {
  it('rejects invalid keys', async () => {
    const parser = new Envox();
    const r = await parser.parse('1ABC=hi');
    expect(r.isValid).toBe(false);
    expect(r.errors[0]!.message).toMatch(/Invalid environment variable key/);
  });

  it('aborts on missing equals when allowEmpty=false', async () => {
    const parser = new Envox({ allowEmpty: false });
    const r = await parser.parse('NO_EQUALS');
    expect(r.isValid).toBe(false);
    expect(r.errors[0]!.message).toContain('Missing equals sign');
  });
});

describe('Schema validation', () => {
  interface Config extends Record<string, any> {
    PORT: number;
    DEBUG: boolean;
    API_KEY: string;
  }

  const successSchema = createMockSchema<Config>((value) => {
    const obj = value as Record<string, string>;

    // Mock validation logic
    if (!obj.PORT || !obj.API_KEY) {
      return {
        issues: [
          { message: 'PORT is required' },
          { message: 'API_KEY is required' },
        ],
      };
    }

    const port = parseInt(obj.PORT, 10);
    if (isNaN(port)) {
      return {
        issues: [{ message: 'PORT must be a number' }],
      };
    }

    return {
      value: {
        PORT: port,
        DEBUG: obj.DEBUG === 'true',
        API_KEY: obj.API_KEY,
      },
    };
  });

  const failureSchema = createMockSchema<Config>(() => ({
    issues: [
      { message: 'Validation failed', path: ['PORT'] },
      { message: 'Another error', path: [{ key: 'API_KEY' }] },
    ],
  }));

  it('validates successfully with schema', async () => {
    const parser = new Envox({ schema: successSchema });
    const content = 'PORT=3000\nDEBUG=true\nAPI_KEY=secret';
    const result = await parser.parse(content);

    expect(result.isValid).toBe(true);
    expect(result.env).toEqual({
      PORT: 3000,
      DEBUG: true,
      API_KEY: 'secret',
    });
  });

  it('handles validation errors', async () => {
    const parser = new Envox({ schema: failureSchema });
    const content = 'PORT=3000\nAPI_KEY=secret';
    const result = await parser.parse(content);

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]!.message).toBe('Validation failed');
    expect(result.errors[1]!.message).toBe('Another error');
  });

  it('works without schema (backward compatibility)', async () => {
    const parser = new Envox();
    const content = 'FOO=bar\nBAZ=qux';
    const result = await parser.parse(content);

    expect(result.isValid).toBe(true);
    expect(result.env).toBeUndefined();
    expect(result.variables).toHaveLength(2);
  });
});

describe('Helper utilities', () => {
  it('toObject and fromObject round-trip properly', async () => {
    const obj = { A: '1', B: 'two words', C: 'special$char' };
    const str = objectToEnv(obj, true);
    const back = await parseEnv(str);
    expect(back.isValid).toBe(true);
    expect(await envToObject(str)).toEqual(obj);
  });

  it('envToObject with schema validation', async () => {
    interface SimpleConfig {
      NAME: string;
      COUNT: number;
    }

    const schema = createMockSchema<SimpleConfig>((value) => {
      const obj = value as Record<string, string>;
      return {
        value: {
          NAME: obj.NAME || '',
          COUNT: parseInt(obj.COUNT || '0', 10),
        },
      };
    });

    const content = 'NAME=test\nCOUNT=42';
    const result = await envToObject(content, { schema });

    expect(result).toEqual({
      NAME: 'test',
      COUNT: 42,
    });
  });

  it('envToObject throws on validation failure', async () => {
    const schema = createMockSchema(() => ({
      issues: [{ message: 'Validation failed' }],
    }));

    const content = 'NAME=test';

    await expect(envToObject(content, { schema })).rejects.toThrow(
      'Invalid environment file'
    );
  });
});

describe('Async schema support', () => {
  it('handles async schema validation', async () => {
    const asyncSchema = createMockSchema<{ VALUE: string }>(async (value) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      const obj = value as Record<string, string>;
      return { value: { VALUE: obj.VALUE || '' } };
    });

    const parser = new Envox({ schema: asyncSchema });
    const result = await parser.parse('VALUE=test');

    expect(result.isValid).toBe(true);
    expect(result.env).toEqual({ VALUE: 'test' });
  });
});

describe('process.env parsing', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = { ...originalEnv };
  });

  it('should parse variables directly from process.env', async () => {
    process.env.PROC_VAR_1 = 'hello';
    process.env.PROC_VAR_2 = 'world';

    const result = await envToObject(process.env);

    expect(result.PROC_VAR_1).toBe('hello');
    expect(result.PROC_VAR_2).toBe('world');
  });

  it('should ignore undefined values in process.env', async () => {
    process.env.DEFINED_VAR = 'is here';
    process.env.UNDEFINED_VAR = undefined;

    const result = await envToObject(process.env);

    expect(result.DEFINED_VAR).toBe('is here');
    expect(result).not.toHaveProperty('UNDEFINED_VAR');
  });

  it('should validate process.env with a schema and transform types', async () => {
    process.env.PORT = '8080';
    process.env.NODE_ENV = 'development';

    const schema = createMockSchema<{ PORT: number; NODE_ENV: string }>(
      (value) => {
        const obj = value as Record<string, string>;
        return {
          value: {
            PORT: parseInt(obj.PORT || '0', 10),
            NODE_ENV: obj.NODE_ENV || 'test',
          },
        };
      }
    );

    const result = await envToObject(process.env, { schema });

    expect(result.PORT).toBe(8080);
    expect(result.NODE_ENV).toBe('development');
    expect(typeof result.PORT).toBe('number');
  });

  it('should expand variables that reference other variables in process.env', async () => {
    process.env.API_HOST = 'api.example.com';
    process.env.API_URL = 'https://${API_HOST}/v1';

    const result = await envToObject(process.env, { expandVariables: true });

    expect(result.API_URL).toBe('https://api.example.com/v1');
  });

  it('should return a detailed parse result when using parseEnv with process.env', async () => {
    process.env.KEY1 = 'VALUE1';

    const result = await parseEnv(process.env);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);

    const variable = result.variables.find((v) => v.key === 'KEY1');
    expect(variable).toBeDefined();
    expect(variable?.value).toBe('VALUE1');
    expect(variable?.line).toBe(0);
  });
});
