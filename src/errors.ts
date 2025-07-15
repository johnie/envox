export class EnvoxError extends Error {
  constructor(
    public readonly line: number,
    public readonly content: string,
    message: string,
  ) {
    super(message);
    this.name = 'EnvoxError';
  }
}
