export interface TestCase {
  readonly name: string;
  readonly run: () => void | Promise<void>;
}

export function assertDeepEqual<T>(
  actual: readonly T[],
  expected: readonly T[],
  message: string,
): void {
  if (
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}
