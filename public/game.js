// Change these tuning numbers to adjust Version 1.
const CONFIG = {
  width: 860, // Game canvas width in pixels.
  height: 430, // Game canvas height in pixels.
  playerSpeed: 220, // Horizontal player speed.
  jumpVelocity: -410, // Upward jump strength.
  gravity: 900, // Downward pull.
  startingCoins: 0, // Coins at the start of a run.
  coinValue: 1, // Coins earned per pickup.
  maxInputLength: 5000, // Safety limit for student input.
  levelTimeSeconds: 75, // Friendly target length for this one-minute level.
};

const $ = (id) => document.getElementById(id);
const screens = { start: $('start-screen'), thinking: $('thinking'), game: $('game-screen'), end: $('end-screen') };
let game;
let currentAnswer = '';

function showScreen(name) { Object.entries(screens).forEach(([key, node]) => node.classList.toggle('hidden', key !== name)); }
function friendlyError() { $('ai-error').textContent = 'StudyAssistant could not answer. Please check the key and your internet connection, then try again.'; showScreen('start'); }

async function requestAI(action) {
  const message = $('student-input').value.trim();
  if (!message) { $('ai-error').textContent = 'Add a small question or piece of work first.'; return; }
  if (message.length > CONFIG.maxInputLength) { $('ai-error').textContent = 'Please make your input shorter.'; return; }
  $('ai-error').textContent = '';
  showScreen('thinking');
  try {
    const response = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, message }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    currentAnswer = data.answer;
    $('ai-answer').textContent = currentAnswer;
    $('score').textContent = CONFIG.startingCoins;
    showScreen('game');
    startGame();
  } catch (error) { friendlyError(); }
}

class StudyScene extends Phaser.Scene {
  constructor() { super('StudyScene'); }
  create() {
    this.coins = CONFIG.startingCoins;
    this.ended = false;
    this.cameras.main.setBackgroundColor('#243273');
    this.add.text(24, 18, 'Finish the level to earn your study reward!', { fontFamily: 'Arial', fontSize: '18px', color: '#dce2ff' });
    this.platforms = [];
    const platforms = [[90, 385, 180], [265, 330, 110], [415, 275, 120], [570, 350, 120], [730, 285, 120], [835, 385, 150]];
    platforms.forEach(([x, y, width]) => { const block = this.add.rectangle(x, y, width, 22, 0x91e6c7); this.physics.add.existing(block, true); this.platforms.push(block); });
    this.player = this.add.rectangle(55, 335, 26, 36, 0xf6cf68); this.physics.add.existing(this.player); this.player.body.setGravityY(CONFIG.gravity); this.player.body.setCollideWorldBounds(false);
    this.physics.add.collider(this.player, this.platforms);
    this.cursors = this.input.keyboard.createCursorKeys(); this.keys = this.input.keyboard.addKeys('W,A,D,SPACE');
    this.coinsGroup = []; [[260, 290], [415, 235], [570, 310], [730, 245]].forEach(([x, y]) => { const coin = this.add.circle(x, y, 9, 0xf6cf68); this.physics.add.existing(coin, true); this.coinsGroup.push(coin); });
    this.physics.add.overlap(this.player, this.coinsGroup, (_player, coin) => { coin.destroy(); this.coins += CONFIG.coinValue; $('score').textContent = this.coins; });
    this.goal = this.add.star(815, 335, 5, 18, 8, 0xff9eaa); this.physics.add.existing(this.goal, true);
    this.physics.add.overlap(this.player, this.goal, () => this.finish(true));
    this.startTime = this.time.now;
  }
  update() {
    if (this.ended) return;
    const left = this.cursors.left.isDown || this.keys.A.isDown || this.touchLeft;
    const right = this.cursors.right.isDown || this.keys.D.isDown || this.touchRight;
    this.player.body.setVelocityX(left ? -CONFIG.playerSpeed : right ? CONFIG.playerSpeed : 0);
    const jump = Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.keys.W) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE) || this.touchJump;
    this.touchJump = false;
    if (jump && this.player.body.blocked.down) this.player.body.setVelocityY(CONFIG.jumpVelocity);
    if (this.player.y > CONFIG.height + 50) this.finish(false);
    if (this.time.now - this.startTime > CONFIG.levelTimeSeconds * 1000) this.finish(false);
  }
  finish(won) { if (this.ended) return; this.ended = true; this.physics.pause(); $('final-score').textContent = this.coins; $('end-title').textContent = won ? 'You did it!' : 'Game Over'; $('end-message').textContent = won ? 'You finished the obby and earned a study reward.' : 'You fell off the path. Try the level again!'; showScreen('end'); }
}

function startGame() { if (game) game.destroy(true); game = new Phaser.Game({ type: Phaser.AUTO, parent: 'game-container', width: CONFIG.width, height: CONFIG.height, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, physics: { default: 'arcade', arcade: { debug: false } }, scene: StudyScene }); }
function attachTouch() { document.querySelectorAll('[data-control]').forEach((button) => { const control = button.dataset.control; const set = (value) => { if (game?.scene?.getScene('StudyScene')) game.scene.getScene('StudyScene')[`touch${control[0].toUpperCase()}${control.slice(1)}`] = value; }; button.addEventListener('pointerdown', () => set(true)); button.addEventListener('pointerup', () => set(false)); button.addEventListener('pointerleave', () => set(false)); }); }
document.querySelectorAll('.action-button').forEach((button) => button.addEventListener('click', () => requestAI(button.dataset.action)));
$('play-again').addEventListener('click', () => { showScreen('start'); $('student-input').focus(); });
$('restart-top').addEventListener('click', () => { showScreen('start'); if (game) game.destroy(true); });
attachTouch();
