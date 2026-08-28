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
  LOGICAL_ACTIONS,
  isLogicalAction,
  isPlayerNumber,
} from "./input/actions.js";
export type { LogicalAction, PlayerNumber } from "./input/actions.js";
export { BrowserInputController } from "./input/browser.js";
export type { BrowserInputControllerOptions } from "./input/browser.js";
export {
  BrowserGamepadSource,
  GamepadAssignmentManager,
  StandardGamepadInputProvider,
  normalizeGamepadAxis,
  standardGamepadActions,
} from "./input/gamepad.js";
export type {
  GamepadAssignment,
  GamepadButtonLike,
  GamepadLike,
  GamepadSource,
  NormalizedGamepadAxes,
} from "./input/gamepad.js";
export { InputManager } from "./input/input-manager.js";
export type { InputSettingsProvider } from "./input/input-manager.js";
export {
  BrowserKeyboardAdapter,
  KeyboardInputProvider,
} from "./input/keyboard.js";
export type { KeyboardCapturePredicate } from "./input/keyboard.js";
export {
  cloneKeyboardMappings,
  createDefaultKeyboardMappings,
  findKeyboardMappingConflicts,
  freezeKeyboardMappings,
  keyboardCodesForAction,
} from "./input/mappings.js";
export type {
  InputMappingConflict,
  KeyboardBindingMap,
  KeyboardMappings,
} from "./input/mappings.js";
export {
  BrowserPointerAdapter,
  PointerInputProvider,
  StaticPointerInputService,
} from "./input/pointer.js";
export type { PointerInputService, PointerSnapshot } from "./input/pointer.js";
export {
  InputMappingConflictError,
  InputSettingsController,
  InputSettingsValidationError,
  MemoryInputSettingsStore,
  createDefaultInputSettings,
  parseInputSettings,
} from "./input/settings.js";
export type {
  InputSettings,
  InputSettingsListener,
  InputSettingsStore,
} from "./input/settings.js";
export { ShellInputRouter, moveMenuSelection } from "./input/shell-navigation.js";
export type {
  ShellInputContext,
  ShellNavigationCommand,
} from "./input/shell-navigation.js";
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
export { CanvasGameRenderer } from "./render/renderer.js";
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
export { calculateViewport, physicalToLogical } from "./render/viewport.js";
export type { LogicalPoint, Size2D, Viewport } from "./render/viewport.js";
export { SpriteAnimation } from "./render/sprite-animation.js";
export type { SpriteAnimationOptions } from "./render/sprite-animation.js";
export { BrowserFrameScheduler, FrameLoop } from "./runtime/frame-loop.js";
export type { FrameCallback, FrameScheduler } from "./runtime/frame-loop.js";
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
export { SharedWebAudioService } from "./audio/audio-service.js";
export type {
  AudioBufferResolver,
  AudioBus,
  AudioContextFactory,
  SharedAudioSettings,
} from "./audio/audio-service.js";
export {
  AssetCache,
  RequiredAssetLoadError,
  browserAssetFetcher,
} from "./assets/asset-service.js";
export type {
  AssetFetchResponse,
  AssetFetcher,
  AssetValue,
} from "./assets/asset-service.js";
export {
  ASSET_TYPES,
  AssetManifestValidationError,
  parseAssetManifest,
} from "./assets/manifest.js";
export type {
  AssetManifest,
  AssetManifestEntry,
  AssetType,
  SpriteMetadata,
} from "./assets/manifest.js";
export {
  MemoryJsonDocumentStore,
  TauriJsonDocumentStore,
} from "./persistence/document-store.js";
export type {
  JsonDocumentStore,
  PersistenceDocument,
  TauriInvoke,
} from "./persistence/document-store.js";
export { NamespacedGameStorageService } from "./persistence/game-storage.js";
export {
  GlobalSettingsRepository,
  GlobalSettingsValidationError,
  PersistentInputSettingsStore,
  createDefaultGlobalSettings,
  parseGlobalSettings,
} from "./persistence/settings.js";
export type {
  AudioSettings,
  GlobalSettings,
  RecoveryReporter,
  RecoveryWarning,
  VisualSettings,
} from "./persistence/settings.js";
export {
  PersistentScoreService,
  ScoreRepository,
  ScoreValidationError,
  compareScores,
  createEmptyScoreDocument,
  parseScoreDocument,
  parseScoreEntry,
} from "./scores/scores.js";
export type {
  ScoreDocument,
  ScoreEntry,
} from "./scores/scores.js";
