'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Game, getTickInterval } = require('./snake.js');

function headOf(game) {
  return game.snake[0];
}

test('新游戏：蛇长 3、朝右、位于棋盘中间，食物不在蛇身上', () => {
  const game = new Game({ cols: 10, rows: 10 });

  assert.deepEqual(game.snake, [
    { x: 5, y: 5 },
    { x: 4, y: 5 },
    { x: 3, y: 5 },
  ]);
  assert.equal(game.direction, 'right');
  assert.equal(game.score, 0);
  assert.equal(game.status, 'playing');
  assert.ok(game.food.x >= 0 && game.food.x < 10 && game.food.y >= 0 && game.food.y < 10);
  assert.ok(!game.snake.some((s) => s.x === game.food.x && s.y === game.food.y));
});

test('每一步向前移动一格，长度不变', () => {
  const game = new Game({ cols: 10, rows: 10, random: () => 0 });

  game.step();

  assert.deepEqual(game.snake, [
    { x: 6, y: 5 },
    { x: 5, y: 5 },
    { x: 4, y: 5 },
  ]);
  assert.equal(game.status, 'playing');
});

test('不能直接掉头，也会忽略与当前方向相同的输入', () => {
  const game = new Game({ cols: 10, rows: 10, random: () => 0 });

  assert.equal(game.turn('left'), false);
  assert.equal(game.turn('right'), false);
  game.step();

  assert.deepEqual(headOf(game), { x: 6, y: 5 });
  assert.equal(game.direction, 'right');
});

test('同一步内快速连按“上、左”会依次生效，而不是掉头撞到自己', () => {
  const game = new Game({ cols: 10, rows: 10, random: () => 0 });

  assert.equal(game.turn('up'), true);
  assert.equal(game.turn('left'), true);
  assert.equal(game.turn('right'), false, '相对于已排队的“左”来说是掉头');

  game.step();
  assert.deepEqual(headOf(game), { x: 5, y: 4 });
  game.step();
  assert.deepEqual(headOf(game), { x: 4, y: 4 });
  assert.equal(game.status, 'playing');
});

test('转向队列最多缓存 3 次操作', () => {
  const game = new Game({ cols: 10, rows: 10, random: () => 0 });

  assert.deepEqual(
    ['up', 'left', 'down', 'right'].map((direction) => game.turn(direction)),
    [true, true, true, false],
  );
});

test('忽略无效方向', () => {
  const game = new Game({ cols: 10, rows: 10 });

  assert.equal(game.turn('diagonal'), false);
  assert.equal(game.turn('toString'), false);
  assert.deepEqual(game.pendingTurns, []);
});

test('吃到食物：蛇变长、得 1 分，并在空位生成新食物', () => {
  const game = new Game({ cols: 10, rows: 10, random: () => 0 });
  game.food = { x: 6, y: 5 };

  game.step();

  assert.equal(game.snake.length, 4);
  assert.deepEqual(headOf(game), { x: 6, y: 5 });
  assert.equal(game.score, 1);
  assert.deepEqual(game.food, { x: 0, y: 0 });
  assert.ok(!game.snake.some((s) => s.x === game.food.x && s.y === game.food.y));
});

test('撞墙后游戏结束，之后不再移动也不能转向', () => {
  const game = new Game({ cols: 10, rows: 10, random: () => 0 });

  for (let i = 0; i < 4; i++) {
    game.step();
  }
  assert.equal(game.status, 'playing');
  assert.deepEqual(headOf(game), { x: 9, y: 5 });

  game.step();
  assert.equal(game.status, 'over');

  const snapshot = JSON.stringify(game.snake);
  game.step();
  assert.equal(JSON.stringify(game.snake), snapshot);
  assert.equal(game.turn('up'), false);
});

test('撞到自己的身体后游戏结束', () => {
  const game = new Game({ cols: 10, rows: 10, random: () => 0 });
  game.snake = [
    { x: 2, y: 2 },
    { x: 2, y: 3 },
    { x: 3, y: 3 },
    { x: 3, y: 2 },
    { x: 3, y: 1 },
  ];
  game.direction = 'up';
  game.food = { x: 9, y: 9 };

  game.turn('right');
  game.step();

  assert.equal(game.status, 'over');
});

test('可以移动到尾巴刚离开的格子', () => {
  const game = new Game({ cols: 5, rows: 5, random: () => 0 });
  game.snake = [
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: 0, y: 0 },
  ];
  game.direction = 'up';
  game.food = { x: 4, y: 4 };

  game.turn('left');
  game.step();

  assert.equal(game.status, 'playing');
  assert.deepEqual(game.snake, [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ]);
});

test('蛇占满整个棋盘时通关', () => {
  const game = new Game({ cols: 4, rows: 1 });
  assert.deepEqual(game.food, { x: 3, y: 0 });

  game.step();

  assert.equal(game.status, 'won');
  assert.equal(game.score, 1);
  assert.equal(game.snake.length, 4);
  assert.equal(game.food, null);
});

test('食物总是生成在棋盘内的空格子上', () => {
  for (const value of [0, 0.25, 0.5, 0.75, 0.999]) {
    const game = new Game({ cols: 4, rows: 4, random: () => value });
    const { x, y } = game.food;

    assert.ok(x >= 0 && x < 4 && y >= 0 && y < 4);
    assert.ok(!game.snake.some((s) => s.x === x && s.y === y));
  }
});

test('得分越高速度越快，但不会超过最快速度', () => {
  assert.equal(getTickInterval(0), 150);
  assert.equal(getTickInterval(10), 130);
  assert.equal(getTickInterval(40), 70);
  assert.equal(getTickInterval(1000), 70);
});
