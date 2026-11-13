// The terrain look for the time of day: the board, the castle, the roads,
// the decor and the hills lose a little color and are multiplied by a tint
// (DayLook.terrainTint, terrainBright, terrainGrey). At night darker, a
// little blue and less colorful, so the bright day colors match the dark
// sky (never washed out); in the noon sun warm and golden. One shared tint
// (set by the day and night cycle), a few shader lines at the end of each
// material, no extra draw call. Units, tools and anything that glows are
// left out, so goblins and the touch states keep their colors.
import { Color, type Material, type MeshLambertMaterial, type MeshStandardMaterial, type Object3D } from 'three';

const tint = { value: new Color(1, 1, 1) };
const grey = { value: 0 };

/** Sets the look of all the terrain at once: the multiply tint (linear, may go past 1) and the share of color lost. */
export function setTerrainLook(color: Color, greyShare: number): void {
  tint.value.copy(color);
  grey.value = greyShare;
}

function addNightFade(material: MeshStandardMaterial | MeshLambertMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.terrainTint = tint;
    shader.uniforms.terrainGrey = grey;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 terrainTint;\nuniform float terrainGrey;')
      .replace(
        '#include <opaque_fragment>',
        [
          '#include <opaque_fragment>',
          // A little less color (toward its own brightness, so never lighter), then multiplied by the tint.
          'float terrainLuma = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));',
          'gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(terrainLuma), terrainGrey);',
          'gl_FragColor.rgb *= terrainTint;',
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
