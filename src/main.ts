import { Graphic } from "./graphic";

import "./main.css";

function startup() {
  const canvas = document.querySelector("canvas")!;
  const app = new Graphic(canvas);

  app.start();
}

window.addEventListener("load", startup);
