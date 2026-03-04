const TILE = 64;
const TILE_EMPTY = 0;
const TILE_SOLID = 1;
const TILE_LADDER = 2;
const TILE_BAR = 3;
const TILE_GOLD = 4;
const STEP_MS = 180;
const HOLE_TIMER = 33;
const ENEMY_STEP_MS = 240; // プレイヤー(180ms)よりやや遅い
const ENEMY_COUNT = 2;    // この数値を変えると敵の数が変わる
const ENEMY_RESPAWN_STEPS = 30; // 死亡後のリスポーンまでのステップ数(~5秒)

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
const player = { x: INITIAL_PLAYER.x, y: INITIAL_PLAYER.y, frame: 0, facing: 1, prevX: INITIAL_PLAYER.x, prevY: INITIAL_PLAYER.y };

const ENEMY_STARTS = [
  { x: 18, y: 12 },
  { x: 15, y:  3 },
  { x:  3, y:  5 },
];
function makeEnemies() {
  return ENEMY_STARTS.slice(0, ENEMY_COUNT).map(s => ({ x: s.x, y: s.y, alive: true, frame: 0, facing: -1, hasGold: false, respawnTimer: 0, prevX: s.x, prevY: s.y }));
}
let enemies = makeEnemies();

function tileAt(col, row) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return TILE_SOLID;
  return MAP[row][col];
}
function isSolid(col, row) { return tileAt(col, row) === TILE_SOLID; }
function isEnemyInHole(col, row) {
  return holes.some(h => h.col === col && h.row === row) &&
         enemies.some(e => e.alive && e.x === col && e.y === row);
}
// プレイヤー専用: 敵が穴にはまっている場合も「地面あり」とみなす
function isGroundForPlayer(col, row) { return isSolid(col, row) || isEnemyInHole(col, row); }
function isLadder(col, row) { return tileAt(col, row) === TILE_LADDER; }
function isBar(col, row)    { return tileAt(col, row) === TILE_BAR; }

// 金塊カウント
const INITIAL_LIVES = 3;
let lives = INITIAL_LIVES;
let score = 0;
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
  player.frame = 0;
  player.facing = 1;
  player.prevX = INITIAL_PLAYER.x;
  player.prevY = INITIAL_PLAYER.y;
  lives = INITIAL_LIVES;
  score = 0;
  totalGold = countGold(INITIAL_MAP);
  collectedGold = 0;
  cleared = false;
  holes = [];
  enemies = makeEnemies();
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
  if (!e.alive) {
    if (e.respawnTimer > 0) {
      e.respawnTimer--;
      if (e.respawnTimer === 0) {
        const start = ENEMY_STARTS[enemies.indexOf(e)];
        e.x = start.x;
        e.y = start.y;
        e.alive = true;
        if (e.hasGold && MAP[e.y][e.x] === TILE_EMPTY) {
          MAP[e.y][e.x] = TILE_GOLD;
        }
        e.hasGold = false;
      }
    }
    return;
  }

  e.prevX = e.x;
  e.prevY = e.y;
  const currentHole = holes.find(h => h.col === e.x && h.row === e.y);
  if (currentHole) {
    // 穴に落ちた瞬間、持っている金塊をすぐ手放す
    if (e.hasGold && MAP[e.y - 1][e.x] === TILE_EMPTY) {
      MAP[e.y - 1][e.x] = TILE_GOLD;
      e.hasGold = false;
    }
    // 残り時間が少なくなったらシェイク＆脱出を試みる
    if (currentHole.remaining <= Math.floor(HOLE_TIMER / 4)) {
      e.frame++;
      // 上が空いていれば脱出
      if (!isSolid(e.x, e.y - 1)) {
        e.y--;
        if (!isSolid(e.x - 1, e.y) && isSolid(e.x - 1, e.y + 1)) {
          e.x--; e.facing = -1;
        } else if (!isSolid(e.x + 1, e.y) && isSolid(e.x + 1, e.y + 1)) {
          e.x++; e.facing = 1;
        }
      }
    }
    return;
  }

  const onGround = isSolid(e.x, e.y + 1) || isEnemyInHole(e.x, e.y + 1);
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
      if (!isSolid(e.x + dir, e.y)) { e.x += dir; e.facing = dir; }
    }
    e.frame++;
    return;
  }

  // はしごで縦移動（高さを合わせる）
  if (onLadder && dy !== 0) {
    const dir = dy > 0 ? 1 : -1;
    if (!isSolid(e.x, e.y + dir)) { e.y += dir; e.frame++; return; }
  }
  // 上のはしごに入る
  if (dy < 0 && isLadder(e.x, e.y - 1) && !isSolid(e.x, e.y - 1)) {
    e.y--; e.frame++; return;
  }
  // 横移動
  if (dx !== 0) {
    const dir = dx > 0 ? 1 : -1;
    if (!isSolid(e.x + dir, e.y)) { e.x += dir; e.facing = dir; e.frame++; return; }
  }
  // 横に進めず高さが違う場合: 最寄りのはしごを目指す
  if (dy !== 0) {
    const ladderCol = findNearestLadder(e.x, e.y);
    if (ladderCol !== -1) {
      const dir = ladderCol > e.x ? 1 : -1;
      if (!isSolid(e.x + dir, e.y)) { e.x += dir; e.facing = dir; e.frame++; }
    }
  }

  // 金塊を拾う
  if (!e.hasGold && MAP[e.y][e.x] === TILE_GOLD) {
    MAP[e.y][e.x] = TILE_EMPTY;
    e.hasGold = true;
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
  player.prevX = player.x;
  player.prevY = player.y;
  const onLadder = isLadder(player.x, player.y);
  const onBar    = isBar(player.x, player.y);
  const onGround = isGroundForPlayer(player.x, player.y + 1);
  const falling  = !onGround && !onLadder && !onBar;

  if (falling) {
    if (!isGroundForPlayer(player.x, player.y + 1)) player.y += 1;
    return;
  }

  // 穴掘り
  if (keys['1']) tryDig(-1);
  if (keys['2']) tryDig(1);

  // 上（はしご）
  if ((keys['ArrowUp'] || keys['w']) && (onLadder || isLadder(player.x, player.y - 1))) {
    if (!isSolid(player.x, player.y - 1)) { player.y -= 1; player.frame++; }
  }
  // 下（はしご）: はしごを下る、または下端で↓を押したら落下
  if ((keys['ArrowDown'] || keys['s']) && (onLadder || onGround || onBar)) {
    if (!isSolid(player.x, player.y + 1)) { player.y += 1; player.frame++; }
  }
  // 左右
  if (keys['ArrowLeft'] || keys['a']) {
    player.facing = -1;
    if (!isSolid(player.x - 1, player.y)) { player.x -= 1; player.frame++; }
  }
  if (keys['ArrowRight'] || keys['d']) {
    player.facing = 1;
    if (!isSolid(player.x + 1, player.y)) { player.x += 1; player.frame++; }
  }

  // 穴の復活処理
  for (let i = holes.length - 1; i >= 0; i--) {
    holes[i].remaining--;
    if (holes[i].remaining <= 0) {
      for (const e of enemies) {
        if (e.alive && e.x === holes[i].col && e.y === holes[i].row) {
          e.alive = false;
          e.respawnTimer = ENEMY_RESPAWN_STEPS;
          score += 250;
        }
      }
      // プレイヤーが穴に埋まった
      if (player.x === holes[i].col && player.y === holes[i].row) {
        lives--;
        if (lives <= 0) {
          gameOver = true;
        } else {
          player.x = INITIAL_PLAYER.x;
          player.y = INITIAL_PLAYER.y;
          holes = [];
          MAP = cloneMap(INITIAL_MAP);
          let collected = 0;
          for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
              if (INITIAL_MAP[r][c] === TILE_GOLD && collected < collectedGold) {
                MAP[r][c] = TILE_EMPTY;
                collected++;
              }
            }
          }
          enemies = makeEnemies();
        }
        return;
      }
      MAP[holes[i].row][holes[i].col] = TILE_SOLID;
      holes.splice(i, 1);
    }
  }

  // 金塊取得
  if (MAP[player.y][player.x] === TILE_GOLD) {
    MAP[player.y][player.x] = TILE_EMPTY;
    collectedGold++;
    score += 100;
    if (collectedGold >= totalGold) cleared = true;
  }

}

function draw() {
  // 背景
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const t = MAP[row][col];
      const x = col * TILE;
      const y = row * TILE;

      const hole = holes.find(h => h.col === col && h.row === row);
      if (hole) {
        if (hole.remaining > 8 || Math.floor(hole.remaining / 2) % 2 === 0) {
          ctx.fillStyle = 'rgba(100, 40, 0, 0.6)';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = '#c0501a';
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
          ctx.setLineDash([]);
        }
        continue;
      }

      if (t === TILE_SOLID) {
        // レンガブロック
        ctx.fillStyle = '#7a3010';
        ctx.fillRect(x, y, TILE, TILE);
        // レンガ目地
        ctx.fillStyle = '#5a2008';
        const bh = TILE / 3; // 3段
        for (let bi = 0; bi < 3; bi++) {
          const by2 = y + bi * bh;
          ctx.fillRect(x, by2, TILE, 2); // 横目地
          const offset = bi % 2 === 0 ? 0 : TILE / 2;
          ctx.fillRect(x + offset, by2, 2, bh); // 縦目地
        }
        // ハイライト（上辺）
        ctx.fillStyle = 'rgba(255,200,150,0.15)';
        ctx.fillRect(x, y, TILE, 3);
      } else if (t === TILE_LADDER) {
        const lx1 = x + TILE * 0.28;
        const lx2 = x + TILE * 0.72;
        // レール
        ctx.strokeStyle = '#c8a000';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(lx1, y); ctx.lineTo(lx1, y + TILE); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(lx2, y); ctx.lineTo(lx2, y + TILE); ctx.stroke();
        // 横桟
        ctx.strokeStyle = '#f5d020';
        ctx.lineWidth = 3;
        const numRungs = 4;
        for (let i = 0; i < numRungs; i++) {
          const ry = y + TILE * (i + 0.5) / numRungs;
          ctx.beginPath(); ctx.moveTo(lx1, ry); ctx.lineTo(lx2, ry); ctx.stroke();
        }
        ctx.lineWidth = 1;
      } else if (t === TILE_BAR) {
        const by2 = y + TILE / 2;
        // 影
        ctx.fillStyle = '#444';
        ctx.fillRect(x, by2 - 2, TILE, 9);
        // 本体
        ctx.fillStyle = '#aaa';
        ctx.fillRect(x, by2 - 3, TILE, 6);
        // ハイライト
        ctx.fillStyle = '#ddd';
        ctx.fillRect(x, by2 - 3, TILE, 2);
      } else if (t === TILE_GOLD) {
        const gx = x + TILE / 2, gy = y + TILE / 2;
        // 外周グロー
        const glow = ctx.createRadialGradient(gx, gy, TILE * 0.1, gx, gy, TILE * 0.32);
        glow.addColorStop(0, '#fff7a0');
        glow.addColorStop(1, '#ffd700');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(gx, gy, TILE * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#b8860b';
        ctx.lineWidth = 2;
        ctx.stroke();
        // 光の点
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.arc(gx - TILE * 0.08, gy - TILE * 0.1, TILE * 0.07, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 1;
      }
    }
  }

  // HUD
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, 0, canvas.width, 70);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`SCORE: ${score}`, 8, 20);
  ctx.fillText(`金塊: ${collectedGold} / ${totalGold}`, 8, 40);
  ctx.fillStyle = '#ff6666';
  ctx.fillText(`${'♥'.repeat(lives)}`, 8, 60);

  // ゲームオーバー
  if (gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 16);
    ctx.fillStyle = '#aaa';
    ctx.font = '20px monospace';
    ctx.fillText('R キーでリスタート', canvas.width / 2, canvas.height / 2 + 24);
    ctx.textAlign = 'left';
    return;
  }

  // クリア
  if (cleared) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CLEAR!', canvas.width / 2, canvas.height / 2 - 16);
    ctx.fillStyle = '#aaa';
    ctx.font = '20px monospace';
    ctx.fillText('R キーでリスタート', canvas.width / 2, canvas.height / 2 + 24);
    ctx.textAlign = 'left';
    return;
  }

  // スムーズ移動の補間係数
  const pt = Math.min(accumulatedMs / STEP_MS, 1);
  const et = Math.min(enemyAccMs / ENEMY_STEP_MS, 1);

  // 敵描画
  for (const e of enemies) {
    if (!e.alive) continue;
    const inHole = holes.find(h => h.col === e.x && h.row === e.y);
    const shakeX = (inHole && inHole.remaining <= Math.floor(HOLE_TIMER / 2))
      ? (inHole.remaining % 2 === 0 ? 1 : -1) * 6
      : 0;
    const epx = (e.prevX + (e.x - e.prevX) * et) * TILE + shakeX;
    const epy = (e.prevY + (e.y - e.prevY) * et) * TILE;
    drawEnemy(epx, epy, e.frame, e.facing, e.x, e.y);
    if (e.hasGold) {
      ctx.fillStyle = '#ffd700';
      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(epx + TILE * 0.78, epy + TILE * 0.18, TILE * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }

  // プレイヤー描画
  const ppx = (player.prevX + (player.x - player.prevX) * pt) * TILE;
  const ppy = (player.prevY + (player.y - player.prevY) * pt) * TILE;
  drawPlayer(ppx, ppy, player.frame, player.facing, player.x, player.y);
}

function getCharState(x, y) {
  if (isBar(x, y)) return 'bar';
  if (isLadder(x, y)) return 'climb';
  if (!isSolid(x, y + 1) && !isLadder(x, y) && !isBar(x, y)) return 'fall';
  return 'walk';
}

function drawPixelSprite(pattern, palette, yOffset = 0) {
  const px = 4;
  const w = pattern[0].length;
  const h = pattern.length;
  const ox = Math.round((-w * px) / 2);
  const oy = Math.round(2 + yOffset);

  for (let r = 0; r < h; r++) {
    const row = pattern[r];
    for (let c = 0; c < w; c++) {
      const ch = row[c];
      if (ch === '.') continue;
      const color = palette[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(ox + c * px, oy + r * px, px, px);
    }
  }
}

const PLAYER_PALETTE = {
  k: '#110a05', // 輪郭
  h: '#5a2f14', // 髪
  s: '#f3c58f', // 肌
  b: '#2c57d9', // 青い服
  n: '#1c2b72', // 濃い青
  o: '#e9852f', // オレンジ
  w: '#f8f4ea', // 白目
};

const ENEMY_PALETTE = {
  k: '#0d0a07', // 輪郭
  w: '#e8dfc0', // フード（クリーム色）
  f: '#d4956a', // 顔（肌）
  g: '#9b2400', // ローブ（赤茶 ← 緑から変更）
  d: '#5e1500', // 暗いローブ（暗い赤茶 ← 暗い緑から変更）
  r: '#ff5533', // 目（赤く光る）
  o: '#7a3810', // 靴（茶色）
};

const PLAYER_WALK_A = [
  '..............',
  '...kkkkk......',
  '..khbbbk......',
  '..kbswwk......',
  '..kbsbbko.....',
  '..kbbbbbk.....',
  '..kbbbbbk.....',
  '...kboobk.....',
  '..kbnnnbk.....',
  '.kbbnnnbbk....',
  '.kbbnnnbbk....',
  '..kbonobk.....',
  '..kk....kk....',
  '..............',
];

const PLAYER_WALK_B = [
  '..............',
  '...kkkkk......',
  '..khbbbk......',
  '..kbswwk......',
  '..kbsbbko.....',
  '..kbbbbbk.....',
  '..kbbbbbk.....',
  '...kboobk.....',
  '..kbnnnbk.....',
  '.kbbnnnbbk....',
  '.kbbnnnbbk....',
  '..kbnobok.....',
  '...kk..kk.....',
  '..............',
];

const PLAYER_CLIMB_A = [
  '..............',
  '...kkkkk......',
  '..khbbbk......',
  '..kbswwk......',
  '.kkbsbbko.....',
  '.kbbbbbbk.....',
  '..kbbbbbk.....',
  '..kkboobk.....',
  '..kbnnnbkk....',
  '..kbnnnbbk....',
  '..kbnnnbk.....',
  '..kboonbk.....',
  '...kk..kk.....',
  '..............',
];

const PLAYER_CLIMB_B = [
  '..............',
  '...kkkkk......',
  '..khbbbk......',
  '..kbswwk......',
  '..kbsbbkk.....',
  '..kbbbbbk.....',
  '.kbbbbbbk.....',
  '.kboobkk......',
  '.kknnnbk......',
  '..kbnnnbk.....',
  '..kbnnnbk.....',
  '..kbonobk.....',
  '..kk....kk....',
  '..............',
];

const PLAYER_BAR = [
  '..kk....kk....',
  '..kb....bk....',
  '..kb....bk....',
  '..kkkkkkkk....',
  '...khbbbk.....',
  '...kbswwk.....',
  '...kbsbbko....',
  '...kbbbbbk....',
  '...kbbbbbk....',
  '....kboobk....',
  '...kbnnnbk....',
  '...kbnnnbk....',
  '...kboonbk....',
  '....kk..kk....',
];

const ENEMY_WALK_A = [
  '..............',
  '...kkkkkk.....',
  '..kwwffwwk....',
  '..kwwwfrwk....',
  '..kwwffwwk....',
  '...kggggk.....',
  '..kggggggk....',
  '..kggggggk....',
  '..kggddggk....',
  '..kggddggk....',
  '.kgggddgggk...',
  '..kggdooggk...',
  '...kk....kk...',
  '..............',
];

const ENEMY_WALK_B = [
  '..............',
  '...kkkkkk.....',
  '..kwwffwwk....',
  '..kwwwfrwk....',
  '..kwwffwwk....',
  '...kggggk.....',
  '..kggggggk....',
  '..kggggggk....',
  '..kggddggk....',
  '..kggddggk....',
  '.kgggddgggk...',
  '..kggdogogk...',
  '....kk..kk....',
  '..............',
];

const ENEMY_CLIMB_A = [
  '..............',
  '...kkkkkk.....',
  '..kwwffwwk....',
  '.kkwwwfrwk....',
  '.kwwwffwwk....',
  '..kggggggk....',
  '..kggggggk....',
  '..kkgddggk....',
  '..kggddggkk...',
  '..kggddgggk...',
  '..kggddggk....',
  '..kggdooggk...',
  '...kk....kk...',
  '..............',
];

const ENEMY_CLIMB_B = [
  '..............',
  '...kkkkkk.....',
  '..kwwffwwk....',
  '..kwwwfrwkk...',
  '..kwwwffwwk...',
  '..kggggggk....',
  '.kgggggggk....',
  '.kggddgkk.....',
  '.kkgddggk.....',
  '..kggddggk....',
  '..kggddggk....',
  '..kggdogogk...',
  '....kk..kk....',
  '..............',
];

const ENEMY_BAR = [
  '..kk....kk....',
  '..kw....wk....',
  '..kw....wk....',
  '..kkkkkkkk....',
  '..kwwffwwk....',
  '..kwwwfrwk....',
  '..kwwffwwk....',
  '..kggggggk....',
  '..kggggggk....',
  '...kgddggk....',
  '..kggddggk....',
  '..kggdooggk...',
  '...kk....kk...',
  '..............',
];

function drawPlayer(bx, by, frame, facing, logCol, logRow) {
  const state = getCharState(logCol, logRow);
  const cx = Math.round(bx + TILE / 2);
  const phase = frame % 2;
  const pattern =
    state === 'bar'
      ? PLAYER_BAR
      : state === 'climb'
        ? (phase === 0 ? PLAYER_CLIMB_A : PLAYER_CLIMB_B)
        : (phase === 0 ? PLAYER_WALK_A : PLAYER_WALK_B);

  ctx.save();
  ctx.translate(cx, by);
  if (facing < 0) ctx.scale(-1, 1);
  drawPixelSprite(pattern, PLAYER_PALETTE);
  ctx.restore();
}

function drawEnemy(bx, by, frame, facing, logCol, logRow) {
  const state = getCharState(logCol, logRow);
  const cx = Math.round(bx + TILE / 2);
  const phase = frame % 2;
  const pattern =
    state === 'bar'
      ? ENEMY_BAR
      : state === 'climb'
        ? (phase === 0 ? ENEMY_CLIMB_A : ENEMY_CLIMB_B)
        : (phase === 0 ? ENEMY_WALK_A : ENEMY_WALK_B);

  ctx.save();
  ctx.translate(cx, by);
  if (facing < 0) ctx.scale(-1, 1);
  drawPixelSprite(pattern, ENEMY_PALETTE);
  ctx.restore();
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
      if (enemies.some(e => e.alive && e.x === player.x && e.y === player.y && !holes.some(h => h.col === e.x && h.row === e.y))) {
        lives--;
        if (lives <= 0) {
          gameOver = true;
        } else {
          player.x = INITIAL_PLAYER.x;
          player.y = INITIAL_PLAYER.y;
          holes = [];
          MAP = cloneMap(INITIAL_MAP);
          // 取得済み金塊を除去
          let collected = 0;
          for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
              if (INITIAL_MAP[r][c] === TILE_GOLD && collected < collectedGold) {
                MAP[r][c] = TILE_EMPTY;
                collected++;
              }
            }
          }
          enemies = makeEnemies();
        }
      }
      enemyAccMs -= ENEMY_STEP_MS;
    }
  }

  draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
