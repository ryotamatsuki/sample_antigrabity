// ============================================================
// SUPER PIXEL ADVENTURE - 2D Side-Scrolling Platformer
// ============================================================

(() => {
    'use strict';

    // ===== CONSTANTS =====
    const CANVAS_W = 800;
    const CANVAS_H = 500;
    const TILE = 32;
    const GRAVITY = 0.6;
    const FRICTION = 0.85;
    const PLAYER_SPEED = 4.5;
    const PLAYER_JUMP = -12;
    const MAX_FALL = 12;
    const TARGET_FPS = 60;
    const TARGET_DT = 1000 / TARGET_FPS;
    const COYOTE_FRAMES = 6;
    const JUMP_BUFFER_FRAMES = 8;

    // ===== CANVAS SETUP =====
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;

    // ===== DOM REFS =====
    const dom = {
        overlay: document.getElementById('overlay'),
        clearOverlay: document.getElementById('stage-clear-overlay'),
        overOverlay: document.getElementById('game-over-overlay'),
        endOverlay: document.getElementById('ending-overlay'),
        scoreVal: document.getElementById('score-value'),
        stageVal: document.getElementById('stage-value'),
        livesVal: document.getElementById('lives-value'),
        clearScore: document.getElementById('clear-score'),
        finalScore: document.getElementById('final-score'),
        endScore: document.getElementById('ending-score'),
    };

    // ===== GAME STATE =====
    const STATE = { TITLE: 0, PLAYING: 1, CLEAR: 2, OVER: 3, ENDING: 4 };
    let state = STATE.TITLE;
    let score = 0;
    let lives = 3;
    let currentStage = 0;
    let camera = { x: 0, y: 0 };
    let shakeTimer = 0;
    let shakeIntensity = 0;
    let particles = [];
    let frameCount = 0;
    let boss = null;
    let bossDefeated = false;
    let lastTime = 0;
    let dtScale = 1;

    // ===== SOUND SYSTEM (Web Audio API) =====
    let audioCtx = null;
    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    function playTone(freq, duration, type = 'square', volume = 0.15) {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(volume, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    }

    function playNoise(duration, volume = 0.1) {
        if (!audioCtx) return;
        const bufferSize = audioCtx.sampleRate * duration;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(volume, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        source.connect(gain);
        gain.connect(audioCtx.destination);
        source.start();
    }

    const sfx = {
        jump() {
            playTone(400, 0.12, 'square', 0.1);
            playTone(600, 0.08, 'square', 0.08);
        },
        coin() {
            playTone(1047, 0.08, 'square', 0.1);
            setTimeout(() => playTone(1319, 0.12, 'square', 0.1), 60);
        },
        stomp() {
            playTone(200, 0.1, 'square', 0.12);
            playNoise(0.08, 0.08);
        },
        hit() {
            playTone(150, 0.2, 'sawtooth', 0.12);
            playTone(80, 0.25, 'square', 0.08);
        },
        bossHit() {
            playTone(120, 0.15, 'sawtooth', 0.15);
            playNoise(0.12, 0.12);
            playTone(180, 0.1, 'square', 0.1);
        },
        bossDefeat() {
            const t = audioCtx.currentTime;
            [523, 659, 784, 1047].forEach((f, i) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(f, t + i * 0.12);
                gain.gain.setValueAtTime(0.12, t + i * 0.12);
                gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.3);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(t + i * 0.12);
                osc.stop(t + i * 0.12 + 0.3);
            });
            playNoise(0.4, 0.15);
        },
        stageClear() {
            const t = audioCtx.currentTime;
            [523, 659, 784, 1047, 1319].forEach((f, i) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(f, t + i * 0.1);
                gain.gain.setValueAtTime(0.1, t + i * 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.25);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(t + i * 0.1);
                osc.stop(t + i * 0.1 + 0.25);
            });
        },
        gameOver() {
            const t = audioCtx.currentTime;
            [440, 370, 311, 220].forEach((f, i) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(f, t + i * 0.2);
                gain.gain.setValueAtTime(0.12, t + i * 0.2);
                gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.2 + 0.35);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(t + i * 0.2);
                osc.stop(t + i * 0.2 + 0.35);
            });
        },
        powerUp() {
            const t = audioCtx.currentTime;
            [523, 659, 784, 1047].forEach((f, i) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(f, t + i * 0.08);
                gain.gain.setValueAtTime(0.1, t + i * 0.08);
                gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.15);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(t + i * 0.08);
                osc.stop(t + i * 0.08 + 0.15);
            });
        },
        blockBump() {
            playTone(250, 0.06, 'square', 0.1);
        },
        brickBreak() {
            playNoise(0.1, 0.12);
            playTone(150, 0.08, 'square', 0.08);
        },
        mushroomSpawn() {
            playTone(600, 0.1, 'square', 0.08);
            setTimeout(() => playTone(800, 0.08, 'square', 0.06), 80);
        },
    };

    // ===== INPUT =====
    const keys = {};
    let jumpBufferCounter = 0;
    let jumpReleased = true;
    const jumpKeys = ['Space', 'ArrowUp', 'KeyW'];

    window.addEventListener('keydown', e => {
        keys[e.code] = true;
        if (e.code === 'Enter') { initAudio(); handleEnter(); }
        if (jumpKeys.includes(e.code)) {
            jumpBufferCounter = JUMP_BUFFER_FRAMES;
            jumpReleased = false;
        }
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
            e.preventDefault();
        }
    });
    window.addEventListener('keyup', e => {
        keys[e.code] = false;
        // Variable jump: cut upward velocity when releasing jump key
        if (jumpKeys.includes(e.code)) {
            jumpReleased = true;
            if (player.vy < PLAYER_JUMP * 0.4) {
                player.vy *= 0.5;
            }
        }
    });

    function handleEnter() {
        if (state === STATE.TITLE) {
            startGame();
        } else if (state === STATE.CLEAR) {
            nextStage();
        } else if (state === STATE.OVER) {
            resetGame();
        } else if (state === STATE.ENDING) {
            resetGame();
        }
    }

    // ===== PLAYER =====
    const PLAYER_NORMAL_H = 30;
    const PLAYER_POWERED_H = 42;
    let player = {
        x: 80, y: 300,
        w: 24, h: PLAYER_NORMAL_H,
        vx: 0, vy: 0,
        onGround: false,
        facing: 1,
        animFrame: 0,
        animTimer: 0,
        invincible: 0,
        dead: false,
        coyoteCounter: 0,
        wasOnGround: false,
        powered: false,
    };

    let mushrooms = [];  // Active mushroom items in the world

    // ===== STAGE DATA =====
    // Tile legend: 0=air, 1=ground, 2=brick, 3=grass-top, Q=?-block(4), 5=used-block
    // Enemy spawn: encoded separately

    const STAGES = [
        // ===== STAGE 1: GRASSLAND =====
        {
            name: '1-1',
            theme: 'grassland',
            bgColors: ['#87CEEB', '#4A90D9', '#2C5F8A'],
            hillColor: '#3a7d44',
            groundColor: '#8B5E3C',
            grassColor: '#4CAF50',
            brickColor: '#C0843C',
            map: [
                '                                                                                                                                                           G',
                '                                                                                                                                                           G',
                '                                                                                                                                                           G',
                '                                                                                                                                                           G',
                '                        CCCCC                                                                                                                              G',
                '                  BQB          BB                                         CCC                                                                              G',
                '                                                                    BBB                                                                                    G',
                '           C                          BB   C  C  C                                      B  C  B                     Q                                      G',
                '         BBB          C         BQB            BBB       BB                                                     CC                                          G',
                '                    BBB                                       BBB             BBB                     BBB      BBBB                   BBBB                  G',
                '                                                                                                                                                           G',
                '                                                                                                                                                           G',
                '33333333333333333   3333333333333333333333   33333333333333333333333333333   33333333333333333333333333333333333333333333   333333333   33333333333333333333333333',
                '11111111111111111   1111111111111111111111   11111111111111111111111111111   11111111111111111111111111111111111111111111   111111111   11111111111111111111111111',
                '11111111111111111   1111111111111111111111   11111111111111111111111111111   11111111111111111111111111111111111111111111   111111111   11111111111111111111111111',
                '11111111111111111   1111111111111111111111   11111111111111111111111111111   11111111111111111111111111111111111111111111   111111111   11111111111111111111111111',
            ],
            enemies: [
                { type: 'slime', x: 10, y: 11 },
                { type: 'slime', x: 20, y: 11 },
                { type: 'shell', x: 35, y: 11 },
                { type: 'slime', x: 50, y: 11 },
                { type: 'shell', x: 70, y: 11 },
                { type: 'slime', x: 85, y: 11 },
                { type: 'slime', x: 100, y: 11 },
                { type: 'shell', x: 120, y: 11 },
                { type: 'slime', x: 140, y: 11 },
            ],
        },
        // ===== STAGE 2: CAVE =====
        {
            name: '1-2',
            theme: 'cave',
            bgColors: ['#1a0a2e', '#0d0620', '#050210'],
            hillColor: '#2a1a4e',
            groundColor: '#4a3a6a',
            grassColor: '#6a5a8a',
            brickColor: '#5a4a7a',
            map: [
                '                                                                                                                                                     G',
                '                                                                                                                                                     G',
                '              C                                                                                                                                      G',
                '            BBBBB                                         CC                                                                                         G',
                '                                                        BQBBBB                                                  CC                                   G',
                '                          BQB                                         BB                                       BBBB                                  G',
                '     C              C                   BB                                      C     C                                      BB                      G',
                '   BBB            BBB          BBB               C    C        BBB             BBB   BBB           BBB                                                G',
                '                                                BBB  BBB                                                                           BBB               G',
                '          BB                                                          BB                    BB            BB            BB                            G',
                '                       BB                                                         BB                                                        BB       G',
                '                                                                                                                                                     G',
                '3333333   333333   33333333   333333   333   33333333333333   333   333333333333333333   333333333333   33333333   333   3333333333   33   333333333333333',
                '1111111   111111   11111111   111111   111   11111111111111   111   111111111111111111   111111111111   11111111   111   1111111111   11   111111111111111',
                '1111111   111111   11111111   111111   111   11111111111111   111   111111111111111111   111111111111   11111111   111   1111111111   11   111111111111111',
                '1111111   111111   11111111   111111   111   11111111111111   111   111111111111111111   111111111111   11111111   111   1111111111   11   111111111111111',
            ],
            enemies: [
                { type: 'flyingEye', x: 12, y: 6 },
                { type: 'fireSkull', x: 28, y: 6 },
                { type: 'flyingEye', x: 42, y: 5 },
                { type: 'fireSkull', x: 55, y: 8 },
                { type: 'flyingEye', x: 70, y: 4 },
                { type: 'slime', x: 80, y: 11 },
                { type: 'fireSkull', x: 95, y: 7 },
                { type: 'flyingEye', x: 110, y: 5 },
                { type: 'slime', x: 120, y: 11 },
            ],
        },
        // ===== STAGE 3: SKY CASTLE =====
        {
            name: '1-3',
            theme: 'sky',
            bgColors: ['#FF7E47', '#E85D26', '#B84017'],
            hillColor: '#c9a962',
            groundColor: '#8a8a9a',
            grassColor: '#aaaabc',
            brickColor: '#9a8a7a',
            map: [
                '                                                                                                                                                                                                       G',
                '                                                                                                                                                                                                       G',
                '                                                                                                                                                                                                       G',
                '     C                                                                       C                                                     C                                                                   G',
                '   BBBB                     BBB         C  C                               BBBBB              CC                                 BBBBB                                                                  G',
                '                  BB                  BBBBBBB                                          BBB  BBBBBB                                              BB                                                      G',
                '            C                                      BB           BBB                                        BB   C                          BB                                                           G',
                '          BQB          BB                                                       C                               BQB           BB                      BBB                                                G',
                '                              BBB           BB              B                 BBB       B          BBB                   BB              BB                                                              G',
                '      BB        BB                    BB            BBB           BB                         BB                    BB              BBB                                                                   G',
                '                       BB                                                           BB                                                        BB                                                        G',
                '                                                                                                                                                                                                       G',
                '333333   333   33   333333   33   3333   33   33333   333   3333   33   333333   33   3333333   33   333333   33   33333   33   33333   33   33333333333333333333333333333333333333333333333333333333333333333',
                '111111   111   11   111111   11   1111   11   11111   111   1111   11   111111   11   1111111   11   111111   11   11111   11   11111   11   11111111111111111111111111111111111111111111111111111111111111111',
                '111111   111   11   111111   11   1111   11   11111   111   1111   11   111111   11   1111111   11   111111   11   11111   11   11111   11   11111111111111111111111111111111111111111111111111111111111111111',
                '111111   111   11   111111   11   1111   11   11111   111   1111   11   111111   11   1111111   11   111111   11   11111   11   11111   11   11111111111111111111111111111111111111111111111111111111111111111',
            ],
            enemies: [
                { type: 'dashGhost', x: 14, y: 8 },
                { type: 'flyingEye', x: 22, y: 5 },
                { type: 'slime', x: 30, y: 11 },
                { type: 'shell', x: 40, y: 11 },
                { type: 'fireSkull', x: 50, y: 6 },
                { type: 'dashGhost', x: 62, y: 7 },
                { type: 'flyingEye', x: 75, y: 4 },
                { type: 'shell', x: 88, y: 11 },
                { type: 'fireSkull', x: 100, y: 8 },
                { type: 'dashGhost', x: 112, y: 6 },
                { type: 'slime', x: 125, y: 11 },
                { type: 'dashGhost', x: 136, y: 9 },
            ],
            boss: { x: 170, y: 7 },
        },
    ];

    // ===== PARSED LEVEL DATA =====
    let tiles = [];
    let coins = [];
    let enemies = [];
    let fireballs = [];
    let goalX = 0;
    let mapWidth = 0;
    let mapHeight = 0;

    function loadStage(idx) {
        const stage = STAGES[idx];
        const map = stage.map;
        mapHeight = map.length;
        mapWidth = map[0].length;
        tiles = [];
        coins = [];
        fireballs = [];
        goalX = 0;
        boss = null;
        bossDefeated = false;

        mushrooms = [];

        for (let r = 0; r < mapHeight; r++) {
            tiles[r] = [];
            for (let c = 0; c < mapWidth; c++) {
                const ch = map[r][c] || ' ';
                switch (ch) {
                    case '1': tiles[r][c] = 1; break; // solid ground
                    case '3': tiles[r][c] = 3; break; // grass top
                    case 'B': tiles[r][c] = 2; break; // brick
                    case 'Q': tiles[r][c] = 4; break; // ? block
                    case 'C': coins.push({ x: c * TILE + 8, y: r * TILE + 8, w: 16, h: 16, collected: false, bobOffset: Math.random() * Math.PI * 2 }); tiles[r][c] = 0; break;
                    case 'G': goalX = c * TILE; tiles[r][c] = 0; break;
                    default: tiles[r][c] = 0;
                }
            }
        }

        // Spawn enemies
        enemies = stage.enemies.map(e => spawnEnemy(e.type, e.x * TILE, e.y * TILE));

        // Spawn boss if defined
        if (stage.boss) {
            boss = createBoss(stage.boss.x * TILE, stage.boss.y * TILE);
        }
    }

    // ===== BOSS =====
    function createBoss(x, y) {
        return {
            x, y, w: 64, h: 72,
            vx: 0, vy: 0,
            hp: 5, maxHp: 5,
            alive: true,
            phase: 'idle', // idle, charge, jump, fireball
            phaseTimer: 0,
            actionCooldown: 90,
            facing: -1,
            invincible: 0,
            onGround: false,
            animFrame: 0,
            animTimer: 0,
            arenaLeft: (x - 4 * TILE),
            arenaRight: (x + 8 * TILE),
            defeated: false,
            defeatTimer: 0,
        };
    }

    function updateBoss() {
        if (!boss || !boss.alive) return;

        // Invincibility
        if (boss.invincible > 0) boss.invincible -= dtScale;

        // Face player
        boss.facing = player.x < boss.x ? -1 : 1;

        // Gravity
        boss.vy += GRAVITY * dtScale;
        if (boss.vy > MAX_FALL) boss.vy = MAX_FALL;

        // Phase logic
        boss.phaseTimer += dtScale;

        switch (boss.phase) {
            case 'idle':
                boss.vx = 0;
                if (boss.phaseTimer >= boss.actionCooldown) {
                    // Choose attack based on HP
                    const attacks = ['charge', 'fireball'];
                    if (boss.hp <= 3) attacks.push('jump');
                    if (boss.hp <= 2) attacks.push('fireball', 'charge');
                    boss.phase = attacks[Math.floor(Math.random() * attacks.length)];
                    boss.phaseTimer = 0;
                }
                break;

            case 'charge':
                boss.vx = boss.facing * 4;
                if (boss.phaseTimer >= 50) {
                    boss.phase = 'idle';
                    boss.phaseTimer = 0;
                    boss.vx = 0;
                    boss.actionCooldown = 60 + Math.random() * 40;
                }
                break;

            case 'jump':
                if (boss.phaseTimer <= dtScale + 0.01) {
                    boss.vy = -14;
                    boss.vx = boss.facing * 3;
                }
                if (boss.phaseTimer > 10 && boss.onGround) {
                    // Ground pound effect
                    triggerShake(8, 15);
                    spawnParticles(boss.x + boss.w / 2, boss.y + boss.h, '#ffaa00', 20, 5);
                    boss.phase = 'idle';
                    boss.phaseTimer = 0;
                    boss.vx = 0;
                    boss.actionCooldown = 50 + Math.random() * 30;
                }
                break;

            case 'fireball': {
                const t = Math.floor(boss.phaseTimer);
                const prev = Math.floor(boss.phaseTimer - dtScale);
                if ((prev < 20 && t >= 20) || (prev < 40 && t >= 40) || (prev < 60 && t >= 60)) {
                    const dx = player.x - boss.x;
                    const dy = player.y - boss.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    fireballs.push({
                        x: boss.x + boss.w / 2 + boss.facing * 30,
                        y: boss.y + 20,
                        vx: (dx / dist) * 4,
                        vy: (dy / dist) * 4,
                        w: 16, h: 16, life: 200,
                    });
                    spawnParticles(boss.x + boss.w / 2 + boss.facing * 30, boss.y + 20, '#ff4400', 5, 2);
                }
                if (boss.phaseTimer >= 80) {
                    boss.phase = 'idle';
                    boss.phaseTimer = 0;
                    boss.actionCooldown = 70 + Math.random() * 30;
                }
                break;
            }
        }

        // Move
        boss.x += boss.vx * dtScale;
        // Clamp to arena
        if (boss.x < boss.arenaLeft) { boss.x = boss.arenaLeft; boss.vx = 0; }
        if (boss.x + boss.w > boss.arenaRight) { boss.x = boss.arenaRight - boss.w; boss.vx = 0; }

        boss.y += boss.vy * dtScale;
        boss.onGround = false;
        // Ground collision for boss
        const bLeft = Math.floor(boss.x / TILE);
        const bRight = Math.floor((boss.x + boss.w - 1) / TILE);
        const bBottom = Math.floor((boss.y + boss.h - 1) / TILE);
        for (let c = bLeft; c <= bRight; c++) {
            if (isSolid(c, bBottom)) {
                boss.y = bBottom * TILE - boss.h;
                boss.vy = 0;
                boss.onGround = true;
                break;
            }
        }

        // Animation
        boss.animTimer += dtScale;
        if (boss.animTimer > 10) {
            boss.animTimer = 0;
            boss.animFrame = (boss.animFrame + 1) % 4;
        }

        // Collision with player
        if (!player.dead && player.invincible <= 0 && aabb(player, boss)) {
            if (player.vy > 0 && player.y + player.h - boss.y < 20 && boss.invincible <= 0) {
                // Stomp boss!
                boss.hp--;
                boss.invincible = 60;
                player.vy = PLAYER_JUMP * 0.7;
                score += 500;
                triggerShake(6, 12);
                spawnParticles(boss.x + boss.w / 2, boss.y, '#ff0000', 15, 5);
                sfx.bossHit();

                if (boss.hp <= 0) {
                    // Boss defeated!
                    boss.alive = false;
                    boss.defeated = true;
                    bossDefeated = true;
                    score += 5000;
                    triggerShake(12, 30);
                    spawnParticles(boss.x + boss.w / 2, boss.y + boss.h / 2, '#ff0000', 40, 8);
                    spawnParticles(boss.x + boss.w / 2, boss.y + boss.h / 2, '#ffaa00', 30, 7);
                    spawnParticles(boss.x + boss.w / 2, boss.y + boss.h / 2, '#ffff00', 20, 6);
                    sfx.bossDefeat();
                }

                // Reset to idle
                boss.phase = 'idle';
                boss.phaseTimer = 0;
                boss.actionCooldown = 90;
                boss.vx = 0;
            } else {
                playerHit();
            }
        }
    }

    function drawBoss() {
        if (!boss || !boss.alive) return;
        if (boss.invincible > 0 && Math.floor(boss.invincible / 3) % 2 === 0) return;

        const x = boss.x - camera.x;
        const y = boss.y - camera.y;
        const f = boss.facing;

        ctx.save();
        ctx.translate(x + boss.w / 2, y + boss.h / 2);
        ctx.scale(f, 1);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, boss.h / 2 + 2, boss.w / 2, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillStyle = '#8B0000';
        ctx.fillRect(-boss.w / 2 + 4, -boss.h / 2 + 20, boss.w - 8, boss.h - 24);

        // Belly
        ctx.fillStyle = '#CC6600';
        ctx.fillRect(-boss.w / 2 + 10, -boss.h / 2 + 28, boss.w - 20, boss.h - 38);
        // Belly scales
        ctx.strokeStyle = '#aa5500';
        ctx.lineWidth = 0.8;
        for (let s = 0; s < 4; s++) {
            ctx.beginPath();
            ctx.moveTo(-boss.w / 2 + 12, -boss.h / 2 + 34 + s * 8);
            ctx.lineTo(boss.w / 2 - 12, -boss.h / 2 + 34 + s * 8);
            ctx.stroke();
        }

        // Head
        ctx.fillStyle = '#8B0000';
        ctx.beginPath();
        ctx.arc(0, -boss.h / 2 + 14, 20, 0, Math.PI * 2);
        ctx.fill();

        // Snout
        ctx.fillStyle = '#6B0000';
        ctx.fillRect(6, -boss.h / 2 + 10, 18, 12);

        // Horns
        ctx.fillStyle = '#444';
        ctx.beginPath();
        ctx.moveTo(-10, -boss.h / 2);
        ctx.lineTo(-6, -boss.h / 2 - 16);
        ctx.lineTo(-2, -boss.h / 2 + 4);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(10, -boss.h / 2);
        ctx.lineTo(14, -boss.h / 2 - 16);
        ctx.lineTo(18, -boss.h / 2 + 4);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#FFCC00';
        ctx.fillRect(-8, -boss.h / 2 + 8, 7, 6);
        ctx.fillRect(4, -boss.h / 2 + 8, 7, 6);
        // Pupils
        ctx.fillStyle = '#000';
        const pupilShift = boss.phase === 'charge' ? 2 : 0;
        ctx.fillRect(-6 + pupilShift, -boss.h / 2 + 10, 3, 3);
        ctx.fillRect(6 + pupilShift, -boss.h / 2 + 10, 3, 3);
        // Angry eyebrows
        ctx.strokeStyle = '#300';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10, -boss.h / 2 + 6);
        ctx.lineTo(-2, -boss.h / 2 + 8);
        ctx.moveTo(12, -boss.h / 2 + 6);
        ctx.lineTo(4, -boss.h / 2 + 8);
        ctx.stroke();

        // Mouth / teeth
        ctx.fillStyle = '#200';
        ctx.fillRect(8, -boss.h / 2 + 18, 14, 4);
        ctx.fillStyle = '#fff';
        ctx.fillRect(9, -boss.h / 2 + 18, 3, 3);
        ctx.fillRect(14, -boss.h / 2 + 18, 3, 3);
        ctx.fillRect(19, -boss.h / 2 + 18, 3, 3);

        // Arms
        ctx.fillStyle = '#8B0000';
        const armSwing = Math.sin(frameCount * 0.1) * 4;
        ctx.fillRect(boss.w / 2 - 6, -boss.h / 2 + 24 + armSwing, 10, 20);
        // Claws
        ctx.fillStyle = '#444';
        ctx.fillRect(boss.w / 2 - 4, -boss.h / 2 + 42 + armSwing, 3, 5);
        ctx.fillRect(boss.w / 2, -boss.h / 2 + 42 + armSwing, 3, 5);

        // Legs
        ctx.fillStyle = '#6B0000';
        const legSwing = boss.phase === 'charge' ? Math.sin(frameCount * 0.2) * 4 : 0;
        ctx.fillRect(-boss.w / 2 + 8, boss.h / 2 - 14 + legSwing, 14, 14);
        ctx.fillRect(boss.w / 2 - 22, boss.h / 2 - 14 - legSwing, 14, 14);

        // Tail
        ctx.fillStyle = '#6B0000';
        ctx.beginPath();
        const tailWag = Math.sin(frameCount * 0.06) * 6;
        ctx.moveTo(-boss.w / 2 + 2, boss.h / 2 - 10);
        ctx.quadraticCurveTo(-boss.w / 2 - 16, boss.h / 2 - 20 + tailWag, -boss.w / 2 - 20, boss.h / 2 - 30 + tailWag);
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#6B0000';
        ctx.stroke();

        // Flame breath when in fireball phase
        if (boss.phase === 'fireball' && boss.phaseTimer % 20 < 10) {
            for (let fl = 0; fl < 6; fl++) {
                const flx = 20 + fl * 6 + Math.random() * 4;
                const fly = -boss.h / 2 + 14 + (Math.random() - 0.5) * 12;
                ctx.fillStyle = `rgba(255, ${120 + Math.random() * 100}, 0, ${0.6 + Math.random() * 0.4})`;
                ctx.beginPath();
                ctx.arc(flx, fly, 4 + Math.random() * 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();

        // HP bar (drawn without transform)
        drawBossHPBar(x, y);
    }

    function drawBossHPBar(x, y) {
        const barW = 80;
        const barH = 8;
        const bx = x + boss.w / 2 - barW / 2;
        const by = y - 20;

        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);

        // HP fill
        const hpRatio = boss.hp / boss.maxHp;
        const hpColor = hpRatio > 0.5 ? '#44ff44' : hpRatio > 0.25 ? '#ffaa00' : '#ff2222';
        ctx.fillStyle = hpColor;
        ctx.fillRect(bx, by, barW * hpRatio, barH);

        // Border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx - 1, by - 1, barW + 2, barH + 2);

        // Label
        ctx.fillStyle = '#fff';
        ctx.font = '7px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('DRAGON KING', x + boss.w / 2, by - 4);
    }

    // ===== ENEMY FACTORY =====
    function spawnEnemy(type, x, y) {
        const base = {
            x, y, vx: 0, vy: 0, w: 28, h: 28,
            type, alive: true, animFrame: 0, animTimer: 0,
            startX: x, startY: y,
        };

        switch (type) {
            case 'slime':
                return { ...base, vx: -1, color: '#3ade3a', h: 22, w: 26 };
            case 'flyingEye':
                return { ...base, vx: -1.5, color: '#c040ff', floatPhase: Math.random() * Math.PI * 2, baseY: y };
            case 'shell':
                return { ...base, vx: -1.2, color: '#20c060', shellMode: false, shellVx: 0 };
            case 'fireSkull':
                return { ...base, vx: 0, color: '#ff4020', fireTimer: 0, fireInterval: 120 };
            case 'dashGhost':
                return { ...base, vx: 0, color: '#9040e0', dashTriggered: false, dashSpeed: 6, detectionRange: 200 };
            default:
                return base;
        }
    }

    // ===== COLLISION =====
    function aabb(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function getTile(col, row) {
        if (row < 0 || row >= mapHeight || col < 0 || col >= mapWidth) return 0;
        return tiles[row][col];
    }

    function isSolid(col, row) {
        const t = getTile(col, row);
        return t === 1 || t === 2 || t === 3 || t === 4 || t === 5;
    }

    // ===== PARTICLES =====
    function spawnParticles(x, y, color, count, speed) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = Math.random() * speed + 1;
            particles.push({
                x, y,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd - 2,
                life: 30 + Math.random() * 20,
                maxLife: 50,
                color,
                size: 2 + Math.random() * 3,
            });
        }
    }

    function updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx * dtScale;
            p.y += p.vy * dtScale;
            p.vy += 0.1 * dtScale;
            p.life -= dtScale;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    function drawParticles() {
        particles.forEach(p => {
            const alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - camera.x, p.y - camera.y, p.size, p.size);
        });
        ctx.globalAlpha = 1;
    }

    // ===== SCREEN SHAKE =====
    function triggerShake(intensity, duration) {
        shakeIntensity = intensity;
        shakeTimer = duration;
    }

    // ===== PLAYER UPDATE =====
    function updatePlayer() {
        if (player.dead) return;

        // Invincibility timer
        if (player.invincible > 0) player.invincible -= dtScale;

        // Coyote time: track time since leaving ground
        if (player.onGround) {
            player.coyoteCounter = COYOTE_FRAMES;
        } else {
            player.coyoteCounter -= dtScale;
        }

        // Jump buffer countdown
        if (jumpBufferCounter > 0) jumpBufferCounter -= dtScale;

        // Horizontal movement
        if (keys['ArrowLeft'] || keys['KeyA']) {
            player.vx -= PLAYER_SPEED * 0.3 * dtScale;
            player.facing = -1;
        }
        if (keys['ArrowRight'] || keys['KeyD']) {
            player.vx += PLAYER_SPEED * 0.3 * dtScale;
            player.facing = 1;
        }

        player.vx *= Math.pow(FRICTION, dtScale);
        if (Math.abs(player.vx) > PLAYER_SPEED) player.vx = PLAYER_SPEED * Math.sign(player.vx);
        if (Math.abs(player.vx) < 0.1) player.vx = 0;

        // Jump: supports coyote time + jump buffering
        const canJump = player.onGround || player.coyoteCounter > 0;
        if (jumpBufferCounter > 0 && canJump) {
            player.vy = PLAYER_JUMP;
            player.onGround = false;
            player.coyoteCounter = 0;
            jumpBufferCounter = 0;
            spawnParticles(player.x + player.w / 2, player.y + player.h, '#fff', 5, 2);
            sfx.jump();
        }

        // Gravity
        player.vy += GRAVITY * dtScale;
        if (player.vy > MAX_FALL) player.vy = MAX_FALL;

        // Move X
        player.x += player.vx * dtScale;
        resolveCollisionX(player);

        // Move Y
        player.y += player.vy * dtScale;
        player.wasOnGround = player.onGround;
        player.onGround = false;
        resolveCollisionY(player);

        // Fell off screen
        if (player.y > mapHeight * TILE + 100) {
            playerDie();
        }

        // Animation
        player.animTimer += dtScale;
        if (player.animTimer > 8) {
            player.animTimer = 0;
            player.animFrame = (player.animFrame + 1) % 4;
        }

        // Goal check (boss must be defeated on stage 3)
        if (player.x + player.w > goalX) {
            if (currentStage === 2 && !bossDefeated) {
                // Can't pass until boss is defeated
                player.x = goalX - player.w - 2;
                player.vx = 0;
            } else {
                stageClear();
            }
        }
    }

    function resolveCollisionX(entity) {
        const left = Math.floor(entity.x / TILE);
        const right = Math.floor((entity.x + entity.w - 1) / TILE);
        const top = Math.floor(entity.y / TILE);
        const bottom = Math.floor((entity.y + entity.h - 1) / TILE);

        for (let r = top; r <= bottom; r++) {
            for (let c = left; c <= right; c++) {
                if (isSolid(c, r)) {
                    if (entity.vx > 0) {
                        entity.x = c * TILE - entity.w;
                        entity.vx = 0;
                    } else if (entity.vx < 0) {
                        entity.x = (c + 1) * TILE;
                        entity.vx = 0;
                    }
                    // For enemies, reverse direction
                    if (entity !== player && entity.type !== 'fireSkull' && entity.type !== 'dashGhost') {
                        entity.vx = -entity.vx;
                    }
                }
            }
        }
    }

    function resolveCollisionY(entity) {
        const left = Math.floor(entity.x / TILE);
        const right = Math.floor((entity.x + entity.w - 1) / TILE);
        const top = Math.floor(entity.y / TILE);
        const bottom = Math.floor((entity.y + entity.h - 1) / TILE);

        for (let r = top; r <= bottom; r++) {
            for (let c = left; c <= right; c++) {
                if (isSolid(c, r)) {
                    if (entity.vy > 0) {
                        entity.y = r * TILE - entity.h;
                        entity.vy = 0;
                        if (entity === player) entity.onGround = true;
                    } else if (entity.vy < 0) {
                        entity.y = (r + 1) * TILE;
                        entity.vy = 0;
                        // Player head-bump block interaction
                        if (entity === player) {
                            hitBlockFromBelow(c, r);
                        }
                    }
                }
            }
        }
    }

    // ===== BLOCK INTERACTION =====
    function hitBlockFromBelow(col, row) {
        const t = getTile(col, row);
        if (t === 4) {
            // ? block: spawn mushroom, become used block
            tiles[row][col] = 5;
            spawnMushroom(col * TILE + 4, row * TILE - TILE);
            triggerShake(2, 5);
            sfx.mushroomSpawn();
        } else if (t === 2 && player.powered) {
            // Powered player breaks brick blocks
            tiles[row][col] = 0;
            triggerShake(3, 6);
            sfx.brickBreak();
            // Spawn debris particles
            const bx = col * TILE + TILE / 2;
            const by = row * TILE + TILE / 2;
            for (let i = 0; i < 6; i++) {
                const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
                const speed = 3 + Math.random() * 4;
                particles.push({
                    x: bx, y: by,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 3,
                    life: 40 + Math.random() * 20,
                    maxLife: 60,
                    color: STAGES[currentStage].brickColor,
                    size: 4 + Math.random() * 4,
                });
            }
        } else if (t === 2 || t === 5) {
            // Regular bump (not powered, or used block)
            sfx.blockBump();
        }
    }

    // ===== MUSHROOM =====
    function spawnMushroom(x, y) {
        mushrooms.push({
            x, y, w: 24, h: 24,
            vx: 2, vy: -4,
            collected: false,
            onGround: false,
            spawnAnim: 16, // rise out of block animation frames
        });
    }

    function updateMushrooms() {
        for (let i = mushrooms.length - 1; i >= 0; i--) {
            const m = mushrooms[i];
            if (m.collected) continue;

            // Spawn animation: rise up out of block
            if (m.spawnAnim > 0) {
                m.spawnAnim -= dtScale;
                continue;
            }

            // Gravity
            m.vy += GRAVITY * dtScale;
            if (m.vy > MAX_FALL) m.vy = MAX_FALL;

            // Move horizontally
            m.x += m.vx * dtScale;
            // Wall collision
            const mLeft = Math.floor(m.x / TILE);
            const mRight = Math.floor((m.x + m.w - 1) / TILE);
            const mTop = Math.floor(m.y / TILE);
            const mBot = Math.floor((m.y + m.h - 1) / TILE);
            for (let r = mTop; r <= mBot; r++) {
                if (m.vx > 0 && isSolid(mRight, r)) { m.x = mRight * TILE - m.w; m.vx = -m.vx; }
                if (m.vx < 0 && isSolid(mLeft, r)) { m.x = (mLeft + 1) * TILE; m.vx = -m.vx; }
            }

            // Move vertically
            m.y += m.vy * dtScale;
            m.onGround = false;
            const mLeft2 = Math.floor(m.x / TILE);
            const mRight2 = Math.floor((m.x + m.w - 1) / TILE);
            const mBot2 = Math.floor((m.y + m.h - 1) / TILE);
            for (let c = mLeft2; c <= mRight2; c++) {
                if (isSolid(c, mBot2)) {
                    m.y = mBot2 * TILE - m.h;
                    m.vy = 0;
                    m.onGround = true;
                }
            }

            // Edge detection
            if (m.onGround) {
                const checkX = m.vx > 0 ? m.x + m.w + 2 : m.x - 2;
                const checkCol = Math.floor(checkX / TILE);
                const checkRow = Math.floor((m.y + m.h + 2) / TILE);
                // Don't reverse at ledges - mushrooms slide off edges like in Mario
            }

            // Fell off screen
            if (m.y > mapHeight * TILE + 100) {
                mushrooms.splice(i, 1);
                continue;
            }

            // Collect by player
            if (!player.dead && aabb(player, m)) {
                m.collected = true;
                powerUpPlayer();
                spawnParticles(m.x + m.w / 2, m.y + m.h / 2, '#ff4444', 12, 4);
                mushrooms.splice(i, 1);
            }
        }
    }

    function powerUpPlayer() {
        if (!player.powered) {
            player.powered = true;
            // Grow taller
            const oldH = player.h;
            player.h = PLAYER_POWERED_H;
            player.y -= (PLAYER_POWERED_H - oldH); // Adjust so feet stay in place
            player.invincible = 30; // Brief flash
            score += 200;
            sfx.powerUp();
            spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#ffff00', 15, 5);
        } else {
            // Already powered: bonus score
            score += 500;
            sfx.powerUp();
        }
    }

    // ===== ENEMY UPDATE =====
    function updateEnemies() {
        enemies.forEach(e => {
            if (!e.alive) return;

            switch (e.type) {
                case 'slime':
                    e.x += e.vx * dtScale;
                    e.vy += GRAVITY * dtScale;
                    if (e.vy > MAX_FALL) e.vy = MAX_FALL;
                    e.y += e.vy * dtScale;
                    resolveCollisionX(e);
                    resolveCollisionY(e);
                    // Edge detection: reverse at ledges
                    edgeDetect(e);
                    break;

                case 'flyingEye':
                    e.x += e.vx * dtScale;
                    e.floatPhase += 0.04 * dtScale;
                    e.y = e.baseY + Math.sin(e.floatPhase) * 40;
                    // Reverse at walls
                    const colL = Math.floor(e.x / TILE);
                    const colR = Math.floor((e.x + e.w) / TILE);
                    if (isSolid(colL, Math.floor(e.y / TILE)) || isSolid(colR, Math.floor(e.y / TILE))) {
                        e.vx = -e.vx;
                    }
                    break;

                case 'shell':
                    if (e.shellMode) {
                        e.x += e.shellVx * dtScale;
                        e.vy += GRAVITY * dtScale;
                        e.y += e.vy * dtScale;
                        // Shell kills other enemies
                        if (e.shellVx !== 0) {
                            enemies.forEach(other => {
                                if (other !== e && other.alive && aabb(e, other)) {
                                    killEnemy(other);
                                    score += 200;
                                }
                            });
                        }
                        resolveCollisionX(e);
                        resolveCollisionY(e);
                        // Shell wall bounce
                        const sCol = Math.floor(e.x / TILE);
                        const sColR = Math.floor((e.x + e.w) / TILE);
                        const sRow = Math.floor((e.y + e.h / 2) / TILE);
                        if (e.shellVx > 0 && isSolid(sColR, sRow)) e.shellVx = -e.shellVx;
                        if (e.shellVx < 0 && isSolid(sCol, sRow)) e.shellVx = -e.shellVx;
                    } else {
                        e.x += e.vx * dtScale;
                        e.vy += GRAVITY * dtScale;
                        if (e.vy > MAX_FALL) e.vy = MAX_FALL;
                        e.y += e.vy * dtScale;
                        resolveCollisionX(e);
                        resolveCollisionY(e);
                        edgeDetect(e);
                    }
                    break;

                case 'fireSkull':
                    e.fireTimer += dtScale;
                    if (e.fireTimer >= e.fireInterval) {
                        e.fireTimer = 0;
                        // Fire in player direction
                        const dx = player.x - e.x;
                        const dir = dx > 0 ? 1 : -1;
                        fireballs.push({
                            x: e.x + e.w / 2, y: e.y + e.h / 2,
                            vx: dir * 3.5, vy: 0,
                            w: 12, h: 12, life: 180,
                        });
                    }
                    break;

                case 'dashGhost':
                    if (!e.dashTriggered) {
                        const distX = player.x - e.x;
                        const distY = player.y - e.y;
                        const dist = Math.sqrt(distX * distX + distY * distY);
                        if (dist < e.detectionRange) {
                            e.dashTriggered = true;
                            e.vx = (distX > 0 ? 1 : -1) * e.dashSpeed;
                        }
                    } else {
                        e.x += e.vx * dtScale;
                        e.vy += GRAVITY * 0.3 * dtScale;
                        e.y += e.vy * dtScale;
                        // Reset if off screen
                        if (e.x < camera.x - 200 || e.x > camera.x + CANVAS_W + 200 || e.y > mapHeight * TILE + 200) {
                            e.x = e.startX;
                            e.y = e.startY;
                            e.vx = 0;
                            e.vy = 0;
                            e.dashTriggered = false;
                        }
                    }
                    break;
            }

            // Collision with player
            if (e.alive && !player.dead && player.invincible <= 0 && aabb(player, e)) {
                // Stationary shell: always kickable from ANY direction (like Mario)
                if (e.type === 'shell' && e.shellMode && e.shellVx === 0) {
                    const playerCenterX = player.x + player.w / 2;
                    const shellCenterX = e.x + e.w / 2;
                    const kickDir = playerCenterX < shellCenterX ? 1 : -1;
                    e.shellVx = kickDir * 7;
                    player.vy = PLAYER_JUMP * 0.5;
                    score += 50;
                    sfx.stomp();
                }
                // Stomping: player falling onto enemy from above
                else if (player.vy > 0 && player.y + player.h - e.y < 16) {
                    if (e.type === 'fireSkull') {
                        // Can't stomp fire skull
                        playerHit();
                    } else if (e.type === 'shell' && !e.shellMode) {
                        // Shell: enter shell mode
                        e.shellMode = true;
                        e.vx = 0;
                        e.h = 20;
                        player.vy = PLAYER_JUMP * 0.6;
                        score += 100;
                        spawnParticles(e.x + e.w / 2, e.y, '#20c060', 8, 3);
                        sfx.stomp();
                    } else {
                        killEnemy(e);
                        player.vy = PLAYER_JUMP * 0.6;
                        score += 100;
                    }
                } else {
                    // Side/bottom collision with non-shell or moving shell = damage
                    playerHit();
                }
            }
        });

        // Fireballs
        for (let i = fireballs.length - 1; i >= 0; i--) {
            const fb = fireballs[i];
            fb.x += fb.vx * dtScale;
            fb.y += fb.vy * dtScale;
            fb.life -= dtScale;
            // Hit player
            if (!player.dead && player.invincible <= 0 && aabb(player, fb)) {
                playerHit();
                fireballs.splice(i, 1);
                continue;
            }
            // Hit wall or expired
            const fCol = Math.floor(fb.x / TILE);
            const fRow = Math.floor(fb.y / TILE);
            if (fb.life <= 0 || isSolid(fCol, fRow)) {
                spawnParticles(fb.x, fb.y, '#ff6020', 5, 2);
                fireballs.splice(i, 1);
            }
        }
    }

    function edgeDetect(e) {
        // Check if ground ahead is gone (to prevent walking off edges)
        const checkX = e.vx > 0 ? e.x + e.w + 2 : e.x - 2;
        const checkCol = Math.floor(checkX / TILE);
        const checkRow = Math.floor((e.y + e.h + 2) / TILE);
        if (!isSolid(checkCol, checkRow)) {
            e.vx = -e.vx;
        }
    }

    function killEnemy(e) {
        e.alive = false;
        spawnParticles(e.x + e.w / 2, e.y + e.h / 2, e.color, 12, 4);
        triggerShake(3, 8);
        sfx.stomp();
    }

    function playerHit() {
        if (player.invincible > 0) return;

        if (player.powered) {
            // Lose power instead of life
            player.powered = false;
            player.h = PLAYER_NORMAL_H;
            player.invincible = 90;
            triggerShake(4, 10);
            spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#ffaa00', 10, 4);
            sfx.hit();
            return;
        }

        lives--;
        player.invincible = 90;
        triggerShake(6, 15);
        spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#ff4444', 15, 5);
        sfx.hit();

        if (lives <= 0) {
            playerDie();
        }
    }

    function playerDie() {
        player.dead = true;
        spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#ff0000', 20, 6);
        triggerShake(8, 20);
        setTimeout(() => {
            if (lives <= 0) {
                state = STATE.OVER;
                dom.overOverlay.classList.remove('hidden');
                dom.finalScore.textContent = `FINAL SCORE: ${score}`;
                sfx.gameOver();
            } else {
                respawnPlayer();
            }
        }, 1000);
    }

    function respawnPlayer() {
        player.x = 80;
        player.y = 200;
        player.vx = 0;
        player.vy = 0;
        player.dead = false;
        player.invincible = 90;
        player.onGround = false;
        player.powered = false;
        player.h = PLAYER_NORMAL_H;
        camera.x = 0;
    }

    // ===== COINS =====
    function updateCoins() {
        coins.forEach(c => {
            if (c.collected) return;
            if (aabb(player, c)) {
                c.collected = true;
                score += 50;
                spawnParticles(c.x + c.w / 2, c.y + c.h / 2, '#ffd700', 8, 3);
                sfx.coin();
            }
        });
    }

    // ===== CAMERA =====
    function updateCamera() {
        const targetX = player.x - CANVAS_W / 3;
        const targetY = player.y - CANVAS_H / 2;
        const lerpFactor = 1 - Math.pow(0.9, dtScale);
        camera.x += (targetX - camera.x) * lerpFactor;
        camera.y += (targetY - camera.y) * lerpFactor;

        // Clamp
        camera.x = Math.max(0, Math.min(camera.x, mapWidth * TILE - CANVAS_W));
        camera.y = Math.max(0, Math.min(camera.y, mapHeight * TILE - CANVAS_H));
    }

    // ===== HUD =====
    function updateHUD() {
        dom.scoreVal.textContent = score;
        dom.stageVal.textContent = STAGES[currentStage].name;
        dom.livesVal.textContent = '❤'.repeat(Math.max(0, lives));
    }

    // ===== DRAWING =====
    function drawBackground() {
        const stage = STAGES[currentStage];
        const colors = stage.bgColors;

        // Sky gradient
        const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
        grad.addColorStop(0, colors[0]);
        grad.addColorStop(0.5, colors[1]);
        grad.addColorStop(1, colors[2]);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Parallax hills
        drawHills(stage.hillColor, 0.2, 180, 100);
        drawHills(stage.hillColor + '88', 0.35, 220, 70);

        // Stars/decorations for cave and sky
        if (stage.theme === 'cave') {
            drawCaveSparkles();
        } else if (stage.theme === 'sky') {
            drawClouds();
        }
    }

    function drawHills(color, parallax, baseY, amp) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, CANVAS_H);
        for (let x = 0; x <= CANVAS_W; x += 4) {
            const worldX = x + camera.x * parallax;
            const y = baseY + Math.sin(worldX * 0.005) * amp * 0.5 + Math.sin(worldX * 0.012) * amp * 0.3;
            ctx.lineTo(x, y);
        }
        ctx.lineTo(CANVAS_W, CANVAS_H);
        ctx.closePath();
        ctx.fill();
    }

    function drawCaveSparkles() {
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 30; i++) {
            const sx = ((i * 137 + frameCount * 0.1) % (CANVAS_W + 200)) - 50;
            const sy = (i * 53) % CANVAS_H;
            const brightness = Math.sin(frameCount * 0.03 + i) * 0.5 + 0.5;
            ctx.globalAlpha = brightness * 0.5;
            ctx.fillRect(sx, sy, 2, 2);
        }
        ctx.globalAlpha = 1;
    }

    function drawClouds() {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        for (let i = 0; i < 8; i++) {
            const cx = ((i * 200 + frameCount * 0.15 - camera.x * 0.05) % (CANVAS_W + 300)) - 100;
            const cy = 50 + (i * 60) % 150;
            drawCloud(cx, cy, 30 + (i % 3) * 15);
        }
    }

    function drawCloud(x, y, s) {
        ctx.beginPath();
        ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.arc(x + s * 0.8, y - s * 0.3, s * 0.7, 0, Math.PI * 2);
        ctx.arc(x - s * 0.6, y - s * 0.1, s * 0.6, 0, Math.PI * 2);
        ctx.arc(x + s * 0.3, y - s * 0.5, s * 0.5, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawTiles() {
        const stage = STAGES[currentStage];
        const startCol = Math.max(0, Math.floor(camera.x / TILE));
        const endCol = Math.min(mapWidth, Math.ceil((camera.x + CANVAS_W) / TILE) + 1);
        const startRow = Math.max(0, Math.floor(camera.y / TILE));
        const endRow = Math.min(mapHeight, Math.ceil((camera.y + CANVAS_H) / TILE) + 1);

        for (let r = startRow; r < endRow; r++) {
            for (let c = startCol; c < endCol; c++) {
                const tile = tiles[r] ? tiles[r][c] : 0;
                const x = c * TILE - camera.x;
                const y = r * TILE - camera.y;

                if (tile === 1) {
                    // Ground
                    ctx.fillStyle = stage.groundColor;
                    ctx.fillRect(x, y, TILE, TILE);
                    // Subtle pattern
                    ctx.fillStyle = 'rgba(0,0,0,0.1)';
                    ctx.fillRect(x + TILE / 2, y, TILE / 2, TILE / 2);
                    ctx.fillRect(x, y + TILE / 2, TILE / 2, TILE / 2);
                } else if (tile === 3) {
                    // Grass top
                    ctx.fillStyle = stage.groundColor;
                    ctx.fillRect(x, y + 4, TILE, TILE - 4);
                    ctx.fillStyle = stage.grassColor;
                    ctx.fillRect(x, y, TILE, 8);
                    // Grass detail
                    ctx.fillStyle = '#66CC66';
                    for (let g = 0; g < 4; g++) {
                        ctx.fillRect(x + g * 8 + 2, y - 2, 3, 4);
                    }
                } else if (tile === 2) {
                    // Brick
                    ctx.fillStyle = stage.brickColor;
                    ctx.fillRect(x, y, TILE, TILE);
                    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x + 1, y + 1, TILE / 2 - 1, TILE / 2 - 1);
                    ctx.strokeRect(x + TILE / 2, y + 1, TILE / 2 - 1, TILE / 2 - 1);
                    ctx.strokeRect(x + 1, y + TILE / 2, TILE - 1, TILE / 2 - 1);
                    // Highlights
                    ctx.fillStyle = 'rgba(255,255,255,0.15)';
                    ctx.fillRect(x + 1, y + 1, TILE - 2, 2);
                } else if (tile === 4) {
                    // ? Block (active)
                    const bob = Math.sin(frameCount * 0.06) * 2;
                    ctx.fillStyle = '#E8A820';
                    ctx.fillRect(x, y + bob * 0.3, TILE, TILE);
                    // Border
                    ctx.strokeStyle = '#B07818';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x + 1, y + 1 + bob * 0.3, TILE - 2, TILE - 2);
                    // Highlight
                    ctx.fillStyle = 'rgba(255,255,255,0.25)';
                    ctx.fillRect(x + 2, y + 2 + bob * 0.3, TILE - 4, 3);
                    // ? symbol
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 18px "Press Start 2P"';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('?', x + TILE / 2, y + TILE / 2 + bob * 0.3);
                    ctx.textBaseline = 'alphabetic';
                } else if (tile === 5) {
                    // Used block (spent ? block)
                    ctx.fillStyle = '#7a6a5a';
                    ctx.fillRect(x, y, TILE, TILE);
                    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
                    // Dot pattern
                    ctx.fillStyle = 'rgba(0,0,0,0.15)';
                    ctx.fillRect(x + TILE / 2 - 2, y + TILE / 2 - 2, 4, 4);
                }
            }
        }
    }

    function drawCoins() {
        coins.forEach(c => {
            if (c.collected) return;
            const x = c.x - camera.x;
            const y = c.y - camera.y + Math.sin(frameCount * 0.06 + c.bobOffset) * 3;

            // Glow
            ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
            ctx.beginPath();
            ctx.arc(x + c.w / 2, y + c.h / 2, 12, 0, Math.PI * 2);
            ctx.fill();

            // Coin body (spinning effect)
            const scaleX = Math.abs(Math.cos(frameCount * 0.05 + c.bobOffset));
            const coinW = c.w * scaleX;
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(x + (c.w - coinW) / 2, y, coinW, c.h);
            ctx.fillStyle = '#FFC107';
            ctx.fillRect(x + (c.w - coinW) / 2 + 2, y + 2, Math.max(0, coinW - 4), c.h - 4);

            // $ symbol
            if (scaleX > 0.3) {
                ctx.fillStyle = '#B8860B';
                ctx.font = '10px "Press Start 2P"';
                ctx.textAlign = 'center';
                ctx.fillText('$', x + c.w / 2, y + c.h - 4);
            }
        });
    }

    function drawMushrooms() {
        mushrooms.forEach(m => {
            if (m.collected) return;
            const x = m.x - camera.x;
            const y = m.y - camera.y;

            // Mushroom cap (red dome)
            ctx.fillStyle = '#E02020';
            ctx.beginPath();
            ctx.ellipse(x + m.w / 2, y + 8, m.w / 2 + 2, 12, 0, Math.PI, 0);
            ctx.fill();

            // White spots on cap
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(x + 6, y + 2, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x + 18, y + 2, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x + 12, y - 2, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Stem
            ctx.fillStyle = '#F5E0C0';
            ctx.fillRect(x + 5, y + 8, m.w - 10, m.h - 8);

            // Eyes
            ctx.fillStyle = '#000';
            ctx.fillRect(x + 7, y + 12, 3, 3);
            ctx.fillRect(x + 14, y + 12, 3, 3);

            // Subtle glow
            ctx.globalAlpha = 0.2 + Math.sin(frameCount * 0.08) * 0.1;
            ctx.fillStyle = '#ff4444';
            ctx.beginPath();
            ctx.arc(x + m.w / 2, y + m.h / 2, m.w / 2 + 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        });
    }

    function drawPlayer() {
        if (player.dead) return;
        if (player.invincible > 0 && Math.floor(player.invincible / 4) % 2 === 0) return;

        const x = player.x - camera.x;
        const y = player.y - camera.y;
        const f = player.facing;
        const pw = player.powered;

        ctx.save();
        ctx.translate(x + player.w / 2, y + player.h / 2);
        ctx.scale(f, 1);

        if (pw) {
            // === POWERED PLAYER (taller) ===
            // Body (white suit)
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(-player.w / 2, -player.h / 2 + 10, player.w, player.h - 16);
            // Red overalls
            ctx.fillStyle = '#FF4444';
            ctx.fillRect(-player.w / 2, -player.h / 2 + 22, player.w, player.h - 28);

            // Head
            ctx.fillStyle = '#FFCC88';
            ctx.fillRect(-player.w / 2 + 2, -player.h / 2, player.w - 4, 14);

            // Hat (red with white stripe)
            ctx.fillStyle = '#FF2222';
            ctx.fillRect(-player.w / 2, -player.h / 2 - 3, player.w, 7);
            ctx.fillRect(-player.w / 2 + player.w - 4, -player.h / 2 - 3, 6, 7);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(-player.w / 2 + 2, -player.h / 2 - 1, player.w - 6, 2);

            // Eye
            ctx.fillStyle = '#000';
            ctx.fillRect(2, -player.h / 2 + 6, 3, 3);

            // Power glow
            ctx.globalAlpha = 0.15 + Math.sin(frameCount * 0.1) * 0.1;
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.arc(0, 0, player.w * 0.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;

            // Legs (animated)
            ctx.fillStyle = '#4444CC';
            const legOffset = player.onGround && Math.abs(player.vx) > 0.5
                ? Math.sin(player.animFrame * Math.PI / 2) * 4 : 0;
            ctx.fillRect(-player.w / 2 + 2, player.h / 2 - 8, 8, 8 + legOffset);
            ctx.fillRect(player.w / 2 - 10, player.h / 2 - 8, 8, 8 - legOffset);

            // Shoes
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(-player.w / 2 + 1, player.h / 2 - 2 + legOffset, 10, 4);
            ctx.fillRect(player.w / 2 - 11, player.h / 2 - 2 - legOffset, 10, 4);
        } else {
            // === NORMAL PLAYER ===
            // Body
            ctx.fillStyle = '#FF4444';
            ctx.fillRect(-player.w / 2, -player.h / 2 + 8, player.w, player.h - 12);

            // Head
            ctx.fillStyle = '#FFCC88';
            ctx.fillRect(-player.w / 2 + 2, -player.h / 2, player.w - 4, 12);

            // Hat
            ctx.fillStyle = '#FF2222';
            ctx.fillRect(-player.w / 2, -player.h / 2 - 2, player.w, 6);
            ctx.fillRect(-player.w / 2 + player.w - 4, -player.h / 2 - 2, 6, 6);

            // Eye
            ctx.fillStyle = '#000';
            ctx.fillRect(2, -player.h / 2 + 5, 3, 3);

            // Legs (animated)
            ctx.fillStyle = '#4444CC';
            const legOffset = player.onGround && Math.abs(player.vx) > 0.5
                ? Math.sin(player.animFrame * Math.PI / 2) * 3 : 0;
            ctx.fillRect(-player.w / 2 + 2, player.h / 2 - 6, 8, 6 + legOffset);
            ctx.fillRect(player.w / 2 - 10, player.h / 2 - 6, 8, 6 - legOffset);

            // Shoes
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(-player.w / 2 + 1, player.h / 2 - 2 + legOffset, 10, 4);
            ctx.fillRect(player.w / 2 - 11, player.h / 2 - 2 - legOffset, 10, 4);
        }

        ctx.restore();
    }

    function drawEnemies() {
        enemies.forEach(e => {
            if (!e.alive) return;
            const x = e.x - camera.x;
            const y = e.y - camera.y;

            switch (e.type) {
                case 'slime':
                    drawSlime(x, y, e);
                    break;
                case 'flyingEye':
                    drawFlyingEye(x, y, e);
                    break;
                case 'shell':
                    drawShell(x, y, e);
                    break;
                case 'fireSkull':
                    drawFireSkull(x, y, e);
                    break;
                case 'dashGhost':
                    drawDashGhost(x, y, e);
                    break;
            }
        });

        // Fireballs
        fireballs.forEach(fb => {
            const fx = fb.x - camera.x;
            const fy = fb.y - camera.y;
            // Glow
            ctx.fillStyle = 'rgba(255, 100, 0, 0.4)';
            ctx.beginPath();
            ctx.arc(fx + 6, fy + 6, 14, 0, Math.PI * 2);
            ctx.fill();
            // Fireball
            ctx.fillStyle = '#FF6600';
            ctx.beginPath();
            ctx.arc(fx + 6, fy + 6, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FFCC00';
            ctx.beginPath();
            ctx.arc(fx + 6, fy + 6, 3, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    function drawSlime(x, y, e) {
        const squish = 1 + Math.sin(frameCount * 0.08) * 0.1;
        // Body
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.ellipse(x + e.w / 2, y + e.h - 5, e.w / 2 * squish, (e.h / 2) / squish, 0, 0, Math.PI * 2);
        ctx.fill();
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.ellipse(x + e.w / 2 - 3, y + e.h - 12, 4, 3, -0.3, 0, Math.PI * 2);
        ctx.fill();
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 6, y + e.h - 16, 5, 5);
        ctx.fillRect(x + 16, y + e.h - 16, 5, 5);
        ctx.fillStyle = '#000';
        ctx.fillRect(x + 8, y + e.h - 14, 2, 3);
        ctx.fillRect(x + 18, y + e.h - 14, 2, 3);
    }

    function drawFlyingEye(x, y, e) {
        // Wings
        const wingFlap = Math.sin(frameCount * 0.2) * 8;
        ctx.fillStyle = '#d080ff';
        ctx.beginPath();
        ctx.moveTo(x, y + 14);
        ctx.lineTo(x - 10, y + 6 + wingFlap);
        ctx.lineTo(x - 5, y + 14);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + e.w, y + 14);
        ctx.lineTo(x + e.w + 10, y + 6 + wingFlap);
        ctx.lineTo(x + e.w + 5, y + 14);
        ctx.fill();
        // Eye body
        ctx.fillStyle = '#f0e0ff';
        ctx.beginPath();
        ctx.arc(x + e.w / 2, y + e.h / 2, e.w / 2, 0, Math.PI * 2);
        ctx.fill();
        // Iris
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(x + e.w / 2 + 2, y + e.h / 2, 6, 0, Math.PI * 2);
        ctx.fill();
        // Pupil
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(x + e.w / 2 + 3, y + e.h / 2, 3, 0, Math.PI * 2);
        ctx.fill();
        // Veins
        ctx.strokeStyle = '#ff6688';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 8); ctx.lineTo(x + 10, y + 14);
        ctx.moveTo(x + e.w - 4, y + 10); ctx.lineTo(x + e.w - 8, y + 16);
        ctx.stroke();
    }

    function drawShell(x, y, e) {
        if (e.shellMode) {
            // Shell only
            ctx.fillStyle = '#1a6040';
            ctx.fillRect(x, y + 4, e.w, e.h - 4);
            ctx.fillStyle = e.color;
            ctx.beginPath();
            ctx.arc(x + e.w / 2, y + 8, e.w / 2, Math.PI, 0);
            ctx.fill();
            // Pattern
            ctx.strokeStyle = '#0a4030';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x + e.w / 2, y + 4);
            ctx.lineTo(x + e.w / 2, y + e.h);
            ctx.moveTo(x + 4, y + e.h / 2);
            ctx.lineTo(x + e.w - 4, y + e.h / 2);
            ctx.stroke();
        } else {
            // Full turtle
            // Shell
            ctx.fillStyle = e.color;
            ctx.beginPath();
            ctx.arc(x + e.w / 2, y + 10, e.w / 2, Math.PI, 0);
            ctx.fill();
            ctx.fillRect(x, y + 10, e.w, e.h / 2);
            // Shell pattern
            ctx.strokeStyle = '#0a6030';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(x + e.w / 2, y + 12, 6, 0, Math.PI * 2);
            ctx.stroke();
            // Head
            ctx.fillStyle = '#90CC60';
            const headDir = e.vx > 0 ? 1 : -1;
            ctx.fillRect(x + (headDir > 0 ? e.w - 2 : -6), y + 8, 8, 10);
            // Eyes
            ctx.fillStyle = '#000';
            ctx.fillRect(x + (headDir > 0 ? e.w + 2 : -4), y + 10, 2, 2);
            // Feet
            ctx.fillStyle = '#90CC60';
            ctx.fillRect(x + 2, y + e.h - 4, 6, 4);
            ctx.fillRect(x + e.w - 8, y + e.h - 4, 6, 4);
        }
    }

    function drawFireSkull(x, y, e) {
        // Flames (behind)
        for (let i = 0; i < 5; i++) {
            const flameH = 8 + Math.sin(frameCount * 0.15 + i) * 6;
            ctx.fillStyle = `rgba(255, ${80 + i * 30}, 0, ${0.3 + Math.random() * 0.3})`;
            ctx.beginPath();
            ctx.arc(x + e.w / 2 + (i - 2) * 5, y - flameH / 2 + 4, 5 + Math.random() * 3, 0, Math.PI * 2);
            ctx.fill();
        }
        // Skull
        ctx.fillStyle = '#f8f8e8';
        ctx.beginPath();
        ctx.arc(x + e.w / 2, y + e.h / 2, e.w / 2 - 2, 0, Math.PI * 2);
        ctx.fill();
        // Eye sockets
        ctx.fillStyle = '#200';
        ctx.fillRect(x + 6, y + 8, 6, 7);
        ctx.fillRect(x + 16, y + 8, 6, 7);
        // Fire in eyes
        const eyeGlow = Math.sin(frameCount * 0.1) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255, ${100 + eyeGlow * 155}, 0, ${0.5 + eyeGlow * 0.5})`;
        ctx.fillRect(x + 7, y + 9, 4, 5);
        ctx.fillRect(x + 17, y + 9, 4, 5);
        // Nose
        ctx.fillStyle = '#200';
        ctx.beginPath();
        ctx.moveTo(x + e.w / 2, y + 17);
        ctx.lineTo(x + e.w / 2 - 2, y + 20);
        ctx.lineTo(x + e.w / 2 + 2, y + 20);
        ctx.fill();
        // Teeth
        ctx.fillStyle = '#200';
        ctx.fillRect(x + 8, y + 22, 3, 3);
        ctx.fillRect(x + 13, y + 22, 3, 3);
        ctx.fillRect(x + 18, y + 22, 3, 3);
    }

    function drawDashGhost(x, y, e) {
        const alpha = e.dashTriggered ? 0.7 : 0.5 + Math.sin(frameCount * 0.05) * 0.2;
        ctx.globalAlpha = alpha;

        // Ghost body
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(x + e.w / 2, y + e.h / 2 - 2, e.w / 2, Math.PI, 0);
        ctx.lineTo(x + e.w, y + e.h);
        // Wavy bottom
        for (let i = e.w; i >= 0; i -= 6) {
            const wiggle = Math.sin(frameCount * 0.1 + i * 0.3) * 3;
            ctx.lineTo(x + i, y + e.h + wiggle);
        }
        ctx.closePath();
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 7, y + 10, 6, 6);
        ctx.fillRect(x + 16, y + 10, 6, 6);
        ctx.fillStyle = e.dashTriggered ? '#ff0000' : '#300050';
        ctx.fillRect(x + 9, y + 12, 3, 3);
        ctx.fillRect(x + 18, y + 12, 3, 3);

        // Anger mark when dashing
        if (e.dashTriggered) {
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x + e.w - 2, y + 2);
            ctx.lineTo(x + e.w + 2, y + 6);
            ctx.moveTo(x + e.w + 2, y + 2);
            ctx.lineTo(x + e.w - 2, y + 6);
            ctx.stroke();
        }

        // Trail when dashing
        if (e.dashTriggered) {
            for (let t = 1; t <= 3; t++) {
                ctx.globalAlpha = alpha * (0.3 / t);
                ctx.fillStyle = e.color;
                ctx.beginPath();
                ctx.arc(x + e.w / 2 - e.vx * t * 3, y + e.h / 2 - 2, e.w / 2 - t * 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.globalAlpha = 1;
    }

    function drawGoal() {
        const gx = goalX - camera.x;
        const gy = 0;

        // Flag pole
        ctx.fillStyle = '#888';
        ctx.fillRect(gx + 14, gy + 100, 4, CANVAS_H - 100);

        // Flag
        const flagWave = Math.sin(frameCount * 0.05) * 3;
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.moveTo(gx + 18, gy + 110);
        ctx.lineTo(gx + 50 + flagWave, gy + 125);
        ctx.lineTo(gx + 18, gy + 140);
        ctx.closePath();
        ctx.fill();

        // Star on flag
        ctx.fillStyle = '#FF4444';
        ctx.font = '14px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('★', gx + 32 + flagWave / 2, gy + 130);
    }

    // ===== MAIN RENDER =====
    function draw() {
        ctx.save();

        // Screen shake
        if (shakeTimer > 0) {
            shakeTimer--;
            const sx = (Math.random() - 0.5) * shakeIntensity;
            const sy = (Math.random() - 0.5) * shakeIntensity;
            ctx.translate(sx, sy);
        }

        drawBackground();
        drawTiles();
        drawCoins();
        drawMushrooms();
        drawGoal();
        drawEnemies();
        drawBoss();
        drawPlayer();
        drawParticles();

        ctx.restore();
    }

    // ===== GAME FLOW =====
    function startGame() {
        initAudio();
        state = STATE.PLAYING;
        dom.overlay.classList.add('hidden');
        score = 0;
        lives = 3;
        currentStage = 0;
        loadStage(0);
        respawnPlayer();
    }

    function stageClear() {
        state = STATE.CLEAR;
        dom.clearOverlay.classList.remove('hidden');
        dom.clearScore.textContent = `SCORE: ${score}`;
        spawnParticles(player.x, player.y, '#FFD700', 30, 6);
        sfx.stageClear();
    }

    function nextStage() {
        currentStage++;
        if (currentStage >= STAGES.length) {
            // All stages cleared!
            state = STATE.ENDING;
            dom.clearOverlay.classList.add('hidden');
            dom.endOverlay.classList.remove('hidden');
            dom.endScore.textContent = `TOTAL SCORE: ${score}`;
        } else {
            state = STATE.PLAYING;
            dom.clearOverlay.classList.add('hidden');
            loadStage(currentStage);
            respawnPlayer();
        }
    }

    function resetGame() {
        state = STATE.PLAYING;
        dom.overOverlay.classList.add('hidden');
        dom.endOverlay.classList.add('hidden');
        score = 0;
        lives = 3;
        currentStage = 0;
        loadStage(0);
        respawnPlayer();
    }

    // ===== GAME LOOP =====
    function gameLoop(timestamp) {
        // Delta time calculation
        if (lastTime === 0) lastTime = timestamp;
        const rawDt = timestamp - lastTime;
        lastTime = timestamp;
        // Cap dt to prevent spiral of death (e.g. tab switch)
        const dt = Math.min(rawDt, TARGET_DT * 3);
        dtScale = dt / TARGET_DT;

        frameCount++;

        if (state === STATE.PLAYING) {
            updatePlayer();
            updateEnemies();
            updateBoss();
            updateCoins();
            updateMushrooms();
            updateCamera();
            updateParticles();
            updateHUD();
        }

        draw();
        requestAnimationFrame(gameLoop);
    }

    // ===== START =====
    loadStage(0);
    requestAnimationFrame(gameLoop);
})();
