/*
 * Fermed geometry library.
 *
 * Every shape a worker may use lives here — no arbitrary code, no loaders, no
 * asset pipeline. This keeps renders reproducible and keeps the worker from
 * inventing geometry that the style set cannot dress.
 *
 * Each entry: (opts, THREE) => THREE.BufferGeometry
 */

import * as THREE from 'three';

const SEG = (o, k, d) => (o?.[k] ?? d);

export const SHAPES = {
  box: (o) => new THREE.BoxGeometry(SEG(o, 'w', 1), SEG(o, 'h', 1), SEG(o, 'd', 1)),
  sphere: (o) => new THREE.SphereGeometry(SEG(o, 'r', 0.7), SEG(o, 'widthSeg', 48), SEG(o, 'heightSeg', 32)),
  icosahedron: (o) => new THREE.IcosahedronGeometry(SEG(o, 'r', 0.8), SEG(o, 'detail', 0)),
  dodecahedron: (o) => new THREE.DodecahedronGeometry(SEG(o, 'r', 0.8), SEG(o, 'detail', 0)),
  octahedron: (o) => new THREE.OctahedronGeometry(SEG(o, 'r', 0.8), SEG(o, 'detail', 0)),
  tetrahedron: (o) => new THREE.TetrahedronGeometry(SEG(o, 'r', 0.9), SEG(o, 'detail', 0)),
  torus: (o) => new THREE.TorusGeometry(SEG(o, 'r', 0.6), SEG(o, 'tube', 0.2), SEG(o, 'radialSeg', 24), SEG(o, 'tubularSeg', 96)),
  torusKnot: (o) => new THREE.TorusKnotGeometry(SEG(o, 'r', 0.55), SEG(o, 'tube', 0.16), SEG(o, 'tubularSeg', 160), SEG(o, 'radialSeg', 20), SEG(o, 'p', 2), SEG(o, 'q', 3)),
  cone: (o) => new THREE.ConeGeometry(SEG(o, 'r', 0.6), SEG(o, 'h', 1.4), SEG(o, 'seg', 48)),
  cylinder: (o) => new THREE.CylinderGeometry(SEG(o, 'rTop', 0.5), SEG(o, 'rBottom', 0.5), SEG(o, 'h', 1.4), SEG(o, 'seg', 48)),
  capsule: (o) => new THREE.CapsuleGeometry(SEG(o, 'r', 0.35), SEG(o, 'len', 0.8), SEG(o, 'capSeg', 12), SEG(o, 'radialSeg', 32)),
  plane: (o) => new THREE.PlaneGeometry(SEG(o, 'w', 4), SEG(o, 'h', 4), SEG(o, 'wSeg', 1), SEG(o, 'hSeg', 1)),
  ring: (o) => new THREE.RingGeometry(SEG(o, 'inner', 0.4), SEG(o, 'outer', 0.8), SEG(o, 'seg', 72)),
  circle: (o) => new THREE.CircleGeometry(SEG(o, 'r', 0.8), SEG(o, 'seg', 72)),
  tube: (o) => {
    // A helix / ribbon path — the workhorse for "flow" storytelling.
    const turns = SEG(o, 'turns', 2);
    const radius = SEG(o, 'r', 1);
    const height = SEG(o, 'h', 3);
    const pts = [];
    const N = SEG(o, 'samples', 220);
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const a = t * Math.PI * 2 * turns;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, (t - 0.5) * height, Math.sin(a) * radius));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.TubeGeometry(curve, N, SEG(o, 'tubeR', 0.045), SEG(o, 'radialSeg', 10), false);
  },
  grid: (o) => new THREE.PlaneGeometry(SEG(o, 'w', 20), SEG(o, 'h', 20), SEG(o, 'wSeg', 40), SEG(o, 'hSeg', 40)),
  text3d: (o) => {
    // Placeholder geometry — TextGeometry needs a font file; instead fermed
    // renders 3D "type" as extruded blocks so no font pipeline is required.
    const chars = String(o?.text ?? 'FERMED').length;
    return new THREE.BoxGeometry(chars * SEG(o, 'charW', 0.34), SEG(o, 'charH', 0.6), SEG(o, 'depth', 0.16));
  },
};

export const SHAPE_NAMES = Object.keys(SHAPES);

export function makeGeometry(shape, opts = {}) {
  const fn = SHAPES[shape] || SHAPES.box;
  const geo = fn(opts);
  geo.userData.fermedShape = shape;
  return geo;
}

/** Material presets — coloured by theme, never by hard-coded hex in a spec. */
export const MATERIALS = {
  solid: (theme, o, THREE_) => new THREE_.MeshStandardMaterial({
    color: new THREE_.Color(o.color || theme.palette.surface),
    metalness: o.metalness ?? theme.geometry.metalness,
    roughness: o.roughness ?? theme.geometry.roughness,
    flatShading: o.flatShading ?? theme.geometry.flatShading,
    emissive: new THREE_.Color(o.emissive || theme.palette.accent),
    emissiveIntensity: o.emissiveIntensity ?? 0,
    transparent: (o.opacity ?? 1) < 1,
    opacity: o.opacity ?? 1,
  }),
  accent: (theme, o, THREE_) => new THREE_.MeshStandardMaterial({
    color: new THREE_.Color(o.color || theme.palette.accent),
    metalness: o.metalness ?? theme.geometry.metalness,
    roughness: o.roughness ?? Math.min(0.35, theme.geometry.roughness),
    emissive: new THREE_.Color(theme.palette.accent),
    emissiveIntensity: o.emissiveIntensity ?? 0.35,
    transparent: (o.opacity ?? 1) < 1,
    opacity: o.opacity ?? 1,
  }),
  glass: (theme, o, THREE_) => new THREE_.MeshPhysicalMaterial({
    color: new THREE_.Color(o.color || theme.palette.text),
    metalness: o.metalness ?? 0.1,
    roughness: o.roughness ?? 0.08,
    transmission: o.transmission ?? 0.9,
    thickness: o.thickness ?? 1.2,
    transparent: true,
    opacity: o.opacity ?? 1,
    ior: 1.35,
  }),
  wire: (theme, o, THREE_) => new THREE_.MeshBasicMaterial({
    color: new THREE_.Color(o.color || theme.palette.accent),
    wireframe: true,
    transparent: true,
    opacity: o.opacity ?? 0.55,
  }),
  ghost: (theme, o, THREE_) => new THREE_.MeshStandardMaterial({
    color: new THREE_.Color(o.color || theme.palette.muted),
    metalness: 0.2,
    roughness: 0.9,
    transparent: true,
    opacity: o.opacity ?? 0.28,
    depthWrite: false,
  }),
  topographic: (theme, o, THREE_) => new THREE_.MeshStandardMaterial({
    color: new THREE_.Color(theme.palette.grid),
    wireframe: true,
    transparent: true,
    opacity: o.opacity ?? 0.4,
  }),
};

export const MATERIAL_NAMES = Object.keys(MATERIALS);

export function makeMaterial(kind, theme, opts = {}) {
  const fn = MATERIALS[kind] || MATERIALS.solid;
  const mat = fn(theme, opts, THREE);
  mat.userData.fermedMaterial = kind;
  return mat;
}
