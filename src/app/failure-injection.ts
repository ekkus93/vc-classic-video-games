export type FailureInjection = "injectStartupFailure" | "injectRenderFailure";

export function shouldInjectFailure(
  search: string,
  failure: FailureInjection,
  developmentMode: boolean,
): boolean {
  return developmentMode && new URLSearchParams(search).get(failure) === "1";
}
