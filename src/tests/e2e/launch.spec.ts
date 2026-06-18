import { test, expect, MODULE_ID } from './fixtures/foundry-clients';

// Smoke spec: proves the whole e2e path end to end — a real Foundry, the module's public
// API, and the built Svelte window rendering. Opt-in tier (needs a licensed Foundry + a
// migration-current PF2e world); see README.md for conventions.
test.describe('Module launches', () => {
  test('the public API opens the encounter builder window', async ({ gmPage }) => {
    await gmPage.evaluate((id) => (window as any).game.modules.get(id).api.open(), MODULE_ID);
    const win = gmPage.locator(`#${MODULE_ID}`);
    await expect(win).toBeVisible();
  });
});
