import { test } from '@playwright/test';

test.describe('03 Priority', () => {
  test.skip(true, 'Requires authenticated fixture and deterministic seeded todos.');

  test('create priorities', async () => {});
  test('filter by priority', async () => {});
  test('sort priority order', async () => {});
});
