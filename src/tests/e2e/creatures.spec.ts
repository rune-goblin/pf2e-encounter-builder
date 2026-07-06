import { test, expect, MODULE_ID } from './fixtures/foundry-clients';

// Drives loadCreatures against a real Foundry — the compendium-indexing path vitest can't reach
// (it reads game.packs) and the exact code behind the "only world creatures, not the compendia"
// bug. Self-contained: each test builds its own throwaway world Actor compendia (the test world
// may ship no bestiary), asserts, and tears them down. Opt-in tier; see README.md.
test.describe('Creature loading', () => {
  let createdPacks: string[] = [];

  test.afterEach(async ({ gmPage }) => {
    await gmPage.evaluate(
      async ({ id, createdPacks }) => {
        const inst = foundry.applications.instances?.get(id);
        if (inst) await inst.close();
        for (const collection of createdPacks) await game.packs.get(collection)?.deleteCompendium();
        // The module-level cache still holds this test's __e2e_ creatures — rebuild it from the
        // world's real state so nothing leaks into a later spec's view.
        await game.modules.get(id).api.loadCreatures(true);
      },
      { id: MODULE_ID, createdPacks },
    );
    createdPacks = [];
  });

  test('a compendium NPC loads through the API and shows in the table', async ({ gmPage }) => {
    const result = await gmPage.evaluate(async (id) => {
      const api = game.modules.get(id).api;
      // Defined in-page: page.evaluate runs in the browser, so nothing from the spec's Node scope
      // is in scope here. level/size are set so the loader's entryToCreature accepts the entry.
      const mkNpc = (name: string, traits: string[]) => ({
        name,
        type: 'npc',
        system: { details: { level: { value: 5 } }, traits: { value: traits, size: { value: 'med' } } },
      });
      const pack = await foundry.documents.collections.CompendiumCollection.createCompendium({
        type: 'Actor',
        label: '__e2e_bestiary',
      });
      const npc = await game.actors.documentClass.create(mkNpc('__e2e_loadcheck', ['humanoid']), {
        pack: pack.collection,
      });

      const index = await api.loadCreatures(true);
      const loaded = index.creatures.find((c: any) => c.uuid === npc.uuid);

      // Freshly mount the window so its load effect re-runs against the now-cached index.
      const inst = foundry.applications.instances?.get(id);
      if (inst) await inst.close();
      api.open();

      return { pack: pack.collection as string, uuid: npc.uuid as string, loaded };
    }, MODULE_ID);

    createdPacks = [result.pack];

    // The compendium creature came through the loader with its fields mapped.
    expect(result.loaded).toBeTruthy();
    expect(result.loaded).toMatchObject({ name: '__e2e_loadcheck', level: 5, size: 'med' });
    expect(result.uuid.startsWith('Compendium.')).toBe(true);

    // …and it renders in the table once searched for.
    const win = gmPage.locator(`#${MODULE_ID}`);
    const search = win.locator('input[type="search"]');
    await expect(search).toBeVisible();
    await search.fill('__e2e_loadcheck');
    const names = win.locator('td.name-cell');
    await expect(names).toHaveCount(1);
    await expect(names.first()).toHaveText('__e2e_loadcheck');
  });

  test('a broken pack is isolated and never clobbers the good creature list', async ({ gmPage }) => {
    const r = await gmPage.evaluate(async (id) => {
      const api = game.modules.get(id).api;
      const CC = foundry.documents.collections.CompendiumCollection;
      const AC = game.actors.documentClass;
      const mkNpc = (name: string, traits: string[]) => ({
        name,
        type: 'npc',
        system: { details: { level: { value: 5 } }, traits: { value: traits, size: { value: 'med' } } },
      });

      const packA = await CC.createCompendium({ type: 'Actor', label: '__e2e_ok' });
      const packB = await CC.createCompendium({ type: 'Actor', label: '__e2e_broken' });
      const gruntA = await AC.create(mkNpc('__e2e_grunt_a', ['humanoid']), { pack: packA.collection });
      const gruntB = await AC.create(mkNpc('__e2e_grunt_b', ['humanoid']), { pack: packB.collection });

      const has = (index: any, uuid: string) => index.creatures.some((c: any) => c.uuid === uuid);

      // Baseline: a clean forced read caches both packs' creatures.
      const healthy = await api.loadCreatures(true);
      const healthyHasA = has(healthy, gruntA.uuid);
      const healthyHasB = has(healthy, gruntB.uuid);

      // Break packB's index and count the warnings the degraded read surfaces.
      const origGetIndex = packB.getIndex.bind(packB);
      packB.getIndex = async () => {
        throw new Error('__e2e_ index boom');
      };
      const origWarn = ui.notifications.warn.bind(ui.notifications);
      let warns = 0;
      ui.notifications.warn = () => {
        warns += 1;
        return 0;
      };

      // Forced read with one pack throwing: must resolve, keep the other pack's creatures, warn.
      const degraded = await api.loadCreatures(true);
      const degradedHasA = has(degraded, gruntA.uuid);
      const degradedHasB = has(degraded, gruntB.uuid);
      const warnsOnDegraded = warns;

      // A degraded read must not become the cache: the next (non-forced) read still serves the
      // good list — packB's creature survives — so the user is never stuck on the short list.
      const afterHasB = has(await api.loadCreatures(), gruntB.uuid);

      ui.notifications.warn = origWarn;
      packB.getIndex = origGetIndex;
      return {
        packs: [packA.collection, packB.collection] as string[],
        healthyHasA,
        healthyHasB,
        degradedHasA,
        degradedHasB,
        warnsOnDegraded,
        afterHasB,
      };
    }, MODULE_ID);

    createdPacks = r.packs;

    expect(r.healthyHasA && r.healthyHasB).toBe(true); // baseline: both packs loaded clean
    expect(r.degradedHasA).toBe(true); // isolation: the good pack survives its neighbour throwing
    expect(r.degradedHasB).toBe(false); // the broken pack genuinely dropped out
    expect(r.warnsOnDegraded).toBeGreaterThanOrEqual(1); // the failure was surfaced, not swallowed
    expect(r.afterHasB).toBe(true); // self-heal: the degraded read never overwrote the good cache
  });
});
