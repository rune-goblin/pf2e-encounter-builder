<script lang="ts">
  interface Props {
    selected?: boolean;
    label: string;
    onclick?: (e: MouseEvent) => void;
  }

  let { selected = false, label, onclick }: Props = $props();
</script>

<button type="button" class="select-badge" class:selected aria-pressed={selected} {onclick}>
  <span class="dot"></span>
  <span class="badge-label">{label}</span>
</button>

<style>
  .select-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: 1px solid var(--peb-brand-border);
    border-radius: 4px;
    padding: 3px 8px;
    margin: 0;
    width: auto;
    color: var(--peb-on-brand);
    font-size: var(--peb-text-sm);
    font-weight: 300;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
    line-height: 1.2;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    box-sizing: border-box;
    border: 1px solid var(--peb-brand-border);
    background: transparent;
    flex-shrink: 0;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .select-badge:hover:not(.selected) {
    background: var(--peb-brand-surface-low);
    color: var(--peb-brand-text);
    border-color: var(--peb-brand-text);
  }
  .select-badge:hover:not(.selected) .dot {
    border-color: var(--peb-brand-text);
  }
  .select-badge.selected {
    background: var(--peb-brand-surface);
    color: var(--peb-on-brand);
    border-color: var(--peb-brand-border);
  }
  .select-badge.selected .dot {
    background: var(--peb-on-brand);
    border-color: var(--peb-on-brand);
  }
  .select-badge:focus-visible {
    outline: 2px solid var(--peb-brand-text);
    outline-offset: 2px;
  }
</style>
