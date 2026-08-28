export {};

const mount = document.querySelector<HTMLElement>("#app");

if (mount === null) {
  throw new Error("Application mount element #app is missing");
}

const heading = document.createElement("h1");
heading.textContent = "VC Classic Video Games";

const statusParagraph = document.createElement("p");
statusParagraph.textContent =
  "Engineering foundation is ready. The Tauri 2 launcher shell is the next phase.";

mount.replaceChildren(heading, statusParagraph);
