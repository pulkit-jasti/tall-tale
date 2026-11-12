// Everything the player sees after the tutorial (docs/menus.md): the main
// menu panel in front (the campaign panel opens in its place), the tool
// shelf on the right, the achievements shelf on the left and the loadout
// stand low in front. One group in boardLift, raised and sunk as a whole by
// the scene swap (src/world/sceneSwap.ts). The game asks it what was chosen.
import { Group, type Camera, type Object3D, type Vector3, type WebGLRenderer } from 'three';
import type { GameAudio } from '../../audio/sound.js';
import type { Particles } from '../../fx/particles.js';
import type { HandState } from '../../player/hands.js';
import { progress, saveProgress } from '../../player/progress.js';
import { moveTool, type PickTool } from '../../rules/campaign.js';
import type { ModelTemplate } from '../../world/models.js';
import type { Stage } from '../../world/stage.js';
import { CampaignPanel } from './campaignPanel.js';
import { MainMenu } from './mainMenu.js';
import { Shelves, type DisplayModel, type DisplayName } from './shelves.js';

export type MenuChoice = { kind: 'settings' } | { kind: 'replay' } | { kind: 'fight'; level: number } | { kind: 'needTools' } | null;

export class Menu {
  readonly group = new Group();
  private main: MainMenu;
  private campaign: CampaignPanel;
  private shelves: Shelves;
  private page: 'main' | 'campaign' = 'main';

  constructor(
    stage: Stage,
    audio: GameAudio,
    particles: Particles,
    models: Record<DisplayName, DisplayModel>,
    templates: { trophy: ModelTemplate; platform: ModelTemplate },
    /** Separate copies of the pick tools for the campaign card's reward. */
    rewardModels: Partial<Record<PickTool, Object3D>>,
    /** And full-size ones to hold when a reward is grabbed off the card (only to look at, no effects). */
    previewModels: Partial<Record<PickTool, DisplayModel>>,
  ) {
    stage.boardLift.add(this.group);
    this.main = new MainMenu(this.group, audio);
    this.campaign = new CampaignPanel(this.group, audio, progress, rewardModels);
    this.shelves = new Shelves(this.group, stage, audio, particles, models, templates, progress);
    this.shelves.addPreviews(previewModels);
    this.shelves.rewardSource = () => this.campaign.rewardShown();
    // A tool let go over a stand slot (or back on its shelf spot): the loadout changes and is saved, the
    // tools glide where they belong now, and Fight unlocks once both slots are filled.
    this.shelves.onDrop = (tool, to) => {
      if (!moveTool(progress, tool, to)) return;
      saveProgress();
      this.shelves.layout();
      this.campaign.refreshFight();
    };
    this.shelves.onGrabTool = (tool) => {
      if (progress.toolsSeen.includes(tool)) return;
      progress.toolsSeen.push(tool);
      saveProgress();
    };
  }

  /** The menu opens on the main page (or the campaign, after a campaign battle). */
  open(page: 'main' | 'campaign' = 'main'): void {
    this.shelves.layout();
    this.campaign.refresh();
    this.showPage(page);
  }

  /** Closing (Fight, Replay tutorial, settings): nothing stays held. */
  close(): void {
    this.shelves.releaseAll();
    this.main.hide();
    this.campaign.hide();
  }

  /** The panels step away while the settings page is open (the shelves stay). */
  hidePanels(): void {
    this.main.hide();
    this.campaign.hide();
  }

  /**
   * At setup: compiles every home screen material and uploads every tag now
   * (shown for a moment to the compiler only), so nothing hitches the first
   * time it appears or is grabbed.
   */
  warm(renderer: WebGLRenderer, scene: Object3D, camera: Camera): void {
    const wasVisible = this.group.visible;
    this.group.visible = true;
    this.shelves.warm(renderer, scene, camera);
    this.group.visible = wasVisible;
  }

  /** The first empty tool slot on the stand (world), or null (for the empty slots hint's arrow). */
  emptySlotWorld(out: Vector3): Vector3 | null {
    return this.shelves.emptySlotWorld(out);
  }

  showPanels(): void {
    this.showPage(this.page);
  }

  /** Something changed outside (the "Unlock all tools" switch): the shelves and the stand show it. */
  refresh(): void {
    this.shelves.layout();
    this.campaign.refresh();
  }

  update(hands: HandState[], dt: number, head: Vector3): MenuChoice {
    this.shelves.update(hands, dt, head);
    if (this.page === 'main') {
      const choice = this.main.update(hands, dt);
      if (choice === 'campaign') this.showPage('campaign');
      else if (choice === 'settings') return { kind: 'settings' };
      else if (choice === 'replay') return { kind: 'replay' };
      return null;
    }
    const choice = this.campaign.update(hands, dt);
    if (choice?.kind === 'back') this.showPage('main');
    else if (choice?.kind === 'fight' || choice?.kind === 'needTools') return choice;
    return null;
  }

  private showPage(page: 'main' | 'campaign'): void {
    this.page = page;
    if (page === 'main') {
      this.campaign.hide();
      this.main.show();
    } else {
      this.main.hide();
      this.campaign.show();
    }
  }
}
