// Map blueprints (docs/map.md section 8): where things are, as static JSON.
// The game only reads blueprints, it does not care who wrote them (by hand
// for the tutorial, the level generator later). No Three.js here.
//
// Points are [distance from center in cm, angle in degrees]. Angle 0 is the
// front of the board (in front of the player), positive angles go to the right.

export type Polar = [number, number];

export type NodeKind = 'camp' | 'junction' | 'wall';

export interface BlueprintNode {
  id: string;
  kind: NodeKind;
  at: Polar;
  /** Camps only: hill width (cm). Bigger camp, more enemies. */
  size?: number;
}

export interface BlueprintRoad {
  from: string;
  to: string;
  /** In-between points that give the road its gentle curve. */
  via: Polar[];
}

export type TriggerKind = 'keg' | 'boulder' | 'tree';

export interface BlueprintTrigger {
  kind: TriggerKind;
  /** Tutorial wave that introduces it. */
  wave: number;
  at: Polar;
}

export interface Blueprint {
  name: string;
  seed: number;
  nodes: BlueprintNode[];
  roads: BlueprintRoad[];
  /** The hidden troop gate (troops come in build step 5). */
  gate: { at: Polar };
  /** Trigger spots (built in build step 5). */
  triggers: BlueprintTrigger[];
}

const isPolar = (v: unknown): v is Polar =>
  Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && Number.isFinite(n));

/** Checks a blueprint read from JSON and returns it typed. Throws with a clear message if it is broken. */
export function parseBlueprint(data: unknown): Blueprint {
  const fail = (why: string): never => {
    throw new Error(`[blueprint] ${why}`);
  };
  if (!data || typeof data !== 'object') fail('not an object');
  const b = data as Partial<Blueprint>;
  if (typeof b.name !== 'string') fail('missing name');
  if (typeof b.seed !== 'number') fail(`${b.name}: missing seed`);
  if (!Array.isArray(b.nodes) || !Array.isArray(b.roads)) fail(`${b.name}: missing nodes or roads`);
  const ids = new Set<string>();
  for (const node of b.nodes!) {
    if (ids.has(node.id)) fail(`${b.name}: node ${node.id} is listed twice`);
    ids.add(node.id);
    if (!['camp', 'junction', 'wall'].includes(node.kind)) fail(`${b.name}: node ${node.id} has kind ${node.kind}`);
    if (!isPolar(node.at)) fail(`${b.name}: node ${node.id} has a bad position`);
    if (node.kind === 'camp' && !(typeof node.size === 'number' && node.size > 0)) fail(`${b.name}: camp ${node.id} needs a size`);
  }
  for (const road of b.roads!) {
    if (!ids.has(road.from) || !ids.has(road.to)) fail(`${b.name}: road ${road.from} to ${road.to} has an unknown end`);
    if (!Array.isArray(road.via) || !road.via.every(isPolar)) fail(`${b.name}: road ${road.from} to ${road.to} has bad points`);
  }
  if (!b.nodes!.some((n) => n.kind === 'camp')) fail(`${b.name}: no camps`);
  if (!b.nodes!.some((n) => n.kind === 'wall')) fail(`${b.name}: no wall entries`);
  if (!b.gate || !isPolar(b.gate.at)) fail(`${b.name}: missing gate`);
  return { ...(b as Blueprint), triggers: b.triggers ?? [] };
}
