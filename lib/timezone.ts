const SINGAPORE_TZ = 'Asia/Singapore';

export function getSingaporeNow(): Date {
  const now = new Date();
  const sg = new Date(now.toLocaleString('en-US', { timeZone: SINGAPORE_TZ }));
  return sg;
}

export function formatSingaporeDate(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  return date.toLocaleString('en-SG', {
    timeZone: SINGAPORE_TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function toDateTimeLocalValue(input?: string | null): string {
  if (!input) return '';
  const date = new Date(input);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

export function fromDateTimeLocal(value?: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function calculateNextDueDate(
  currentDueDate: string,
  pattern: 'daily' | 'weekly' | 'monthly' | 'yearly',
): string {
  const date = new Date(currentDueDate);

  switch (pattern) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }

  return date.toISOString();
}
