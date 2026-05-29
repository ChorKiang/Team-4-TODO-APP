import { test } from '@playwright/test';

test.describe('01 Authentication', () => {
  test.skip(true, 'Requires full virtual authenticator integration and seeded users in CI.');

  test('register new user', async () => {});
  test('login existing user', async () => {});
  test('logout user', async () => {});
});
