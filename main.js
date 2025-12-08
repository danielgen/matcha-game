const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");
const startOverlay = document.getElementById("start-overlay");
const endOverlay = document.getElementById("end-overlay");
const timerEl = document.getElementById("timer");
const caughtEl = document.getElementById("caught-count");
const summaryEl = document.getElementById("summary");
const modePill = document.getElementById("mode-pill");
const modeRadios = document.querySelectorAll('input[name="mode"]');
const durationRadios = document.querySelectorAll('input[name="duration"]');
const backPlayBtn = document.getElementById("back-play-btn");
const soundBtn = document.getElementById("sound-btn");

const MODES = {
  CLOUD: "cloud",
  STORY: "story"
};

const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;
const DEFAULT_ROUND_SECONDS = 30;
const GROUND_Y = GAME_HEIGHT - 100;
const GRAVITY = 1600;

const background = new Image();
background.src = "background.png";

const bgMusic = new Audio("sounds/piano-background.mp3");
bgMusic.loop = true;
bgMusic.volume = 0.45;
const meowSounds = [new Audio("sounds/meow1.mp3"), new Audio("sounds/meow2.mp3")];

const spritePaths = {
  stand: "sprites/stand.png",
  sit: "sprites/sitting.png",
  sleep: "sprites/sleep.png",
  walkR1: "sprites/walk-right-1.png",
  walkR2: "sprites/walk-right-2.png",
  walkL1: "sprites/walk-left-1.png",
  walkL2: "sprites/walk-left-2.png",
  jumpUp: "sprites/jump-up.png",
  jumpLeft: "sprites/jump-up.png",
  grab: "sprites/jump-up.png",
  grabSimple: "sprites/jump-up.png"
};

const sprites = Object.fromEntries(
  Object.entries(spritePaths).map(([key, src]) => {
    const img = new Image();
    img.src = src;
    return [key, img];
  })
);

const warmGrounding = [
  "matcha","window","stairs","tea",
  "couch","nap","morning","coffee","caramelised",
  "blanket","candle","notebook","balcony","plants",
  "soft","quiet","warm","sleep","zakopane","Josh Groban",
  "books","mismatched mug","old hoodie","slow morning",

  // soft negatives
  "tired","fog","30k words","restless brain","grey morning",
  "winter", "5 floors"
];

const tinyHopes = [
  "sun","vacation","luck","dreamjob","weekend",
  "sea","sky","future", "chance","journey","step","soon",
  "passport","train","clear day","tiny win",
  "message","courage","soft start","another try",

  // tiny shadows
  "delay","waiting","application","missed train","maybe"
];

const playfulSilliness = [
  "woohoo","trophy", "silly","tiny win","chaos","paws",
  "wiggle","snack","daje", "spark","cat stretch",
  "fake productivity","tiny dance","crumbs",

  // playful “negatives”
  "tiny loss","oopsie","late again"
];

const randomWords = [
  "carbonara","ciao","matcha","Kasia","Ayla",
  "stairs","focusmate","i win",
  "lalaland","rembrandt","roadtrip","Italy",
  "polish","Italian",
  "window view","horse","sun cure","europe"
];

const secretWord = ["pierogi"]; // 1% chance

const storyPools = {
  time: [
    "today",
    "this morning",
    "tonight",
    "this afternoon",
    "right now",
    "lately",
    "these days",
    "this quiet hour",
    "after all this time",
    "on this small Tuesday",
    "in the soft blue light",
    "somewhere between coffee and sleep"
  ],
  mood: [
    "it feels foggy",
    "the sky is heavy",
    "the room is soft",
    "the stairs feel tall",
    "the window is kind",
    "the air feels slow",
    "the city is humming far away",
    "my thoughts feel cotton-soft",
    "the light is gentle and tired",
    "nothing is urgent, but everything hums",
    "the world feels slightly out of focus",
    "the silence is loud but not unkind"
  ],
  self: [
    "tired but curious",
    "not sure what I want",
    "still here",
    "softer than I thought",
    "humming quietly",
    "a little frayed at the edges",
    "braver than I remembered",
    "full of half-finished thoughts"
  ],
  desire: [
    "a little sun",
    "to leave the stairs behind",
    "to feel enough",
    "to hear from you",
    "a small yes",
    "one honest rest",
    "a day without rushing",
    "to feel proud of myself"
  ],
  movement: [
    "take one more step",
    "stay and breathe",
    "wait and see",
    "make some tea",
    "watch the window",
    "write three soft words",
    "stretch and stand anyway",
    "let tonight be enough for now"
  ]
};

const storyCategories = Object.keys(storyPools);

const wordFonts = [
  "'Inter', system-ui, sans-serif",
  "'Nunito', sans-serif",
  "'Kalam', cursive",
  "'Fira Sans', sans-serif"
];

const wordColors = ["#1c9b5f", "#2a8fbd", "#3cb371", "#1c6f8f", "#229977", "#c05a2c", "#b16ac2"];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function chooseWord() {
  const r = Math.random();
  if (r < 0.60) return pick(warmGrounding);
  if (r < 0.85) return pick(tinyHopes);
  if (r < 0.95) return pick(playfulSilliness);
  if (r < 0.99) return pick(randomWords);
  return pick(secretWord);
}

function chooseStoryFragment() {
  const category = pick(storyCategories);
  return {category, text: pick(storyPools[category])};
}

const cat = {
  x: GAME_WIDTH * 0.5,
  y: GROUND_Y,
  vx: 0,
  vy: 0,
  facing: 1,
  animFrame: 0,
  animTimer: 0,
  state: "idle",
  pounceTimer: 0,
  onGround: true
};

let words = [];
let lastSpawn = 0;
let spawnInterval = 850;
let caughtCounts = new Map();
let caughtByCategory = new Map();
let phase = "idle";
let mode = MODES.STORY;
let lastTick = 0;
let roundDuration = DEFAULT_ROUND_SECONDS;
let timeLeft = roundDuration;
let summaryRendered = false;
let lastInputAt = performance.now();
let selectedWords = new Set();
let selectedStoryChoices = new Map();
let backVisible = false;
let soundEnabled = true;
let meowTimer = null;

const keys = {left: false, right: false};

function setTimerText(secondsVal) {
  const minutes = Math.floor(secondsVal / 60);
  const seconds = Math.floor(secondsVal % 60);
  timerEl.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function setModeLabel() {
  if (modePill) {
    modePill.textContent = mode === MODES.STORY ? "Story" : "Cloud";
  }
}

function setBackPlayVisible(show) {
  backVisible = show;
  if (backPlayBtn) {
    backPlayBtn.style.display = show ? "block" : "none";
  }
}

function clearMeowTimer() {
  if (meowTimer) {
    clearTimeout(meowTimer);
    meowTimer = null;
  }
}

function scheduleMeow() {
  clearMeowTimer();
  if (!soundEnabled || phase !== "play") return;
  const delay = 5000 + Math.random() * 10000;
  meowTimer = setTimeout(() => {
    if (soundEnabled && phase === "play") {
      const s = pick(meowSounds);
      s.currentTime = 0;
      s.play().catch(() => {});
    }
    scheduleMeow();
  }, delay);
}

function applySoundState() {
  if (soundEnabled) {
    bgMusic.play().catch(() => {});
    scheduleMeow();
  } else {
    bgMusic.pause();
    meowSounds.forEach(s => {
      s.pause();
      s.currentTime = 0;
    });
    clearMeowTimer();
  }
  if (soundBtn) {
    soundBtn.textContent = `Sound: ${soundEnabled ? "On" : "Off"}`;
  }
}

function resetToStartScreen() {
  words = [];
  lastSpawn = 0;
  caughtCounts = new Map();
  caughtByCategory = new Map();
  timeLeft = roundDuration;
  phase = "idle";
  summaryRendered = false;
  selectedWords = new Set();
  selectedStoryChoices = new Map();
  summaryEl.innerHTML = "";
  caughtEl.textContent = "0";
  setTimerText(timeLeft);
  applySoundState();
  cat.x = GAME_WIDTH * 0.5;
  cat.y = GROUND_Y;
  cat.vx = 0;
  cat.vy = 0;
  cat.onGround = true;
  cat.state = "idle";
  cat.animFrame = 0;
  cat.animTimer = 0;
  cat.pounceTimer = 0;
  startOverlay.classList.add("visible");
  endOverlay.classList.remove("visible");
  setBackPlayVisible(false);
  setModeLabel();
}

function resetRound() {
  words = [];
  lastSpawn = 0;
  caughtCounts = new Map();
  caughtByCategory = new Map();
  timeLeft = roundDuration;
  phase = "play";
  summaryRendered = false;
  selectedWords = new Set();
  selectedStoryChoices = new Map();
  lastInputAt = performance.now();
  summaryEl.innerHTML = "";
  applySoundState();
  setBackPlayVisible(true);
  setModeLabel();
  cat.x = GAME_WIDTH * 0.5;
  cat.y = GROUND_Y;
  cat.vx = 0;
  cat.vy = 0;
  cat.onGround = true;
  cat.state = "idle";
  cat.animFrame = 0;
  cat.animTimer = 0;
  cat.pounceTimer = 0;
  startOverlay.classList.remove("visible");
  endOverlay.classList.remove("visible");
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function spawnWord() {
  const payload = mode === MODES.STORY ? chooseStoryFragment() : {text: chooseWord(), category: null};
  const text = payload.text;
  const category = payload.category;
  const size = 22 + Math.random() * 22;
  const weight = Math.random() > 0.5 ? "700" : "600";
  const fontFamily = pick(wordFonts);
  const color = pick(wordColors);
  const w = {
    text,
    category,
    x: 120 + Math.random() * (GAME_WIDTH - 240),
    y: -20,
    vx: (Math.random() - 0.5) * 40,
    vy: 40 + Math.random() * 40,
    caught: false,
    age: 0,
    style: {
      font: `${weight} ${size.toFixed(0)}px ${fontFamily}`,
      color
    }
  };
  words.push(w);
}

function update(dt) {
  if (phase !== "play") return;
  timeLeft = Math.max(0, timeLeft - dt);
  if (timeLeft <= 0) {
    endRound();
    return;
  }

  if (keys.left) cat.vx = -260;
  else if (keys.right) cat.vx = 260;
  else cat.vx = 0;

  cat.x += cat.vx * dt;
  cat.x = clamp(cat.x, 120, GAME_WIDTH - 120);
  cat.facing = cat.vx < 0 ? -1 : cat.vx > 0 ? 1 : cat.facing;

  // jump / gravity
  cat.vy += GRAVITY * dt;
  cat.y += cat.vy * dt;
  if (cat.y >= GROUND_Y) {
    cat.y = GROUND_Y;
    cat.vy = 0;
    cat.onGround = true;
  } else {
    cat.onGround = false;
  }

  const inactive = performance.now() - lastInputAt > 3000;

  if (cat.pounceTimer > 0) {
    cat.pounceTimer -= dt;
    cat.state = "pounce";
  } else if (!cat.onGround) {
    cat.state = "jump";
  } else if (inactive && cat.vx === 0) {
    cat.state = "sleep";
  } else {
    cat.state = cat.vx === 0 ? "idle" : "walk";
  }

  lastSpawn += dt * 1000;
  if (lastSpawn >= spawnInterval) {
    spawnWord();
    lastSpawn = 0;
    spawnInterval = 700 + Math.random() * 650;
  }

  const catchZone = {x: cat.x, y: cat.y - 40, r: 90};
  words = words.filter(w => {
    w.age += dt;
    w.x += w.vx * dt;
    w.y += w.vy * dt;
    if (cat.pounceTimer > 0 && !w.caught) {
      const dx = w.x - catchZone.x;
      const dy = w.y - catchZone.y;
      if (dx * dx + dy * dy <= catchZone.r * catchZone.r) {
        w.caught = true;
        caughtCounts.set(w.text, (caughtCounts.get(w.text) || 0) + 1);
        if (w.category) {
          const bucket = caughtByCategory.get(w.category) || new Map();
          bucket.set(w.text, (bucket.get(w.text) || 0) + 1);
          caughtByCategory.set(w.category, bucket);
        }
        updateCaughtUI();
        return false;
      }
    }
    if (w.y > GAME_HEIGHT - 80) return false;
    return true;
  });
}

function drawBackground() {
  if (background.complete && background.naturalWidth) {
    ctx.drawImage(background, 0, 0, GAME_WIDTH, GAME_HEIGHT);
  } else {
    ctx.fillStyle = "#dfe7ef";
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }
}

function drawCat() {
  const walkCycle = [sprites.walkR1, sprites.walkR2];

  let img;
  if (cat.state === "pounce") {
    img = sprites.grab;
  } else if (cat.state === "jump") {
    img = cat.facing === -1 ? sprites.jumpLeft : sprites.jumpUp;
  } else if (cat.state === "sleep") {
    img = sprites.sleep || sprites.stand;
  } else if (cat.state === "walk") {
    img = walkCycle[cat.animFrame % walkCycle.length];
  } else {
    img = sprites.stand;
  }

  cat.animTimer += 1 / 60;
  if (cat.state === "walk" && cat.animTimer > 0.14) {
    cat.animFrame = (cat.animFrame + 1) % walkCycle.length;
    cat.animTimer = 0;
  }
  if (cat.state !== "walk") {
    cat.animFrame = 0;
  }

  const ready = img && img.complete && img.naturalWidth > 0;
  if (ready) {
    const targetHeight = (cat.state === "jump" || cat.state === "pounce")
      ? 180
      : cat.state === "sleep"
        ? 180 * 0.65
        : 180 * 0.8;
    const scale = targetHeight / img.naturalHeight;
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const yOffset = cat.state === "pounce" ? 2 : cat.state === "sleep" ? 40 : 30;
    ctx.save();
    ctx.translate(cat.x, cat.y);
    ctx.scale(cat.facing, 1);
    ctx.drawImage(img, -drawW / 2, -drawH + 10 + yOffset, drawW, drawH);
    ctx.restore();
  } else {
    ctx.fillStyle = "#222";
    ctx.fillRect(cat.x - 30, cat.y - 60, 60, 60);
  }
}

function drawWords() {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  words.forEach(w => {
    ctx.font = w.style.font;
    ctx.fillStyle = w.style.color;
    ctx.fillText(w.text, w.x, w.y);
  });
}

function render() {
  drawBackground();
  drawWords();
  drawCat();
  drawTimerUI();
}

function drawTimerUI() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = Math.floor(timeLeft % 60);
  timerEl.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateCaughtUI() {
  let total = 0;
  const recent = [];
  caughtCounts.forEach((count, word) => {
    total += count;
  });
  caughtEl.textContent = total;
}

function pounce() {
  if (phase !== "play") return;
  cat.pounceTimer = 0.35;
  cat.state = "pounce";
  lastInputAt = performance.now();
}

function jump() {
  if (phase !== "play") return;
  if (!cat.onGround) return;
  cat.vy = -620;
  cat.onGround = false;
  cat.state = "jump";
  lastInputAt = performance.now();
}

function endRound() {
  phase = "summary";
  endOverlay.classList.add("visible");
  summaryRendered = false;
}

function renderWordCloud() {
  ctx.fillStyle = "#f7f7f7";
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  initSelectionsForSummary();
  const entries = buildCloudEntries();
  summaryEl.textContent = entries.length
    ? `You caught ${entries.reduce((s, [, c]) => s + c, 0)} words.`
    : "No words caught this round. Try again!";

  if (!entries.length) return;

  const placements = [];
  entries.forEach(([word, count]) => {
    const size = 18 + Math.min(60, count * 10);
    let placed = false;
    for (let i = 0; i < 40 && !placed; i++) {
      const x = 120 + Math.random() * (GAME_WIDTH - 240);
      const y = 120 + Math.random() * (GAME_HEIGHT - 240);
      const box = {x, y, w: ctx.measureText(word).width + size, h: size + 10};
      const overlaps = placements.some(p => Math.abs(p.x - box.x) < (p.w + box.w) * 0.5 &&
        Math.abs(p.y - box.y) < (p.h + box.h) * 0.5);
      if (!overlaps) {
        placements.push({...box, size, word, color: pick(wordColors)});
        placed = true;
      }
    }
  });

  placements.forEach(p => {
    ctx.font = `${p.size}px 'Inter', system-ui, sans-serif`;
    ctx.fillStyle = p.color || pick(wordColors);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.word, p.x, p.y);
  });
  renderCloudSelectionControls(entries);
}

function totalStoryFragmentsCaught() {
  let total = 0;
  caughtByCategory.forEach(bucket => {
    bucket.forEach(count => {
      total += count;
    });
  });
  return total;
}

function pickFragmentForCategory(category) {
  const pool = storyPools[category] || [];
  const bucket = caughtByCategory.get(category);
  if (bucket && bucket.size) {
    const [text] = Array.from(bucket.entries()).sort((a, b) => b[1] - a[1])[0];
    return text;
  }
  return pool.length ? pick(pool) : "";
}

function initSelectionsForSummary() {
  if (selectedWords.size === 0) {
    caughtCounts.forEach((_, word) => selectedWords.add(word));
  }
  storyCategories.forEach(cat => {
    if (!selectedStoryChoices.has(cat)) {
      const choice = pickFragmentForCategory(cat);
      if (choice) selectedStoryChoices.set(cat, choice);
    }
  });
}

function buildCloudEntries() {
  const entries = Array.from(caughtCounts.entries()).filter(([word]) => selectedWords.has(word));
  return entries.sort((a, b) => b[1] - a[1]);
}

function renderCloudSelectionControls(entries) {
  const uniqueWords = entries.map(([w, c]) => ({word: w, count: c}));
  if (!uniqueWords.length) return;
  const container = document.createElement("div");
  container.className = "selection-panel";
  const title = document.createElement("div");
  title.className = "selection-title";
  title.textContent = "Keep words";
  container.appendChild(title);

  uniqueWords.forEach(({word, count}) => {
    const label = document.createElement("label");
    label.className = "selection-item";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = selectedWords.has(word);
    input.addEventListener("change", () => {
      if (input.checked) selectedWords.add(word);
      else selectedWords.delete(word);
      summaryRendered = false;
      renderWordCloud();
    });
    const text = document.createElement("span");
    text.textContent = `${word} (${count})`;
    label.appendChild(input);
    label.appendChild(text);
    container.appendChild(label);
  });
  summaryEl.appendChild(container);
}

function buildStoryLines() {
  if (totalStoryFragmentsCaught() === 0) return [];
  const selections = {
    time: selectedStoryChoices.get("time") || pickFragmentForCategory("time"),
    mood: selectedStoryChoices.get("mood") || pickFragmentForCategory("mood"),
    self: selectedStoryChoices.get("self") || pickFragmentForCategory("self"),
    desire: selectedStoryChoices.get("desire") || pickFragmentForCategory("desire"),
    movement: selectedStoryChoices.get("movement") || pickFragmentForCategory("movement")
  };
  return [
    `${selections.time}, ${selections.mood}.`,
    selections.self ? `I'm ${selections.self}.` : "",
    selections.desire ? `I want ${selections.desire}.` : "",
    selections.movement ? `so I ${selections.movement}.` : ""
  ];
}

function renderStorySelectionControls() {
  const container = document.createElement("div");
  container.className = "selection-panel";
  const title = document.createElement("div");
  title.className = "selection-title";
  title.textContent = "You grabbed many! Pick one per line";
  container.appendChild(title);

  storyCategories.forEach(cat => {
    const bucket = caughtByCategory.get(cat);
    if (!bucket || bucket.size <= 1) return;
    const wrapper = document.createElement("div");
    wrapper.className = "selection-item selection-select";
    const label = document.createElement("div");
    label.textContent = cat;
    const select = document.createElement("select");
    Array.from(bucket.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([text, count]) => {
        const opt = document.createElement("option");
        opt.value = text;
        opt.textContent = text;
        if (selectedStoryChoices.get(cat) === text) opt.selected = true;
        select.appendChild(opt);
      });
    select.addEventListener("change", e => {
      selectedStoryChoices.set(cat, e.target.value);
      summaryRendered = false;
      renderStorySummary();
    });
    wrapper.appendChild(label);
    wrapper.appendChild(select);
    container.appendChild(wrapper);
  });

  if (container.childElementCount > 1) {
    summaryEl.appendChild(container);
  }
}

function renderStorySummary() {
  ctx.fillStyle = "#f7f3ec";
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  initSelectionsForSummary();
  const lines = buildStoryLines();
  if (!lines.length) {
    summaryEl.textContent = "No fragments caught this round. Try again!";
    return;
  }
  summaryEl.textContent = "Story preview above. Adjust lines below.";
  renderStorySelectionControls();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#1c2b3a";
  ctx.font = "32px 'Inter', system-ui, sans-serif";
  const startY = GAME_HEIGHT * 0.35;
  const spacing = 64;
  lines.forEach((line, idx) => {
    ctx.fillText(line, GAME_WIDTH * 0.5, startY + idx * spacing);
  });
}

function loop(ts) {
  const dt = Math.min(0.05, (ts - lastTick) / 1000 || 0);
  lastTick = ts;
  if (phase === "summary") {
    if (!summaryRendered) {
      if (mode === MODES.STORY) {
        renderStorySummary();
      } else {
        renderWordCloud();
      }
      summaryRendered = true;
    }
    requestAnimationFrame(loop);
    return;
  }
  update(dt);
  render();
  requestAnimationFrame(loop);
}

startBtn.addEventListener("click", () => {
  resetRound();
});

restartBtn.addEventListener("click", () => {
  resetToStartScreen();
});

if (backPlayBtn) {
  backPlayBtn.addEventListener("click", () => {
    resetToStartScreen();
  });
}

if (soundBtn) {
  soundBtn.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    applySoundState();
  });
}

modeRadios.forEach(radio => {
  radio.addEventListener("change", e => {
    mode = e.target.value === MODES.STORY ? MODES.STORY : MODES.CLOUD;
    setModeLabel();
  });
});

durationRadios.forEach(radio => {
  radio.addEventListener("change", e => {
    const val = Number(e.target.value);
    roundDuration = Number.isFinite(val) ? val : DEFAULT_ROUND_SECONDS;
    if (phase !== "play") {
      timeLeft = roundDuration;
      setTimerText(timeLeft);
    }
  });
});

window.addEventListener("keydown", e => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = true;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = true;
  if (e.code === "ArrowUp") {
    e.preventDefault();
    jump();
  }
  if (e.code === "Space") {
    e.preventDefault();
    pounce();
  }
  if (e.code === "Escape") {
    e.preventDefault();
    resetToStartScreen();
    return;
  }
  lastInputAt = performance.now();
});

window.addEventListener("keyup", e => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
});

canvas.addEventListener("pointerdown", () => {
  pounce();
  lastInputAt = performance.now();
});

requestAnimationFrame(loop);

