/*
 * Fermed spec schema.
 *
 * The spec is the contract between the Director agent (who writes it) and the
 * renderer (which obeys it). Workers never touch JavaScript. Everything a
 * worker can express must be expressible here — and anything the renderer
 * cannot draw must be rejected here, loudly, before a render wastes minutes.
 */

import { z } from 'zod';

import { SHAPE_NAMES, MATERIAL_NAMES } from './geometry.js';
import { STYLESET_NAMES } from './stylesets.js';
import { EASE_SET } from './easings.js';

const vec3 = z.array(z.number()).length(3);
const frac = z.number().min(0).max(1);
const window2 = z.array(frac).length(2);
const easeStr = z.string().refine((v) => EASE_SET.has(v), {
  message: 'unknown ease — see engine/easings.js for the allowed list',
});

const motionSchema = z.object({
  spin: z.union([z.number(), vec3]).optional(),
  float: z.union([z.number(), z.object({ amp: z.number().optional(), speed: z.number().optional() })]).optional(),
  drift: z.union([z.number(), z.object({ amp: z.number().optional(), speed: z.number().optional() })]).optional(),
  orbit: z.object({ radius: z.number(), speed: z.number().optional() }).optional(),
  pulse: z.union([z.number(), z.object({ amp: z.number().optional(), speed: z.number().optional() })]).optional(),
  opacityFlicker: z.number().min(0).max(0.5).optional(),
}).strict();

const transformPart = z.object({
  position: vec3.optional(),
  rotation: vec3.optional(),
  scale: z.union([z.number().positive(), vec3]).optional(),
}).strict();

const elementSchema = z.object({
  id: z.string().min(1).optional(),
  label: z.string().optional(),               // for the storyboard only
  shape: z.enum(SHAPE_NAMES).default('box'),
  geometry: z.record(z.number()).optional(),
  material: z.enum(MATERIAL_NAMES).default('solid'),
  materialOptions: z.object({
    color: z.string().optional(),
    emissive: z.string().optional(),
    emissiveIntensity: z.number().optional(),
    metalness: z.number().min(0).max(1).optional(),
    roughness: z.number().min(0).max(1).optional(),
    opacity: z.number().min(0).max(1).optional(),
    transmission: z.number().min(0).max(1).optional(),
    flatShading: z.boolean().optional(),
  }).strict().optional(),
  position: vec3.optional(),                   // shorthand start
  rotation: vec3.optional(),
  scale: z.union([z.number(), vec3]).optional(),
  transform: z.object({
    from: transformPart.optional(),
    to: transformPart.optional(),
  }).strict().optional(),
  to: transformPart.optional(),                // shorthand target
  motion: motionSchema.optional(),
  enter: window2.optional(),
  exit: window2.optional(),
  opacity: z.number().min(0).max(1).optional(),
  opacityIn: z.number().min(0).max(1).optional(),
  opacityOut: z.number().min(0).max(1).optional(),
  ease: easeStr.optional(),
  opacityEase: easeStr.optional(),
  hold: z.boolean().optional(),
  seed: z.number().optional(),
  renderOrder: z.number().optional(),
}).strict();

const copySchema = z.object({
  id: z.string().optional(),
  kind: z.enum(['display', 'lead', 'metric', 'eyebrow']).default('display'),
  eyebrow: z.string().max(64).optional(),
  text: z.string().min(1).max(400),
  suffix: z.string().max(12).optional(),
  caption: z.string().max(200).optional(),
  rule: z.boolean().optional(),
  slot: z.enum([
    'top-left', 'top-center', 'top-right',
    'center-left', 'center', 'center-right',
    'bottom-left', 'bottom-center', 'bottom-right',
  ]).default('center-left'),
  enter: window2.optional(),
  exit: window2.optional(),
  stagger: z.number().min(0).max(0.5).optional(),
  ease: easeStr.optional(),
  hold: z.boolean().optional(),
}).strict();

const cameraSchema = z.object({
  from: z.object({ position: vec3.optional(), lookAt: vec3.optional(), fov: z.number().min(10).max(110).optional() }).strict().optional(),
  to: z.object({ position: vec3.optional(), lookAt: vec3.optional(), fov: z.number().min(10).max(110).optional() }).strict().optional(),
  position: vec3.optional(),
  lookAt: vec3.optional(),
  fov: z.number().min(10).max(110).optional(),
  ease: easeStr.optional(),
  shake: z.number().min(0).max(3).optional(),
}).strict();

const sceneSchema = z.object({
  id: z.string().min(1).optional(),
  label: z.string().max(80).optional(),
  duration: z.number().min(1).max(20).default(4),
  transition: z.enum(['cut', 'fade', 'dip']).default('fade'),
  veilColour: z.string().optional(),
  camera: cameraSchema.optional(),
  elements: z.array(elementSchema).max(24).default([]),
  copy: z.array(copySchema).max(6).default([]),
});

export const specSchema = z.object({
  $schema: z.string().optional(),
  meta: z.object({
    title: z.string().min(1),
    subtitle: z.string().optional(),
    client: z.string().optional(),
    author: z.string().optional(),
    slug: z.string().optional(),
    brief: z.string().max(2000).optional(),
  }).strict(),

  styleset: z.union([
    z.enum(STYLESET_NAMES),
    z.object({ name: z.enum(STYLESET_NAMES) }).passthrough(),
    z.object({ name: z.string() }).passthrough(), // inline custom styleset
  ]),

  theme: z.object({
    palette: z.record(z.string()).optional(),
    fonts: z.record(z.union([z.string(), z.number()])).optional(),
    motion: z.object({
      speed: z.number().min(0.4).max(2).optional(),
      cameraEase: easeStr.optional(),
      copyEase: easeStr.optional(),
      intensity: z.number().min(0).max(1.5).optional(),
    }).strict().optional(),
    geometry: z.object({
      metalness: z.number().min(0).max(1).optional(),
      roughness: z.number().min(0).max(1).optional(),
      flatShading: z.boolean().optional(),
      wireframe: z.boolean().optional(),
    }).strict().optional(),
    framing: z.object({
      letterbox: z.number().min(0).max(0.25).optional(),
      vignette: z.number().min(0).max(1).optional(),
      grain: z.number().min(0).max(0.4).optional(),
      copyAlign: z.enum(['left', 'center']).optional(),
    }).strict().optional(),
  }).strict().optional(),

  render: z.object({
    width: z.number().int().min(320).max(3840).optional(),
    height: z.number().int().min(240).max(2160).optional(),
    fps: z.number().int().min(12).max(60).optional(),
    pixelRatioCap: z.number().min(1).max(3).optional(),
    exposure: z.number().min(0.2).max(3).optional(),
    fog: z.number().min(0).max(0.4).optional(),
    ambient: z.number().optional(),
    envIntensity: z.number().min(0).max(2).optional(),
  }).strict().optional(),

  scroll: z.object({
    pxPerSecond: z.number().min(40).max(1200).optional(),
    lerpDuration: z.number().min(0.2).max(3).optional(),
    smooth: z.boolean().optional(),
    wheelMultiplier: z.number().min(0.2).max(4).optional(),
    touchMultiplier: z.number().min(0.2).max(4).optional(),
  }).strict().optional(),

  music: z.object({
    src: z.string().optional(),
    volume: z.number().min(0).max(1).optional(),
    fadeIn: z.number().min(0).max(5).optional(),
    fadeOut: z.number().min(0).max(5).optional(),
  }).strict().optional(),

  scenes: z.array(sceneSchema).min(1).max(14),

  export: z.object({
    scrollEase: z.enum(['linear', 'inOutCubic', 'inOutQuint', 'easeOutCubic', 'easeInOutSine']).optional(),
    introHold: z.number().min(0).max(3).optional(),
    outroHold: z.number().min(0).max(3).optional(),
    format: z.enum(['mp4', 'webm']).optional(),
    crf: z.number().min(0).max(51).optional(),
    preset: z.string().optional(),
  }).strict().optional(),
}).strict();

/** Validate and return { ok, errors[], spec }. Always non-throwing. */
export function validateSpec(raw) {
  const parsed = specSchema.safeParse(raw);
  if (parsed.success) {
    return { ok: true, errors: [], spec: applyDefaults(parsed.data) };
  }
  const errors = parsed.error.issues.map((i) => ({
    path: i.path.join('.') || '(root)',
    message: i.message,
    code: i.code,
  }));
  return { ok: false, errors, spec: null };
}

/** Fill the render/scroll defaults so workers can omit them. */
export function applyDefaults(spec) {
  const s = structuredClone(spec);
  s.render = { width: 1920, height: 1080, fps: 30, pixelRatioCap: 2, exposure: 1, fog: 0.035, ambient: 0.35, envIntensity: 1.15, ...(s.render || {}) };
  s.scroll = { pxPerSecond: 180, lerpDuration: 1.1, smooth: true, wheelMultiplier: 1, touchMultiplier: 1.6, ...(s.scroll || {}) };
  s.export = { scrollEase: 'inOutCubic', introHold: 0.25, outroHold: 0.6, format: 'mp4', crf: 18, preset: 'slow', ...(s.export || {}) };
  s.meta.slug = s.meta.slug || s.meta.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return s;
}

/** Human-readable storyboard, used by `fermed inspect` and the worker docs. */
export function storyboard(spec) {
  const total = (spec.scenes || []).reduce((n, s) => n + (s.duration || 4), 0);
  let acc = 0;
  return (spec.scenes || []).map((s, i) => {
    const start = acc;
    acc += s.duration || 4;
    return {
      '#': i + 1,
      id: s.id || `scene-${i}`,
      label: s.label || '',
      duration: s.duration || 4,
      timecode: `${start.toFixed(2)}s – ${acc.toFixed(2)}s`,
      elements: (s.elements || []).length,
      copy: (s.copy || []).map((c) => `${c.kind}${c.eyebrow ? ` [${c.eyebrow}]` : ''}: "${String(c.text).slice(0, 60)}"`),
      hasCamera: !!s.camera,
      transition: s.transition || 'fade',
      fraction: `${(( (start) / total) * 100).toFixed(1)}% → ${((acc / total) * 100).toFixed(1)}%`,
    };
  });
}
