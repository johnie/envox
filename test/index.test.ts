import { describe, it, expect, vi } from 'vitest';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { parseEnv, isEnvFile, fromObject } from '@/index';
import { toObject } from '@/helpers';

describe('parseEnv', () => {
  describe('basic parsing', () => {
    it('should parse simple key-value pairs', () => {
      const result = parseEnv('KEY=value\nANOTHER=test');

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

    it('should handle empty lines', () => {
      const result = parseEnv('KEY=value\n\nANOTHER=test\n');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({
          KEY: 'value',
          ANOTHER: 'test',
        });
        expect(result.vars).toHaveLength(2);
      }
    });

    it('should handle comments when allowComments is true', () => {
      const result = parseEnv(
        '# This is a comment\nKEY=value\n# Another comment',
        { allowComments: true }
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ KEY: 'value' });
        expect(result.vars).toHaveLength(1);
      }
    });

    it('should handle export statements when allowExport is true', () => {
      const result = parseEnv('export KEY=value\nexport ANOTHER=test', {
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

    it('should parse object input', () => {
      const result = parseEnv({ KEY: 'value', ANOTHER: 'test' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({
          KEY: 'value',
          ANOTHER: 'test',
        });
        expect(result.vars).toHaveLength(2);
      }
    });

    it('should filter out undefined values from object input', () => {
      const result = parseEnv({ KEY: 'value', UNDEFINED: undefined });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ KEY: 'value' });
        expect(result.vars).toHaveLength(1);
      }
    });
  });

  describe('options', () => {
    it('should trim values when trimValues is true', () => {
      const result = parseEnv('KEY=  value  ', { trimValues: true });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.KEY).toBe('value');
      }
    });

    it('should reject lines without equals when allowEmpty is false', () => {
      const result = parseEnv('KEY=value\nINVALID_LINE', {
        allowEmpty: false,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]?.message).toBe('Missing equals sign');
        expect(result.errors[0]?.line).toBe(2);
      }
    });

    it('should treat comments as regular lines when allowComments is false', () => {
      const result = parseEnv('KEY=value\n# This should cause an error', {
        allowComments: false,
        allowEmpty: false,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]?.line).toBe(2);
        expect(result.errors[0]?.message).toBe('Missing equals sign');
      }
    });

    it('should not handle export when allowExport is false', () => {
      const result = parseEnv('export KEY=value', { allowExport: false });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]?.message).toContain(
          'Invalid environment variable key'
        );
      }
    });
  });

  describe('quoted values', () => {
    it('should handle double-quoted values', () => {
      const result = parseEnv('KEY="value with spaces"');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.KEY).toBe('value with spaces');
      }
    });

    it('should handle single-quoted values', () => {
      const result = parseEnv("KEY='value with spaces'");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.KEY).toBe('value with spaces');
      }
    });

    it('should handle escaped quotes in double-quoted values', () => {
      const result = parseEnv('KEY="value with \\"quotes\\""');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.KEY).toBe('value with "quotes"');
      }
    });

    it('should handle escaped backslashes in double-quoted values', () => {
      const result = parseEnv('KEY="value with \\\\ backslash"');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.KEY).toBe('value with \\ backslash');
      }
    });

    it('should not process escapes in single-quoted values', () => {
      const result = parseEnv("KEY='value with \\'quotes\\''");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.KEY).toBe("value with \\'quotes\\'");
      }
    });
  });

  describe('variable expansion', () => {
    it('should expand variables when expandVariables is true', () => {
      const result = parseEnv('BASE=hello\nEXPANDED=${BASE}_world', {
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

    it('should expand variables using simple syntax', () => {
      const result = parseEnv('BASE=hello\nEXPANDED=$BASE_world', {
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

    it('should handle missing variables in expansion', () => {
      const result = parseEnv('EXPANDED=${MISSING}_value', {
        expandVariables: true,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.EXPANDED).toBe('_value');
      }
    });

    it('should expand variables from object input', () => {
      const result = parseEnv(
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

    it('should not expand variables when expandVariables is false', () => {
      const result = parseEnv('BASE=hello\nEXPANDED=${BASE}_world', {
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

    it('should expand braced variables', () => {
      const result = parseEnv('TEST=value\nOUTPUT=${TEST}', {
        expandVariables: true,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.OUTPUT).toBe('value');
      }
    });

    it('should expand simple dollar variables', () => {
      const result = parseEnv('TEST=value\nOUTPUT=$TEST', {
        expandVariables: true,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.OUTPUT).toBe('value');
      }
    });

    it('should resolve missing expansion variables to empty string', () => {
      const result = parseEnv('OUTPUT=${MISSING}', {
        expandVariables: true,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.OUTPUT).toBe('');
      }
    });

    it('should expand multiple variables in one value', () => {
      const result = parseEnv('A=hello\nB=world\nOUTPUT=${A}_${B}', {
        expandVariables: true,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.OUTPUT).toBe('hello_world');
      }
    });

    it('should expand mixed braced and simple variables', () => {
      const result = parseEnv('A=hello\nB=world\nOUTPUT=${A}_$B', {
        expandVariables: true,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.OUTPUT).toBe('hello_world');
      }
    });
  });

  describe('validation', () => {
    it('should reject invalid keys', () => {
      const result = parseEnv('123INVALID=value');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]?.message).toContain(
          'Invalid environment variable key'
        );
      }
    });

    it('should reject keys with spaces', () => {
      const result = parseEnv('INVALID KEY=value');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]?.message).toContain(
          'Invalid environment variable key'
        );
      }
    });

    it('should accept valid keys', () => {
      const result = parseEnv('VALID_KEY=value\n_ANOTHER=test\nKEY123=value');

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
    it('should validate with a schema', () => {
      const mockSchema: StandardSchemaV1<
        Record<string, string>,
        { port: number }
      > = {
        '~standard': {
          version: 1,
          vendor: 'test',
          validate: vi.fn().mockReturnValue({
            value: { port: 3000 },
          }),
        },
      };

      const result = parseEnv('PORT=3000', { schema: mockSchema });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ port: 3000 });
        expect(mockSchema['~standard'].validate).toHaveBeenCalledWith({
          PORT: '3000',
        });
      }
    });

    it('should handle schema validation errors', () => {
      const mockSchema: StandardSchemaV1<Record<string, string>, unknown> = {
        '~standard': {
          version: 1,
          vendor: 'test',
          validate: vi.fn().mockReturnValue({
            issues: [
              {
                message: 'Required field missing',
                path: ['PORT'],
              },
            ],
          }),
        },
      };

      const result = parseEnv('OTHER=value', { schema: mockSchema });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]?.message).toBe('Required field missing');
        expect(result.errors[0]?.content).toBe('Path: PORT');
      }
    });

    it('should handle schema validation exceptions', () => {
      const mockSchema: StandardSchemaV1<Record<string, string>, unknown> = {
        '~standard': {
          version: 1,
          vendor: 'test',
          validate: vi.fn().mockImplementation(() => {
            throw new Error('Schema error');
          }),
        },
      };

      const result = parseEnv('KEY=value', { schema: mockSchema });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]?.message).toBe('Schema error');
      }
    });
  });

  describe('error handling', () => {
    it('should collect multiple errors', () => {
      const result = parseEnv(
        '123INVALID=value\nMISSING_EQUALS\n456ALSO_INVALID=test',
        { allowEmpty: false }
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(3);
        expect(result.errors[0]?.line).toBe(1);
        expect(result.errors[1]?.line).toBe(2);
        expect(result.errors[2]?.line).toBe(3);
      }
    });

    it('should include line content in errors', () => {
      const result = parseEnv('123BAD=value');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0]?.content).toBe('123BAD=value');
        expect(result.errors[0]?.line).toBe(1);
      }
    });

    it('should handle default options correctly', () => {
      const result = parseEnv('KEY=value\n# Comment\nexport ANOTHER=test');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({
          KEY: 'value',
          ANOTHER: 'test',
        });
        expect(result.vars).toHaveLength(2);
      }
    });

    it('should handle empty options object', () => {
      const result = parseEnv('KEY=value', {});

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ KEY: 'value' });
      }
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
