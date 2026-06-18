<script lang="ts">
  import { MODULE_ID } from '@/constants';
  import {
    activeStageIndex,
    blackTextSwitchIndex,
    computeCost,
    effectiveLevel,
    makeBarStages,
    makeXpBudget,
    threatBand,
    type Creature,
    type EncounterEntry,
  } from '@/encounter/math';
  import { creatureFromUuid, loadCreatures, type CreatureIndex } from '@/data/creatures';
  import { encounterFromCombat, saveEncounter } from '@/encounter/save';
  import CreatureTable from './CreatureTable.svelte';
  import CreatureFilters from './CreatureFilters.svelte';
  import EncounterList from './EncounterList.svelte';
  import EncounterBudget from './EncounterBudget.svelte';

  const L = (k: string): string => game.i18n.localize(`pf2e-encounter-builder.${k}`);

  let data = $state<CreatureIndex | null>(null);
  let loadError = $state(false);

  // Size/level the GMG budget assumes for the PCs. Companions/NPCs in the party don't
  // count toward the size, so filter to characters; party.level is the system's own
  // notion, falling back to the highest PC level if it isn't set.
  function readParty(): { size: number; level: number } | null {
    const party = game.actors.party;
    if (!party) return null;
    const pcs = party.members.filter((m) => m.isOfType('character'));
    if (pcs.length === 0) return null;
    return { size: pcs.length, level: party.level || Math.max(...pcs.map((p) => p.level)) };
  }

  // Restore the last-used values; the active party is pulled on demand via the button below.
  let partySize = $state(Number(game.settings.get(MODULE_ID, 'partySize')) || 4);
  let partyLevel = $state(Number(game.settings.get(MODULE_ID, 'partyLevel')) || 1);

  function syncFromParty() {
    const p = readParty();
    if (!p) {
      ui.notifications.warn(L('notifications.noParty'));
      return;
    }
    partySize = p.size;
    partyLevel = p.level;
  }

  let encounter = $state<EncounterEntry[]>([]);
  let saving = $state(false);

  let size = $state<string[]>([]);
  let trait = $state<string[]>([]);
  let creatureType = $state<string[]>([]);
  let rarity = $state<string[]>([]);
  let remasterOnly = $state(false);

  $effect(() => {
    loadCreatures()
      .then((d) => (data = d))
      .catch((err) => {
        console.error(`${MODULE_ID} | failed to load creatures`, err);
        loadError = true;
      });
  });

  $effect(() => {
    void game.settings.set(MODULE_ID, 'partySize', partySize);
  });
  $effect(() => {
    void game.settings.set(MODULE_ID, 'partyLevel', partyLevel);
  });

  const enriched = $derived(
    encounter.map((e) => {
      const effLevel = effectiveLevel(e);
      return {
        ...e,
        cost: computeCost(e, partyLevel) * e.count,
        effLevel,
        band: threatBand(effLevel - partyLevel),
      };
    }),
  );
  const xpCost = $derived(enriched.reduce((sum, e) => sum + e.cost, 0));
  const xpBudget = $derived(makeXpBudget(partySize));
  const barStages = $derived(makeBarStages(xpBudget));
  const barValue = $derived(Math.min(100, (xpCost / xpBudget[4]) * 100));
  const stageIndex = $derived(activeStageIndex(barStages, barValue));
  const activeStage = $derived(barStages[stageIndex]);
  const totalsTextColor = $derived(stageIndex >= blackTextSwitchIndex(barStages) ? '#fff' : '#111');

  function addCreature(c: Creature) {
    encounter = [...encounter, { ...c, variant: 0, count: 1, cost: 0 }];
  }

  let dragActive = $state(false);
  let dragDepth = 0;

  async function addFromUuid(uuid: string) {
    try {
      const creature = await creatureFromUuid(uuid);
      if (!creature) {
        ui.notifications.warn(L('notifications.dropNotCreature'));
        return;
      }
      addCreature(creature);
    } catch (err) {
      console.error(`${MODULE_ID} | drop failed`, err);
      ui.notifications.warn(L('notifications.dropFailed'));
    }
  }

  // The drag payload is only readable on drop, so the highlight keys off dataTransfer.types
  // (text/plain — what Foundry document drags carry) during dragover; the Actor check happens
  // on drop. enter/leave are depth-counted so crossing child elements doesn't flicker it off.
  function onDragEnter(event: DragEvent) {
    if (!event.dataTransfer?.types.includes('text/plain')) return;
    event.preventDefault();
    dragDepth += 1;
    dragActive = true;
  }
  function onDragOver(event: DragEvent) {
    if (!event.dataTransfer?.types.includes('text/plain')) return;
    event.preventDefault();
  }
  function onDragLeave() {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dragActive = false;
  }
  function onDrop(event: DragEvent) {
    dragDepth = 0;
    dragActive = false;
    const dropped = foundry.applications.ux.TextEditor.getDragEventData(event);
    if (dropped.type !== 'Actor' || typeof dropped.uuid !== 'string') return;
    event.preventDefault();
    void addFromUuid(dropped.uuid);
  }

  let loading = $state(false);

  async function load() {
    const combat = game.combats.viewed;
    if (!combat || combat.combatants.size === 0) {
      ui.notifications.warn(L('notifications.loadNoEncounter'));
      return;
    }
    loading = true;
    try {
      const entries = await encounterFromCombat(combat);
      if (entries.length === 0) {
        ui.notifications.warn(L('notifications.loadEmpty'));
        return;
      }
      encounter = entries;
    } catch (err) {
      console.error(`${MODULE_ID} | load failed`, err);
      ui.notifications.error(L('notifications.loadError'));
    } finally {
      loading = false;
    }
  }

  async function save() {
    if (encounter.length === 0) return;
    saving = true;
    try {
      const result = await saveEncounter(encounter, { partySize, partyLevel });
      ui.notifications.info(
        game.i18n.format(`${MODULE_ID}.notifications.saved`, { count: result.combatantCount }),
      );
    } catch (err) {
      console.error(`${MODULE_ID} | save failed`, err);
      ui.notifications.error(L('notifications.saveError'));
    } finally {
      saving = false;
    }
  }
</script>

<div
  class="page"
  role="region"
  aria-label={L('title')}
  ondragenter={onDragEnter}
  ondragover={onDragOver}
  ondragleave={onDragLeave}
  ondrop={onDrop}
>
  {#if loadError}
    <p class="status">{L('status.loadError')}</p>
  {:else if !data}
    <p class="status">{L('status.loading')}</p>
  {:else}
    <section class="top-controls">
      <label class="field">
        <span>{L('party.size')}</span>
        <input type="number" min="1" bind:value={partySize} />
      </label>
      <label class="field">
        <span>{L('party.level')}</span>
        <input type="number" bind:value={partyLevel} />
      </label>
      <button type="button" class="from-party" title={L('party.fromPartyHint')} onclick={syncFromParty}>
        <i class="fa-solid fa-users" aria-hidden="true"></i>
        {L('party.fromParty')}
      </button>
    </section>

    <EncounterBudget value={barValue} stages={barStages} />

    <section class="main">
      <CreatureTable
        creatures={data.creatures}
        sizeFilter={size}
        traitFilter={trait}
        creatureTypeFilter={creatureType}
        rarityFilter={rarity}
        {remasterOnly}
        onAdd={addCreature}
      />

      <aside class="right-col">
        <EncounterList
          bind:encounter
          {enriched}
          {xpCost}
          {partySize}
          stageColor={activeStage.color}
          {totalsTextColor}
          {saving}
          {loading}
          dropActive={dragActive}
          onSave={save}
          onLoad={load}
        />
        <CreatureFilters
          options={data.options}
          bind:size
          bind:trait
          bind:creatureType
          bind:rarity
          bind:remasterOnly
        />
      </aside>
    </section>
  {/if}
</div>

<style>
  .page {
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    padding: 0.75rem;
    gap: 0.5rem;
    overflow: hidden;
  }
  .status {
    padding: 2rem;
    text-align: center;
    opacity: 0.7;
  }
  .top-controls {
    display: flex;
    gap: 0.75rem;
    align-items: end;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: var(--peb-text-sm);
    width: 110px;
  }
  .field input {
    width: 100%;
  }
  .from-party {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    width: auto;
    height: min-content;
    padding: 5px 10px;
    border: 1px solid var(--peb-brand-border);
    border-radius: 4px;
    background: var(--peb-brand-surface-low);
    color: var(--peb-brand-text);
    font-size: var(--peb-text-sm);
    white-space: nowrap;
    cursor: pointer;
  }
  .from-party:hover {
    background: var(--peb-brand-surface);
    color: var(--peb-on-brand);
  }
  .main {
    flex: 1;
    display: grid;
    grid-template-columns: 1.7fr 1fr;
    gap: 0.75rem;
    align-items: stretch;
    min-height: 0;
  }
  .right-col {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    overflow-y: auto;
    min-height: 0;
  }
</style>
