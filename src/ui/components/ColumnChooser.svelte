<script lang="ts">
  import type { ColumnKey } from '@/encounter/math';

  interface Props {
    visibility: Record<ColumnKey, boolean>;
  }

  let { visibility = $bindable() }: Props = $props();

  const L = (k: string): string => game.i18n.localize(`pf2e-encounter-builder-rg.${k}`);

  // Name and level are always shown, so they get no toggle — only the optional columns.
  const TOGGLEABLE: ColumnKey[] = ['size', 'rarity', 'traits', 'source'];

  let open = $state(false);
  let root = $state<HTMLElement>();

  $effect(() => {
    if (!open) return;
    // Capture the click so an outside click that closes the menu is swallowed rather than
    // also landing on whatever is underneath (e.g. selecting a creature row).
    const onClick = (e: MouseEvent) => {
      if (root?.contains(e.target as Node)) return;
      open = false;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('click', onClick, true);
    return () => window.removeEventListener('click', onClick, true);
  });
</script>

<div class="chooser-rg" bind:this={root}>
  <button
    type="button"
    class="gear-rg"
    title={L('table.chooseColumns')}
    aria-label={L('table.chooseColumns')}
    aria-expanded={open}
    onclick={() => (open = !open)}
  >
    <i class="fa-solid fa-gear" aria-hidden="true"></i>
  </button>

  {#if open}
    <div class="menu-rg">
      <strong>{L('table.columns')}</strong>
      {#each TOGGLEABLE as key (key)}
        <label class="toggle-rg">
          <input
            type="checkbox"
            checked={visibility[key]}
            onchange={(e) => (visibility[key] = e.currentTarget.checked)}
          />
          <span>{L(`table.${key}`)}</span>
        </label>
      {/each}
    </div>
  {/if}
</div>

<style>
  /* Absolute so the tall menu can't stretch the header row it sits in (the parent cell is
     the positioning context); spanning the cell's full height lets align-items center the
     gear in the row. The menu sits 4px after the gear (flex gap) but takes align-self so it
     drops downward instead of centering; z-index (a flex item) lifts it over the table. */
  .chooser-rg {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 6px;
  }
  .gear-rg {
    background: transparent;
    border: 0;
    padding: 4px;
    cursor: pointer;
    color: inherit;
  }
  .gear-rg:hover {
    background: rgba(128, 128, 128, 0.25);
  }
  .menu-rg {
    align-self: flex-start;
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 0.5rem 0.75rem;
    white-space: nowrap;
    background: #20232a;
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5);
  }
  .toggle-rg {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--peb-text);
    cursor: pointer;
  }
</style>
