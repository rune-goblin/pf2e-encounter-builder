<script lang="ts">
  import { sizeLabel, type Creature, type ColumnKey } from '@/encounter/math';

  interface Props {
    creatures: Creature[];
    sizeFilter: string[];
    traitFilter: string[];
    creatureTypeFilter: string[];
    rarityFilter: string[];
    remasterOnly: boolean;
    onAdd: (creature: Creature) => void;
  }

  let { creatures, sizeFilter, traitFilter, creatureTypeFilter, rarityFilter, remasterOnly, onAdd }: Props =
    $props();

  const L = (k: string): string => game.i18n.localize(`pf2e-encounter-builder.${k}`);

  let name = $state('');
  let minLevel = $state('');
  let maxLevel = $state('');

  let sortBy = $state<'name' | 'level'>('name');
  let sortDesc = $state(false);

  let columnVisibility = $state<Record<ColumnKey, boolean>>({
    name: true,
    level: true,
    size: true,
    rarity: true,
    traits: true,
    source: false,
  });
  let showColumns = $state(false);

  const COLUMNS: { key: ColumnKey; locked: boolean }[] = [
    { key: 'name', locked: true },
    { key: 'level', locked: true },
    { key: 'size', locked: false },
    { key: 'rarity', locked: false },
    { key: 'traits', locked: false },
    { key: 'source', locked: false },
  ];

  function setSort(col: 'name' | 'level') {
    if (sortBy === col) sortDesc = !sortDesc;
    else {
      sortBy = col;
      sortDesc = false;
    }
  }

  async function openSheet(c: Creature) {
    const doc = await fromUuid(c.uuid);
    doc?.sheet?.render(true);
  }

  function cap(s: string): string {
    return s ? s[0].toUpperCase() + s.slice(1) : s;
  }

  const filtered = $derived.by(() => {
    const nameLc = name.toLowerCase();
    const minL = minLevel === '' ? -2 : Number(minLevel);
    const maxL = maxLevel === '' ? 30 : Number(maxLevel);
    const rows = creatures.filter((c) => {
      if (nameLc && !c.name.toLowerCase().includes(nameLc)) return false;
      if (c.level < minL || c.level > maxL) return false;
      if (sizeFilter.length && !sizeFilter.includes(c.size)) return false;
      if (traitFilter.length && !traitFilter.some((t) => c.traits.includes(t))) return false;
      if (creatureTypeFilter.length && !creatureTypeFilter.some((t) => c.traits.includes(t)))
        return false;
      if (rarityFilter.length && !rarityFilter.includes(c.rarity)) return false;
      if (remasterOnly && !c.remaster) return false;
      return true;
    });
    return rows.sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      if (av < bv) return sortDesc ? 1 : -1;
      if (av > bv) return sortDesc ? -1 : 1;
      return 0;
    });
  });
</script>

<div class="creatures-panel">
  <h2 class="section-title">{L('table.title')}</h2>
  <div class="table-controls">
    <label class="field search-field">
      <span>{L('table.search')}</span>
      <input type="search" bind:value={name} placeholder={L('table.searchPlaceholder')} />
    </label>
    <label class="field narrow">
      <span>{L('table.minLevel')}</span>
      <input type="number" bind:value={minLevel} />
    </label>
    <label class="field narrow">
      <span>{L('table.maxLevel')}</span>
      <input type="number" bind:value={maxLevel} />
    </label>
  </div>
  <div class="row-count">
    {game.i18n.format('pf2e-encounter-builder.table.matches', { count: filtered.length })}
  </div>

  {#snippet cols()}
    <col style:width="40px" />
    <col style:width="40px" />
    {#if columnVisibility.name}<col style:width="220px" />{/if}
    {#if columnVisibility.level}<col style:width="64px" />{/if}
    {#if columnVisibility.size}<col style:width="64px" />{/if}
    {#if columnVisibility.rarity}<col style:width="96px" />{/if}
    {#if columnVisibility.traits}<col />{/if}
    {#if columnVisibility.source}<col style:width="160px" />{/if}
  {/snippet}

  <div class="head-table-wrap">
    <table class="split-table">
      <colgroup>{@render cols()}</colgroup>
      <thead>
        <tr>
          <th class="icon-col">
            <button
              type="button"
              class="gear"
              title={L('table.chooseColumns')}
              aria-label={L('table.chooseColumns')}
              onclick={() => (showColumns = !showColumns)}
            >
              <i class="fa-solid fa-gear" aria-hidden="true"></i>
            </button>
          </th>
          <th class="icon-col"></th>
          {#if columnVisibility.name}
            <th class="sortable" onclick={() => setSort('name')}>
              {L('table.name')}
              {sortBy === 'name' ? (sortDesc ? '↓' : '↑') : ''}
            </th>
          {/if}
          {#if columnVisibility.level}
            <th class="sortable" onclick={() => setSort('level')}>
              {L('table.level')}
              {sortBy === 'level' ? (sortDesc ? '↓' : '↑') : ''}
            </th>
          {/if}
          {#if columnVisibility.size}<th>{L('table.size')}</th>{/if}
          {#if columnVisibility.rarity}<th>{L('table.rarity')}</th>{/if}
          {#if columnVisibility.traits}<th>{L('table.traits')}</th>{/if}
          {#if columnVisibility.source}<th>{L('table.source')}</th>{/if}
        </tr>
      </thead>
    </table>
  </div>

  <div class="table-scroll">
    <table class="split-table">
      <colgroup>{@render cols()}</colgroup>
      <tbody>
        {#each filtered as c (c.uuid)}
          <tr ondblclick={() => onAdd(c)}>
            <td class="action-cell">
              <button class="icon-action add" title={L('table.add')} aria-label={L('table.add')} onclick={() => onAdd(c)}>+</button>
            </td>
            <td class="action-cell">
              <button class="icon-action open" title={L('table.openSheet')} aria-label={L('table.openSheet')} onclick={() => openSheet(c)}>
                <i class="fa-solid fa-up-right-from-square" aria-hidden="true"></i>
              </button>
            </td>
            {#if columnVisibility.name}<td class="name-cell">{c.name}</td>{/if}
            {#if columnVisibility.level}<td>{c.level}</td>{/if}
            {#if columnVisibility.size}<td>{sizeLabel(c.size)}</td>{/if}
            {#if columnVisibility.rarity}<td>{cap(c.rarity)}</td>{/if}
            {#if columnVisibility.traits}
              <td class="traits" title={c.traits.join(', ')}>
                <span class="traits-ellipsis">{c.traits.join(', ')}</span>
              </td>
            {/if}
            {#if columnVisibility.source}<td class="source" title={c.source}>{c.source}</td>{/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  {#if showColumns}
    <!-- Click-away backdrop: closes the column chooser without a modal. -->
    <button class="col-backdrop" type="button" aria-label="Close" onclick={() => (showColumns = false)}></button>
    <div class="col-popover">
      <strong>{L('table.columns')}</strong>
      {#each COLUMNS as col (col.key)}
        <label class="col-toggle" class:locked={col.locked}>
          <input
            type="checkbox"
            checked={columnVisibility[col.key]}
            disabled={col.locked}
            onchange={(e) => (columnVisibility[col.key] = e.currentTarget.checked)}
          />
          <span>{L(`table.${col.key}`)}</span>
        </label>
      {/each}
    </div>
  {/if}
</div>

<style>
  .creatures-panel {
    min-width: 0;
    /* Grid items default to min-height: auto, which refuses to shrink below content height —
       without this the panel grows to fit every row and .table-scroll never scrolls. */
    min-height: 0;
    display: flex;
    flex-direction: column;
    position: relative;
  }
  .section-title {
    font-size: var(--peb-text-lg);
    font-weight: 700;
    margin: 0 0 0.5rem;
    border: none;
  }
  .table-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: end;
    margin-bottom: 0.5rem;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: var(--peb-text-sm);
  }
  .field input {
    width: 100%;
  }
  .search-field {
    flex: 1;
    min-width: 200px;
  }
  .narrow {
    width: 90px;
  }
  .row-count {
    opacity: 0.75;
    font-size: var(--peb-text-sm);
    margin-bottom: 0.25rem;
  }

  /* Split-table: header and body are separate tables sharing a colgroup so widths line up;
     scrollbar-gutter: stable on both reserves the same gutter so the body scrollbar sits
     below the header rather than beside it. */
  .split-table {
    table-layout: fixed;
    width: 100%;
    border-collapse: collapse;
  }
  .head-table-wrap {
    overflow: hidden;
    scrollbar-gutter: stable;
  }
  .table-scroll {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-gutter: stable;
    min-height: 200px;
  }
  thead th {
    text-align: left;
    padding: 5px 6px;
    font-size: var(--peb-text);
    font-weight: 700;
    background: rgba(0, 0, 0, 0.2);
    border-bottom: 1px solid rgba(255, 255, 255, 0.15);
    white-space: nowrap;
  }
  .sortable {
    cursor: pointer;
    user-select: none;
  }
  tbody td {
    padding: 4px 6px;
    vertical-align: top;
    font-size: var(--peb-text);
    border-bottom: 1px solid rgba(128, 128, 128, 0.2);
  }
  /* Skip layout + paint for off-screen rows — keeps thousands of rows snappy without
     virtual-scroll bookkeeping. */
  tbody tr {
    content-visibility: auto;
    contain-intrinsic-size: auto 30px;
  }
  tbody tr:hover td {
    background: rgba(128, 128, 128, 0.18);
    cursor: pointer;
  }
  .name-cell {
    font-weight: 600;
  }
  .icon-col {
    width: 1%;
    padding: 0;
  }
  .action-cell {
    padding: 0;
  }
  .traits,
  .source {
    opacity: 0.8;
  }
  .traits-ellipsis {
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .icon-action {
    width: 100%;
    height: 100%;
    min-height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 0;
    padding: 4px;
    font-weight: 700;
    cursor: pointer;
    color: inherit;
  }
  .icon-action.add {
    color: #2f974e;
  }
  .icon-action.add:hover {
    background: rgba(47, 151, 78, 0.25);
  }
  .icon-action.open:hover {
    background: rgba(128, 128, 128, 0.25);
  }
  .gear {
    width: 100%;
    background: transparent;
    border: 0;
    padding: 4px;
    cursor: pointer;
    color: inherit;
  }
  .gear:hover {
    background: rgba(128, 128, 128, 0.25);
  }

  .col-backdrop {
    position: fixed;
    inset: 0;
    background: transparent;
    border: 0;
    z-index: 99;
    cursor: default;
  }
  .col-popover {
    position: absolute;
    z-index: 100;
    top: 6rem;
    left: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 0.5rem 0.75rem;
    background: #20232a;
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5);
  }
  .col-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--peb-text);
    cursor: pointer;
  }
  .col-toggle.locked {
    opacity: 0.55;
    cursor: not-allowed;
  }
</style>
