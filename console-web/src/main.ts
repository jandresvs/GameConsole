import "./styles.css";
import { ConsoleApp } from "./console/ConsoleApp";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Falta el elemento #app en index.html");

new ConsoleApp(root).mount();
