import { test, expect, MODULE_ID } from './fixtures/foundry-clients';

// Drives the public API end to end against a real Foundry to cover the Foundry-coupled half of
// the skirmish feature that vitest can't reach: saveEncounter stamps each combatant with its
// side, addEncounterToScene turns that into a token disposition (allies friendly, enemies
// hostile), and encounterFromCombat reads it back so sides survive a save → place → load round
// trip. Self-contained — it creates its own `__e2e_` NPC actors (one with the troop trait) rather
// than depending on the world shipping any particular bestiary. Opt-in tier; see README.md.
test.describe('Skirmish save/load round-trip', () => {
  let combatId: string | null = null;
  let sceneId: string | null = null;
  let createdActorIds: string[] = [];

  test.afterEach(async ({ gmPage }) => {
    // The world is shared — remove everything the test created, in dependency order.
    await gmPage.evaluate(
      async ({ combatId, sceneId, createdActorIds }) => {
        await game.combats.get(combatId ?? '')?.delete();
        await game.scenes.get(sceneId ?? '')?.delete();
        for (const id of createdActorIds) await game.actors.get(id)?.delete();
      },
      { combatId, sceneId, createdActorIds },
    );
    combatId = null;
    sceneId = null;
    createdActorIds = [];
  });

  test('allies deploy friendly, enemies hostile, and both sides round-trip on load', async ({ gmPage }) => {
    const result = await gmPage.evaluate(async (id) => {
      const api = game.modules.get(id).api;
      const D = (window as unknown as { CONST: { TOKEN_DISPOSITIONS: { FRIENDLY: number; HOSTILE: number } } }).CONST
        .TOKEN_DISPOSITIONS;

      const actorIdsBefore = new Set(game.actors.map((a: any) => a.id));
      const combatIdsBefore = new Set(game.combats.map((c: any) => c.id));

      // Own test fixtures: two NPCs, one carrying the `troop` trait. level/size are set so the
      // load path's entryToCreature accepts the imported copies (world actors get no sourceId).
      const AC = game.actors.documentClass;
      const mkNpc = (name: string, traits: string[]) =>
        AC.create({
          name,
          type: 'npc',
          system: { details: { level: { value: 5 } }, traits: { value: traits, size: { value: 'med' } } },
        });
      const troopActor = await mkNpc('__e2e_troop', ['troop']);
      const gruntActor = await mkNpc('__e2e_grunt', ['humanoid']);

      // saveEncounter only reads uuid/variant/count/side/name; the rest of Creature is rebuilt
      // from the imported actor on load, so the entries can be minimal.
      const entries = [
        { uuid: gruntActor.uuid, name: gruntActor.name, variant: 0, count: 2, cost: 0, side: 'enemy' },
        { uuid: troopActor.uuid, name: troopActor.name, variant: 0, count: 1, cost: 0, side: 'ally' },
      ];

      const scene = await game.scenes.documentClass.create({ name: '__e2e_skirmish' });
      await api.saveEncounter(entries, { partySize: 4, partyLevel: 7 });

      const combat = game.combats.find((c: any) => !combatIdsBefore.has(c.id));
      const createdActorIds = game.actors.filter((a: any) => !actorIdsBefore.has(a.id)).map((a: any) => a.id);

      await api.addEncounterToScene(combat, scene);

      // Post-placement: each combatant carries its side flag and now a token with a disposition.
      const combatants = combat.combatants.map((c: any) => ({
        side: c.getFlag(id, 'side'),
        disposition: c.token?.disposition ?? null,
      }));

      // The load path: rebuild the entry list from the combat and collapse by (creature|side).
      const loaded = (await api.encounterFromCombat(combat)).map((e: any) => ({ side: e.side, count: e.count }));

      return {
        combatId: combat.id as string,
        sceneId: scene.id as string,
        createdActorIds: createdActorIds as string[],
        combatantCount: combat.combatants.size as number,
        combatants,
        loaded,
        FRIENDLY: D.FRIENDLY,
        HOSTILE: D.HOSTILE,
      };
    }, MODULE_ID);

    combatId = result.combatId;
    sceneId = result.sceneId;
    createdActorIds = result.createdActorIds;

    // One friendly ally + two hostile enemies were deployed.
    expect(result.combatantCount).toBe(3);

    const combatants = result.combatants as { side: string; disposition: number | null }[];
    const allies = combatants.filter((c) => c.side === 'ally');
    const enemies = combatants.filter((c) => c.side === 'enemy');
    expect(allies).toHaveLength(1);
    expect(enemies).toHaveLength(2);
    expect(allies.every((c) => c.disposition === result.FRIENDLY)).toBe(true);
    expect(enemies.every((c) => c.disposition === result.HOSTILE)).toBe(true);

    // Load collapses the two enemy grunts into one counted row and keeps the sides distinct.
    expect(result.loaded).toContainEqual({ side: 'ally', count: 1 });
    expect(result.loaded).toContainEqual({ side: 'enemy', count: 2 });
    expect(result.loaded).toHaveLength(2);
  });
});
