import { AssetManager, World } from '@iwsdk/core';
import { AudioContext as ThreeAudioContext } from 'three';
import projectOptions from 'virtual:iwsdk-project';
import { mic } from './audio/mic.js';
import { LOADING } from './config/game.js';
import { GameSystem, gameReady, requestBattleStart } from './game.js';
import { MouseLookSystem, setLandingView } from './player/mouseLook.js';
import { uiFontReady } from './ui/kit/font.js';

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const container = byId<HTMLDivElement>('scene-container');
const startPage = byId<HTMLDivElement>('start-page');
const steps = {
  intro: byId<HTMLDivElement>('step-intro'),
  mic: byId<HTMLDivElement>('step-mic'),
  enter: byId<HTMLDivElement>('step-enter'),
};
const getStarted = byId<HTMLButtonElement>('get-started');
const allowMic = byId<HTMLButtonElement>('allow-mic');
const skipMic = byId<HTMLButtonElement>('skip-mic');
const enterButton = byId<HTMLButtonElement>('enter-vr');
const micStatus = byId<HTMLParagraphElement>('mic-status');
const vrHint = byId<HTMLParagraphElement>('vr-hint');
const loading = byId<HTMLDivElement>('loading');
const loadingFill = byId<HTMLDivElement>('loading-fill');
const loadingStatus = byId<HTMLParagraphElement>('loading-status');
const loadingTip = byId<HTMLParagraphElement>('loading-tip');

// ---- The loading screen: a real progress bar from every model and sound the game asks for ----

let started = 0;
let finished = 0;
let shown = 0;
const showProgress = (share: number): void => {
  // Never goes back, even when new files join the list.
  shown = Math.max(shown, Math.min(1, share));
  loadingFill.style.width = `${(shown * 100).toFixed(1)}%`;
};
const track = <T>(load: Promise<T>): Promise<T> => {
  started++;
  return load.finally(() => {
    finished++;
    // Up to 90% while loading; building and warming up take the rest.
    showProgress((finished / Math.max(started, 1)) * 0.9);
  });
};
const loadGltf = AssetManager.loadGLTF.bind(AssetManager);
AssetManager.loadGLTF = ((...args: Parameters<typeof loadGltf>) => track(loadGltf(...args))) as typeof AssetManager.loadGLTF;
const loadAudio = AssetManager.loadAudio.bind(AssetManager);
AssetManager.loadAudio = ((...args: Parameters<typeof loadAudio>) => track(loadAudio(...args))) as typeof AssetManager.loadAudio;

let tipIndex = Math.floor(Math.random() * LOADING.tips.length);
loadingTip.textContent = LOADING.tips[tipIndex];
const tipTimer = window.setInterval(() => {
  tipIndex = (tipIndex + 1) % LOADING.tips.length;
  loadingTip.style.opacity = '0';
  window.setTimeout(() => {
    loadingTip.textContent = LOADING.tips[tipIndex];
    loadingTip.style.opacity = '1';
  }, 300);
}, LOADING.tipSeconds * 1000);

const nextFrame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));

// ---- The start page: one step at a time (Get started, the mic, Enter VR) ----

const MIC_TEXT: Record<string, string> = {
  asking: 'Tap Allow in the browser prompt...',
  on: 'Microphone on. Shout "Charge!" into your war horn!',
  denied: '',
  unsupported: 'No microphone in this browser. Hold your war horn up to your face to call your knights.',
};
/** The player chose to play without the mic (no browser prompt). */
let micSkipped = false;
const showStep = (name: keyof typeof steps): void => {
  for (const [key, step] of Object.entries(steps)) step.hidden = key !== name;
  if (name === 'enter') {
    micStatus.textContent = micSkipped ? MIC_TEXT.denied : (MIC_TEXT[mic.state] ?? MIC_TEXT.denied);
    // No line at all when there is nothing to say (an empty line still takes a gap).
    micStatus.hidden = !micStatus.textContent;
  }
};

World.create(container, projectOptions).then(async (world) => {
  // The UI font before any panel is drawn (canvas text keeps the font it was drawn with).
  await uiFontReady;
  world.registerSystem(GameSystem);
  world.registerSystem(MouseLookSystem);

  const vrSupported = (await navigator.xr?.isSessionSupported('immersive-vr').catch(() => false)) ?? false;
  // Mic permission is asked here, on the 2D page, before entering VR. Already
  // allowed before: the mic opens now with no prompt.
  if (!mic.supported) mic.state = 'unsupported';
  else if (await mic.alreadyAllowed()) await mic.request();
  enterButton.textContent = vrSupported ? 'Enter VR' : 'Play in the browser';
  vrHint.hidden = vrSupported;
  // A returning player whose mic is already decided goes straight to Enter VR.
  showStep(mic.state === 'on' || mic.state === 'denied' ? 'enter' : 'intro');

  getStarted.addEventListener('click', () => {
    // Sound needs one tap before it can play.
    void ThreeAudioContext.getContext().resume();
    showStep(mic.state === 'unknown' ? 'mic' : 'enter');
  });
  allowMic.addEventListener('click', () => {
    // Entering VR needs a fresh tap after the browser's prompt (the browser
    // only opens VR right after a tap), so Enter VR is its own step.
    allowMic.disabled = true;
    skipMic.hidden = true;
    allowMic.textContent = MIC_TEXT.asking;
    void mic.request().then(() => showStep('enter'));
  });
  skipMic.addEventListener('click', () => {
    micSkipped = true;
    showStep('enter');
  });
  /** Leaves the start page for the game: the camera back at the giant's eyes, then the board is placed. */
  const leaveStartPage = (vr: boolean): void => {
    startPage.style.display = 'none';
    setLandingView(false);
    // Once the board is placed, the welcome panel's Play button starts the tutorial.
    requestBattleStart(vr);
  };
  enterButton.addEventListener('click', () => {
    void ThreeAudioContext.getContext().resume();
    // In VR the start page stays as it is while the browser asks to allow VR,
    // and only leaves once the session really starts (sessionstart below). A
    // declined prompt leaves the page untouched, so Enter VR can be tapped again.
    if (vrSupported) world.launchXR();
    else leaveStartPage(false);
  });
  world.renderer.xr.addEventListener('sessionstart', () => leaveStartPage(true));
  // Coming back from VR shows the start page again.
  world.renderer.xr.addEventListener('sessionend', () => {
    startPage.style.display = 'flex';
    showStep('enter');
    setLandingView(true);
  });

  // The loading screen stays until the game has built everything, then the
  // shaders are compiled and a few frames drawn behind it, so the page is
  // smooth from the moment it fades.
  try {
    await gameReady;
    loadingStatus.textContent = 'Getting the battle ready...';
    showProgress(0.93);
    await nextFrame();
    await world.renderer.compileAsync(world.scene, world.camera).catch(() => world.renderer.compile(world.scene, world.camera));
    showProgress(0.98);
    for (let i = 0; i < LOADING.settleFrames; i++) await nextFrame();
    showProgress(1);
    window.clearInterval(tipTimer);
    loading.style.transitionDuration = `${LOADING.fadeSeconds}s`;
    loading.classList.add('done');
    window.setTimeout(() => loading.remove(), LOADING.fadeSeconds * 1000 + 100);
  } catch {
    window.clearInterval(tipTimer);
    loadingStatus.textContent = 'Something went wrong while loading. Please reload the page.';
    loadingTip.textContent = '';
  }
});
