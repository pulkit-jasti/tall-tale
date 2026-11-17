// The magnifying glass's looks (2026-11-17 playtest): a progress ring that
// fills while the beam works on something (a bed growing, a plant healing, a
// keg or a goblin catching fire), so the player knows how long to hold still,
// and a livelier beam: a hot core with bands of light running down it to the
// target, a soft glow around it, and a bright spot where it lands. Each is one
// mesh with a tiny shader (no textures, no geometry rebuilt while aiming).
import { AdditiveBlending, CylinderGeometry, DoubleSide, Mesh, RingGeometry, ShaderMaterial, Color } from 'three';

/** A flat ring (lying in the ground's plane) that fills clockwise from 0 to 1. */
export function progressRing(): { mesh: Mesh; set: (share: number, hex: number) => void } {
  const material = new ShaderMaterial({
    uniforms: { share: { value: 0 }, color: { value: new Color(0xffffff) } },
    vertexShader: `
      varying vec2 vPos;
      void main() {
        vPos = position.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float share;
      uniform vec3 color;
      varying vec2 vPos;
      void main() {
        // Angle from the far side, going clockwise seen from above (0 to 1).
        float a = fract(atan(vPos.x, -vPos.y) / 6.2831853 + 1.0);
        bool filled = a <= share;
        gl_FragColor = filled ? vec4(color, 0.95) : vec4(0.0, 0.0, 0.0, 0.35);
      }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide,
  });
  const mesh = new Mesh(new RingGeometry(0.78, 1, 40, 1).rotateX(-Math.PI / 2), material);
  mesh.frustumCulled = false;
  const color = material.uniforms.color.value as Color;
  return {
    mesh,
    set: (share, hex) => {
      material.uniforms.share.value = share;
      color.setHex(hex);
    },
  };
}

/** The beam: an open cylinder along +y (0 to 1), scaled to length. `time` makes its bands run toward the target. */
export function glassBeam(): { core: Mesh; glow: Mesh; spot: Mesh; set: (hex: number, opacity: number, time: number) => void } {
  const uniforms = { color: { value: new Color(0xffffff) }, opacity: { value: 0.8 }, time: { value: 0 } };
  const shared = {
    vertexShader: `
      varying float vAlong;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vAlong = position.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  };
  const core = new Mesh(
    new CylinderGeometry(1, 1, 1, 10, 1, true).translate(0, 0.5, 0),
    new ShaderMaterial({
      ...shared,
      uniforms,
      fragmentShader: `
        uniform vec3 color;
        uniform float opacity;
        uniform float time;
        varying float vAlong;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          // Soft at its edges (seen side on), bright in the middle.
          float facing = pow(abs(dot(vNormal, vView)), 1.4);
          // Bands of light running from the lens down to the target.
          float bands = 0.65 + 0.35 * sin(vAlong * 38.0 - time * 14.0);
          // A white-hot middle, the time of day's color at the edges.
          vec3 c = mix(color, vec3(1.0), facing * 0.6);
          gl_FragColor = vec4(c, opacity * facing * bands);
        }`,
    }),
  );
  const glow = new Mesh(
    new CylinderGeometry(1, 1, 1, 10, 1, true).translate(0, 0.5, 0),
    new ShaderMaterial({
      ...shared,
      uniforms,
      fragmentShader: `
        uniform vec3 color;
        uniform float opacity;
        uniform float time;
        varying float vAlong;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          float facing = pow(abs(dot(vNormal, vView)), 3.0);
          float pulse = 0.8 + 0.2 * sin(time * 9.0);
          gl_FragColor = vec4(color, opacity * 0.35 * facing * pulse);
        }`,
    }),
  );
  // The hot spot: a disc facing up, brightest in the middle, pulsing.
  const spot = new Mesh(
    new RingGeometry(0, 1, 24, 1).rotateX(-Math.PI / 2),
    new ShaderMaterial({
      uniforms,
      vertexShader: `
        varying vec2 vPos;
        void main() {
          vPos = position.xz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 color;
        uniform float opacity;
        uniform float time;
        varying vec2 vPos;
        void main() {
          float r = length(vPos);
          float pulse = 0.85 + 0.15 * sin(time * 12.0);
          float a = pow(1.0 - clamp(r, 0.0, 1.0), 2.0) * pulse;
          gl_FragColor = vec4(mix(color, vec3(1.0), 1.0 - r), opacity * a);
        }`,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    }),
  );
  for (const m of [core, glow, spot]) m.frustumCulled = false;
  const color = uniforms.color.value;
  return {
    core,
    glow,
    spot,
    set: (hex, opacity, time) => {
      color.setHex(hex);
      uniforms.opacity.value = opacity;
      uniforms.time.value = time;
    },
  };
}
