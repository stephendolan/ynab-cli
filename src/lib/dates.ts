import dayjs from 'dayjs';
import { YnabCliError } from './errors.js';

export function parseDate(input: string): string {
  const d = dayjs(input);
  if (!d.isValid()) {
    throw new YnabCliError(`Invalid date: ${input}`, 400);
  }
  return d.format('YYYY-MM-DD');
}

export function todayDate(): string {
  return dayjs().format('YYYY-MM-DD');
}
