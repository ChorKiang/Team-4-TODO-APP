import { test } from '@playwright/test';

test.describe('02 Todo CRUD', () => {
  test.skip(true, 'Requires authenticated fixture and isolated DB per run.');

  test('create todo with title only', async () => {});
  test('edit todo', async () => {});
  test('toggle complete', async () => {});
  test('delete todo', async () => {});
});
