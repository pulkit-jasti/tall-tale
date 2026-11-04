import { World } from '@iwsdk/core';
import { AudioContext as ThreeAudioContext } from 'three';
import projectOptions from 'virtual:iwsdk-project';
import { mic } from './audio/mic.js';
import { DEBUG_KEYS } from './debug/debugKeys.js';
import { GameSystem, requestBattleStart } from './game.js';
import { MouseLookSystem } from './player/mouseLook.js';

const container = document.getElementById('scene-container') as HTMLDivElement;
const startPage = document.getElementById('start-page') as HTMLDivElement;
const enterButton = document.getElementById('enter-vr') as HTMLButtonElement;
const keyList = document.getElementById('debug-keys') as HTMLUListElement;
const micStatus = document.getElementById('mic-status') as HTMLParagraphElement;

const MIC_TEXT: Record<string, string> = {
  unknown: 'The megaphone needs your microphone. Tap the button to allow it (or say no: you get a bell instead, it works just as well).',
  asking: 'Allow the microphone in the browser prompt...',
  on: 'Microphone on: scream into the megaphone!',
  denied: 'No microphone: you get a bell instead of the megaphone. It works just as well.',
  unsupported: 'No microphone in this browser: you get a bell instead of the megaphone.',
};
const showMic = (): void => {
  micStatus.textContent = MIC_TEXT[mic.state];
};

for (const { key, does } of DEBUG_KEYS) {
  const item = document.createElement('li');
  item.innerHTML = `<b>${key}</b> ${does}`;
  keyList.appendChild(item);
}

World.create(container, projectOptions).then(async (world) => {
  world.registerSystem(GameSystem);
  world.registerSystem(MouseLookSystem);

  const vrSupported = (await navigator.xr?.isSessionSupported('immersive-vr').catch(() => false)) ?? false;
  // Mic permission is asked here, on the 2D page, before entering VR. Already
  // allowed before: the mic opens now with no prompt, so one tap enters VR.
  if (!mic.supported) mic.state = 'unsupported';
  else if (await mic.alreadyAllowed()) await mic.request();
  showMic();
  const enterText = vrSupported ? 'Enter VR' : 'Play in the browser (no VR found)';
  enterButton.disabled = false;
  enterButton.textContent = mic.state === 'unknown' ? 'Allow microphone' : enterText;
  enterButton.addEventListener('click', () => {
    // Sound needs one tap before it can play.
    void ThreeAudioContext.getContext().resume();
    // First tap: the mic prompt. Entering VR needs a fresh tap after it
    // (the browser only opens VR right after a tap), so the button asks again.
    if (mic.state === 'unknown') {
      enterButton.disabled = true;
      void mic.request().then(() => {
        showMic();
        enterButton.disabled = false;
        enterButton.textContent = enterText;
      });
      showMic();
      return;
    }
    startPage.style.display = 'none';
    // Once the board is placed, the welcome panel's Play button starts the tutorial.
    requestBattleStart(vrSupported);
    if (vrSupported) world.launchXR();
  });
  // Coming back from VR shows the start page again.
  world.renderer.xr.addEventListener('sessionend', () => {
    startPage.style.display = 'flex';
  });
});
