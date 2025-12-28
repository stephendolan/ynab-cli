import { handleYnabError, YnabCliError } from './errors.js';

export function withErrorHandling<TArgs extends unknown[], R>(
  fn: (...args: TArgs) => Promise<R>
): (...args: TArgs) => Promise<void> {
  return async (...args: TArgs) => {
    try {
      await fn(...args);
    } catch (error) {
      handleYnabError(error);
    }
  };
}

export function requireConfirmation(itemType: string, confirmed: boolean = false): void {
  if (!confirmed) {
    throw new YnabCliError(
      `Deleting ${itemType} requires --yes flag to confirm`,
      400
    );
  }
}

export function buildUpdateObject<T>(
  options: T,
  mapping: Record<string, string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const optionsRecord = options as Record<string, unknown>;

  for (const [optionKey, targetKey] of Object.entries(mapping)) {
    if (optionsRecord[optionKey] !== undefined) {
      result[targetKey] = optionsRecord[optionKey];
    }
  }

  return result;
}
