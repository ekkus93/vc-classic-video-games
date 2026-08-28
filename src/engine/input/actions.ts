export const LOGICAL_ACTIONS = [
  "up",
  "down",
  "left",
  "right",
  "action-1",
  "action-2",
  "start",
  "pause",
  "back",
] as const;

export type LogicalAction = (typeof LOGICAL_ACTIONS)[number];
export type PlayerNumber = 1 | 2 | 3 | 4;

export function isLogicalAction(value: string): value is LogicalAction {
  return LOGICAL_ACTIONS.some((action) => action === value);
}

export function isPlayerNumber(value: number): value is PlayerNumber {
  return Number.isInteger(value) && value >= 1 && value <= 4;
}
