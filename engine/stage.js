/*
 * Fermed 3D stage.
 *
 * Owns the renderer, camera, lights and the element registry. It knows nothing
 * about scrolling or video — it renders one deterministic frame given a
 * timeline sample. That separation is what lets the same pixels reach a
 * browser preview and an MP4.
 */

import * as THREE from 'three';

import { makeGeometry, makeMaterial } from './geometry.js';
import { applyIdle, cameraShake } from './timeline.js';
import { clamp } from './util.js';

export function createStage({ canvas, theme, spec, pixelRatioCap = 2 }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true, // required for frame-grab export
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, pixelRatioCap));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = spec?.render?.exposure ?? 1.0;
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme.palette.bg);

  // Environment map. Without one, metalness > 0 renders as flat black because
  // there is nothing for the surface to reflect. Built from the theme so every
  // style set gets reflections that belong to it.
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envScene = new THREE.Scene();
  const envBase = new THREE.Color(theme.palette.surface).multiplyScalar(2.2);
  envScene.add(new THREE.Mesh(
    new THREE.SphereGeometry(60, 16, 12),
    new THREE.MeshBasicMaterial({ color: theme.palette.bg, side: THREE.BackSide }),
  ));
  const panels = [
    { c: 0xffffff, s: 1.0, p: [0, 34, 0], size: [90, 60] },          // top softbox
    { c: 0xffffff, s: 0.55, p: [30, 6, 22], size: [30, 46] },         // key strip
    { c: 0xffffff, s: 0.35, p: [-28, -4, 18], size: [24, 40] },       // fill strip
    { c: theme.palette.accent, s: 1.6, p: [-10, 14, -34], size: [40, 30] }, // rim bounce
    { c: theme.palette.accent, s: 0.9, p: [16, -18, -24], size: [46, 26] }, // floor bounce
  ];
  for (const p of panels) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(p.c).multiplyScalar(p.s),
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(p.size[0], p.size[1]), mat);
    mesh.position.set(...p.p);
    mesh.lookAt(0, 0, 0);
    envScene.add(mesh);
  }
  envScene.add(new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.MeshBasicMaterial({ color: envBase, side: THREE.DoubleSide }),
  ).rotateX(-Math.PI / 2).translateY(-24));
  const envRT = pmrem.fromScene(envScene, 0.02);
  scene.fog = new THREE.FogExp2(theme.palette.bg, spec?.render?.fog ?? 0.02);
  scene.environment = envRT.texture;
  scene.environmentIntensity = spec?.render?.envIntensity ?? 1.15;

  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.05, 400);

  // ---- lighting rig: theme-aware, always three-point -----------------------
  const hemi = new THREE.HemisphereLight(theme.palette.text, theme.palette.bg, 0.55);
  const key = new THREE.DirectionalLight(theme.palette.text, 2.4);
  key.position.set(5, 7, 6);
  const rim = new THREE.DirectionalLight(theme.palette.accent, 1.6);
  rim.position.set(-6, 3, -5);
  const fill = new THREE.PointLight(theme.palette.accent, 8, 30, 2);
  fill.position.set(0, -3, 3);
  scene.add(hemi, key, rim, fill);

  if (spec?.render?.ambient !== 0) {
    scene.add(new THREE.AmbientLight(theme.palette.surface, 0.35));
  }

  // ---- element registry ---------------------------------------------------
  const objects = new Map(); // id -> { mesh, def, seed }
  const group = new THREE.Group();
  scene.add(group);

  const allElements = [];
  (spec.scenes || []).forEach((sceneDef, si) => {
    (sceneDef.elements || []).forEach((el, ei) => {
      allElements.push({ el, id: el.id || `${sceneDef.id || `s${si}`}-e${ei}`, seed: si * 97 + ei * 13 });
    });
  });

  for (const { el, id, seed } of allElements) {
    const geo = makeGeometry(el.shape || 'box', el.geometry || el.shapeOptions || {});
    const mat = makeMaterial(el.material || 'solid', theme, el.materialOptions || el.mat || {});
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false; // elements travel far; culling causes pops
    mesh.userData.id = id;
    if (el.renderOrder != null) mesh.renderOrder = el.renderOrder;
    group.add(mesh);
    objects.set(id, { mesh, def: el, seed });
  }

  // ---- sizing -------------------------------------------------------------
  let aspect = 16 / 9;
  let renderW = 1280;
  let renderH = 720;

  function setSize(w, h, ratio = 1) {
    renderW = w;
    renderH = h;
    aspect = w / h;
    renderer.setPixelRatio(Math.min(ratio, pixelRatioCap));
    renderer.setSize(w, h, false);
    if (canvas) {
      canvas.width = Math.round(w * Math.min(ratio, pixelRatioCap));
      canvas.height = Math.round(h * Math.min(ratio, pixelRatioCap));
    }
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }

  // ---- render one sampled state ------------------------------------------
  function render(sample) {
    scene.background = new THREE.Color(sample.bg || theme.palette.bg);
    scene.fog.color = new THREE.Color(sample.bg || theme.palette.bg);

    const sc = sample.__sceneMeta;
    const shake = cameraShake(sample.camera, sc?.cam?.shake || 0, sample.tSec || 0);

    camera.position.set(...shake.position);
    camera.fov = clamp(shake.fov, 12, 110);
    camera.updateProjectionMatrix();
    camera.lookAt(new THREE.Vector3(...shake.lookAt));

    for (const [id, entry] of objects) {
      const st = sample.elements[id];
      if (!st) {
        entry.mesh.visible = false;
        continue;
      }
      const animated = applyIdle(st, entry.def, sample.tSec || 0, entry.seed);
      entry.mesh.visible = animated.opacity > 0.002;
      entry.mesh.position.set(...animated.position);
      entry.mesh.rotation.set(...animated.rotation);
      entry.mesh.scale.set(...animated.scale);
      const mat = entry.mesh.material;
      const baseOpacity = entry.def.materialOptions?.opacity ?? entry.def.mat?.opacity ?? 1;
      mat.opacity = animated.opacity * baseOpacity;
      mat.transparent = mat.opacity < 0.999 || mat.transmission > 0;
      entry.mesh.visible = entry.mesh.visible && mat.opacity > 0.002;
    }

    renderer.render(scene, camera);
    return renderer;
  }

  function dispose() {
    for (const { mesh } of objects.values()) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    envRT.dispose();
    pmrem.dispose();
    renderer.dispose();
  }

  return {
    renderer, scene, camera, render, setSize, dispose, objects,
    get size() { return { width: renderW, height: renderH, aspect }; },
  };
}
