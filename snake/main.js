/**
 * 贪吃蛇界面：负责绘制棋盘、处理键盘 / 触屏输入以及游戏循环。
 * 游戏规则（移动、碰撞、计分等）在 snake.js 中实现。
 */
(function () {
  'use strict';

  const { DIRECTIONS, Game, getTickInterval } = window.SnakeGame;

  const COLS = 20;
  const ROWS = 20;
  const BEST_SCORE_KEY = 'snake.bestScore';
  // 手指滑动超过这个距离（CSS 像素）才算一次转向
  const SWIPE_THRESHOLD = 24;

  const KEY_TO_DIRECTION = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    KeyW: 'up',
    KeyS: 'down',
    KeyA: 'left',
    KeyD: 'right',
  };

  const COLORS = {
    tileLight: '#1d2a41',
    tileDark: '#18233a',
    food: '#f43f5e',
    foodShine: 'rgba(255, 255, 255, 0.55)',
    eye: '#0f172a',
    deadHead: '#ef4444',
  };

  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayText = document.getElementById('overlay-text');
  const overlayButton = document.getElementById('overlay-button');
  const pauseButton = document.getElementById('pause-button');

  const game = new Game({ cols: COLS, rows: ROWS });
  // 'ready' 未开始 | 'running' 进行中 | 'paused' 已暂停 | 'over' 已结束（失败或通关）
  let phase = 'ready';
  let timer = null;
  let bestScore = loadBestScore();
  let bestBeforeRound = bestScore;
  let swipe = null;

  // ---------- 最高分 ----------

  function loadBestScore() {
    try {
      const value = Number.parseInt(localStorage.getItem(BEST_SCORE_KEY), 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (error) {
      return 0; // 部分浏览器的隐私模式不允许访问 localStorage
    }
  }

  function saveBestScore(value) {
    try {
      localStorage.setItem(BEST_SCORE_KEY, String(value));
    } catch (error) {
      // 保存失败时忽略即可，不影响游戏
    }
  }

  // ---------- 游戏流程 ----------

  function setPhase(next) {
    phase = next;
    pauseButton.disabled = phase !== 'running' && phase !== 'paused';
    pauseButton.textContent = phase === 'paused' ? '继续' : '暂停';
  }

  function startGame() {
    clearTimeout(timer);
    game.reset();
    bestBeforeRound = bestScore;
    setPhase('running');
    hideOverlay();
    updateScoreboard();
    render();
    scheduleTick();
  }

  function pauseGame() {
    if (phase !== 'running') {
      return;
    }
    clearTimeout(timer);
    setPhase('paused');
    showOverlay('已暂停', '休息一下，准备好了就继续吧。', '继续游戏');
  }

  function resumeGame() {
    if (phase !== 'paused') {
      return;
    }
    setPhase('running');
    hideOverlay();
    scheduleTick();
  }

  function togglePause() {
    if (phase === 'running') {
      pauseGame();
    } else if (phase === 'paused') {
      resumeGame();
    }
  }

  /** 空格 / 回车 / 遮罩上的按钮：开始、暂停、继续或重新开始 */
  function primaryAction() {
    if (phase === 'running' || phase === 'paused') {
      togglePause();
    } else {
      startGame();
    }
  }

  /** 方向输入；还没开始时会直接开始游戏 */
  function steer(direction) {
    if (phase === 'ready') {
      startGame();
    }
    if (phase === 'running') {
      game.turn(direction);
    }
  }

  function scheduleTick() {
    clearTimeout(timer);
    timer = setTimeout(tick, getTickInterval(game.score));
  }

  function tick() {
    game.step();
    if (game.score > bestScore) {
      bestScore = game.score;
      saveBestScore(bestScore);
    }
    updateScoreboard();
    render();

    if (game.status === 'playing') {
      scheduleTick();
    } else {
      endGame();
    }
  }

  function endGame() {
    setPhase('over');
    const record = game.score > bestBeforeRound ? '，新纪录！🎉' : '';
    if (game.status === 'won') {
      showOverlay('恭喜通关！', `蛇已经占满了整个棋盘，得分 ${game.score}${record}`, '再玩一次');
    } else {
      showOverlay('游戏结束', `本局得分 ${game.score}${record}`, '再玩一次');
    }
  }

  // ---------- 界面 ----------

  function showOverlay(title, text, buttonLabel) {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    overlayButton.textContent = buttonLabel;
    overlay.hidden = false;
  }

  function hideOverlay() {
    if (overlay.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    overlay.hidden = true;
  }

  function updateScoreboard() {
    scoreEl.textContent = String(game.score);
    bestEl.textContent = String(bestScore);
  }

  // ---------- 绘制 ----------

  function resizeCanvas() {
    // 按设备像素比设置画布分辨率，高清屏上也能保持清晰
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = Math.round(rect.width * ratio);
    const height = Math.round(rect.height * ratio);
    if (width > 0 && height > 0 && (canvas.width !== width || canvas.height !== height)) {
      canvas.width = width;
      canvas.height = height;
    }
    render();
  }

  function render() {
    const cell = canvas.width / COLS;
    drawBoard(cell);
    if (game.food) {
      drawFood(game.food, cell);
    }
    drawSnake(cell);
  }

  function drawBoard(cell) {
    ctx.fillStyle = COLORS.tileDark;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = COLORS.tileLight;
    for (let y = 0; y < ROWS; y++) {
      for (let x = y % 2; x < COLS; x += 2) {
        const left = Math.round(x * cell);
        const top = Math.round(y * cell);
        ctx.fillRect(left, top, Math.round((x + 1) * cell) - left, Math.round((y + 1) * cell) - top);
      }
    }
  }

  function drawFood({ x, y }, cell) {
    const cx = (x + 0.5) * cell;
    const cy = (y + 0.5) * cell;
    fillCircle(cx, cy, cell * 0.36, COLORS.food);
    fillCircle(cx - cell * 0.12, cy - cell * 0.12, cell * 0.1, COLORS.foodShine);
  }

  function drawSnake(cell) {
    const { snake } = game;
    const inset = cell * 0.08;
    const size = cell - inset * 2;
    snake.forEach(({ x, y }, index) => {
      // 从蛇头到蛇尾颜色逐渐变深
      const lightness = 58 - (22 * index) / Math.max(1, snake.length - 1);
      ctx.fillStyle = index === 0 && game.status === 'over'
        ? COLORS.deadHead
        : `hsl(142, 70%, ${lightness}%)`;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x * cell + inset, y * cell + inset, size, size, cell * 0.3);
      } else {
        ctx.rect(x * cell + inset, y * cell + inset, size, size);
      }
      ctx.fill();
    });
    drawEyes(snake[0], cell);
  }

  function drawEyes(head, cell) {
    // 眼睛朝向前进方向，两只眼睛沿垂直于前进方向的轴分开
    const { x: dx, y: dy } = DIRECTIONS[game.direction];
    const cx = (head.x + 0.5 + dx * 0.15) * cell;
    const cy = (head.y + 0.5 + dy * 0.15) * cell;
    const spread = cell * 0.2;
    for (const side of [-1, 1]) {
      fillCircle(cx - dy * spread * side, cy + dx * spread * side, cell * 0.09, COLORS.eye);
    }
  }

  function fillCircle(x, y, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---------- 输入 ----------

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const direction = KEY_TO_DIRECTION[event.code];
    if (direction) {
      event.preventDefault();
      steer(direction);
      return;
    }

    switch (event.code) {
      case 'Space':
      case 'Enter':
      case 'NumpadEnter': {
        // 焦点在开始 / 暂停按钮上时交给按钮自己处理，避免一次按键触发两次
        const target = event.target;
        if ((target === overlayButton || target === pauseButton) && !target.disabled) {
          return;
        }
        event.preventDefault();
        if (!event.repeat) {
          primaryAction();
        }
        break;
      }
      case 'KeyP':
      case 'Escape':
        if (!event.repeat) {
          togglePause();
        }
        break;
      default:
        break;
    }
  });

  // 触屏：在棋盘上滑动来转向
  canvas.addEventListener('pointerdown', (event) => {
    swipe = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!swipe || event.pointerId !== swipe.id) {
      return;
    }
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) {
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) {
      steer(dx > 0 ? 'right' : 'left');
    } else {
      steer(dy > 0 ? 'down' : 'up');
    }
    // 以当前位置作为新的起点，一次滑动中可以连续转弯
    swipe.x = event.clientX;
    swipe.y = event.clientY;
  });

  function endSwipe(event) {
    if (swipe && event.pointerId === swipe.id) {
      swipe = null;
    }
  }

  canvas.addEventListener('pointerup', endSwipe);
  canvas.addEventListener('pointercancel', endSwipe);

  document.querySelectorAll('.dpad [data-direction]').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      steer(button.dataset.direction);
    });
  });

  overlayButton.addEventListener('click', primaryAction);
  pauseButton.addEventListener('click', togglePause);

  // 切换到其他标签页或窗口时自动暂停
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pauseGame();
    }
  });
  window.addEventListener('blur', pauseGame);
  window.addEventListener('resize', resizeCanvas);

  updateScoreboard();
  resizeCanvas();
})();
