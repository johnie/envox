import { describe, it, expect, vi } from 'vitest';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { EnvoxError } from '@/errors';
import { expandValue } from '@/expansions';
import { parseEnv, isEnvFile, fromObject } from '@/index';
import { REGEX } from '@/constants';
import { toObject } from '@/helpers';

describe('parseEnv', () => {
  describe('basic parsing', () => {
    it('should parse simple key-value pairs', async () => {
      const result = await parseEnv('KEY=value\nANOTHER=test');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({
          KEY: 'value',
          ANOTHER: 'test',
        });
        expect(result.vars).toHaveLength(2);
        expect(result.vars[0]).toEqual({
          key: 'KEY',
          value: 'value',
          line: 1,
        });
      }
    });

    it('should handle empty lines', async () => {
      const result = await parseEnv('KEY=value\n\nANOTHER=test\n');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({
          KEY: 'value',
          ANOTHER: 'test',
        });
        expect(result.vars).toHaveLength(2);
      }
    });

    it('should handle comments when allowComments is true', async () => {
      const result = await parseEnv(
        '# This is a comment\nKEY=value\n# Another comment',
        { allowComments: true }
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ KEY: 'value' });
        expect(result.vars).toHaveLength(1);
      }
    });

    it('should handle export statements when allowExport is true', async () => {
      const result = await parseEnv('export KEY=value\nexport ANOTHER=test', {
        allowExport: true,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({
          KEY: 'value',
          ANOTHER: 'test',
        });
      }
    });

    it('should parse object input', async () => {
      const result = await parseEnv({ KEY: 'value', ANOTHER: 'test' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({
          KEY: 'value',
          ANOTHER: 'test',
        });
        expect(result.vars).toHaveLength(2);
      }
    });

    it('should filter out undefined values from object input', async () => {
      const result = await parseEnv({ KEY: 'value', UNDEFINED: undefined });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ KEY: 'value' });
        expect(result.vars).toHaveLength(1);
      }
    });
  });

  describe('options', () => {
    it('should trim values when trimValues is true', async () => {
      const result = await parseEnv('KEY=  value  ', { trimValues: true });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.KEY).toBe('value');
      }
    });

    it('should reject lines without equals when allowEmpty is false', async () => {
      const result = await parseEnv('KEY=value\nINVALID_LINE', {
        allowEmpty: false,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]!.message).toBe('Missing equals sign');
        expect(result.errors[0]!.line).toBe(2);
      }
    });

    it('should treat comments as regular lines when allowComments is false', async () => {
      const result = await parseEnv('KEY=value\n# This should cause an error', {
        allowComments: false,
        allowEmpty: false,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]!.line).toBe(2);
        expect(result.errors[0]!.message).toBe('Missing equals sign');
      }
    });

    it('should not handle export when allowExport is false', async () => {
      const result = await parseEnv('export KEY=value', { allowExport: false });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]!.message).toContain(
          'Invalid environment variable key'
        );
      }
    });
  });

  describe('quoted values', () => {
    it('should handle double-quoted values', async () => {
      const result = await parseEnv('KEY="value with spaces"');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.KEY).toBe('value with spaces');
      }
    });

    it('should handle single-quoted values', async () => {
      const result = await parseEnv("KEY='value with spaces'");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.KEY).toBe('value with spaces');
      }
    });

    it('should handle escaped quotes in double-quoted values', async () => {
      const result = await parseEnv('KEY="value with \\"quotes\\""');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.KEY).toBe('value with "quotes"');
      }
    });

    it('should handle escaped backslashes in double-quoted values', async () => {
      const result = await parseEnv('KEY="value with \\\\ backslash"');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.KEY).toBe('value with \\ backslash');
      }
    });

    it('should not process escapes in single-quoted values', async () => {
      const result = await parseEnv("KEY='value with \\'quotes\\''");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.KEY).toBe("value with \\'quotes\\'");
      }
    });
  });

  describe('variable expansion', () => {
    it('should expand variables when expandVariables is true', async () => {
      const result = await parseEnv('BASE=hello\nEXPANDED=${BASE}_world', {
        expandVariables: true,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({
          BASE: 'hello',
          EXPANDED: 'hello_world',
        });
      }
    });

    it('should expand variables using simple syntax', async () => {
      const result = await parseEnv('BASE=hello\nEXPANDED=$BASE_world', {
        expandVariables: true,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({
          BASE: 'hello',
          EXPANDED: 'hello_world',
        });
      }
    });

    it('should handle missing variables in expansion', async () => {
      const result = await parseEnv('EXPANDED=${MISSING}_value', {
        expandVariables: true,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.EXPANDED).toBe('_value');
      }
    });

    it('should expand variables from object input', async () => {
      const result = await parseEnv(
        {
          BASE: 'hello',
          EXPANDED: '${BASE}_world',
        },
        { expandVariables: true }
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({
          BASE: 'hello',
          EXPANDED: 'hello_world',
        });
      }
    });

    it('should not expand variables when expandVariables is false', async () => {
      const result = await parseEnv('BASE=hello\nEXPANDED=${BASE}_world', {
        expandVariables: false,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({
          BASE: 'hello',
          EXPANDED: '${BASE}_world',
        });
      }
    });
  });

  describe('validation', () => {
    it('should reject invalid keys', async () => {
      const result = await parseEnv('123INVALID=value');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]!.message).toContain(
          'Invalid environment variable key'
        );
      }
    });

    it('should reject keys with spaces', async () => {
      const result = await parseEnv('INVALID KEY=value');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]!.message).toContain(
          'Invalid environment variable key'
        );
      }
    });

    it('should accept valid keys', async () => {
      const result = await parseEnv(
        'VALID_KEY=value\n_ANOTHER=test\nKEY123=value'
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({
          VALID_KEY: 'value',
          _ANOTHER: 'test',
          KEY123: 'value',
        });
      }
    });
  });

  describe('schema validation', () => {
    it('should validate with a schema', async () => {
      const mockSchema: StandardSchemaV1<
        Record<string, string>,
        { port: number }
      > = {
        '~standard': {
          version: 1,
          vendor: 'test',
          validate: vi.fn().mockResolvedValue({
            value: { port: 3000 },
          }),
        },
      };

      const result = await parseEnv('PORT=3000', { schema: mockSchema });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ port: 3000 });
        expect(mockSchema['~standard'].validate).toHaveBeenCalledWith({
          PORT: '3000',
        });
      }
    });

    it('should handle schema validation errors', async () => {
      const mockSchema: StandardSchemaV1<Record<string, string>, any> = {
        '~standard': {
          version: 1,
          vendor: 'test',
          validate: vi.fn().mockResolvedValue({
            issues: [
              {
                message: 'Required field missing',
                path: ['PORT'],
              },
            ],
          }),
        },
      };

      const result = await parseEnv('OTHER=value', { schema: mockSchema });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]!.message).toBe('Required field missing');
        expect(result.errors[0]!.content).toBe('Path: PORT');
      }
    });

    it('should handle schema validation exceptions', async () => {
      const mockSchema: StandardSchemaV1<Record<string, string>, any> = {
        '~standard': {
          version: 1,
          vendor: 'test',
          validate: vi.fn().mockRejectedValue(new Error('Schema error')),
        },
      };

      const result = await parseEnv('KEY=value', { schema: mockSchema });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]!.message).toBe('Schema error');
      }
    });
  });

  describe('error handling', () => {
    it('should collect multiple errors', async () => {
      const result = await parseEnv(
        '123INVALID=value\nMISSING_EQUALS\n456ALSO_INVALID=test',
        { allowEmpty: false }
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(3);
        expect(result.errors[0]!.line).toBe(1);
        expect(result.errors[1]!.line).toBe(2);
        expect(result.errors[2]!.line).toBe(3);
      }
    });

    it('should handle default options correctly', async () => {
      // Test that default options work without explicitly passing them
      const result = await parseEnv(
        'KEY=value\n# Comment\nexport ANOTHER=test'
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({
          KEY: 'value',
          ANOTHER: 'test',
        });
        expect(result.vars).toHaveLength(2);
      }
    });

    it('should handle empty options object', async () => {
      const result = await parseEnv('KEY=value', {});

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ KEY: 'value' });
      }
    });
  });
});

describe('expandValue', () => {
  it('should expand braced variables', () => {
    const lookup = (key: string) => (key === 'TEST' ? 'value' : undefined);
    const result = expandValue('${TEST}', lookup);
    expect(result).toBe('value');
  });

  it('should expand simple variables', () => {
    const lookup = (key: string) => (key === 'TEST' ? 'value' : undefined);
    const result = expandValue('$TEST', lookup);
    expect(result).toBe('value');
  });

  it('should handle missing variables', () => {
    const lookup = () => undefined;
    const result = expandValue('${MISSING}', lookup);
    expect(result).toBe('');
  });

  it('should expand multiple variables', () => {
    const lookup = (key: string) => {
      if (key === 'A') return 'hello';
      if (key === 'B') return 'world';
      return undefined;
    };
    const result = expandValue('${A}_${B}', lookup);
    expect(result).toBe('hello_world');
  });

  it('should handle mixed braced and simple variables', () => {
    const lookup = (key: string) => {
      if (key === 'A') return 'hello';
      if (key === 'B') return 'world';
      return undefined;
    };
    const result = expandValue('${A}_$B', lookup);
    expect(result).toBe('hello_world');
  });
});

describe('EnvoxError', () => {
  it('should create error with correct properties', () => {
    const error = new EnvoxError(1, 'INVALID=value', 'Test error');
    expect(error.name).toBe('EnvoxError');
    expect(error.line).toBe(1);
    expect(error.content).toBe('INVALID=value');
    expect(error.message).toBe('Test error');
  });

  it('should be instanceof Error', () => {
    const error = new EnvoxError(1, 'content', 'message');
    expect(error instanceof Error).toBe(true);
    expect(error instanceof EnvoxError).toBe(true);
  });
});

describe('constants', () => {
  describe('REGEX', () => {
    it('VAR_EXPANSION should match braced variables', () => {
      expect('${TEST}'.match(REGEX.VAR_EXPANSION)).toBeTruthy();
      expect('${TEST_VAR}'.match(REGEX.VAR_EXPANSION)).toBeTruthy();
    });

    it('VAR_EXPANSION should match simple variables', () => {
      expect('$TEST'.match(REGEX.VAR_EXPANSION)).toBeTruthy();
      expect('$TEST_VAR'.match(REGEX.VAR_EXPANSION)).toBeTruthy();
    });

    it('VALID_KEY should match valid keys', () => {
      expect(REGEX.VALID_KEY.test('TEST')).toBe(true);
      expect(REGEX.VALID_KEY.test('TEST_VAR')).toBe(true);
      expect(REGEX.VALID_KEY.test('_TEST')).toBe(true);
      expect(REGEX.VALID_KEY.test('TEST123')).toBe(true);
    });

    it('VALID_KEY should not match invalid keys', () => {
      expect(REGEX.VALID_KEY.test('123TEST')).toBe(false);
      expect(REGEX.VALID_KEY.test('TEST-VAR')).toBe(false);
      expect(REGEX.VALID_KEY.test('TEST VAR')).toBe(false);
    });

    it('NEED_QUOTES should match values that need quotes', () => {
      expect(REGEX.NEED_QUOTES.test('value with spaces')).toBe(true);
      expect(REGEX.NEED_QUOTES.test('value"with"quotes')).toBe(true);
      expect(REGEX.NEED_QUOTES.test("value'with'quotes")).toBe(true);
      expect(REGEX.NEED_QUOTES.test('value$with$dollar')).toBe(true);
      expect(REGEX.NEED_QUOTES.test('value\\with\\backslash')).toBe(true);
    });

    it('NEED_QUOTES should not match simple values', () => {
      expect(REGEX.NEED_QUOTES.test('simplevalue')).toBe(false);
      expect(REGEX.NEED_QUOTES.test('simple_value')).toBe(false);
      expect(REGEX.NEED_QUOTES.test('simple123')).toBe(false);
    });

    it('ENV_VAR_LIKE should match environment variable patterns', () => {
      expect(REGEX.ENV_VAR_LIKE.test('TEST')).toBe(true);
      expect(REGEX.ENV_VAR_LIKE.test('TEST_VAR')).toBe(true);
      expect(REGEX.ENV_VAR_LIKE.test('_TEST')).toBe(true);
      expect(REGEX.ENV_VAR_LIKE.test('TEST123')).toBe(true);
    });
  });
});

describe('helpers', () => {
  describe('isEnvFile', () => {
    it('should return true for valid env file content', () => {
      expect(isEnvFile('KEY=value\nANOTHER=test')).toBe(true);
    });

    it('should return true for env file with comments', () => {
      expect(
        isEnvFile('# Comment\nKEY=value\n# Another comment\nANOTHER=test')
      ).toBe(true);
    });

    it('should return true for env file with export statements', () => {
      expect(isEnvFile('export KEY=value\nexport ANOTHER=test')).toBe(true);
    });

    it('should return false for empty content', () => {
      expect(isEnvFile('')).toBe(false);
      expect(isEnvFile('   \n  \n  ')).toBe(false);
    });

    it('should return false for content with too few valid lines', () => {
      expect(
        isEnvFile('KEY=value\ninvalid line\nanother invalid\nyet another')
      ).toBe(false);
    });

    it('should return true when at least 50% of lines are valid', () => {
      expect(isEnvFile('KEY=value\nANOTHER=test\ninvalid line')).toBe(true);
    });

    it('should ignore comment lines in calculation', () => {
      expect(isEnvFile('# Comment\nKEY=value\n# Another comment')).toBe(true);
    });
  });

  describe('toObject', () => {
    it('should convert variables array to object', () => {
      const variables = [
        { key: 'KEY1', value: 'value1', line: 1 },
        { key: 'KEY2', value: 'value2', line: 2 },
      ];
      const result = toObject(variables);
      expect(result).toEqual({
        KEY1: 'value1',
        KEY2: 'value2',
      });
    });

    it('should handle empty array', () => {
      const result = toObject([]);
      expect(result).toEqual({});
    });

    it('should handle duplicate keys (last one wins)', () => {
      const variables = [
        { key: 'KEY', value: 'value1', line: 1 },
        { key: 'KEY', value: 'value2', line: 2 },
      ];
      const result = toObject(variables);
      expect(result).toEqual({ KEY: 'value2' });
    });
  });

  describe('fromObject', () => {
    it('should convert object to env format', () => {
      const obj = { KEY1: 'value1', KEY2: 'value2' };
      const result = fromObject(obj);
      expect(result).toBe('KEY1=value1\nKEY2=value2');
    });

    it('should quote values that need quotes', () => {
      const obj = { KEY: 'value with spaces' };
      const result = fromObject(obj);
      expect(result).toBe('KEY="value with spaces"');
    });

    it('should escape quotes in values', () => {
      const obj = { KEY: 'value with "quotes"' };
      const result = fromObject(obj);
      expect(result).toBe('KEY="value with \\"quotes\\""');
    });

    it('should add export prefix when includeExport is true', () => {
      const obj = { KEY: 'value' };
      const result = fromObject(obj, { includeExport: true });
      expect(result).toBe('export KEY=value');
    });

    it('should handle empty object', () => {
      const result = fromObject({});
      expect(result).toBe('');
    });

    it('should handle values with various special characters', () => {
      const obj = {
        SPACES: 'value with spaces',
        QUOTES: 'value with "quotes"',
        SINGLE_QUOTES: "value with 'quotes'",
        DOLLAR: 'value with $dollar',
        BACKSLASH: 'value with \\backslash',
        SIMPLE: 'simplevalue',
      };
      const result = fromObject(obj);
      expect(result).toContain('SPACES="value with spaces"');
      expect(result).toContain('QUOTES="value with \\"quotes\\""');
      expect(result).toContain('SINGLE_QUOTES="value with \'quotes\'"');
      expect(result).toContain('DOLLAR="value with $dollar"');
      expect(result).toContain('BACKSLASH="value with \\backslash"');
      expect(result).toContain('SIMPLE=simplevalue');
    });
  });
});
