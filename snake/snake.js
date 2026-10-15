/**
 * 贪吃蛇核心逻辑：只负责游戏状态，不涉及任何界面代码，方便单独测试。
 * 浏览器中通过 window.SnakeGame 使用，Node.js 中通过 require 引入。
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.SnakeGame = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DIRECTIONS = Object.freeze({
    up: Object.freeze({ x: 0, y: -1 }),
    down: Object.freeze({ x: 0, y: 1 }),
    left: Object.freeze({ x: -1, y: 0 }),
    right: Object.freeze({ x: 1, y: 0 }),
  });

  const OPPOSITE = Object.freeze({ up: 'down', down: 'up', left: 'right', right: 'left' });

  const INITIAL_LENGTH = 3;
  // 两次移动之间最多缓存的转向次数，快速连按时不会丢失操作
  const MAX_QUEUED_TURNS = 3;

  // 初始每 150ms 移动一格，每得 1 分加快 2ms，最快 70ms
  const BASE_INTERVAL = 150;
  const MIN_INTERVAL = 70;
  const SPEEDUP_PER_POINT = 2;

  function getTickInterval(score) {
    return Math.max(MIN_INTERVAL, BASE_INTERVAL - score * SPEEDUP_PER_POINT);
  }

  function samePosition(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  class Game {
    constructor({ cols = 20, rows = 20, random = Math.random } = {}) {
      this.cols = cols;
      this.rows = rows;
      this.random = random;
      this.reset();
    }

    reset() {
      const headX = Math.floor(this.cols / 2);
      const headY = Math.floor(this.rows / 2);
      this.snake = [];
      for (let i = 0; i < INITIAL_LENGTH; i++) {
        this.snake.push({ x: headX - i, y: headY });
      }
      this.direction = 'right';
      this.pendingTurns = [];
      this.score = 0;
      this.status = 'playing'; // 'playing' | 'over' | 'won'
      this.food = this.spawnFood();
    }

    /** 请求转向。掉头、与当前方向相同或队列已满时忽略，返回是否被接受。 */
    turn(direction) {
      if (this.status !== 'playing' || !Object.prototype.hasOwnProperty.call(DIRECTIONS, direction)) {
        return false;
      }
      const last = this.pendingTurns.length > 0
        ? this.pendingTurns[this.pendingTurns.length - 1]
        : this.direction;
      if (
        direction === last ||
        direction === OPPOSITE[last] ||
        this.pendingTurns.length >= MAX_QUEUED_TURNS
      ) {
        return false;
      }
      this.pendingTurns.push(direction);
      return true;
    }

    /** 让蛇前进一格，并处理吃食物、碰撞和通关。 */
    step() {
      if (this.status !== 'playing') {
        return;
      }
      if (this.pendingTurns.length > 0) {
        this.direction = this.pendingTurns.shift();
      }

      const { x: dx, y: dy } = DIRECTIONS[this.direction];
      const head = this.snake[0];
      const next = { x: head.x + dx, y: head.y + dy };
      const eating = this.food !== null && samePosition(next, this.food);
      // 没吃到食物时尾巴会同时移走，所以移动到当前尾巴的位置不算撞到自己
      const body = eating ? this.snake : this.snake.slice(0, -1);

      if (this.isOutside(next) || body.some((segment) => samePosition(segment, next))) {
        this.status = 'over';
        return;
      }

      this.snake.unshift(next);
      if (!eating) {
        this.snake.pop();
        return;
      }

      this.score += 1;
      this.food = this.spawnFood();
      if (this.food === null) {
        this.status = 'won';
      }
    }

    isOutside({ x, y }) {
      return x < 0 || y < 0 || x >= this.cols || y >= this.rows;
    }

    /** 在空格子中随机放置食物；棋盘已被蛇占满时返回 null。 */
    spawnFood() {
      const occupied = new Set(this.snake.map((segment) => segment.y * this.cols + segment.x));
      const free = [];
      for (let i = 0; i < this.cols * this.rows; i++) {
        if (!occupied.has(i)) {
          free.push(i);
        }
      }
      if (free.length === 0) {
        return null;
      }
      const index = free[Math.floor(this.random() * free.length)];
      return { x: index % this.cols, y: Math.floor(index / this.cols) };
    }
  }

  return { DIRECTIONS, Game, getTickInterval };
});
