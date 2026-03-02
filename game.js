const TILE = 32;
const TILE_EMPTY = 0;
const TILE_SOLID = 1;
const TILE_LADDER = 2;
const TILE_BAR = 3;
const TILE_GOLD = 4;
const STEP_MS = 120;
const HOLE_TIMER = 33;
const ENEMY_STEP_MS = 160; // プレイヤー(120ms)よりやや遅い

// マップ定義
// 0: 空, 1: レンガ, 2: はしご, 3: 鉄骨, 4: 金塊
//
// 構造:
//   はしごは col=8 を縦断。左右交互に足場が現れるジグザグ構成。
//   鉄骨は row5 の右側 (col 9-16) に空中配置。
//   金塊はすべて「プレイヤーが立てる行」に配置。
//
//         row 13: 全面地面(レンガ)
//         row 12: 地面レベル(プレイヤーが歩く)
//         row 10: 左側レンガ(col 0-7) → プレイヤーは row9 を歩く
//         row  8: 右側レンガ(col 9-19) → プレイヤーは row7 を歩く
//         row  6: 左側レンガ(col 0-7) → プレイヤーは row5 を歩く
//         row  5: 右側に鉄骨(col 9-16) → はしごから右足場へ渡る橋
//         row  4: 右側レンガ(col 9-19) → プレイヤーは row3 を歩く
//         row  2: 左側レンガ(col 0-7) → プレイヤーは row1 を歩く
const INITIAL_MAP = [
  //  0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19
  [  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ],  // 0
  [  0, 4, 0, 0, 0, 4, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ],  // 1 ← 左台・金塊
  [  1, 1, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ],  // 2   左台レンガ
  [  0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 4, 0, 0, 4, 0, 0, 4, 0, 0 ],  // 3 ← 右台・金塊
  [  0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ],  // 4   右台レンガ
  [  0, 4, 0, 0, 4, 0, 4, 0, 2, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0 ],  // 5 ← 左台・金塊 + 鉄骨(右)
  [  1, 1, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ],  // 6   左台レンガ
  [  0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 4, 0, 0, 4, 0, 0, 4, 0, 0, 0 ],  // 7 ← 右台・金塊
  [  0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ],  // 8   右台レンガ
  [  0, 4, 0, 4, 0, 4, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ],  // 9 ← 左台・金塊
  [  1, 1, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ],  // 10  左台レンガ
  [  0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ],  // 11
  [  0, 4, 0, 0, 0, 4, 0, 0, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0, 4 ],  // 12  地面レベル・金塊
  [  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ],  // 13  地面
];

function cloneMap(map) {
  return map.map(row => row.slice());
}

function countGold(map) {
  let count = 0;
  for (let r = 0; r < map.length; r++) {
    for (let c = 0; c < map[0].length; c++) {
      if (map[r][c] === TILE_GOLD) count++;
    }
  }
  return count;
}

let MAP = cloneMap(INITIAL_MAP);

const COLS = INITIAL_MAP[0].length;
const ROWS = INITIAL_MAP.length;

const canvas = document.getElementById('canvas');
canvas.width  = COLS * TILE;
canvas.height = ROWS * TILE;
const ctx = canvas.getContext('2d');

const INITIAL_PLAYER = { x: 1, y: 12 };
const player = { x: INITIAL_PLAYER.x, y: INITIAL_PLAYER.y };

const INITIAL_ENEMY = { x: 18, y: 12 };
let enemy = { x: INITIAL_ENEMY.x, y: INITIAL_ENEMY.y };

function tileAt(col, row) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return TILE_SOLID;
  return MAP[row][col];
}
function isSolid(col, row) { return tileAt(col, row) === TILE_SOLID; }
function isLadder(col, row) { return tileAt(col, row) === TILE_LADDER; }
function isBar(col, row)    { return tileAt(col, row) === TILE_BAR; }

// 金塊カウント
let totalGold = countGold(INITIAL_MAP);
let collectedGold = 0;
let cleared = false;
let holes = []; // { col, row, remaining }
let enemyAlive = true;
let gameOver = false;
let enemyAccMs = 0;

const keys = {};
let accumulatedMs = 0;
let lastTimestamp = null;

function resetGame() {
  MAP = cloneMap(INITIAL_MAP);
  player.x = INITIAL_PLAYER.x;
  player.y = INITIAL_PLAYER.y;
  totalGold = countGold(INITIAL_MAP);
  collectedGold = 0;
  cleared = false;
  holes = [];
  enemy.x = INITIAL_ENEMY.x;
  enemy.y = INITIAL_ENEMY.y;
  enemyAlive = true;
  gameOver = false;
  enemyAccMs = 0;
  accumulatedMs = 0;
  lastTimestamp = null;

  for (const key in keys) {
    delete keys[key];
  }
}

window.addEventListener('keydown', e => {
  if (e.key === 'r' || e.key === 'R') {
    resetGame();
    e.preventDefault();
    return;
  }
  keys[e.key] = true;
  e.preventDefault();
});
window.addEventListener('keyup', e => {
  keys[e.key] = false;
});
function updateEnemy() {
  if (!enemyAlive) return;

  const inHole = holes.some(h => h.col === enemy.x && h.row === enemy.y);
  if (inHole) return;

  const onGround = isSolid(enemy.x, enemy.y + 1);
  const onLadder = isLadder(enemy.x, enemy.y);
  const onBar    = isBar(enemy.x, enemy.y);
  const falling  = !onGround && !onLadder && !onBar;
  if (falling) { enemy.y++; return; }

  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;

  if (onLadder && dy !== 0) {
    const dir = dy > 0 ? 1 : -1;
    if (!isSolid(enemy.x, enemy.y + dir)) { enemy.y += dir; return; }
  }
  if (dy < 0 && isLadder(enemy.x, enemy.y - 1) && !isSolid(enemy.x, enemy.y - 1)) {
    enemy.y--; return;
  }
  if (dx !== 0) {
    const dir = dx > 0 ? 1 : -1;
    if (!isSolid(enemy.x + dir, enemy.y)) { enemy.x += dir; return; }
  }
}

function tryDig(direction) {
  const onLadder = isLadder(player.x, player.y);
  const onBar    = isBar(player.x, player.y);
  const onGround = isSolid(player.x, player.y + 1);
  const falling  = !onGround && !onLadder && !onBar;
  if (falling) return;

  const tc = player.x + direction;
  const tr = player.y + 1;
  if (tileAt(tc, tr) !== TILE_SOLID) return;
  if (holes.some(h => h.col === tc && h.row === tr)) return;

  MAP[tr][tc] = TILE_EMPTY;
  holes.push({ col: tc, row: tr, remaining: HOLE_TIMER });
}

function updateStep() {
  const onLadder = isLadder(player.x, player.y);
  const onBar    = isBar(player.x, player.y);
  const onGround = isSolid(player.x, player.y + 1);
  const falling  = !onGround && !onLadder && !onBar;

  if (falling) {
    if (!isSolid(player.x, player.y + 1)) player.y += 1;
    return;
  }

  // 穴掘り
  if (keys['1']) tryDig(-1);
  if (keys['2']) tryDig(1);

  // 上（はしご）
  if ((keys['ArrowUp'] || keys['w']) && (onLadder || isLadder(player.x, player.y - 1))) {
    if (!isSolid(player.x, player.y - 1)) player.y -= 1;
  }
  // 下（はしご）: はしごを下る、または下端で↓を押したら落下
  if ((keys['ArrowDown'] || keys['s']) && (onLadder || onGround)) {
    if (!isSolid(player.x, player.y + 1)) player.y += 1;
  }
  // 左右
  if (keys['ArrowLeft'] || keys['a']) {
    if (!isSolid(player.x - 1, player.y)) player.x -= 1;
  }
  if (keys['ArrowRight'] || keys['d']) {
    if (!isSolid(player.x + 1, player.y)) player.x += 1;
  }

  // 穴の復活処理
  for (let i = holes.length - 1; i >= 0; i--) {
    holes[i].remaining--;
    if (holes[i].remaining <= 0) {
      if (enemy.x === holes[i].col && enemy.y === holes[i].row) {
        enemyAlive = false;
      }
      MAP[holes[i].row][holes[i].col] = TILE_SOLID;
      holes.splice(i, 1);
    }
  }

  // 金塊取得
  if (MAP[player.y][player.x] === TILE_GOLD) {
    MAP[player.y][player.x] = TILE_EMPTY;
    collectedGold++;
    if (collectedGold >= totalGold) cleared = true;
  }

}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const t = MAP[row][col];
      const x = col * TILE;
      const y = row * TILE;

      const hole = holes.find(h => h.col === col && h.row === row);
      if (hole) {
        // 掘られた穴（点滅: 残り8ステップ以下）
        if (hole.remaining > 8 || Math.floor(hole.remaining / 2) % 2 === 0) {
          ctx.fillStyle = 'rgba(80, 30, 0, 0.5)';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = '#7a3b1e';
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
          ctx.setLineDash([]);
        }
        continue;
      }

      if (t === TILE_SOLID) {
        ctx.fillStyle = '#a0522d';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = '#7a3b1e';
        ctx.strokeRect(x, y, TILE, TILE);
      } else if (t === TILE_LADDER) {
        ctx.strokeStyle = '#f5c518';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x + 10, y); ctx.lineTo(x + 10, y + TILE); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 22, y); ctx.lineTo(x + 22, y + TILE); ctx.stroke();
        for (let i = 0; i < 3; i++) {
          const hy = y + 6 + i * 10;
          ctx.beginPath(); ctx.moveTo(x + 10, hy); ctx.lineTo(x + 22, hy); ctx.stroke();
        }
        ctx.lineWidth = 1;
      } else if (t === TILE_BAR) {
        ctx.fillStyle = '#888';
        ctx.fillRect(x, y + TILE / 2 - 3, TILE, 6);
      } else if (t === TILE_GOLD) {
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(x + TILE / 2, y + TILE / 2, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#b8860b';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    }
  }

  // スコア
  ctx.fillStyle = '#fff';
  ctx.font = '16px monospace';
  ctx.fillText(`金塊: ${collectedGold} / ${totalGold}`, 8, 20);

  // ゲームオーバー
  if (gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
    ctx.textAlign = 'left';
    return;
  }

  // クリア
  if (cleared) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CLEAR!', canvas.width / 2, canvas.height / 2);
    ctx.textAlign = 'left';
    return;
  }

  // 敵
  if (enemyAlive) {
    const ex = enemy.x * TILE;
    const ey = enemy.y * TILE;
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(ex + 8, ey + 10, 16, 16);
    ctx.fillStyle = '#ffcccc';
    ctx.beginPath();
    ctx.arc(ex + 16, ey + 7, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // プレイヤー
  const px = player.x * TILE;
  const py = player.y * TILE;
  ctx.fillStyle = '#00bfff';
  ctx.fillRect(px + 8, py + 10, 16, 16);
  ctx.fillStyle = '#ffe4b5';
  ctx.beginPath();
  ctx.arc(px + 16, py + 7, 7, 0, Math.PI * 2);
  ctx.fill();
}

function loop(timestamp) {
  if (lastTimestamp === null) lastTimestamp = timestamp;
  const delta = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  if (!cleared && !gameOver) {
    accumulatedMs += delta;
    while (accumulatedMs >= STEP_MS) {
      updateStep();
      accumulatedMs -= STEP_MS;
    }

    enemyAccMs += delta;
    while (enemyAccMs >= ENEMY_STEP_MS) {
      updateEnemy();
      if (enemyAlive && enemy.x === player.x && enemy.y === player.y) {
        gameOver = true;
      }
      enemyAccMs -= ENEMY_STEP_MS;
    }
  }

  draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
