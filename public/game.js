// Tuning numbers live here so the game is easy to adjust.
const CONFIG = {
  width: 900, // Camera width in pixels.
  height: 520, // Camera height in pixels.
  playerSpeed: 245, // Horizontal player speed.
  jumpVelocity: -470, // Upward jump strength.
  gravity: 1120, // Downward pull.
  levelPlatforms: 24, // Number of generated platforms in one run.
  platformGapMin: 95, // Minimum horizontal gap between platform centers.
  platformGapMax: 145, // Maximum horizontal gap between platform centers.
  levelTimeSeconds: 110, // Maximum time for the longer challenge.
  coinValue: 1, // Coins earned per coin pickup.
  crateValue: 3, // Coins earned per color crate.
  maxInputLength: 5000, // Safety limit for student writing.
};

const $ = (id) => document.getElementById(id);
const screens = { start: $('start-screen'), thinking: $('thinking'), activity: $('activity-screen'), game: $('game-screen'), end: $('end-screen') };
const COLORS = ['#ffffff', '#91e6c7', '#f6cf68', '#ff9eaa', '#9bb7ff', '#d7a7ff', '#ffb86b', '#63d7e8', '#f38ba8', '#b8e986'];
let game;
let currentAnswer = '';
let unlockedColors = new Set(['#ffffff']);
let selectedColor = '#ffffff';
let runNumber = 0;

function showScreen(name) { Object.entries(screens).forEach(([key, node]) => node.classList.toggle('hidden', key !== name)); }
function friendlyError() { $('ai-error').textContent = 'StudyAssistant could not answer. Please check the key and your internet connection, then try again.'; showScreen('start'); }
function updateColorPicker() {
  const picker = $('color-picker'); picker.innerHTML = '';
  COLORS.forEach((color) => { const button = document.createElement('button'); button.style.background = color; button.title = unlockedColors.has(color) ? 'Choose this color' : 'Locked: find a crate'; button.className = unlockedColors.has(color) ? '' : 'locked'; button.disabled = !unlockedColors.has(color); button.addEventListener('click', () => { selectedColor = color; $('avatar-button').style.background = color; $('avatar-face').style.background = color === '#ffffff' ? '#10152c' : '#fff'; game?.scene?.getScene('StudyScene')?.setPlayerColor(color); picker.classList.add('hidden'); }); picker.appendChild(button); });
}
function showStudyActivity() { $('activity-answer').textContent = currentAnswer; $('student-work').value = ''; $('complete-activity').disabled = true; showScreen('activity'); $('student-work').focus(); }
async function requestAI(action) {
  const message = $('student-input').value.trim();
  if (!message) { $('ai-error').textContent = 'Add a small question or piece of work first.'; return; }
  if (message.length > CONFIG.maxInputLength) { $('ai-error').textContent = 'Please make your input shorter.'; return; }
  $('ai-error').textContent = ''; showScreen('thinking');
  try { const response = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, message }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); currentAnswer = data.answer; showStudyActivity(); }
  catch (error) { friendlyError(); }
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
    $('score').textContent = '0'; $('run-label').textContent = `Run ${runNumber} · Reach the star!`; this.startTime = this.time.now;
  }
  makeLayout() {
    const platforms = [{ x: 0, y: 465, w: 190, spikes: false, crate: false }]; let nextX = 125;
    for (let i = 1; i < CONFIG.levelPlatforms; i += 1) { const gap = this.random.between(CONFIG.platformGapMin, CONFIG.platformGapMax); nextX += gap; const previous = platforms[i - 1]; const y = Phaser.Math.Clamp(previous.y + this.random.between(-68, 68), 270, 465); platforms.push({ x: nextX, y, w: this.random.between(112, 165), spikes: i > 2 && this.random.frac() > 0.52, crate: i > 1 && i % 3 === 0 }); }
    return { platforms, worldWidth: nextX + 260 };
  }
  drawBackdrop() {
    const graphics = this.add.graphics(); graphics.fillStyle(0x1d2b65, 1); graphics.fillRect(0, 0, this.worldWidth, CONFIG.height); graphics.lineStyle(2, 0x33488f, .7); for (let x = 0; x < this.worldWidth; x += 120) { graphics.lineBetween(x, 0, x + 250, CONFIG.height); graphics.lineBetween(x, CONFIG.height, x + 250, 0); }
    this.add.text(22, 24, 'Study obby · collect coins and color crates', { fontFamily: 'Arial', fontSize: '18px', color: '#dce2ff' }).setScrollFactor(0);
  }
  makePlatform(platform, index) {
    const top = this.add.rectangle(platform.x + platform.w / 2, platform.y, platform.w, 22, 0x91e6c7); this.physics.add.existing(top, true); this.platforms.push(top);
    const face = this.add.graphics(); face.fillStyle(0x4b6b8a, 1); face.fillPoints([{ x: platform.x, y: platform.y + 11 }, { x: platform.x + platform.w, y: platform.y + 11 }, { x: platform.x + platform.w - 16, y: platform.y + 30 }, { x: platform.x + 16, y: platform.y + 30 }], true); face.lineStyle(2, 0x91e6c7, .8); face.strokePoints([{ x: platform.x, y: platform.y + 11 }, { x: platform.x + platform.w, y: platform.y + 11 }, { x: platform.x + platform.w - 16, y: platform.y + 30 }, { x: platform.x + 16, y: platform.y + 30 }, { x: platform.x, y: platform.y + 11 }], true);
    if (platform.spikes) { const spikeX = platform.x + platform.w * .55; const spikes = this.add.triangle(spikeX, platform.y - 22, 0, 22, 18, 0, 36, 22, 0xff6b88); this.physics.add.existing(spikes, true); this.hazards.push(spikes); }
    if (index > 0) { const below = this.add.triangle(platform.x - 18, platform.y + 75, 0, 34, 20, 0, 40, 34, 0xff6b88); this.physics.add.existing(below, true); this.hazards.push(below); }
    if (platform.crate) { const crate = this.add.rectangle(platform.x + platform.w * .28, platform.y - 38, 24, 24, Phaser.Display.Color.HexStringToColor(COLORS[(index / 3) % COLORS.length]).color); this.physics.add.existing(crate, true); crate.crateColor = COLORS[(index / 3) % COLORS.length]; crate.isCrate = true; this.pickups.push(crate); }
    if (index % 2 === 0 && index > 0) { const coin = this.add.circle(platform.x + platform.w * .72, platform.y - 34, 9, 0xf6cf68); this.physics.add.existing(coin, true); coin.isCoin = true; this.pickups.push(coin); }
  }
  setPlayerColor(color) { this.player.setFillStyle(Phaser.Display.Color.HexStringToColor(color).color); this.drawFace(); }
  drawFace() { if (!this.face || !this.player) return; const x = this.player.x; const y = this.player.y; this.face.clear(); this.face.fillStyle(0x10152c, 1); this.face.fillCircle(x - 6, y - 4, 2.5); this.face.fillCircle(x + 6, y - 4, 2.5); this.face.lineStyle(2.5, 0x10152c, 1); this.face.lineBetween(x - 6, y + 2, x - 3, y + 5); this.face.lineBetween(x - 3, y + 5, x + 3, y + 5); this.face.lineBetween(x + 3, y + 5, x + 6, y + 2); this.face.lineStyle(3, 0x10152c, 1); this.face.lineBetween(x - 7, y + 14, x - 9, y + 22); this.face.lineBetween(x + 7, y + 14, x + 9, y + 22); }
  collectPickup(pickup) { if (!pickup.active) return; pickup.destroy(); this.coins += pickup.isCrate ? CONFIG.crateValue : CONFIG.coinValue; if (pickup.isCrate) { unlockedColors.add(pickup.crateColor); updateColorPicker(); } $('score').textContent = this.coins; }
  update() { if (this.ended) return; const left = this.cursors.left.isDown || this.keys.A.isDown || this.touchLeft; const right = this.cursors.right.isDown || this.keys.D.isDown || this.touchRight; this.player.body.setVelocityX(left ? -CONFIG.playerSpeed : right ? CONFIG.playerSpeed : 0); const jump = Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.keys.W) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE) || this.touchJump; this.touchJump = false; if (jump && this.player.body.blocked.down) this.player.body.setVelocityY(CONFIG.jumpVelocity); this.drawFace(); if (this.player.y > CONFIG.height + 90 || this.time.now - this.startTime > CONFIG.levelTimeSeconds * 1000) this.finish(false); }
  finish(won) { if (this.ended) return; this.ended = true; this.physics.pause(); $('final-score').textContent = this.coins; $('end-title').textContent = won ? 'You did it!' : 'Game Over'; $('end-message').textContent = won ? 'You finished this run and earned a study reward.' : 'The obby changed for this run. Try again and look for a safer route!'; showScreen('end'); }
}

function startGame() { runNumber += 1; if (game) game.destroy(true); showScreen('game'); game = new Phaser.Game({ type: Phaser.AUTO, parent: 'game-container', width: CONFIG.width, height: CONFIG.height, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, physics: { default: 'arcade', arcade: { debug: false } }, scene: StudyScene }); }
function attachTouch() { document.querySelectorAll('[data-control]').forEach((button) => { const control = button.dataset.control; const set = (value) => { const scene = game?.scene?.getScene('StudyScene'); if (scene) scene[`touch${control[0].toUpperCase()}${control.slice(1)}`] = value; }; button.addEventListener('pointerdown', (event) => { event.preventDefault(); set(true); }); button.addEventListener('pointerup', () => set(false)); button.addEventListener('pointercancel', () => set(false)); button.addEventListener('pointerleave', () => set(false)); }); }

document.querySelectorAll('.action-button').forEach((button) => button.addEventListener('click', () => requestAI(button.dataset.action)));
$('student-work').addEventListener('input', () => { $('complete-activity').disabled = !$('student-work').value.trim(); });
$('complete-activity').addEventListener('click', () => { $('ai-answer').textContent = currentAnswer; startGame(); });
$('play-again').addEventListener('click', () => { showScreen('start'); $('student-input').focus(); });
$('restart-top').addEventListener('click', () => { showScreen('start'); if (game) game.destroy(true); });
$('avatar-button').addEventListener('click', () => $('color-picker').classList.toggle('hidden'));
updateColorPicker(); attachTouch();
