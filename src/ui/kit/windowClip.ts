// Cutting a scrolling page's rows at its window's edges, in the shader, by
// world position (src/ui/kit/scrollArea.ts). three.js's own clipping planes
// are turned into one camera's view space, and IWSDK draws both eyes in one
// pass (multiview), so each eye cut in a different place and rows came and
// went as the head moved (headset test 2026-11-11). A world position does
// not depend on the eye, so this cut is the same for both.
import { Vector4, type Material, type Plane } from 'three';

/** The two edges as shader uniforms (a plane's normal and constant): keep what is below the top and above the bottom. */
export interface WindowEdges {
  top: { value: Vector4 };
  bottom: { value: Vector4 };
}

export const createWindowEdges = (): WindowEdges => ({ top: { value: new Vector4() }, bottom: { value: new Vector4() } });

/** Copies two world planes into the edges (every frame: the panel moves with the board). */
export function setWindowEdges(edges: WindowEdges, top: Plane, bottom: Plane): void {
  edges.top.value.set(top.normal.x, top.normal.y, top.normal.z, top.constant);
  edges.bottom.value.set(bottom.normal.x, bottom.normal.y, bottom.normal.z, bottom.constant);
}

const clipped = new WeakSet<Material>();

/** Makes a material discard what is outside the edges (once per material; its shader is built again once). */
export function clipToWindow(material: Material, edges: WindowEdges): void {
  if (clipped.has(material)) return;
  clipped.add(material);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.windowTop = edges.top;
    shader.uniforms.windowBottom = edges.bottom;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vWindowWorld;\nvoid main() {')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vWindowWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      [
        'uniform vec4 windowTop;',
        'uniform vec4 windowBottom;',
        'varying vec3 vWindowWorld;',
        'void main() {',
        '  if (dot(windowTop.xyz, vWindowWorld) + windowTop.w < 0.0 || dot(windowBottom.xyz, vWindowWorld) + windowBottom.w < 0.0) discard;',
      ].join('\n'),
    );
  };
  // Its own program (the uniforms differ from an uncut material of the same kind).
  material.customProgramCacheKey = () => 'windowClip';
  material.needsUpdate = true;
}
