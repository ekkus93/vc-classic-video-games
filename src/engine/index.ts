export type {
  GameInstance,
  GameModule,
  GameRenderer,
  GameStartOptions,
} from "./game/contracts.js";
export {
  defineGameMetadata,
  GameMetadataValidationError,
  INPUT_KINDS,
  parseGameMetadata,
} from "./game/metadata.js";
export type {
  ControlDescription,
  DifficultyDefinition,
  GameMetadata,
  InputKind,
} from "./game/metadata.js";
export {
  DuplicateGameIdError,
  GameRegistry,
  UnknownGameIdError,
} from "./game/registry.js";
export {
  GameLifecycle,
  InvalidLifecycleTransitionError,
} from "./game/lifecycle.js";
export type { GameLifecycleState } from "./game/lifecycle.js";
export {
  ActiveGameRuntime,
  InvalidRuntimeStateError,
  NoActiveGameError,
} from "./game/runtime.js";
export type {
  GameRuntimeErrorEvent,
  GameRuntimeErrorHandler,
  GameRuntimePhase,
} from "./game/runtime.js";
export type {
  AssetService,
  AudioService,
  GameClock,
  GameLogger,
  GameServices,
  GameStorageService,
  InputService,
  RandomService,
  ScoreService,
  ScoreSubmission,
} from "./game/services.js";
export {
  add,
  dot,
  length,
  lengthSquared,
  normalize,
  scale,
  subtract,
  wrapCoordinate,
} from "./math/vector2.js";
export type { Vector2 } from "./math/vector2.js";
export {
  intersectsAabb,
  intersectsCircle,
  segmentsIntersect,
} from "./math/collision.js";
export type { Aabb, Circle } from "./math/collision.js";
export { XorShift32 } from "./random/xorshift32.js";
export {
  CanvasGameRenderer,
} from "./render/renderer.js";
export type {
  HorizontalTextAlign,
  SpriteSourceRect,
  TextStyle,
  VerticalTextAlign,
} from "./render/renderer.js";
export {
  LogicalFramebuffer,
  presentFramebuffer,
} from "./render/logical-framebuffer.js";
export type { CanvasSurface } from "./render/logical-framebuffer.js";
export {
  calculateViewport,
  physicalToLogical,
} from "./render/viewport.js";
export type {
  LogicalPoint,
  Size2D,
  Viewport,
} from "./render/viewport.js";
export { SpriteAnimation } from "./render/sprite-animation.js";
export type { SpriteAnimationOptions } from "./render/sprite-animation.js";
export {
  BrowserFrameScheduler,
  FrameLoop,
} from "./runtime/frame-loop.js";
export type {
  FrameCallback,
  FrameScheduler,
} from "./runtime/frame-loop.js";
export { FixedStepClock } from "./runtime/fixed-step.js";
export type {
  FixedStepAdvanceResult,
  FixedStepOptions,
} from "./runtime/fixed-step.js";
export { GameLoopDriver } from "./runtime/game-loop-driver.js";
export type {
  GameLoopCallbacks,
  GameLoopDriverOptions,
} from "./runtime/game-loop-driver.js";
