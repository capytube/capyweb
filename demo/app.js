const VIDEO_URL =
  "https://magnus-video-public.s3.ap-southeast-1.amazonaws.com/capytube-stream.mp4";
const STORAGE_KEY = "capytube-friend-demo";

const CAPY_NAMES = {
  magnus: "Magnus",
  elon: "Elon",
  einstein: "Einstein",
};

const STARTER_SNACKS = [
  { id: "carrots", title: "Carrots", detail: "Sweet crunchy baby carrots", votes: 18 },
  { id: "pandan", title: "Pandan leaf", detail: "Fresh tips from Chiang Mai", votes: 11 },
  { id: "watermelon", title: "Watermelon", detail: "Chilled, for a thirsty capy", votes: 27 },
  { id: "grass", title: "Timothy grass", detail: "Silky and aromatic", votes: 14 },
];

const PASSES = [
  {
    id: "chalk",
    name: "Capy #1234",
    rarity: "Ultra rare",
    image: "assets/pass-chalk.png",
    price: 5,
    perks: ["Chalk powder, +5 bidding bonus", "Climbing gym, +10 minutes on a call"],
  },
  {
    id: "cafe",
    name: "Capy #5687",
    rarity: "Rare",
    image: "assets/pass-cafe.png",
    price: 6,
    perks: ["Chalk powder, +5 bidding bonus", "Climbing gym, +10 minutes on a call"],
  },
  {
    id: "trail",
    name: "Capy #632574",
    rarity: "Epic",
    image: "assets/pass-trail.png",
    price: 3,
    perks: ["Chalk powder, +5 bidding bonus", "Climbing gym, +10 minutes on a call"],
  },
];

const SAMPLE_CHAT = [
  { name: "Nok", text: "He just sat down like a beanbag." },
  { name: "Arun", text: "Watermelon is winning. Obviously." },
  { name: "Mina", text: "Einstein is planning something. I can tell." },
  { name: "Jules", text: "Elon looked at the high hold and thought about it." },
];

const defaultState = () => ({
  coins: 40,
  name: "Friend",
  capy: "magnus",
  snacks: STARTER_SNACKS.map((snack) => ({ ...snack })),
  bid: 20,
  bidder: "",
  passes: [],
  chat: SAMPLE_CHAT.map((line) => ({ ...line })),
});

let state = loadState();

const coinCount = document.querySelector("#coin-count");
const nameInput = document.querySelector("#display-name");
const chatLog = document.querySelector("#chat-log");
const snackOptions = document.querySelector("#snack-options");
const shopGrid = document.querySelector("#shop-grid");
const noteDialog = document.querySelector("#note-dialog");
const noteTitle = document.querySelector("#note-title");
const noteBody = document.querySelector("#note-body");
const noteConfirm = document.querySelector("#note-confirm");
const reel = document.querySelector("#reel");
const playReel = document.querySelector("#play-reel");
const reelStatus = document.querySelector("#reel-status");
const stageToast = document.querySelector("#stage-toast");
const floatLayer = document.querySelector("#float-layer");
const toasts = document.querySelector("#toasts");

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved || !Array.isArray(saved.snacks)) return defaultState();
    return { ...defaultState(), ...saved };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function displayName() {
  const name = state.name.trim();
  return name || "Friend";
}

function setView(name) {
  const view = ["home", "watch", "play", "shop"].includes(name) ? name : "home";
  document.querySelectorAll("[data-view]").forEach((section) => {
    section.hidden = section.dataset.view !== view;
  });
  document.querySelectorAll("[data-nav]").forEach((link) => {
    const active = link.dataset.nav === view;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (location.hash !== `#${view}`) history.replaceState(null, "", `#${view}`);
}

function toast(message) {
  const item = document.createElement("p");
  item.className = "toast";
  item.textContent = message;
  toasts.appendChild(item);
  window.setTimeout(() => item.remove(), 2800);
}

function renderCoins() {
  coinCount.textContent = String(state.coins);
}

function renderCapy() {
  document.querySelectorAll("[data-capy]").forEach((button) => {
    const selected = button.dataset.capy === state.capy;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-selected", selected ? "true" : "false");
  });
  const label = document.querySelector("#snack-for");
  label.textContent = `Voting for ${CAPY_NAMES[state.capy]}`;
}

function renderSnacks() {
  const total = state.snacks.reduce((sum, snack) => sum + snack.votes, 0) || 1;
  snackOptions.replaceChildren();
  state.snacks.forEach((snack) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option";
    button.dataset.snack = snack.id;

    const copy = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = snack.title;
    const detail = document.createElement("small");
    detail.textContent = snack.detail;
    copy.append(title, detail);

    const count = document.createElement("span");
    count.className = "count";
    count.textContent = `${snack.votes} votes`;

    const bar = document.createElement("span");
    bar.className = "bar";
    const fill = document.createElement("span");
    fill.style.width = `${Math.round((snack.votes / total) * 100)}%`;
    bar.appendChild(fill);

    const left = document.createElement("span");
    left.append(copy, bar);
    button.append(left, count);
    snackOptions.appendChild(button);
  });
}

function renderBid() {
  document.querySelector("#bid-amount").textContent = String(state.bid);
  const holder = document.querySelector("#bid-holder");
  holder.textContent = state.bidder ? `Leading: ${state.bidder}` : "No one yet";
  const input = document.querySelector("#bid-input");
  const next = state.bid + 5;
  input.min = String(next);
  if (Number(input.value) < next) input.value = String(next);
}

function renderShop() {
  shopGrid.replaceChildren();
  PASSES.forEach((pass) => {
    const owned = state.passes.includes(pass.id);
    const card = document.createElement("article");
    card.className = "shop-card";

    const image = document.createElement("img");
    image.src = pass.image;
    image.alt = pass.name;

    const rarity = document.createElement("p");
    rarity.className = "rarity";
    rarity.textContent = pass.rarity;

    const title = document.createElement("h3");
    title.textContent = pass.name;

    const list = document.createElement("ul");
    pass.perks.forEach((perk) => {
      const item = document.createElement("li");
      item.textContent = perk;
      list.appendChild(item);
    });

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.pass = pass.id;
    button.disabled = owned;
    button.textContent = owned ? "In your pocket" : `Claim · ${pass.price} coins`;

    card.append(image, rarity, title, list, button);
    shopGrid.appendChild(card);
  });
}

function renderChat() {
  chatLog.replaceChildren();
  state.chat.forEach((line) => appendChat(line, false));
  chatLog.scrollTop = chatLog.scrollHeight;
}

function appendChat(line, persist) {
  const bubble = document.createElement("p");
  bubble.className = line.mine ? "bubble mine" : "bubble";
  const who = document.createElement("strong");
  who.textContent = line.name;
  bubble.appendChild(who);
  bubble.append(document.createTextNode(line.text));
  chatLog.appendChild(bubble);
  chatLog.scrollTop = chatLog.scrollHeight;
  if (persist) {
    state.chat.push(line);
    if (state.chat.length > 40) state.chat.shift();
    saveState();
  }
}

function spend(cost, successText) {
  if (state.coins < cost) {
    openNote({
      title: "Not enough play coins",
      body: `That costs ${cost}. You have ${state.coins}. Add a handful of play coins, or reset the demo.`,
      confirm: "Add 25 coins",
      mode: "topup",
    });
    return false;
  }
  state.coins -= cost;
  renderCoins();
  saveState();
  if (successText) toast(successText);
  return true;
}

function showStageToast(message) {
  stageToast.hidden = false;
  stageToast.textContent = message;
  window.clearTimeout(showStageToast.timer);
  showStageToast.timer = window.setTimeout(() => {
    stageToast.hidden = true;
  }, 2200);
}

function floatEmoji(emoji) {
  const node = document.createElement("span");
  node.className = "floater";
  node.textContent = emoji;
  node.style.left = `${20 + Math.random() * 60}%`;
  floatLayer.appendChild(node);
  window.setTimeout(() => node.remove(), 1400);
}

let noteMode = "info";

function openNote({ title, body, confirm, mode }) {
  noteMode = mode;
  noteTitle.textContent = title;
  noteBody.textContent = body;
  noteConfirm.hidden = mode === "info";
  noteConfirm.textContent = confirm || "OK";
  noteDialog.showModal();
}

function go(view) {
  setView(view);
  if (view !== "watch") reel.pause();
  if (view !== "home") window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-go]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    go(link.dataset.go);
  });
});

window.addEventListener("hashchange", () => {
  setView(location.hash.replace("#", ""));
});

nameInput.value = state.name === "Friend" ? "" : state.name;
nameInput.placeholder = "Friend";
nameInput.addEventListener("input", () => {
  state.name = nameInput.value.slice(0, 16);
  saveState();
});

document.querySelector("#coin-pill").addEventListener("click", () => {
  openNote({
    title: "Play coins",
    body: "These coins only live in this browser. They are not CapyCoin, and nothing on this page charges a card.",
    confirm: "Add 25 coins",
    mode: "topup",
  });
});

noteDialog.addEventListener("close", () => {
  if (noteDialog.returnValue !== "confirm" || noteMode !== "topup") return;
  state.coins += 25;
  renderCoins();
  saveState();
  toast("25 play coins added");
});

playReel.addEventListener("click", async () => {
  reel.controls = true;
  playReel.hidden = true;
  reelStatus.textContent = "Playing";
  try {
    await reel.play();
  } catch {
    reelStatus.textContent = "Press play on the video";
  }
});

reel.addEventListener("error", () => {
  playReel.hidden = true;
  reelStatus.textContent = "Reel unavailable";
  showStageToast("The reel didn’t load. The rest of the demo still works.");
});

reel.addEventListener("ended", () => {
  reelStatus.textContent = "Replay ended";
});

document.querySelector(".tip-row").addEventListener("click", (event) => {
  const button = event.target.closest("[data-tip]");
  if (!button) return;
  const cost = Number(button.dataset.cost);
  const tip = button.dataset.tip;
  if (!spend(cost)) return;
  showStageToast(`${displayName()} sent ${tip}`);
  floatEmoji(tip === "Watermelon" ? "🍉" : tip === "Apple" ? "🍎" : "🍮");
  appendChat({ name: displayName(), text: `Sent ${tip}.`, mine: true }, true);
});

document.querySelector(".emoji-row").addEventListener("click", (event) => {
  const button = event.target.closest("[data-react]");
  if (!button) return;
  floatEmoji(button.dataset.react);
  appendChat({ name: displayName(), text: button.dataset.react, mine: true }, true);
});

document.querySelector("#chat-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.querySelector("#chat-input");
  const text = input.value.trim();
  if (!text) return;
  appendChat({ name: displayName(), text, mine: true }, true);
  input.value = "";
});

document.querySelector("#capy-picker").addEventListener("click", (event) => {
  const button = event.target.closest("[data-capy]");
  if (!button) return;
  state.capy = button.dataset.capy;
  renderCapy();
  saveState();
});

snackOptions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-snack]");
  if (!button) return;
  const snack = state.snacks.find((item) => item.id === button.dataset.snack);
  if (!snack) return;
  if (!spend(5, `${CAPY_NAMES[state.capy]} got a vote for ${snack.title}`)) return;
  snack.votes += 1;
  renderSnacks();
  saveState();
});

document.querySelector("#custom-snack").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.querySelector("#custom-snack-input");
  const title = input.value.trim();
  if (!title) return;
  if (!spend(20, `Requested ${title}`)) return;
  state.snacks.push({
    id: `custom-${Date.now()}`,
    title,
    detail: `Asked for by ${displayName()}`,
    votes: 1,
  });
  input.value = "";
  renderSnacks();
  saveState();
});

document.querySelector("#bid-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.querySelector("#bid-input");
  const amount = Number(input.value);
  if (!Number.isFinite(amount) || amount < state.bid + 5) {
    toast(`Bid at least ${state.bid + 5} coins`);
    return;
  }
  if (!spend(amount, `${displayName()} leads the safari at ${amount}`)) return;
  state.bid = amount;
  state.bidder = displayName();
  renderBid();
  saveState();
});

shopGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-pass]");
  if (!button || button.disabled) return;
  const pass = PASSES.find((item) => item.id === button.dataset.pass);
  if (!pass) return;
  if (!spend(pass.price, `${pass.name} is in your pocket`)) return;
  state.passes.push(pass.id);
  renderShop();
  saveState();
});

document.querySelector("#reset-demo").addEventListener("click", () => {
  state = defaultState();
  nameInput.value = "";
  saveState();
  renderCoins();
  renderCapy();
  renderSnacks();
  renderBid();
  renderShop();
  renderChat();
  toast("Demo reset");
});

if (!reel.getAttribute("src")) reel.src = VIDEO_URL;

renderCoins();
renderCapy();
renderSnacks();
renderBid();
renderShop();
renderChat();
setView(location.hash.replace("#", "") || "home");
