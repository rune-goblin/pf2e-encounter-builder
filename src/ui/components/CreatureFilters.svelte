<script lang="ts">
  import Collapsible from './Collapsible.svelte';
  import SelectBadge from './SelectBadge.svelte';
  import { filterOptions, sizeLabel, type FilterOptions } from '@/encounter/math';

  interface Props {
    options: FilterOptions;
    size: string[];
    trait: string[];
    creatureType: string[];
    rarity: string[];
    remasterOnly: boolean;
    artOnly: boolean;
  }

  let {
    options,
    size = $bindable(),
    trait = $bindable(),
    creatureType = $bindable(),
    rarity = $bindable(),
    remasterOnly = $bindable(),
    artOnly = $bindable(),
  }: Props = $props();

  const L = (k: string): string => game.i18n.localize(`pf2e-encounter-builder-rg.${k}`);

  let traitSearch = $state('');

  const visibleTraits = $derived(filterOptions(options.traits, trait, traitSearch));

  function toggle(arr: string[], value: string): string[] {
    return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
  }

  function cap(s: string): string {
    return s ? s[0].toUpperCase() + s.slice(1) : s;
  }
</script>

<div class="refine">
  <div class="filters-header">
    <h2 class="section-title">{L('filters.title')}</h2>
    <div class="toggles">
      <label class="legacy-toggle">
        <input type="checkbox" bind:checked={remasterOnly} />
        <span>{L('filters.remasterOnly')}</span>
      </label>
      <label class="legacy-toggle">
        <input type="checkbox" bind:checked={artOnly} />
        <span>{L('filters.artOnly')}</span>
      </label>
    </div>
  </div>

  <Collapsible label={L('filters.size')} open count={size.length}>
    {#snippet summary()}
      {#if size.length}
        <button type="button" class="reset" onclick={() => (size = [])}>{L('filters.reset')}</button>
      {/if}
    {/snippet}
    <div class="badges">
      {#each options.sizes as opt (opt)}
        <SelectBadge selected={size.includes(opt)} label={sizeLabel(opt)} onclick={() => (size = toggle(size, opt))} />
      {/each}
    </div>
  </Collapsible>

  <Collapsible label={L('filters.trait')} count={trait.length}>
    {#snippet summary()}
      {#if trait.length}
        <button type="button" class="reset" onclick={() => (trait = [])}>{L('filters.reset')}</button>
      {/if}
    {/snippet}
    <input type="search" bind:value={traitSearch} placeholder={L('filters.searchTraits')} />
    <div class="badges scroll">
      {#each visibleTraits as opt (opt)}
        <SelectBadge selected={trait.includes(opt)} label={opt} onclick={() => (trait = toggle(trait, opt))} />
      {/each}
    </div>
  </Collapsible>

  <Collapsible label={L('filters.creatureType')} count={creatureType.length}>
    {#snippet summary()}
      {#if creatureType.length}
        <button type="button" class="reset" onclick={() => (creatureType = [])}>{L('filters.reset')}</button>
      {/if}
    {/snippet}
    <div class="badges">
      {#each options.creatureTypes as opt (opt)}
        <SelectBadge selected={creatureType.includes(opt)} label={cap(opt)} onclick={() => (creatureType = toggle(creatureType, opt))} />
      {/each}
    </div>
  </Collapsible>

  <Collapsible label={L('filters.rarity')} count={rarity.length}>
    {#snippet summary()}
      {#if rarity.length}
        <button type="button" class="reset" onclick={() => (rarity = [])}>{L('filters.reset')}</button>
      {/if}
    {/snippet}
    <div class="badges">
      {#each options.rarities as opt (opt)}
        <SelectBadge selected={rarity.includes(opt)} label={cap(opt)} onclick={() => (rarity = toggle(rarity, opt))} />
      {/each}
    </div>
  </Collapsible>
</div>

<style>
  .refine {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .filters-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .section-title {
    font-size: var(--peb-text-lg);
    font-weight: 700;
    margin: 0;
    border: none;
  }
  .toggles {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    justify-content: flex-end;
  }
  .legacy-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: var(--peb-text-sm);
    cursor: pointer;
    white-space: nowrap;
  }
  .reset {
    margin-right: 6px;
    background: transparent;
    border: 1px solid rgba(128, 128, 128, 0.5);
    border-radius: 4px;
    padding: 1px 8px;
    font-size: var(--peb-text-sm);
    cursor: pointer;
    color: inherit;
    width: auto;
  }
  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .badges.scroll {
    max-height: 200px;
    overflow-y: auto;
    padding: 2px;
  }
  input[type='search'] {
    width: 100%;
  }
</style>
