import './styles.css';
import { MODULE_ID } from './constants';
import { EncounterBuilderApp } from './ui/EncounterBuilderApp';
import { addEncounterToScene, missingFromScene, saveEncounter } from './encounter/save';

const LAUNCH_ID = `${MODULE_ID}-launch`;
const ADD_TO_SCENE_CLASS = `${MODULE_ID}-add-to-scene`;

const L = (k: string): string => game.i18n.localize(`${MODULE_ID}.${k}`);

interface ModuleApi {
  version: string;
  open: () => void;
  saveEncounter: typeof saveEncounter;
  addEncounterToScene: typeof addEncounterToScene;
}

async function handleAddToScene(): Promise<void> {
  const combat = game.combats.viewed;
  if (!combat || combat.combatants.size === 0) {
    ui.notifications.warn(L('notifications.noEncounter'));
    return;
  }
  const scene = canvas.scene;
  if (!scene) {
    ui.notifications.warn(L('notifications.noActiveScene'));
    return;
  }
  try {
    const result = await addEncounterToScene(combat, scene);
    if (result.placed === 0) {
      ui.notifications.info(L('notifications.allOnScene'));
    } else {
      ui.notifications.info(game.i18n.format(`${MODULE_ID}.notifications.addedToScene`, { count: result.placed }));
    }
    refreshAddToSceneButtons();
  } catch (err) {
    console.error(`${MODULE_ID} | add to scene failed`, err);
    ui.notifications.error(L('notifications.addToSceneError'));
  }
}

// Enabled only when the viewed combat has combatants not yet tokened on the current scene;
// disabled when everything's already placed (or there's no combat/scene to place onto), so
// the button reads as a one-shot "place the missing creatures" action.
function refreshAddToSceneButtons(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>(`.${ADD_TO_SCENE_CLASS}`);
  if (buttons.length === 0) return;
  const combat = game.combats.viewed;
  const scene = canvas.scene;
  const enabled = !!combat && !!scene && missingFromScene(combat, scene).length > 0;
  for (const btn of buttons) btn.disabled = !enabled;
}

// The combat tracker re-renders partial PARTS, so this runs often; the id guard keeps it
// idempotent. GM-only: the builder imports actors and creates combats.
function injectLaunchButton(element: HTMLElement): void {
  if (!game.user.isGM) return;
  if (element.querySelector(`#${LAUNCH_ID}`)) return;

  // The header is a flex column; the create-combat control lives inside `nav.encounters`.
  // Inserting above that nav stacks our button row directly over "Create Combat" in every
  // tracker state without disturbing the nav's own flex row.
  const anchor = element.querySelector('nav.encounters') ?? element.querySelector('[data-action="createCombat"]');
  if (!anchor) return;

  const row = document.createElement('div');
  row.id = LAUNCH_ID;
  row.className = 'pf2e-encounter-builder-launch';

  const builder = document.createElement('button');
  builder.type = 'button';
  builder.textContent = L('button.builder');
  builder.addEventListener('click', () => EncounterBuilderApp.open());

  const addToScene = document.createElement('button');
  addToScene.type = 'button';
  addToScene.className = ADD_TO_SCENE_CLASS;
  addToScene.disabled = true;
  addToScene.textContent = L('button.addToScene');
  addToScene.addEventListener('click', () => void handleAddToScene());

  row.append(builder, addToScene);
  anchor.before(row);
}

Hooks.once('init', () => {
  game.settings.register(MODULE_ID, 'partySize', {
    name: `${MODULE_ID}.party.size`,
    scope: 'client',
    config: false,
    type: Number,
    default: 4,
  });
  game.settings.register(MODULE_ID, 'partyLevel', {
    name: `${MODULE_ID}.party.level`,
    scope: 'client',
    config: false,
    type: Number,
    default: 1,
  });
});

Hooks.on('renderCombatTracker', (_app: unknown, element: HTMLElement) => {
  injectLaunchButton(element);
  refreshAddToSceneButtons();
});

// A freshly loaded scene may already hold (or lack) the viewed combat's tokens, so re-evaluate
// the button whenever the canvas finishes drawing one.
Hooks.on('canvasReady', () => {
  refreshAddToSceneButtons();
});

// Tokens are embedded in the scene, so add/remove fire the embedded-document hooks. Either edge
// changes what's still "missing" from the viewed scene, so recompute the button — but skip edits
// to scenes we aren't showing, since the state only reflects canvas.scene.
function onViewedSceneTokenChange(tokenDoc: { parent?: { id?: string } | null }): void {
  if (tokenDoc.parent?.id !== canvas.scene?.id) return;
  refreshAddToSceneButtons();
}
Hooks.on('createToken', onViewedSceneTokenChange);
Hooks.on('deleteToken', onViewedSceneTokenChange);

Hooks.once('ready', () => {
  const module = game.modules.get(MODULE_ID);
  const version = module?.version ?? '0.0.0';
  const api: ModuleApi = {
    version,
    open: () => EncounterBuilderApp.open(),
    saveEncounter,
    addEncounterToScene,
  };
  // `api` is the Foundry convention for a public API, but isn't a typed field on Module.
  if (module) (module as { api?: ModuleApi }).api = api;
  console.log(`${MODULE_ID} | ready (v${version})`);
});
