import { GameSurface } from "./game-surface/GameSurface.js";

export function App() {
  return (
    <main className="app-shell">
      <section className="launcher" aria-labelledby="launcher-title">
        <header className="launcher__header">
          <h1 id="launcher-title">VC Classic Video Games</h1>
          <p>
            One controller-first arcade shell. Game modules will plug into the
            shared runtime without owning application UI state.
          </p>
        </header>

        <div className="launcher__preview">
          <GameSurface />
          <section className="launcher__status" aria-labelledby="preview-title">
            <h2 id="preview-title">Runtime preview</h2>
            <p>
              The animated Canvas is driven by the engine frame loop, not by
              React renders. React owns launcher composition and lifecycle only.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
