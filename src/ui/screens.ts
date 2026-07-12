import { PLAYER_CLASSES } from "../sim/classes";
import { FOLLOWERS_TO_WIN } from "../core/constants";

const screen = (): HTMLElement => document.getElementById("screen")!;

export function clearScreen(): void {
  screen().innerHTML = "";
}

export function showTitle(onStart: (classId: string, honorMode: boolean) => void): void {
  let selected = "samurai";
  const root = screen();
  root.innerHTML = `
    <div class="panel">
      <h1>SHOGUN</h1>
      <div class="sub">Rise from nothing. Gather ${FOLLOWERS_TO_WIN} followers. Claim the Shogunate.<br>
      A 3D isometric remake of the 1986 Gang&nbsp;of&nbsp;Five classic.</div>
      <h2>Choose your station in life</h2>
      <div class="class-grid" id="class-grid"></div>
      <label class="honor"><input type="checkbox" id="honor-toggle">
        Way of Honour — death is permanent, as in 1986</label>
      <br>
      <button class="btn" id="start-btn">BEGIN YOUR RISE</button>
    </div>`;
  const grid = document.getElementById("class-grid")!;
  for (const c of PLAYER_CLASSES) {
    const card = document.createElement("div");
    card.className = "class-card" + (c.id === selected ? " selected" : "");
    card.innerHTML = `
      <div class="cname">${c.label}</div>
      <div class="cmult">score ×${c.scoreMultiplier}</div>
      <div class="cblurb">${c.blurb}</div>
      <div class="cstats">Persuasion ${c.persuasion} · Gold ${c.gold}<br>Attack ${c.attack} · HP ${c.hp}</div>`;
    card.onclick = () => {
      selected = c.id;
      grid.querySelectorAll(".class-card").forEach((el) => el.classList.remove("selected"));
      card.classList.add("selected");
    };
    grid.appendChild(card);
  }
  document.getElementById("start-btn")!.onclick = () => {
    const honor = (document.getElementById("honor-toggle") as HTMLInputElement).checked;
    clearScreen();
    onStart(selected, honor);
  };
}

export interface EndStats {
  won: boolean;
  score: number;
  followers: number;
  gold: number;
  sacred: number;
  minutes: number;
  classLabel: string;
  multiplier: number;
  reason?: string;
}

export function showEnd(stats: EndStats, onRestart: () => void): void {
  const root = screen();
  const title = stats.won ? "SHOGUN!" : "DEFEAT";
  const sub = stats.won
    ? `The Emperor bows his head. All of Japan is yours, ${stats.classLabel}.`
    : (stats.reason ?? "Your ambition ends here.");
  root.innerHTML = `
    <div class="panel">
      <h1 style="${stats.won ? "" : "color:#d64545;text-shadow:0 0 30px rgba(214,69,69,0.35)"}">${title}</h1>
      <div class="sub">${sub}</div>
      ${
        stats.won
          ? `<div class="score-line"><span>Followers</span><span>${stats.followers}</span></div>
             <div class="score-line"><span>Treasury</span><span>${stats.gold} koban</span></div>
             <div class="score-line"><span>Imperial treasures</span><span>${stats.sacred} / 4</span></div>
             <div class="score-line"><span>Time</span><span>${stats.minutes} min</span></div>
             <div class="score-line"><span>Class multiplier (${stats.classLabel})</span><span>×${stats.multiplier}</span></div>
             <div class="score-total">SCORE: ${stats.score.toLocaleString()}</div>`
          : ""
      }
      <br><button class="btn" id="restart-btn">PLAY AGAIN</button>
    </div>`;
  document.getElementById("restart-btn")!.onclick = () => {
    clearScreen();
    onRestart();
  };
}

export function showPause(onResume: () => void, onQuit: () => void): void {
  const root = screen();
  root.innerHTML = `
    <div class="panel">
      <h2>— PAUSED —</h2>
      <div class="chooser">
        <button id="p-resume">Resume</button>
        <button id="p-quit">Abandon campaign (return to title)</button>
      </div>
    </div>`;
  document.getElementById("p-resume")!.onclick = () => {
    clearScreen();
    onResume();
  };
  document.getElementById("p-quit")!.onclick = () => {
    clearScreen();
    onQuit();
  };
}

export interface ChooserOption {
  label: string;
  value: string;
}

export function showChooser(
  title: string,
  options: ChooserOption[],
  onPick: (value: string | null) => void,
): void {
  const root = screen();
  root.innerHTML = `
    <div class="panel">
      <h2>${title}</h2>
      <div class="chooser" id="chooser-list"></div>
      <button class="btn ghost" id="chooser-cancel">Cancel</button>
    </div>`;
  const list = document.getElementById("chooser-list")!;
  for (const opt of options) {
    const b = document.createElement("button");
    b.textContent = opt.label;
    b.onclick = () => {
      clearScreen();
      onPick(opt.value);
    };
    list.appendChild(b);
  }
  document.getElementById("chooser-cancel")!.onclick = () => {
    clearScreen();
    onPick(null);
  };
}
