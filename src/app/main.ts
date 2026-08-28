export {};

const mount = document.querySelector<HTMLElement>("#app");

if (mount === null) {
  throw new Error("Application mount element #app is missing");
}

const status = document.createElement("section");
status.className = "shell-status";
status.setAttribute("aria-labelledby", "shell-title");

const heading = document.createElement("h1");
heading.id = "shell-title";
heading.textContent = "VC Classic Video Games";

const statusParagraph = document.createElement("p");
statusParagraph.textContent =
  "Tauri 2 application shell is running. The launcher UI is the next milestone.";

status.append(heading, statusParagraph);
mount.replaceChildren(status);
