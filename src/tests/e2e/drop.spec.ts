import { test, expect, MODULE_ID } from './fixtures/foundry-clients';
import type { Page } from '@playwright/test';

// Covers the side a dropped creature lands on — the wiring vitest can't see, since it lives in
// the drop handler's reading of the DOM rather than in the encounter math. Before the fix every
// drop was added as an enemy regardless of where it was released, so the allied-troops list
// could only be filled from the table's Ally button.

/** Dispatch what a Foundry document drag puts on the wire, onto a specific element. */
async function dropActorOn(page: Page, selector: string, uuid: string): Promise<void> {
  await page.evaluate(
    ({ selector, uuid }) => {
      const el = document.querySelector(selector);
      if (!el) throw new Error(`drop target not found: ${selector}`);
      const dt = new DataTransfer();
      // TextEditor.getDragEventData just JSON-parses text/plain, so this is the whole payload.
      dt.setData('text/plain', JSON.stringify({ type: 'Actor', uuid }));
      el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    },
    { selector, uuid },
  );
}

test.describe('Drop target sides', () => {
  let createdActorIds: string[] = [];
  let originalSkirmish: boolean | null = null;

  test.afterEach(async ({ gmPage }) => {
    await gmPage.evaluate(
      async ({ id, createdActorIds, originalSkirmish }) => {
        const inst = foundry.applications.instances?.get(id);
        if (inst) await inst.close();
        for (const actorId of createdActorIds) await game.actors.get(actorId)?.delete();
        // The toggle persists to settings — put it back so a later spec opens in the same state.
        if (originalSkirmish !== null) await game.settings.set(id, 'skirmish', originalSkirmish);
      },
      { id: MODULE_ID, createdActorIds, originalSkirmish },
    );
    createdActorIds = [];
    originalSkirmish = null;
  });

  test('a creature dropped on the allied list joins the allies, not the enemies', async ({ gmPage }) => {
    const setup = await gmPage.evaluate(async (id) => {
      const api = game.modules.get(id).api;
      const AC = game.actors.documentClass;
      const mkNpc = (name: string) =>
        AC.create({
          name,
          type: 'npc',
          system: { details: { level: { value: 5 } }, traits: { value: ['troop'], size: { value: 'med' } } },
        });
      const allyActor = await mkNpc('__e2e_drop_ally');
      const enemyActor = await mkNpc('__e2e_drop_enemy');

      const skirmish = Boolean(game.settings.get(id, 'skirmish'));

      const inst = foundry.applications.instances?.get(id);
      if (inst) await inst.close();
      api.open();

      return {
        allyUuid: allyActor.uuid as string,
        enemyUuid: enemyActor.uuid as string,
        actorIds: [allyActor.id, enemyActor.id] as string[],
        skirmish,
      };
    }, MODULE_ID);

    createdActorIds = setup.actorIds;
    originalSkirmish = setup.skirmish;

    const win = gmPage.locator(`#${MODULE_ID}`);
    const enemySection = win.locator('[data-drop-side="enemy"]');
    await expect(enemySection).toBeVisible();

    // Skirmish is what reveals the allied list; the toggle is a pressed-state button.
    const toggle = win.locator('button.skirmish-toggle');
    if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click();
    const allySection = win.locator('[data-drop-side="ally"]');
    await expect(allySection).toBeVisible();

    const allyRows = allySection.locator('.encounter-item .name');
    const enemyRows = enemySection.locator('.encounter-item .name');

    // Release over the allied list's *heading*, which sits outside the bordered panel — the spot
    // most likely to be aimed at, and the one that fell through to the enemy list.
    await dropActorOn(gmPage, `#${MODULE_ID} [data-drop-side="ally"] .section-title`, setup.allyUuid);

    await expect(allyRows).toHaveCount(1);
    await expect(allyRows.first()).toHaveText('1 × __e2e_drop_ally');
    await expect(enemyRows).toHaveCount(0); // the regression: it used to land here instead

    // The enemy list still takes its own drops, deep inside the panel.
    await dropActorOn(gmPage, `#${MODULE_ID} [data-drop-side="enemy"] .encounter-list`, setup.enemyUuid);

    await expect(enemyRows).toHaveCount(1);
    await expect(enemyRows.first()).toHaveText('1 × __e2e_drop_enemy');
    await expect(allyRows).toHaveCount(1); // unchanged by the enemy drop

    // Outside both lists (the creature table) there's no ambiguity to resolve — still an enemy.
    await dropActorOn(gmPage, `#${MODULE_ID} table.split-table`, setup.enemyUuid);
    await expect(enemyRows).toHaveCount(2);
    await expect(allyRows).toHaveCount(1);
  });
});
