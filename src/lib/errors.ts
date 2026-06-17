import type { YnabError } from '../types/index.js';
import { outputJson } from './output.js';

export class YnabCliError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'YnabCliError';
  }
}

const ERROR_STATUS_CODES: Record<string, number> = {
  bad_request: 400,
  not_authorized: 401,
  subscription_lapsed: 403,
  trial_expired: 403,
  unauthorized_scope: 403,
  data_limit_reached: 403,
  not_found: 404,
  resource_not_found: 404,
  conflict: 409,
  too_many_requests: 429,
  internal_server_error: 500,
  service_unavailable: 503,
};

export function sanitizeErrorMessage(message: string): string {
  const sensitivePatterns = [
    /Bearer\s+[\w\-._~+/]+=*/gi,
    /token[=:]\s*[\w\-._~+/]+=*/gi,
    /api[_-]?key[=:]\s*[\w\-._~+/]+=*/gi,
    /authorization:\s*bearer\s+[\w\-._~+/]+=*/gi,
  ];

  let sanitized = message;
  for (const pattern of sensitivePatterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  return sanitized.length > 500 ? sanitized.substring(0, 500) + '...' : sanitized;
}

interface YnabApiError {
  name?: string;
  detail?: string;
  message?: string;
  id?: string;
}

function isErrorObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function sanitizeApiError(error: unknown): YnabError {
  if (!isErrorObject(error)) {
    return {
      name: 'api_error',
      detail: 'An error occurred',
      id: undefined,
    };
  }

  const apiError = error as YnabApiError;
  const detail = sanitizeErrorMessage(
    String(apiError.detail || apiError.message || 'An error occurred')
  );

  return {
    name: apiError.name || 'api_error',
    detail,
    id: apiError.id,
  };
}

function enhanceRateLimitMessage(detail: string): string {
  return `${detail}\n\nYNAB API limit: 200 requests/hour (rolling window). Wait a few minutes and retry.`;
}

function formatErrorResponse(name: string, detail: string, statusCode: number): never {
  const enhancedDetail = name === 'too_many_requests' ? enhanceRateLimitMessage(detail) : detail;

  outputJson({ error: { name, detail: enhancedDetail, statusCode } });
  process.exit(1);
  throw new Error('process.exit returned unexpectedly');
}

export function handleYnabError(error: unknown): never {
  if (!isErrorObject(error)) {
    formatErrorResponse('unknown_error', 'An unexpected error occurred', 1);
  }

  const errorObj = error as { error?: unknown; message?: string };

  if (errorObj.error) {
    const ynabError: YnabError = sanitizeApiError(errorObj.error);
    formatErrorResponse(
      ynabError.name,
      ynabError.detail,
      ERROR_STATUS_CODES[ynabError.name] || 500
    );
  }

  if (error instanceof YnabCliError) {
    const sanitized = sanitizeErrorMessage(error.message);
    formatErrorResponse('cli_error', sanitized, error.statusCode || 1);
  }

  const sanitized = sanitizeErrorMessage(errorObj.message || 'An unexpected error occurred');
  formatErrorResponse('unknown_error', sanitized, 1);
}
