// The terrain fade: at night the board, the castle, the roads, the decor and
// the hills turn darker, a little blue and a little less colorful
// (DayLook.terrainFade), so their bright day colors match the dark sky. It
// only ever darkens (a multiply), never washes them out. One shared amount (set by
// the day and night cycle), a few shader lines at the end of each material,
// no extra draw call. Units, tools and anything that glows are left out, so
// goblins and the touch states keep their colors.
import { Color, type Material, type MeshLambertMaterial, type MeshStandardMaterial, type Object3D } from 'three';
import { DAY_NIGHT } from '../config/game.js';

const amount = { value: 0 };
const tint = { value: new Color(DAY_NIGHT.terrainTint) };
const desaturate = { value: DAY_NIGHT.terrainDesaturate };

/** Sets the fade on all the terrain at once (0 = its own colors, 1 = full). */
export function setNightFade(value: number): void {
  amount.value = value;
}

function addNightFade(material: MeshStandardMaterial | MeshLambertMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.nightFade = amount;
    shader.uniforms.nightTint = tint;
    shader.uniforms.nightDesaturate = desaturate;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float nightFade;\nuniform vec3 nightTint;\nuniform float nightDesaturate;')
      .replace(
        '#include <opaque_fragment>',
        [
          '#include <opaque_fragment>',
          // A little less color (toward its own brightness, so never lighter), then multiplied by the dark cool tint.
          'float nightLuma = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));',
          'gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(nightLuma), nightDesaturate * nightFade);',
          'gl_FragColor.rgb *= mix(vec3(1.0), nightTint, nightFade);',
        ].join('\n'),
      );
  };
  material.customProgramCacheKey = () => 'nightFade';
}

/**
 * Gives the fade to every lit material under `root`, once each. Call it on
 * terrain only, before units or tools are added there. Skips materials with
 * their own shader changes and anything that glows (emissive).
 */
export function fadeAtNight(root: Object3D): void {
  const seen = new Set<Material>();
  root.traverse((object) => {
    const mesh = object as Object3D & { material?: Material | Material[] };
    if (!mesh.material) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (seen.has(material)) continue;
      seen.add(material);
      if (!(material as MeshStandardMaterial).isMeshStandardMaterial && !(material as MeshLambertMaterial).isMeshLambertMaterial) continue;
      const lit = material as MeshStandardMaterial | MeshLambertMaterial;
      if (Object.prototype.hasOwnProperty.call(material, 'onBeforeCompile')) continue;
      if (lit.emissive.getHex() !== 0) continue;
      addNightFade(lit);
    }
  });
}
