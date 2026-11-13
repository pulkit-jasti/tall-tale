// The night rim: a bright edge on troops and goblins, so they stand out from
// the darker ground at sunset and at night (DAY_NIGHT.rim). It is added on
// top of the emissive color, so the Idle, Ready, Held and Locked glow and the
// hit flash still work as before. One shared amount for every unit (set by
// the day and night cycle), a few shader lines, no extra draw call.
import { Color, type MeshStandardMaterial } from 'three';
import { DAY_NIGHT } from '../config/game.js';

/** How strong the rim is right now (0 = off), shared by every unit material. */
const amount = { value: 0 };
const power = { value: DAY_NIGHT.rimPower };

/** Sets the rim strength on every unit at once (0 to 1). */
export function setNightRim(value: number): void {
  amount.value = value;
}

/** Gives a unit material the rim, in its side's color. Call once per material (clones lose it). */
export function addNightRim(material: MeshStandardMaterial, color: number): void {
  const rimColor = { value: new Color(color) };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.rimAmount = amount;
    shader.uniforms.rimPower = power;
    shader.uniforms.rimColor = rimColor;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float rimAmount;\nuniform float rimPower;\nuniform vec3 rimColor;')
      .replace(
        '#include <emissivemap_fragment>',
        // Brightest where the surface turns away from the eye (its outline).
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += rimColor * rimAmount * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), rimPower);',
      );
  };
  // Every unit shares one shader program.
  material.customProgramCacheKey = () => 'nightRim';
}
