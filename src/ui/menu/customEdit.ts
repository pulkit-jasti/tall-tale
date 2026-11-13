// The Custom Game create and edit page (docs/custom-mode.md section 8): one
// page for both. Create starts from the defaults and a free name; Edit from
// the level's own values, and Save writes over it. A narrow, tall panel:
// Back and the title at the top, then the chosen tab's rows scrolling with
// the scrollbar. The Map tab starts with the name and the description (text
// fields typed with the Quest's system keyboard, each with its message
// under it), then the seed; every other row comes from the settings list
// (src/config/levelSettings.ts), so a new setting needs no UI code. Under
// the panel: the Map, Waves and Rules tabs on the left and the gold Save on
// the right. Save checks the name, runs the generator (with its checks),
// stores the level and tells the menu which one it was; when it cannot, a
// status line along the panel's bottom says why.
import type { Object3D } from 'three';
import type { GameAudio } from '../../audio/sound.js';
import { CUSTOM_GAME, MENU, TABS } from '../../config/game.js';
import {
  defaultSettings,
  fixValue,
  formatValue,
  LEVEL_SETTINGS,
  SEED,
  SETTING_GROUPS,
  SETTING_HINTS,
  type LevelSettings,
  type SettingDef,
  type SettingGroup,
} from '../../config/levelSettings.js';
import { note } from '../../debug/notes.js';
import { generateLevel, LevelGenError, summarize } from '../../level/generate.js';
import type { HandState } from '../../player/hands.js';
import { saveCustomLevels } from '../../player/customLevels.js';
import { addLevel, checkName, cleanName, freeName, NAME_MESSAGES, updateLevel, type CustomLevels } from '../../rules/customLevels.js';
import { createRandom } from '../../rules/random.js';
import {
  ActionButton,
  armControls,
  CanvasLabel,
  drawLine,
  FieldRow,
  layerPage,
  Panel,
  PanelHeader,
  ScrollArea,
  SettingRow,
  Tabs,
  UI_COLORS,
  menuCenterY,
  type Control,
  type RowSpec,
  type RowValue,
  type ScrollItem,
} from '../kit/index.js';

export type EditChoice = { kind: 'back' } | { kind: 'saved'; id: string } | null;

interface Row {
  def: SettingDef;
  row: SettingRow;
}

export class CustomEditPage {
  private panel: Panel;
  private back: PanelHeader;
  private nameRow: FieldRow;
  private descriptionRow: FieldRow;
  private tabs: Tabs;
  private save: ActionButton;
  private status: CanvasLabel;
  private area: ScrollArea;
  private rows = new Map<SettingGroup, ScrollItem[]>();
  private settingRows: Row[] = [];
  private seedRow: SettingRow;
  private settings: LevelSettings = defaultSettings();
  private seed = 1;
  /** The level being edited, or null for a new one. */
  private editing: string | null = null;
  /** The seed dice: a seeded random started from the clock (it only picks seeds, never gameplay). */
  private dice = createRandom(Date.now() >>> 0);

  constructor(
    parent: Object3D,
    audio: GameAudio,
    private levels: CustomLevels,
  ) {
    const E = CUSTOM_GAME.edit;
    const M = MENU.main;
    this.panel = new Panel(parent, {
      width: E.width,
      height: E.height,
      radius: M.radius,
      centerY: menuCenterY(E.height, M.tiltDeg),
      tiltDeg: M.tiltDeg,
      layoutWidth: Math.round(E.width * 15),
      canvasScale: 2,
    });
    const root = this.panel.root;
    // The title ("New level" or "Edit level") and Back float over the panel; the tabs and Save under it.
    this.back = new PanelHeader(audio, 'New level', { back: true });
    this.back.placeAbove(E.height);
    // Under the panel: the tabs from its left edge, Save at its right edge, on one line.
    const lineY = -E.height / 2 - TABS.below - TABS.height / 2;
    this.tabs = new Tabs(
      audio,
      SETTING_GROUPS.map((g) => g.label),
    );
    this.tabs.group.position.set(-E.width / 2 + this.tabs.width / 2, lineY, 0);
    this.tabs.onChange = (i) => this.showTab(SETTING_GROUPS[i].id);
    this.save = new ActionButton(audio, E.saveSize[0], E.saveSize[1], 'tick', 'Save', E.saveColor, E.saveInk);
    this.save.group.position.set(E.width / 2 - E.saveSize[0] / 2, lineY, 0);
    // Why it could not save: under the tabs and Save, outside the panel (the rows keep the same room over and under them).
    this.status = new CanvasLabel(E.width, E.statusHeight);
    this.status.mesh.position.set(0, lineY - TABS.height / 2 - 0.5 - E.statusHeight / 2, 0.05);
    // The rows' window, and the scrollbar beside it.
    const windowW = E.windowRight - E.windowLeft;
    const windowX = (E.windowLeft + E.windowRight) / 2;
    this.area = new ScrollArea(audio, { width: windowW, height: E.windowTop - E.windowBottom, gap: E.rowGap, scrollbarX: E.scrollbarX - windowX });
    this.area.group.position.set(windowX, (E.windowTop + E.windowBottom) / 2, 0);
    root.add(this.back.group, this.tabs.group, this.save.group, this.status.mesh, this.area.group);
    // The Map tab: the name, the description, the seed, then its settings.
    this.nameRow = new FieldRow(audio, 'Name', windowW, CUSTOM_GAME.nameMax, 'Name your level', 'Shown in your list of levels');
    this.nameRow.field.onInput = () => this.checkName(false);
    this.nameRow.field.onDone = () => this.checkName(true);
    this.descriptionRow = new FieldRow(audio, 'Description', windowW, CUSTOM_GAME.descriptionMax, 'Optional: what is special about it', 'Shown on the level card');
    this.descriptionRow.field.onInput = (text) => this.checkDescription(text);
    this.seedRow = new SettingRow(audio, SEED.label, { kind: 'seed', value: this.seed, roll: () => this.dice.int(SEED.max + 1) }, windowW, SEED.hint);
    this.seedRow.onChange = (v) => {
      this.seed = v as number;
      this.setStatus(null);
    };
    for (const g of SETTING_GROUPS) this.rows.set(g.id, g.id === 'map' ? [this.nameRow, this.descriptionRow, this.seedRow] : []);
    for (const def of LEVEL_SETTINGS) {
      const row = new SettingRow(audio, def.label, specFor(def, this.settings), windowW, SETTING_HINTS[def.key]);
      row.onChange = (value) => this.changed(def, row, value);
      this.settingRows.push({ def, row });
      this.rows.get(def.group)!.push(row);
    }
  }

  get visible(): boolean {
    return this.panel.visible;
  }

  /** Opens for a new level (null) or to edit one, on the Map tab, at the top. */
  open(editId: string | null): void {
    const entry = editId ? this.levels.levels.find((l) => l.id === editId) : undefined;
    this.editing = entry?.id ?? null;
    this.settings = entry ? structuredClone(entry.level.meta.settings) : defaultSettings();
    this.seed = entry ? entry.level.meta.askedSeed : this.dice.int(SEED.max + 1);
    this.nameRow.field.setValue(entry ? entry.name : freeName(this.levels));
    this.nameRow.field.setMessage(null);
    this.descriptionRow.field.setValue(entry?.description ?? '');
    this.descriptionRow.field.setMessage(null);
    this.setStatus(null);
    this.seedRow.setValue(this.seed);
    for (const { def, row } of this.settingRows) {
      row.setValue(controlValue(def, this.settings));
      row.setValueText(formatValue(def, this.settings[def.key]));
    }
    this.back.setTitle(this.editing ? 'Edit level' : 'New level');
    this.panel.visible = true;
    this.panel.popIn(0.25);
    this.tabs.select(0);
    this.showTab('map');
    this.paint();
    armControls(this.controls);
  }

  hide(): void {
    this.nameRow.field.blur();
    this.descriptionRow.field.blur();
    this.panel.visible = false;
  }

  update(hands: HandState[], dt: number): EditChoice {
    if (!this.panel.visible) return null;
    this.panel.update(dt);
    if (this.back.update(hands, dt)) {
      this.hide();
      return { kind: 'back' };
    }
    this.tabs.update(hands, dt);
    this.area.update(hands, dt);
    if (this.save.update(hands, dt)) return this.trySave();
    return null;
  }

  private get controls(): Control[] {
    return [this.back, this.tabs, this.save, this.area];
  }

  private showTab(group: SettingGroup): void {
    this.area.setItems(this.rows.get(group)!);
    // Drawn like the settings page: on top, in the page's own order (no flicker on taps). Again for the tab's rows.
    layerPage(this.panel.root);
    armControls(this.area.controls);
  }

  /** A row moved: the setting takes its value (made valid), and the row shows it (once a slider is let go). */
  private changed(def: SettingDef, row: SettingRow, value: RowValue): void {
    const next = fixValue(def, settingValue(def, value));
    (this.settings as unknown as Record<string, unknown>)[def.key] = next;
    row.setValueText(formatValue(def, next));
    this.setStatus(null);
  }

  /** The name's message: what is wrong, or a note at the limit. `done`: the keyboard closed (an empty name is told then). */
  private checkName(done: boolean): boolean {
    const field = this.nameRow.field;
    const problem = checkName(this.levels, field.value, this.editing);
    if (problem && (problem !== 'empty' || done)) field.setMessage(NAME_MESSAGES[problem], true);
    else if (cleanName(field.value).length >= CUSTOM_GAME.nameMax) field.setMessage(NAME_MESSAGES.tooLong, false);
    else field.setMessage(null);
    return problem === null;
  }

  private checkDescription(text: string): void {
    this.descriptionRow.field.setMessage(text.length >= CUSTOM_GAME.descriptionMax ? `${CUSTOM_GAME.descriptionMax} characters at most.` : null, false);
  }

  /** The status line: only drawn when its text changes (a redraw on every slider step was what made the panel flicker). */
  private statusText: string | null = '';
  private setStatus(text: string | null): void {
    if (text === this.statusText) return;
    this.statusText = text;
    this.status.draw((c, w, h) => {
      if (text) drawLine(c, text, w / 2, h / 2, w - 8, h * 0.62, UI_COLORS.warn);
    });
  }

  private trySave(): EditChoice {
    if (!this.checkName(true)) {
      // Not saved: back to the Map tab's top, where the name and its message are.
      if (this.tabs.selected !== 0) {
        this.tabs.select(0);
        this.showTab('map');
      } else this.area.scrollToTop();
      this.setStatus('Check the name first.');
      return null;
    }
    const name = cleanName(this.nameRow.field.value);
    const description = this.descriptionRow.field.value;
    try {
      const made = generateLevel(this.seed, this.settings, name);
      note(`Custom level "${name}":\n${summarize(made)}`);
      const now = Date.now();
      if (this.editing) {
        if (!updateLevel(this.levels, this.editing, name, description, made.level, now)) return null;
        saveCustomLevels();
        this.hide();
        return { kind: 'saved', id: this.editing };
      }
      const entry = addLevel(this.levels, name, description, made.level, now);
      if (!entry) {
        this.setStatus(`${CUSTOM_GAME.maxLevels} levels at most. Delete one first.`);
        return null;
      }
      saveCustomLevels();
      this.hide();
      return { kind: 'saved', id: entry.id };
    } catch (error) {
      if (!(error instanceof LevelGenError)) throw error;
      note(`Custom level "${name}" failed: ${error.problems.join('; ')}`);
      this.setStatus('Could not make a level with these settings. Try changing them.');
      return null;
    }
  }

  private paint(): void {
    const E = CUSTOM_GAME.edit;
    // Only the parchment: no lines (they took room for nothing).
    this.panel.paint(() => {});
  }
}

/** A setting's control spec, at its value now. */
function specFor(def: SettingDef, s: LevelSettings): RowSpec {
  switch (def.kind) {
    case 'count':
      return { kind: 'count', min: def.min, max: def.max, value: s[def.key] as number };
    case 'range':
      return { kind: 'range', steps: Math.round((def.max - def.min) / def.step), value: controlValue(def, s) as number };
    case 'span':
      return { kind: 'span', steps: Math.round((def.max - def.min) / def.step), value: controlValue(def, s) as [number, number] };
    case 'choice':
      return { kind: 'choice', labels: def.choices.map((c) => c.label), value: controlValue(def, s) as number };
    case 'toggle':
      return { kind: 'toggle', value: s[def.key] as boolean };
  }
}

/** A setting's value as its control holds it (sliders 0 to 1, a choice's index). */
function controlValue(def: SettingDef, s: LevelSettings): RowValue {
  const v = s[def.key];
  switch (def.kind) {
    case 'range':
      return ((v as number) - def.min) / (def.max - def.min);
    case 'span':
      return (v as [number, number]).map((n) => (n - def.min) / (def.max - def.min)) as [number, number];
    case 'choice':
      return Math.max(0, def.choices.findIndex((c) => c.id === v));
    default:
      return v as RowValue;
  }
}

/** A control's value back as the setting's (fixValue makes it valid after). */
function settingValue(def: SettingDef, value: RowValue): unknown {
  switch (def.kind) {
    case 'range':
      return def.min + (value as number) * (def.max - def.min);
    case 'span':
      return (value as [number, number]).map((n) => def.min + n * (def.max - def.min));
    case 'choice':
      return def.choices[value as number]?.id;
    default:
      return value;
  }
}
