import type { ScoreService, ScoreSubmission } from "../game/services.js";
import type { JsonDocumentStore } from "../persistence/document-store.js";
import type { RecoveryReporter } from "../persistence/settings.js";

export interface ScoreEntry {
  readonly gameId: string;
  readonly mode: string;
  readonly difficulty: string;
  readonly score: number;
  readonly initials: string | null;
  readonly timestamp: string;
  readonly sequence: number;
}

export interface ScoreDocument {
  readonly version: 1;
  readonly nextSequence: number;
  readonly entries: readonly ScoreEntry[];
}

export class ScoreValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ScoreValidationError";
  }
}

function validGameId(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/u.test(value);
}

function nonEmpty(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ScoreValidationError(`${path} must be a non-empty string`);
  }
  return value.trim();
}

export function parseScoreEntry(value: unknown): ScoreEntry {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ScoreValidationError("score entry must be an object");
  }
  const raw = value as Record<string, unknown>;
  const gameId = nonEmpty(raw.gameId, "gameId");
  if (!validGameId(gameId)) {
    throw new ScoreValidationError("gameId is invalid");
  }
  if (typeof raw.score !== "number" || !Number.isSafeInteger(raw.score) || raw.score < 0) {
    throw new ScoreValidationError("score must be a non-negative safe integer");
  }
  if (typeof raw.sequence !== "number" || !Number.isSafeInteger(raw.sequence) || raw.sequence < 0) {
    throw new ScoreValidationError("sequence must be a non-negative safe integer");
  }
  const initials = raw.initials === null || raw.initials === undefined ? null : nonEmpty(raw.initials, "initials").toUpperCase();
  if (initials !== null && initials.length > 3) {
    throw new ScoreValidationError("initials must be at most 3 characters");
  }
  const timestamp = nonEmpty(raw.timestamp, "timestamp");
  if (Number.isNaN(Date.parse(timestamp))) {
    throw new ScoreValidationError("timestamp must be ISO-compatible");
  }
  return Object.freeze({
    gameId,
    mode: nonEmpty(raw.mode, "mode"),
    difficulty: nonEmpty(raw.difficulty, "difficulty"),
    score: raw.score,
    initials,
    timestamp,
    sequence: raw.sequence,
  });
}

export function createEmptyScoreDocument(): ScoreDocument {
  return Object.freeze({ version: 1, nextSequence: 0, entries: Object.freeze([]) });
}

export function parseScoreDocument(value: unknown): ScoreDocument {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ScoreValidationError("score document must be an object");
  }
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1 || !Array.isArray(raw.entries)) {
    throw new ScoreValidationError("score document version must be 1");
  }
  if (typeof raw.nextSequence !== "number" || !Number.isSafeInteger(raw.nextSequence) || raw.nextSequence < 0) {
    throw new ScoreValidationError("nextSequence must be a non-negative safe integer");
  }
  return Object.freeze({
    version: 1,
    nextSequence: raw.nextSequence,
    entries: Object.freeze(raw.entries.map(parseScoreEntry)),
  });
}

export function compareScores(a: ScoreEntry, b: ScoreEntry): number {
  return b.score - a.score || a.timestamp.localeCompare(b.timestamp) || a.sequence - b.sequence;
}

export class ScoreRepository {
  public constructor(
    private readonly documents: JsonDocumentStore,
    private readonly reportRecovery: RecoveryReporter = () => undefined,
  ) {}

  public async load(): Promise<ScoreDocument> {
    const raw = await this.documents.load("scores");
    if (raw === null) {
      return createEmptyScoreDocument();
    }
    try {
      return parseScoreDocument(JSON.parse(raw) as unknown);
    } catch (error) {
      this.reportRecovery({
        scope: "scores",
        message: `Stored scores were invalid and ignored: ${error instanceof Error ? error.message : String(error)}`,
      });
      return createEmptyScoreDocument();
    }
  }

  public async submitScore(gameId: string, difficulty: string, submission: ScoreSubmission): Promise<ScoreEntry> {
    const current = await this.load();
    const entry = parseScoreEntry({
      gameId,
      difficulty,
      mode: submission.mode,
      score: submission.score,
      initials: submission.initials ?? null,
      timestamp: submission.timestamp ?? new Date().toISOString(),
      sequence: current.nextSequence,
    });
    const next: ScoreDocument = {
      version: 1,
      nextSequence: current.nextSequence + 1,
      entries: [...current.entries, entry],
    };
    await this.documents.save("scores", JSON.stringify(next));
    return entry;
  }

  public async queryScores(gameId: string, mode: string, difficulty: string, limit = 10): Promise<readonly ScoreEntry[]> {
    if (!Number.isInteger(limit) || limit <= 0 || limit > 100) {
      throw new RangeError("score query limit must be an integer in [1, 100]");
    }
    const current = await this.load();
    return Object.freeze(
      current.entries
        .filter((entry) => entry.gameId === gameId && entry.mode === mode && entry.difficulty === difficulty)
        .sort(compareScores)
        .slice(0, limit),
    );
  }
}

export class PersistentScoreService implements ScoreService {
  public constructor(
    private readonly repository: ScoreRepository,
    private readonly gameId: string,
    private readonly difficulty: () => string,
  ) {}

  public async submit(submission: ScoreSubmission): Promise<void> {
    await this.repository.submitScore(this.gameId, this.difficulty(), submission);
  }
}
