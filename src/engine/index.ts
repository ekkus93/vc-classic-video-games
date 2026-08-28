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
export { XorShift32 } from "./random/xorshift32.js";
