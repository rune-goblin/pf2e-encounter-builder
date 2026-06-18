import { mount, unmount } from 'svelte';
import { MODULE_ID } from '@/constants';
import EncounterBuilder from './components/EncounterBuilder.svelte';

const { ApplicationV2 } = foundry.applications.api;

export class EncounterBuilderApp extends ApplicationV2 {
  static override DEFAULT_OPTIONS = {
    id: MODULE_ID,
    tag: 'section',
    classes: [MODULE_ID],
    window: { title: `${MODULE_ID}.title`, icon: 'fa-solid fa-dragon', resizable: true },
    position: { width: 1120, height: 840 },
  };

  #component?: ReturnType<typeof mount>;
  #root?: HTMLElement;

  static #instance?: EncounterBuilderApp;

  // One window per session: reopening focuses the existing one rather than stacking copies.
  static open(): EncounterBuilderApp {
    EncounterBuilderApp.#instance ??= new EncounterBuilderApp();
    EncounterBuilderApp.#instance.render({ force: true });
    return EncounterBuilderApp.#instance;
  }

  // AppV2 runs _renderHTML on every render; mount once and reuse the node, so a re-render
  // neither leaks a second component nor discards Svelte's reactive state.
  protected override async _renderHTML(): Promise<HTMLElement> {
    if (!this.#component) {
      this.#root = document.createElement('div');
      // Fills .window-content so the inner flex/grid height chain resolves and panes scroll.
      this.#root.className = 'peb-root';
      this.#component = mount(EncounterBuilder, { target: this.#root });
    }
    return this.#root!;
  }

  protected override _replaceHTML(result: HTMLElement, content: HTMLElement): void {
    content.replaceChildren(result);
  }

  protected override async _preClose(): Promise<void> {
    if (this.#component) {
      unmount(this.#component);
      this.#component = undefined;
      this.#root = undefined;
    }
    EncounterBuilderApp.#instance = undefined;
  }
}
