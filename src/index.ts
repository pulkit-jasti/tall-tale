import { World } from '@iwsdk/core';
import { AudioContext as ThreeAudioContext } from 'three';
import projectOptions from 'virtual:iwsdk-project';
import { DEBUG_KEYS } from './debug/debugKeys.js';
import { GameSystem, requestBattleStart } from './game.js';
import { MouseLookSystem } from './player/mouseLook.js';

const container = document.getElementById('scene-container') as HTMLDivElement;
const startPage = document.getElementById('start-page') as HTMLDivElement;
const enterButton = document.getElementById('enter-vr') as HTMLButtonElement;
const keyList = document.getElementById('debug-keys') as HTMLUListElement;

for (const { key, does } of DEBUG_KEYS) {
  const item = document.createElement('li');
  item.innerHTML = `<b>${key}</b> ${does}`;
  keyList.appendChild(item);
}

World.create(container, projectOptions).then(async (world) => {
  world.registerSystem(GameSystem);
  world.registerSystem(MouseLookSystem);

  const vrSupported = (await navigator.xr?.isSessionSupported('immersive-vr').catch(() => false)) ?? false;
  enterButton.disabled = false;
  enterButton.textContent = vrSupported ? 'Enter VR' : 'Play in the browser (no VR found)';
  enterButton.addEventListener('click', () => {
    // Sound needs one tap before it can play.
    void ThreeAudioContext.getContext().resume();
    startPage.style.display = 'none';
    // The tutorial battle starts once the board is placed.
    requestBattleStart(vrSupported);
    if (vrSupported) world.launchXR();
  });
  // Coming back from VR shows the start page again.
  world.renderer.xr.addEventListener('sessionend', () => {
    startPage.style.display = 'flex';
  });
});
