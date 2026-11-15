/*
 * Fermed public entry point.
 *
 *   import { mountFermed } from './engine/index.js';
 *   import spec from './spec.json';
 *   mountFermed({ spec });
 */

export { mountFermed } from './player.js';
export { buildTimeline, applyIdle, cameraShake } from './timeline.js';
export { createStage } from './stage.js';
export { createOverlay } from './overlay.js';
export { STYLESETS, STYLESET_NAMES, resolveTheme } from './stylesets.js';
export { SHAPE_NAMES, MATERIAL_NAMES } from './geometry.js';
export { validateSpec } from './schema.js';
export { EASINGS, EASE_PRESETS, SCROLL_EASES } from './easings.js';
export { frameModel, safeArea, slotBox } from './frame.js';
export { ASPECT_PRESETS, ASPECT_NAMES, aspectSize, aspectHints } from './aspects.js';
export * from './util.js';
