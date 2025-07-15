import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { EnvoxParseError } from '@/types';

export async function runSchema<TIn, TOut>(
  schema: StandardSchemaV1<TIn, TOut>,
  data: TIn,
): Promise<
  { success: true; data: TOut } | { success: false; errors: EnvoxParseError[] }
> {
  try {
    const validation = await schema['~standard'].validate(data);

    if ('issues' in validation) {
      const errors: EnvoxParseError[] =
        validation.issues?.map((issue) => ({
          line: 0,
          message: issue.message,
          content: issue.path
            ? `Path: ${formatPath(issue.path)}`
            : 'Schema validation failed',
        })) || [];

      return { success: false, errors };
    }

    return { success: true, data: validation.value };
  } catch (error) {
    return {
      success: false,
      errors: [
        {
          line: 0,
          message:
            error instanceof Error ? error.message : 'Schema validation failed',
          content: 'Schema validation error',
        },
      ],
    };
  }
}

function formatPath(
  path: ReadonlyArray<PropertyKey | StandardSchemaV1.PathSegment>,
): string {
  return path
    .map((segment) => {
      if (typeof segment === 'object' && 'key' in segment) {
        return String(segment.key);
      }
      return String(segment);
    })
    .join('.');
}
