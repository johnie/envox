// tests/envox.test.ts
import { describe, it, expect } from 'vitest';
import { Envox, parseEnv, objectToEnv, envToObject } from '@/index';

describe('Envox basic parsing', () => {
  const parser = new Envox({ expandVariables: true });

  it('parses simple key=value pairs', () => {
    const result = parser.parse('FOO=bar\nBAZ=qux');
    expect(result.isValid).toBe(true);
    const vars = Object.fromEntries(
      result.variables.map((v) => [v.key, v.value])
    );
    expect(vars).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('ignores empty lines and comments when allowed', () => {
    const content = `
      # comment
      FOO=1

      # another
      BAR=2
    `;
    const r = new Envox({ allowComments: true }).parse(content);
    expect(r.isValid).toBe(true);
    expect(r.variables.map((v) => v.key)).toEqual(['FOO', 'BAR']);
  });

  it('supports export prefix', () => {
    const r = new Envox({ allowExport: true }).parse('export X=42');
    expect(r.isValid).toBe(true);
    expect(r.variables[0]!.key).toBe('X');
  });

  it('trims values when trimValues=true', () => {
    const r = new Envox({ trimValues: true }).parse('X=  spaced  ');
    expect(r.variables[0]!.value).toBe('spaced');
  });

  it('handles single and double quotes in values', () => {
    const r = new Envox().parse(`A="hello world"\nB='hi there'`);
    const vars = Object.fromEntries(r.variables.map((v) => [v.key, v.value]));
    expect(vars).toEqual({ A: 'hello world', B: 'hi there' });
  });
});

describe('Envox variable expansion', () => {
  it('expands ${VAR} and $VAR', () => {
    const p = new Envox({ expandVariables: true });
    const input = ['FOO=foo', 'BAR=${FOO}-bar', 'BAZ=$BAR-baz'].join('\n');
    const r = p.parse(input);
    expect(r.isValid).toBe(true);
    const vars = Object.fromEntries(r.variables.map((v) => [v.key, v.value]));
    expect(vars.FOO).toBe('foo');
    expect(vars.BAR).toBe('foo-bar');
    expect(vars.BAZ).toBe('foo-bar-baz');
  });
});

describe('Error handling', () => {
  it('rejects invalid keys', () => {
    const parser = new Envox();
    const r = parser.parse('1ABC=hi');
    expect(r.isValid).toBe(false);
    expect(r.errors[0]!.message).toMatch(/Invalid environment variable key/);
  });

  it('aborts on missing equals when allowEmpty=false', () => {
    const parser = new Envox({ allowEmpty: false });
    const r = parser.parse('NO_EQUALS');
    expect(r.isValid).toBe(false);
    expect(r.errors[0]!.message).toContain('Missing equals sign');
  });
});

describe('Helper utilities', () => {
  it('toObject and fromObject round-trip properly', () => {
    const obj = { A: '1', B: 'two words', C: 'special$char' };
    const str = objectToEnv(obj, true);
    const back = parseEnv(str);
    expect(back.isValid).toBe(true);
    expect(envToObject(str)).toEqual(obj);
  });
});
