<script lang="ts">
  import { untrack, type Snippet } from 'svelte';

  interface Props {
    label: string;
    open?: boolean;
    count?: number;
    summary?: Snippet;
    children: Snippet;
  }

  let { label, open = false, count = 0, summary, children }: Props = $props();
  // `open` only seeds the initial state; the section owns its expanded state thereafter.
  let expanded = $state(untrack(() => open));
</script>

<section class="collapsible">
  <header class="collapsible-header">
    <button
      type="button"
      class="collapsible-toggle"
      aria-expanded={expanded}
      onclick={() => (expanded = !expanded)}
    >
      <i class="fa-solid fa-chevron-right chevron" class:open={expanded} aria-hidden="true"></i>
      <span class="label">{label}</span>
      {#if count > 0}<span class="count">{count}</span>{/if}
    </button>
    {#if summary}{@render summary()}{/if}
  </header>
  {#if expanded}
    <div class="collapsible-body">{@render children()}</div>
  {/if}
</section>

<style>
  .collapsible {
    border: 1px solid rgba(128, 128, 128, 0.3);
    border-radius: 6px;
    overflow: hidden;
  }
  .collapsible-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(128, 128, 128, 0.12);
  }
  .collapsible-toggle {
    flex: 1;
    display: flex;
    align-items: center;
    /* Override Foundry's centered <button> base so the label sits left after the chevron. */
    justify-content: flex-start;
    gap: 0.5rem;
    background: transparent;
    border: 0;
    padding: 6px 8px;
    font-weight: 600;
    font-size: var(--peb-text);
    cursor: pointer;
    text-align: left;
    color: inherit;
  }
  .chevron {
    transition: transform 0.15s ease;
    font-size: var(--peb-text-sm);
    opacity: 0.7;
  }
  .chevron.open {
    transform: rotate(90deg);
  }
  .count {
    margin-left: auto;
    background: var(--peb-brand-surface);
    color: var(--peb-on-brand);
    border-radius: 999px;
    font-size: var(--peb-text-sm);
    padding: 0 7px;
    line-height: 1.4;
  }
  .collapsible-body {
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
</style>
