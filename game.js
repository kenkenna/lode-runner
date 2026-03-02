const TILE = 48;
const TILE_EMPTY = 0;
const TILE_SOLID = 1;
const TILE_LADDER = 2;
const TILE_BAR = 3;
const TILE_GOLD = 4;
const STEP_MS = 120;
const HOLE_TIMER = 33;
const ENEMY_STEP_MS = 160; // プレイヤー(120ms)よりやや遅い
const ENEMY_COUNT = 2;    // この数値を変えると敵の数が変わる

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

const ENEMY_STARTS = [
  { x: 18, y: 12 },
  { x: 15, y:  3 },
  { x:  3, y:  5 },
];
let enemies = ENEMY_STARTS.slice(0, ENEMY_COUNT).map(s => ({ x: s.x, y: s.y, alive: true }));

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
  enemies = ENEMY_STARTS.slice(0, ENEMY_COUNT).map(s => ({ x: s.x, y: s.y, alive: true }));
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
function findNearestLadder(col, row) {
  for (let d = 1; d < COLS; d++) {
    if (col - d >= 0 && isLadder(col - d, row)) return col - d;
    if (col + d < COLS && isLadder(col + d, row)) return col + d;
  }
  return -1;
}

function updateEnemy(e) {
  if (!e.alive) return;

  const inHole = holes.some(h => h.col === e.x && h.row === e.y);
  if (inHole) return;

  const onGround = isSolid(e.x, e.y + 1);
  const onLadder = isLadder(e.x, e.y);
  const onBar    = isBar(e.x, e.y);
  const falling  = !onGround && !onLadder && !onBar;
  if (falling) { e.y++; return; }

  const dx = player.x - e.x;
  const dy = player.y - e.y;

  // 鉄骨上: 横移動のみ
  if (onBar) {
    if (dx !== 0) {
      const dir = dx > 0 ? 1 : -1;
      if (!isSolid(e.x + dir, e.y)) { e.x += dir; }
    }
    return;
  }

  // はしごで縦移動（高さを合わせる）
  if (onLadder && dy !== 0) {
    const dir = dy > 0 ? 1 : -1;
    if (!isSolid(e.x, e.y + dir)) { e.y += dir; return; }
  }
  // 上のはしごに入る
  if (dy < 0 && isLadder(e.x, e.y - 1) && !isSolid(e.x, e.y - 1)) {
    e.y--; return;
  }
  // 横移動
  if (dx !== 0) {
    const dir = dx > 0 ? 1 : -1;
    if (!isSolid(e.x + dir, e.y)) { e.x += dir; return; }
  }
  // 横に進めず高さが違う場合: 最寄りのはしごを目指す
  if (dy !== 0) {
    const ladderCol = findNearestLadder(e.x, e.y);
    if (ladderCol !== -1) {
      const dir = ladderCol > e.x ? 1 : -1;
      if (!isSolid(e.x + dir, e.y)) { e.x += dir; }
    }
  }
}

function tryDig(direction) {
  const onLadder = isLadder(player.x, player.y);
  const onBar    = isBar(player.x, player.y);
  const onGround = isSolid(player.x, player.y + 1);
  const falling  = !onGround && !onLadder && !onBar;
  if (falling || onBar) return;

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
  if ((keys['ArrowDown'] || keys['s']) && (onLadder || onGround || onBar)) {
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
      for (const e of enemies) {
        if (e.alive && e.x === holes[i].col && e.y === holes[i].row) {
          e.alive = false;
        }
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
        const lx1 = x + TILE * 0.3;
        const lx2 = x + TILE * 0.7;
        ctx.strokeStyle = '#f5c518';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(lx1, y); ctx.lineTo(lx1, y + TILE); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(lx2, y); ctx.lineTo(lx2, y + TILE); ctx.stroke();
        const numRungs = Math.max(3, Math.floor(TILE / 12));
        for (let i = 0; i < numRungs; i++) {
          const hy = y + TILE * (i + 1) / (numRungs + 1);
          ctx.beginPath(); ctx.moveTo(lx1, hy); ctx.lineTo(lx2, hy); ctx.stroke();
        }
        ctx.lineWidth = 1;
      } else if (t === TILE_BAR) {
        ctx.fillStyle = '#888';
        ctx.fillRect(x, y + TILE / 2 - 3, TILE, 6);
      } else if (t === TILE_GOLD) {
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(x + TILE / 2, y + TILE / 2, TILE * 0.25, 0, Math.PI * 2);
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
  for (const e of enemies) {
    if (!e.alive) continue;
    const ex = e.x * TILE;
    const ey = e.y * TILE;
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(ex + TILE * 0.25, ey + TILE * 0.31, TILE * 0.5, TILE * 0.5);
    ctx.fillStyle = '#ffcccc';
    ctx.beginPath();
    ctx.arc(ex + TILE * 0.5, ey + TILE * 0.22, TILE * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }

  // プレイヤー
  const px = player.x * TILE;
  const py = player.y * TILE;
  ctx.fillStyle = '#00bfff';
  ctx.fillRect(px + TILE * 0.25, py + TILE * 0.31, TILE * 0.5, TILE * 0.5);
  ctx.fillStyle = '#ffe4b5';
  ctx.beginPath();
  ctx.arc(px + TILE * 0.5, py + TILE * 0.22, TILE * 0.22, 0, Math.PI * 2);
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
      for (const e of enemies) updateEnemy(e);
      if (enemies.some(e => e.alive && e.x === player.x && e.y === player.y)) {
        gameOver = true;
      }
      enemyAccMs -= ENEMY_STEP_MS;
    }
  }

  draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
