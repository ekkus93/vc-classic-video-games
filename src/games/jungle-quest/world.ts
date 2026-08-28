import type { Aabb } from "../../engine/index.js";
import { JUNGLE_QUEST_RUN_RULES } from "./design.js";

export type JungleQuestRoomId = "fern-gate" | "echo-hollow" | "root-vault" | "sun-shrine";
export type JungleQuestPlatformKind = "surface" | "ledge" | "tunnel";
export interface JungleQuestPlatform { readonly id: string; readonly x1: number; readonly x2: number; readonly y: number; readonly kind: JungleQuestPlatformKind; }
export interface JungleQuestLadder { readonly id: string; readonly x: number; readonly yTop: number; readonly yBottom: number; }
export interface JungleQuestVine { readonly id: string; readonly anchorX: number; readonly anchorY: number; readonly length: number; }
export interface JungleQuestCollectible { readonly id: string; readonly x: number; readonly y: number; readonly label: string; }
export interface JungleQuestCheckpoint { readonly x: number; readonly y: number; }
export interface JungleQuestRoom {
  readonly id: JungleQuestRoomId; readonly title: string; readonly previous: JungleQuestRoomId | null; readonly next: JungleQuestRoomId | null;
  readonly platforms: readonly JungleQuestPlatform[]; readonly ladders: readonly JungleQuestLadder[]; readonly vines: readonly JungleQuestVine[];
  readonly hazards: readonly Aabb[]; readonly collectibles: readonly JungleQuestCollectible[]; readonly checkpoint: JungleQuestCheckpoint | null;
  readonly palette: Readonly<{ sky: string; canopy: string; earth: string; tunnel: string }>;
}
const SURFACE_Y = 190;
const TUNNEL_Y = 226;
function platform(id: string, x1: number, x2: number, y: number, kind: JungleQuestPlatformKind): JungleQuestPlatform { return Object.freeze({ id, x1, x2, y, kind }); }
const ROOMS: readonly JungleQuestRoom[] = Object.freeze([
  Object.freeze({
    id: "fern-gate", title: "Fern Gate", previous: null, next: "echo-hollow",
    platforms: Object.freeze([
      platform("fern-ground-left", 0, 258, SURFACE_Y, "surface"),
      platform("fern-ground-right", 296, 320, SURFACE_Y, "surface"),
      platform("fern-ledge", 58, 126, 144, "ledge"),
    ]),
    ladders: Object.freeze([Object.freeze({ id: "fern-ladder", x: 92, yTop: 144, yBottom: SURFACE_Y })]),
    vines: Object.freeze([]), hazards: Object.freeze([Object.freeze({ x: 214, y: 182, width: 24, height: 8 })]),
    collectibles: Object.freeze([Object.freeze({ id: "jade-seed", x: 92, y: 132, label: "Jade Seed" })]),
    checkpoint: Object.freeze({ x: 24, y: SURFACE_Y - JUNGLE_QUEST_RUN_RULES.playerHeight / 2 }),
    palette: Object.freeze({ sky: "#123b45", canopy: "#1d6a4d", earth: "#634b32", tunnel: "#2d2430" }),
  }),
  Object.freeze({
    id: "echo-hollow", title: "Echo Hollow", previous: "fern-gate", next: "root-vault",
    platforms: Object.freeze([platform("echo-left", 0, 116, SURFACE_Y, "surface"), platform("echo-right", 202, 320, SURFACE_Y, "surface"), platform("echo-tunnel", 0, 320, TUNNEL_Y, "tunnel")]),
    ladders: Object.freeze([Object.freeze({ id: "echo-descent", x: 42, yTop: SURFACE_Y, yBottom: TUNNEL_Y })]),
    vines: Object.freeze([Object.freeze({ id: "echo-vine", anchorX: 158, anchorY: 62, length: 118 })]), hazards: Object.freeze([]),
    collectibles: Object.freeze([Object.freeze({ id: "sun-disc", x: 252, y: 176, label: "Sun Disc" })]), checkpoint: null,
    palette: Object.freeze({ sky: "#17444b", canopy: "#267353", earth: "#6c5035", tunnel: "#302331" }),
  }),
  Object.freeze({
    id: "root-vault", title: "Root Vault", previous: "echo-hollow", next: "sun-shrine",
    platforms: Object.freeze([platform("root-ground", 0, 320, SURFACE_Y, "surface"), platform("root-tunnel", 0, 320, TUNNEL_Y, "tunnel")]),
    ladders: Object.freeze([Object.freeze({ id: "root-ascent", x: 268, yTop: SURFACE_Y, yBottom: TUNNEL_Y })]), vines: Object.freeze([]),
    hazards: Object.freeze([Object.freeze({ x: 204, y: 182, width: 28, height: 8 })]),
    collectibles: Object.freeze([Object.freeze({ id: "root-crystal", x: 152, y: 212, label: "Root Crystal" })]),
    checkpoint: Object.freeze({ x: 28, y: SURFACE_Y - JUNGLE_QUEST_RUN_RULES.playerHeight / 2 }),
    palette: Object.freeze({ sky: "#193a3c", canopy: "#315f45", earth: "#725437", tunnel: "#2b2232" }),
  }),
  Object.freeze({
    id: "sun-shrine", title: "Sun Shrine", previous: "root-vault", next: null,
    platforms: Object.freeze([platform("shrine-ground", 0, 320, SURFACE_Y, "surface"), platform("shrine-tunnel", 0, 112, TUNNEL_Y, "tunnel")]),
    ladders: Object.freeze([Object.freeze({ id: "shrine-ascent", x: 82, yTop: SURFACE_Y, yBottom: TUNNEL_Y })]), vines: Object.freeze([]),
    hazards: Object.freeze([Object.freeze({ x: 142, y: 182, width: 22, height: 8 })]),
    collectibles: Object.freeze([Object.freeze({ id: "sky-amber", x: 232, y: 176, label: "Sky Amber" })]), checkpoint: null,
    palette: Object.freeze({ sky: "#23494e", canopy: "#497248", earth: "#76583a", tunnel: "#33283a" }),
  }),
]);
const ROOM_MAP = new Map(ROOMS.map((room) => [room.id, room] as const));
export const JUNGLE_QUEST_ROOMS = ROOMS;
export const JUNGLE_QUEST_START_ROOM: JungleQuestRoomId = "fern-gate";
export const JUNGLE_QUEST_FINISH_ROOM: JungleQuestRoomId = "sun-shrine";
export const JUNGLE_QUEST_FINISH_X = 300;
export const JUNGLE_QUEST_TOTAL_COLLECTIBLES = ROOMS.reduce((count, room) => count + room.collectibles.length, 0);
export function jungleQuestRoom(id: JungleQuestRoomId): JungleQuestRoom { const room = ROOM_MAP.get(id); if (room === undefined) throw new Error(`Unknown Jungle Quest room: ${id}`); return room; }
export function jungleQuestCollectibleIds(): readonly string[] { return Object.freeze(ROOMS.flatMap((room) => room.collectibles.map((collectible) => collectible.id))); }
