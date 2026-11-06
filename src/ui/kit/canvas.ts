// Canvas textures and the flat pictures made from them (panels, button
// faces, price tags, markers, labels, the FPS panel): one place for the
// color space, sharpness and unlit material every one of them needs.
import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';

/** A texture from a canvas, in sRGB, `anisotropy` sharp at a slant. Set needsUpdate after redrawing the canvas. */
export function canvasTexture(canvas: HTMLCanvasElement, anisotropy = 1): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}

/** A flat unlit picture (width by height, facing +z), see-through where the canvas is, never fogged or tone mapped. */
export function canvasPlane(texture: CanvasTexture, width: number, height: number): Mesh {
  return new Mesh(new PlaneGeometry(width, height), new MeshBasicMaterial({ map: texture, transparent: true, fog: false, toneMapped: false }));
}
