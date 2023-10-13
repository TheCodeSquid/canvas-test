import { Graphic } from "./graphic";

import "./main.css";

class App {
  private graphic: Graphic

  private nav = document.querySelector("nav")!;
  private main = document.querySelector("main")!;

  constructor() {
    const canvas = document.querySelector("canvas")!;
    this.graphic = new Graphic(canvas);

    this.scrollCheck();
    window.addEventListener("scroll", this.scrollCheck.bind(this));

    this.graphic.start();
  }

  scrollCheck() {
    const targetScroll = window.innerHeight * 0.1;
    if (window.scrollY < targetScroll) {
      this.nav.classList.remove("shown");
      this.main.classList.remove("shown");
    } else {
      this.nav.classList.add("shown");
      this.main.classList.add("shown");
    }
  }
}

window.addEventListener("load", () => new App());
