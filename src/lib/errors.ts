export const extractFunctionErrorMessage = async (error: unknown, fallback: string): Promise<string> => {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try {
      const payload = (await context.clone().json()) as { error?: unknown };
      if (typeof payload.error === 'string' && payload.error.trim()) {
        return payload.error;
      }
    } catch {
      // Fall through to generic error message if response body is not JSON.
    }
  }
  return error instanceof Error ? error.message : fallback;
};
