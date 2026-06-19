<script lang="ts">
  import { sizeLabel, type Creature, type ColumnKey } from '@/encounter/math';

  interface Props {
    creatures: Creature[];
    sizeFilter: string[];
    traitFilter: string[];
    creatureTypeFilter: string[];
    rarityFilter: string[];
    remasterOnly: boolean;
    artOnly: boolean;
    onAdd: (creature: Creature) => void;
  }

  let {
    creatures,
    sizeFilter,
    traitFilter,
    creatureTypeFilter,
    rarityFilter,
    remasterOnly,
    artOnly,
    onAdd,
  }: Props = $props();

  const L = (k: string): string => game.i18n.localize(`pf2e-encounter-builder.${k}`);

  let name = $state('');
  let minLevel = $state('');
  let maxLevel = $state('');

  let selected = $state<Creature | null>(null);

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
      if (artOnly && !c.hasArt) return false;
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
  <div class="table-header">
    <div class="title-row">
      <h2 class="section-title">{L('table.title')}</h2>
    </div>

    <div class="header-body">
      <div class="table-controls">
        <label class="field search-field">
          <span>{L('table.search')}</span>
          <input type="search" bind:value={name} placeholder={L('table.searchPlaceholder')} />
        </label>
        <div class="level-row">
          <label class="field narrow">
            <span>{L('table.minLevel')}</span>
            <input type="number" bind:value={minLevel} />
          </label>
          <label class="field narrow">
            <span>{L('table.maxLevel')}</span>
            <input type="number" bind:value={maxLevel} />
          </label>
          <div class="row-count">
            {game.i18n.format('pf2e-encounter-builder.table.matches', { count: filtered.length })}
          </div>
        </div>
      </div>

      {#if selected}
        {@const sel = selected}
        <div class="creature-preview">
          {#if sel.img}
            <img class="preview-art" class:has-art={sel.hasArt} src={sel.img} alt="" />
          {:else}
            <div class="preview-art placeholder"><i class="fa-solid fa-paw" aria-hidden="true"></i></div>
          {/if}
          <div class="preview-info">
            <div class="preview-name">{sel.name}</div>
            <div class="preview-meta">
              {game.i18n.format('pf2e-encounter-builder.encounter.levelShort', { level: sel.level })} · {sizeLabel(sel.size)} · {cap(sel.rarity)}
            </div>
            <div class="preview-traits">{sel.traits.join(', ')}</div>
            <div class="preview-actions">
              <button type="button" class="preview-btn add" title={L('table.add')} onclick={() => onAdd(sel)}>
                <i class="fa-solid fa-plus" aria-hidden="true"></i>{L('table.previewAdd')}
              </button>
              <button
                type="button"
                class="preview-btn"
                title={L('table.openSheet')}
                aria-label={L('table.openSheet')}
                onclick={() => openSheet(sel)}
              >
                <i class="fa-solid fa-up-right-from-square" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        </div>
      {:else}
        <div class="creature-preview empty">
          <i class="fa-solid fa-dragon" aria-hidden="true"></i>
          <span>{L('table.previewEmpty')}</span>
        </div>
      {/if}
    </div>
  </div>

  {#snippet cols()}
    <col style:width="40px" />
    <col style:width="40px" />
    <col style:width="34px" />
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
          <!-- Row click selects (drives the preview); buttons give keyboard users the same actions. -->
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <tr class:selected={selected?.uuid === c.uuid} onclick={() => (selected = c)} ondblclick={() => onAdd(c)}>
            <td class="action-cell">
              <button class="icon-action add" title={L('table.add')} aria-label={L('table.add')} onclick={() => onAdd(c)}>+</button>
            </td>
            <td class="action-cell">
              <button class="icon-action open" title={L('table.openSheet')} aria-label={L('table.openSheet')} onclick={() => openSheet(c)}>
                <i class="fa-solid fa-up-right-from-square" aria-hidden="true"></i>
              </button>
            </td>
            <td class="thumb-cell">
              {#if c.img}
                <img class="thumb" src={c.img} alt="" loading="lazy" />
              {/if}
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
    margin: 0;
    border: none;
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
  .row-count {
    margin-left: auto;
    opacity: 0.75;
    font-size: var(--peb-text-sm);
    white-space: nowrap;
  }

  .table-header {
    display: flex;
    flex-direction: column;
    margin-bottom: 0.5rem;
  }
  /* Title + match count share the heading line; the 0.5rem below mirrors the encounter
     header's margin so .header-body lines up with the encounter panel across the gap. */
  .title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    min-height: var(--peb-header-h);
    margin-bottom: 0.5rem;
  }
  /* Search/level controls left, selected-creature preview right, top-aligned so the
     portrait sits level with the encounter panel. Wraps the preview below when narrow. */
  .header-body {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: flex-start;
  }
  .table-controls {
    flex: 1 1 220px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .level-row {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }
  .narrow {
    width: 72px;
    flex: none;
  }
  .creature-preview {
    flex: 1 1 240px;
    max-width: 360px;
    box-sizing: border-box;
    display: flex;
    gap: 0.6rem;
    min-height: 132px;
    padding: 0.5rem;
    background: var(--peb-brand-surface-low);
    border: 1px solid var(--peb-brand-border);
    border-radius: 6px;
  }
  .creature-preview.empty {
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-style: dashed;
    border-color: rgba(128, 128, 128, 0.4);
    background: rgba(0, 0, 0, 0.12);
    color: rgba(255, 255, 255, 0.45);
    text-align: center;
  }
  .creature-preview.empty i {
    font-size: 26px;
    opacity: 0.6;
  }
  .creature-preview.empty span {
    font-size: var(--peb-text-sm);
  }
  .preview-art {
    width: 112px;
    height: 112px;
    flex: none;
    object-fit: cover;
    object-position: top;
    border-radius: 5px;
    background: rgba(0, 0, 0, 0.35);
  }
  /* Module-supplied art keeps the brand ring that the table thumbnails dropped. */
  .preview-art.has-art {
    box-shadow: 0 0 0 1px var(--peb-brand-border), 0 2px 8px rgba(0, 0, 0, 0.45);
  }
  .preview-art.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 34px;
    color: rgba(255, 255, 255, 0.3);
  }
  .preview-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .preview-name {
    font-weight: 700;
    font-size: var(--peb-text);
    line-height: 1.18;
    color: var(--peb-brand-text);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .preview-meta {
    font-size: var(--peb-text-sm);
    opacity: 0.85;
  }
  .preview-traits {
    font-size: var(--peb-text-sm);
    opacity: 0.62;
    line-height: 1.25;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .preview-actions {
    margin-top: auto;
    display: flex;
    gap: 5px;
  }
  .preview-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    width: auto;
    padding: 4px 10px;
    border-radius: 4px;
    border: 1px solid var(--peb-brand-border);
    background: rgba(128, 128, 128, 0.12);
    color: inherit;
    font-size: var(--peb-text-sm);
    font-weight: 600;
    cursor: pointer;
  }
  .preview-btn.add {
    flex: 1;
    background: var(--peb-brand-surface);
    color: var(--peb-on-brand);
  }
  .preview-btn:hover {
    filter: brightness(1.12);
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
    vertical-align: middle;
    font-size: var(--peb-text);
    border-bottom: 1px solid rgba(128, 128, 128, 0.2);
  }
  /* Row striping lives in styles.css — Foundry core stripes the <tr> with specificity a
     Svelte-scoped rule can't beat, so it's owned at the app-namespace level. */
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
  /* Last so it wins over striping and hover. */
  tbody tr.selected td {
    background: rgba(0, 116, 90, 0.28);
  }
  tbody tr.selected td:first-child {
    box-shadow: inset 3px 0 0 var(--peb-brand-text);
  }
  .name-cell {
    font-weight: 600;
  }
  .thumb-cell {
    padding: 2px;
  }
  .thumb {
    display: block;
    width: 30px;
    height: 30px;
    object-fit: cover;
    object-position: top;
    border-radius: 4px;
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
