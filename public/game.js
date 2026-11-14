// Tuning numbers live here so the game is easy to adjust.
const CONFIG = {
  width: 900, // Camera width in pixels.
  height: 520, // Camera height in pixels.
  playerSpeed: 245, // Horizontal player speed.
  jumpVelocity: -490, // Upward jump strength.
  gravity: 1050, // Downward pull.
  levelPlatforms: 24, // Number of generated platforms in one run.
  platformGapMin: 70, // Minimum horizontal gap between platform centers.
  platformGapMax: 120, // Maximum horizontal gap between platform centers.
  levelTimeSeconds: 130, // Maximum time for the longer challenge.
  coinValue: 1, // Coins earned per coin pickup.
  crateValue: 3, // Coins earned per color crate.
  maxInputLength: 5000, // Safety limit for student writing.
};

const $ = (id) => document.getElementById(id);
const screens = { start: $('start-screen'), thinking: $('thinking'), activity: $('activity-screen'), game: $('game-screen'), end: $('end-screen') };
const COLORS = ['#ffffff', '#91e6c7', '#f6cf68', '#ff9eaa', '#9bb7ff', '#d7a7ff', '#ffb86b', '#63d7e8', '#f38ba8', '#b8e986'];
const SHOP_COLORS = COLORS.slice(1);
const DECORATIONS = ['clouds', 'lanterns', 'neon-ridges'];
let game;
let currentAnswer = '';
let unlockedColors = new Set(['#ffffff']);
let selectedColor = '#ffffff';
let runNumber = 0;
let aiRequestInFlight = false;
let lastAIAction = 'worksheet';
let unlockedDecorations = new Set();

function showScreen(name) { Object.entries(screens).forEach(([key, node]) => node.classList.toggle('hidden', key !== name)); }
function setActionButtonsDisabled(disabled) { document.querySelectorAll('.action-button').forEach((button) => { button.disabled = disabled; }); }
function friendlyError(error) { const message = error?.name === 'AbortError' ? 'The request took too long.' : 'StudyAssistant could not answer.'; $('ai-error').textContent = `${message} Please try again.`; showScreen('start'); }
function updateColorPicker() {
  const picker = $('color-picker'); picker.innerHTML = '';
  COLORS.forEach((color) => { const button = document.createElement('button'); button.style.background = color; button.title = unlockedColors.has(color) ? 'Choose this color' : 'Locked: find a crate'; button.className = unlockedColors.has(color) ? '' : 'locked'; button.disabled = !unlockedColors.has(color); button.addEventListener('click', () => { selectedColor = color; $('avatar-button').style.background = color; $('avatar-face').style.background = color === '#ffffff' ? '#10152c' : '#fff'; game?.scene?.getScene('StudyScene')?.setPlayerColor(color); picker.classList.add('hidden'); }); picker.appendChild(button); });
}
function currentScene() { return game?.scene?.getScene('StudyScene'); }
function updateShop() {
  const scene = currentScene(); const coins = scene?.coins || 0; const colorButton = $('buy-color-pack'); const decorButton = $('buy-decor-pack');
  const colorsLeft = SHOP_COLORS.some((color) => !unlockedColors.has(color)); const decorLeft = unlockedDecorations.size < DECORATIONS.length;
  colorButton.disabled = !scene || coins < 5 || !colorsLeft; decorButton.disabled = !scene || coins < 7 || !decorLeft;
  if (!scene) $('shop-message').textContent = 'Start a run to spend coins.';
}
function spendCoins(cost) { const scene = currentScene(); if (!scene || scene.coins < cost) return false; scene.coins -= cost; $('score').textContent = scene.coins; updateShop(); return true; }
function buyColorPack() { const color = SHOP_COLORS.find((item) => !unlockedColors.has(item)); if (!color) return; if (!spendCoins(5)) { $('shop-message').textContent = 'Collect 5 coins first.'; return; } unlockedColors.add(color); selectedColor = color; $('avatar-button').style.background = color; $('avatar-face').style.background = '#fff'; currentScene()?.setPlayerColor(color); updateColorPicker(); $('shop-message').textContent = 'New color unlocked and equipped!'; }
function buyDecorationPack() { const decoration = DECORATIONS.find((item) => !unlockedDecorations.has(item)); if (!decoration) return; if (!spendCoins(7)) { $('shop-message').textContent = 'Collect 7 coins first.'; return; } unlockedDecorations.add(decoration); currentScene()?.addShopDecoration(decoration); $('shop-message').textContent = `${decoration.replace('-', ' ')} added to your 3D scene!`; }
function showStudyActivity() { $('activity-answer').textContent = currentAnswer; $('retry-answer').disabled = false; $('retry-answer').textContent = 'That answer is incorrect — try again'; $('step-help-panel').classList.add('hidden'); $('step-help-answer').textContent = ''; $('step-help').disabled = false; $('step-help').textContent = 'I need step-by-step help'; $('student-work').value = ''; $('complete-activity').disabled = true; showScreen('activity'); $('student-work').focus(); }
async function requestAI(action) {
  if (aiRequestInFlight) return;
  const message = $('student-input').value.trim();
  if (!message && action !== 'worksheet') { $('ai-error').textContent = 'Add a small piece of work first.'; return; }
  if (message.length > CONFIG.maxInputLength) { $('ai-error').textContent = 'Please make your input shorter.'; return; }
  aiRequestInFlight = true; lastAIAction = action; $('retry-answer').disabled = true; setActionButtonsDisabled(true); $('ai-error').textContent = ''; showScreen('thinking');
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 55000);
  try { const response = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, subject: $('subject').value, message }), signal: controller.signal }); const data = await response.json(); if (!response.ok) throw new Error(data.error); currentAnswer = data.answer; showStudyActivity(); }
  catch (error) { friendlyError(error); }
  finally { clearTimeout(timeout); aiRequestInFlight = false; setActionButtonsDisabled(false); }
}

function retryAnswer() { if (aiRequestInFlight) return; $('retry-answer').disabled = true; requestAI(lastAIAction); }

async function requestStepHelp() {
  const button = $('step-help');
  const message = `${$('student-input').value.trim() || 'the practice activity'}\n\nPrevious StudyAssistant response:\n${currentAnswer}`;
  button.disabled = true;
  button.textContent = 'Preparing step-by-step help…';
  try {
    const response = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'steps', subject: $('subject').value, message }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    $('step-help-answer').textContent = data.answer;
    $('step-help-panel').classList.remove('hidden');
    button.textContent = 'Step-by-step help ready';
  } catch (error) {
    button.disabled = false;
    button.textContent = 'I need step-by-step help';
    $('ai-error').textContent = 'Step-by-step help is unavailable right now. Please try again.';
  }
}

class StudyScene extends Phaser.Scene {
  constructor() { super('StudyScene'); }
  create() {
    this.coins = 0; this.ended = false; this.touchJump = false; this.touchLeft = false; this.touchRight = false;
    this.cameras.main.setBackgroundColor('#16204d'); this.platforms = []; this.hazards = []; this.pickups = []; this.random = new Phaser.Math.RandomDataGenerator([`${Date.now()}-${runNumber}`]);
    const layout = this.makeLayout(); this.worldWidth = layout.worldWidth; this.cameras.main.setBounds(0, 0, this.worldWidth, CONFIG.height); this.drawBackdrop();
    layout.platforms.forEach((platform, index) => this.makePlatform(platform, index));
    this.player = this.add.circle(75, layout.platforms[0].y - 38, 17, Phaser.Display.Color.HexStringToColor(selectedColor).color); this.physics.add.existing(this.player); this.player.body.setCircle(17); this.player.body.setGravityY(CONFIG.gravity); this.player.body.setCollideWorldBounds(false); this.face = this.add.graphics(); this.drawFace();
    this.physics.add.collider(this.player, this.platforms); this.physics.add.overlap(this.player, this.hazards, () => this.finish(false)); this.physics.add.overlap(this.player, this.pickups, (_player, pickup) => this.collectPickup(pickup));
    this.cursors = this.input.keyboard.createCursorKeys(); this.keys = this.input.keyboard.addKeys('W,A,D,SPACE'); this.cameras.main.startFollow(this.player, true, 0.08, 0.08); this.cameras.main.setDeadzone(260, 160);
    const last = layout.platforms[layout.platforms.length - 1]; this.goal = this.add.star(last.x + last.w / 2 - 24, last.y - 36, 5, 22, 10, 0xff9eaa); this.physics.add.existing(this.goal, true); this.physics.add.overlap(this.player, this.goal, () => this.finish(true));
    $('score').textContent = '0'; $('run-label').textContent = `Run ${runNumber} · 3D study obby`; $('shop-message').textContent = 'Collect coins to buy colors and decorations.'; updateShop(); this.startTime = this.time.now;
  }
  makeLayout() {
    const platforms = [{ x: 0, y: 465, w: 220, spikes: false, crate: false }]; let nextX = 145;
    for (let i = 1; i < CONFIG.levelPlatforms; i += 1) { const gap = this.random.between(CONFIG.platformGapMin, CONFIG.platformGapMax); nextX += gap; const previous = platforms[i - 1]; const y = Phaser.Math.Clamp(previous.y + this.random.between(-48, 48), 300, 465); platforms.push({ x: nextX, y, w: this.random.between(125, 180), spikes: i > 3 && this.random.frac() > 0.65, crate: i > 1 && i % 3 === 0 }); }
    return { platforms, worldWidth: nextX + 260 };
  }
  drawBackdrop() {
    const graphics = this.add.graphics(); graphics.fillStyle(0x111a46, 1); graphics.fillRect(0, 0, this.worldWidth, CONFIG.height); graphics.fillStyle(0x263c82, 1); graphics.fillRect(0, 150, this.worldWidth, CONFIG.height - 150); graphics.fillStyle(0x0d1538, .9); graphics.fillTriangle(0, 290, 220, 165, 470, 290); graphics.fillTriangle(330, 290, 620, 145, 920, 290); graphics.fillTriangle(780, 290, 1080, 175, 1400, 290); graphics.lineStyle(2, 0x6275c5, .32); const horizon = 215; for (let x = 0; x < this.worldWidth; x += 110) { graphics.lineBetween(x, horizon, x + 110, CONFIG.height); } for (let y = horizon; y < CONFIG.height; y += 38) { graphics.lineBetween(0, y, this.worldWidth, y); }
    if (unlockedDecorations.has('clouds')) this.addShopDecoration('clouds'); if (unlockedDecorations.has('lanterns')) this.addShopDecoration('lanterns'); if (unlockedDecorations.has('neon-ridges')) this.addShopDecoration('neon-ridges');
    this.add.text(22, 24, '3D study obby · collect coins and shop upgrades', { fontFamily: 'Arial', fontSize: '18px', color: '#dce2ff' }).setScrollFactor(0);
  }
  makePlatform(platform, index) {
    const shadow = this.add.rectangle(platform.x + platform.w / 2 + 10, platform.y + 22, platform.w, 20, 0x080d28, .6); const top = this.add.rectangle(platform.x + platform.w / 2, platform.y, platform.w, 22, 0x91e6c7); this.physics.add.existing(top, true); this.platforms.push(top);
    const face = this.add.graphics(); face.fillStyle(0x4b6b8a, 1); face.fillPoints([{ x: platform.x, y: platform.y + 11 }, { x: platform.x + platform.w, y: platform.y + 11 }, { x: platform.x + platform.w - 18, y: platform.y + 38 }, { x: platform.x + 18, y: platform.y + 38 }], true); face.lineStyle(2, 0x91e6c7, .8); face.strokePoints([{ x: platform.x, y: platform.y + 11 }, { x: platform.x + platform.w, y: platform.y + 11 }, { x: platform.x + platform.w - 18, y: platform.y + 38 }, { x: platform.x + 18, y: platform.y + 38 }, { x: platform.x, y: platform.y + 11 }], true);
    if (platform.spikes) { const spikeX = platform.x + platform.w * .55; const spikes = this.add.triangle(spikeX, platform.y - 22, 0, 22, 18, 0, 36, 22, 0xff6b88); this.physics.add.existing(spikes, true); this.hazards.push(spikes); }
    if (index > 0 && index % 3 === 0) { const below = this.add.triangle(platform.x - 18, platform.y + 75, 0, 34, 20, 0, 40, 34, 0xff6b88); this.physics.add.existing(below, true); this.hazards.push(below); }
    if (platform.crate) { const crate = this.add.rectangle(platform.x + platform.w * .28, platform.y - 38, 24, 24, Phaser.Display.Color.HexStringToColor(COLORS[(index / 3) % COLORS.length]).color); this.physics.add.existing(crate, true); crate.crateColor = COLORS[(index / 3) % COLORS.length]; crate.isCrate = true; this.pickups.push(crate); }
    if (index % 2 === 0 && index > 0) { const coin = this.add.circle(platform.x + platform.w * .72, platform.y - 34, 9, 0xf6cf68); this.physics.add.existing(coin, true); coin.isCoin = true; this.pickups.push(coin); }
  }
  addShopDecoration(decoration) {
    if (decoration === 'clouds') { const cloud = this.add.graphics().setScrollFactor(.35); cloud.fillStyle(0xbad7ff, .18); [180, 700, 1180, 1600].forEach((x) => { cloud.fillCircle(x, 125, 28); cloud.fillCircle(x + 30, 115, 38); cloud.fillCircle(x + 66, 128, 24); }); }
    if (decoration === 'lanterns') { const lanterns = this.add.graphics().setScrollFactor(.6); lanterns.lineStyle(2, 0xf6cf68, .7); [260, 820, 1390].forEach((x) => { lanterns.lineBetween(x, 90, x, 155); lanterns.fillStyle(0xff9eaa, .9); lanterns.fillCircle(x, 165, 10); }); }
    if (decoration === 'neon-ridges') { const ridges = this.add.graphics().setScrollFactor(.45); ridges.lineStyle(4, 0x63d7e8, .45); for (let x = 0; x < this.worldWidth; x += 240) ridges.lineBetween(x, 245, x + 120, 190); }
  }
  setPlayerColor(color) { this.player.setFillStyle(Phaser.Display.Color.HexStringToColor(color).color); this.drawFace(); }
  drawFace() { if (!this.face || !this.player) return; const x = this.player.x; const y = this.player.y; this.face.clear(); this.face.fillStyle(0x10152c, 1); this.face.fillCircle(x - 6, y - 4, 2.5); this.face.fillCircle(x + 6, y - 4, 2.5); this.face.lineStyle(2.5, 0x10152c, 1); this.face.lineBetween(x - 6, y + 2, x - 3, y + 5); this.face.lineBetween(x - 3, y + 5, x + 3, y + 5); this.face.lineBetween(x + 3, y + 5, x + 6, y + 2); this.face.lineStyle(3, 0x10152c, 1); this.face.lineBetween(x - 7, y + 14, x - 9, y + 22); this.face.lineBetween(x + 7, y + 14, x + 9, y + 22); }
  collectPickup(pickup) { if (!pickup.active) return; pickup.destroy(); this.coins += pickup.isCrate ? CONFIG.crateValue : CONFIG.coinValue; if (pickup.isCrate) { unlockedColors.add(pickup.crateColor); updateColorPicker(); } $('score').textContent = this.coins; updateShop(); }
  update() { if (this.ended) return; const left = this.cursors.left.isDown || this.keys.A.isDown || this.touchLeft; const right = this.cursors.right.isDown || this.keys.D.isDown || this.touchRight; this.player.body.setVelocityX(left ? -CONFIG.playerSpeed : right ? CONFIG.playerSpeed : 0); const jump = Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.keys.W) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE) || this.touchJump; this.touchJump = false; if (jump && this.player.body.blocked.down) this.player.body.setVelocityY(CONFIG.jumpVelocity); this.drawFace(); if (this.player.y > CONFIG.height + 90 || this.time.now - this.startTime > CONFIG.levelTimeSeconds * 1000) this.finish(false); }
  finish(won) { if (this.ended) return; this.ended = true; this.physics.pause(); $('final-score').textContent = this.coins; $('end-title').textContent = won ? 'You did it!' : 'Game Over'; $('end-message').textContent = won ? 'You finished this run and earned a study reward.' : 'The obby changed for this run. Try again and look for a safer route!'; showScreen('end'); }
}

function startGame() { runNumber += 1; if (game) game.destroy(true); showScreen('game'); game = new Phaser.Game({ type: Phaser.AUTO, parent: 'game-container', width: CONFIG.width, height: CONFIG.height, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, physics: { default: 'arcade', arcade: { debug: false } }, scene: StudyScene }); }
function attachTouch() { document.querySelectorAll('[data-control]').forEach((button) => { const control = button.dataset.control; const set = (value) => { const scene = game?.scene?.getScene('StudyScene'); if (scene) scene[`touch${control[0].toUpperCase()}${control.slice(1)}`] = value; }; button.addEventListener('pointerdown', (event) => { event.preventDefault(); set(true); }); button.addEventListener('pointerup', () => set(false)); button.addEventListener('pointercancel', () => set(false)); button.addEventListener('pointerleave', () => set(false)); }); }

document.querySelectorAll('.action-button').forEach((button) => button.addEventListener('click', () => requestAI(button.dataset.action)));
$('student-work').addEventListener('input', () => { $('complete-activity').disabled = !$('student-work').value.trim(); });
$('step-help').addEventListener('click', requestStepHelp);
$('retry-answer').addEventListener('click', retryAnswer);
$('complete-activity').addEventListener('click', () => { $('ai-answer').textContent = currentAnswer; startGame(); });
$('play-again').addEventListener('click', () => { showScreen('start'); $('student-input').focus(); });
$('restart-top').addEventListener('click', () => { showScreen('start'); if (game) game.destroy(true); });
$('avatar-button').addEventListener('click', () => $('color-picker').classList.toggle('hidden'));
$('shop-toggle').addEventListener('click', () => { $('shop-panel').classList.toggle('hidden'); updateShop(); });
$('buy-color-pack').addEventListener('click', buyColorPack);
$('buy-decor-pack').addEventListener('click', buyDecorationPack);
updateColorPicker(); attachTouch();
