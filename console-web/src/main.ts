import "./styles.css";
import { ConsoleApp } from "./console/ConsoleApp";
import { GameCatalog } from "./console/GameCatalog";
import { StandalonePage } from "./console/StandalonePage";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Falta el elemento #app en index.html");

// ?game=chase abre ese juego solo (la opción "Abrir en otra pestaña"); sin parámetro, la consola completa.
const requested = new URLSearchParams(location.search).get("game");
const entry = requested ? new GameCatalog().find(requested) : undefined;

if (entry?.create) new StandalonePage(root, entry).mount();
else new ConsoleApp(root).mount();
