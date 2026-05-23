const COLORS = ["red", "yellow", "green", "blue"];
const CLASSIC_VALUES = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "Skip", "Reverse", "+2"];
const MERCY_EXTRA_VALUES = ["+4", "+6", "+10", "Discard All"];

const state = {
  mode: "classic",
  deck: [],
  discardPile: [],
  playerHand: [],
  cpuHand: [],
  currentColor: null,
  currentValue: null,
  turn: "player",
  awaitingColorFor: null,
  gameOver: false,
  mustPassAfterDraw: false
};

const modeSelect = document.getElementById("modeSelect");
const restartBtn = document.getElementById("restartBtn");
const drawPileBtn = document.getElementById("drawPileBtn");
const discardCard = document.getElementById("discardCard");
const playerHandEl = document.getElementById("playerHand");
const cpuHandEl = document.getElementById("cpuHand");
const cpuCountEl = document.getElementById("cpuCount");
const playerCountEl = document.getElementById("playerCount");
const drawCountEl = document.getElementById("drawCount");
const turnText = document.getElementById("turnText");
const messageText = document.getElementById("messageText");
const gameLog = document.getElementById("gameLog");
const colorPicker = document.getElementById("colorPicker");

function createDeck(mode) {
  const deck = [];

  for (const color of COLORS) {
    deck.push(makeCard(color, "0"));

    for (let i = 0; i < 2; i++) {
      for (const value of CLASSIC_VALUES.slice(1)) {
        deck.push(makeCard(color, value));
      }
    }
  }

  for (let i = 0; i < 4; i++) {
    deck.push(makeCard("wild", "Wild"));
    deck.push(makeCard("wild", "+4"));
  }

  if (mode === "mercy") {
    for (const color of COLORS) {
      for (let i = 0; i < 2; i++) {
        for (const value of MERCY_EXTRA_VALUES) {
          deck.push(makeCard(color, value));
        }
      }
    }

    for (let i = 0; i < 4; i++) {
      deck.push(makeCard("wild", "+6"));
      deck.push(makeCard("wild", "+10"));
      deck.push(makeCard("wild", "Wild Reverse Draw 4"));
    }
  }

  return shuffle(deck);
}

function makeCard(color, value) {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    color,
    value
  };
}

function shuffle(cards) {
  const arr = [...cards];

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

function startGame() {
  state.mode = modeSelect.value;
  state.deck = createDeck(state.mode);
  state.discardPile = [];
  state.playerHand = [];
  state.cpuHand = [];
  state.currentColor = null;
  state.currentValue = null;
  state.turn = "player";
  state.awaitingColorFor = null;
  state.gameOver = false;
  state.mustPassAfterDraw = false;

  gameLog.innerHTML = "";
  colorPicker.classList.add("hidden");

  for (let i = 0; i < 7; i++) {
    drawToHand(state.playerHand);
    drawToHand(state.cpuHand);
  }

  let firstCard = state.deck.pop();

  while (firstCard.color === "wild" || isActionCard(firstCard)) {
    state.deck.unshift(firstCard);
    state.deck = shuffle(state.deck);
    firstCard = state.deck.pop();
  }

  state.discardPile.push(firstCard);
  state.currentColor = firstCard.color;
  state.currentValue = firstCard.value;

  addLog(`Game started in ${state.mode === "mercy" ? "No Mercy" : "Classic"} mode. You and CPU each got 7 cards.`);
  render();
}

function drawToHand(hand, count = 1) {
  for (let i = 0; i < count; i++) {
    refillDeckIfNeeded();

    if (state.deck.length === 0) {
      addLog("No cards left to draw.");
      return;
    }

    hand.push(state.deck.pop());
  }
}

function refillDeckIfNeeded() {
  if (state.deck.length > 0 || state.discardPile.length <= 1) return;

  const top = state.discardPile.pop();
  state.deck = shuffle(state.discardPile);
  state.discardPile = [top];

  addLog("Draw pile was reshuffled from the discard pile.");
}

function isActionCard(card) {
  return [
    "Skip",
    "Reverse",
    "+2",
    "+4",
    "+6",
    "+10",
    "Wild",
    "Wild Reverse Draw 4",
    "Discard All"
  ].includes(card.value);
}

function isDrawCard(card) {
  return ["+2", "+4", "+6", "+10", "Wild Reverse Draw 4"].includes(card.value);
}

function drawAmount(card) {
  if (card.value === "+2") return 2;
  if (card.value === "+4" || card.value === "Wild Reverse Draw 4") return 4;
  if (card.value === "+6") return 6;
  if (card.value === "+10") return 10;
  return 0;
}

function getCardLabel(card) {
  if (!card) return "";
  if (card.value === "Wild Reverse Draw 4") return "W+4";
  if (card.value === "Discard All") return "ALL";
  return card.value;
}

function isPlayable(card) {
  if (state.gameOver || state.turn !== "player" || state.awaitingColorFor) return false;

  return card.color === "wild" ||
    card.color === state.currentColor ||
    card.value === state.currentValue;
}

function cardMatches(card) {
  return card.color === "wild" ||
    card.color === state.currentColor ||
    card.value === state.currentValue;
}

function playCard(player, index, chosenColor = null) {
  const hand = player === "player" ? state.playerHand : state.cpuHand;
  const card = hand[index];

  if (!card || state.gameOver) return;
  if (!cardMatches(card)) return;

  hand.splice(index, 1);
  state.discardPile.push(card);
  state.currentValue = card.value;

  if (card.color === "wild") {
    state.currentColor = chosenColor || chooseCpuColor(hand);
  } else {
    state.currentColor = card.color;
  }

  const name = player === "player" ? "You" : "CPU";
  addLog(`${name} played ${describeCard(card)}${card.color === "wild" ? ` and chose ${state.currentColor}` : ""}.`);

  if (card.value === "Discard All") {
    discardAllMatchingColor(hand, player, state.currentColor);
  }

  checkWinLose();

  if (state.gameOver) {
    render();
    return;
  }

  applyAction(card, player);
  checkWinLose();
  render();

  if (!state.gameOver && state.turn === "cpu") {
    setTimeout(cpuTurn, 650);
  }
}

function discardAllMatchingColor(hand, player, color) {
  const discarded = [];

  for (let i = hand.length - 1; i >= 0; i--) {
    if (hand[i].color === color) {
      discarded.push(hand.splice(i, 1)[0]);
    }
  }

  if (discarded.length) {
    state.discardPile.push(...discarded);
    addLog(`${player === "player" ? "You" : "CPU"} discarded ${discarded.length} extra ${color} card(s).`);
  }
}

function applyAction(card, player) {
  const opponentHand = player === "player" ? state.cpuHand : state.playerHand;
  const opponentName = player === "player" ? "CPU" : "You";

  if (isDrawCard(card)) {
    const amount = drawAmount(card);
    drawToHand(opponentHand, amount);
    addLog(`${opponentName} drew ${amount} card(s). No stacking allowed, so the turn was skipped.`);
    state.turn = player;
    return;
  }

  if (card.value === "Skip" || card.value === "Reverse") {
    addLog(`${opponentName} was skipped.`);
    state.turn = player;
    return;
  }

  state.turn = player === "player" ? "cpu" : "player";
}

function chooseCpuColor(hand) {
  const counts = {
    red: 0,
    yellow: 0,
    green: 0,
    blue: 0
  };

  for (const card of hand) {
    if (counts[card.color] !== undefined) {
      counts[card.color]++;
    }
  }

  return COLORS.sort((a, b) => counts[b] - counts[a])[0];
}

function cpuTurn() {
  if (state.gameOver || state.turn !== "cpu") return;

  const playableIndex = state.cpuHand.findIndex(card => cardMatches(card));

  if (playableIndex >= 0) {
    const card = state.cpuHand[playableIndex];
    const chosenColor = card.color === "wild" ? chooseCpuColor(state.cpuHand) : null;
    playCard("cpu", playableIndex, chosenColor);
    return;
  }

  drawToHand(state.cpuHand);
  addLog("CPU drew 1 card.");

  const newCardIndex = state.cpuHand.length - 1;

  if (state.cpuHand[newCardIndex] && cardMatches(state.cpuHand[newCardIndex])) {
    addLog("CPU can play the drawn card.");
    setTimeout(() => playCard("cpu", newCardIndex), 450);
  } else {
    addLog("CPU passed.");
    state.turn = "player";
    render();
  }
}

function playerPlay(index) {
  const card = state.playerHand[index];

  if (!isPlayable(card)) return;

  if (card.color === "wild") {
    state.awaitingColorFor = index;
    messageText.textContent = "Choose a color for your wild card.";
    colorPicker.classList.remove("hidden");
    render();
    return;
  }

  playCard("player", index);
}

function playerDraw() {
  if (state.gameOver || state.turn !== "player" || state.awaitingColorFor) return;

  drawToHand(state.playerHand);
  addLog("You drew 1 card.");

  const drawnIndex = state.playerHand.length - 1;
  const drawnCard = state.playerHand[drawnIndex];

  checkWinLose();

  if (state.gameOver) {
    render();
    return;
  }

  if (drawnCard && cardMatches(drawnCard)) {
    addLog(`You may play the drawn card: ${describeCard(drawnCard)}.`);
    messageText.textContent = "You drew a playable card. Play it or tap Draw again to pass.";
    state.mustPassAfterDraw = true;
  } else {
    addLog("You passed.");
    state.turn = "cpu";
    state.mustPassAfterDraw = false;
    setTimeout(cpuTurn, 650);
  }

  render();
}

function handleDrawPile() {
  if (state.mustPassAfterDraw && state.turn === "player") {
    addLog("You passed.");
    state.turn = "cpu";
    state.mustPassAfterDraw = false;
    render();
    setTimeout(cpuTurn, 650);
    return;
  }

  playerDraw();
}

function chooseWildColor(color) {
  if (state.awaitingColorFor === null) return;

  const index = state.awaitingColorFor;
  state.awaitingColorFor = null;
  colorPicker.classList.add("hidden");

  playCard("player", index, color);
}

function describeCard(card) {
  if (card.color === "wild") return card.value;
  return `${card.color} ${card.value}`;
}

function checkWinLose() {
  if (state.playerHand.length === 0) {
    endGame("You win! UNO legend!", true);
    return;
  }

  if (state.cpuHand.length === 0) {
    endGame("CPU wins. Revenge round?", false);
    return;
  }

  if (state.mode === "mercy") {
    if (state.playerHand.length > 250) {
      endGame("No Mercy rule: you have more than 250 cards. You lose.", false);
      return;
    }

    if (state.cpuHand.length > 250) {
      endGame("No Mercy rule: CPU has more than 250 cards. You win!", true);
    }
  }
}

function endGame(message, playerWon) {
  state.gameOver = true;
  state.awaitingColorFor = null;
  colorPicker.classList.add("hidden");

  turnText.textContent = playerWon ? "You win!" : "Game over";
  messageText.textContent = message;

  addLog(message, playerWon ? "win" : "lose");
}

function addLog(text, className = "") {
  const li = document.createElement("li");
  li.textContent = text;

  if (className) {
    li.classList.add(className);
  }

  gameLog.prepend(li);

  while (gameLog.children.length > 60) {
    gameLog.removeChild(gameLog.lastChild);
  }
}

function render() {
  renderDiscard();
  renderPlayerHand();
  renderCpuHand();

  cpuCountEl.textContent = state.cpuHand.length;
  playerCountEl.textContent = state.playerHand.length;
  drawCountEl.textContent = state.deck.length;

  if (!state.gameOver) {
    turnText.textContent = state.turn === "player" ? "Your turn" : "CPU turn";

    if (!state.awaitingColorFor && !state.mustPassAfterDraw) {
      messageText.textContent = state.turn === "player"
        ? "Play a matching color, number, or symbol. Tap draw if you cannot play."
        : "CPU is thinking...";
    }
  }
}

function renderDiscard() {
  const top = state.discardPile[state.discardPile.length - 1];

  discardCard.className = `card big-card ${top.color === "wild" ? "wild" : state.currentColor}`;
  discardCard.dataset.label = getCardLabel(top);
  discardCard.innerHTML = `<span>${getCardLabel(top)}</span>`;
  discardCard.title = describeCard(top);
}

function renderPlayerHand() {
  playerHandEl.innerHTML = "";

  state.playerHand.forEach((card, index) => {
    const cardEl = document.createElement("button");

    cardEl.type = "button";
    cardEl.className = `card ${card.color}`;

    if (isPlayable(card)) {
      cardEl.classList.add("playable");
    }

    if (!isPlayable(card)) {
      cardEl.classList.add("disabled");
    }

    cardEl.dataset.label = getCardLabel(card);
    cardEl.title = describeCard(card);
    cardEl.innerHTML = `<span>${getCardLabel(card)}</span>`;
    cardEl.addEventListener("click", () => playerPlay(index));

    playerHandEl.appendChild(cardEl);
  });
}

function renderCpuHand() {
  cpuHandEl.innerHTML = "";

  const shown = Math.min(state.cpuHand.length, 30);

  for (let i = 0; i < shown; i++) {
    const back = document.createElement("div");

    back.className = "cpu-back";
    back.style.setProperty("--tilt", `${(i % 7) - 3}deg`);
    back.innerHTML = "<span>UNO</span>";

    cpuHandEl.appendChild(back);
  }

  if (state.cpuHand.length > shown) {
    const more = document.createElement("div");

    more.className = "cpu-back";
    more.innerHTML = `<span>+${state.cpuHand.length - shown}</span>`;

    cpuHandEl.appendChild(more);
  }
}

restartBtn.addEventListener("click", startGame);
modeSelect.addEventListener("change", startGame);
drawPileBtn.addEventListener("click", handleDrawPile);

drawPileBtn.addEventListener("keydown", event => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    handleDrawPile();
  }
});

colorPicker.addEventListener("click", event => {
  const button = event.target.closest("button[data-color]");

  if (button) {
    chooseWildColor(button.dataset.color);
  }
});

startGame();
