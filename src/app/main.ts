import { StrictMode, createElement } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.js";
import "./styles.css";

const mount = document.querySelector<HTMLElement>("#app");

if (mount === null) {
  throw new Error("Application mount element #app is missing");
}

createRoot(mount).render(createElement(StrictMode, null, createElement(App)));
