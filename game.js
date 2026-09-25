/**
 * Snake Arcade - Core Game Engine
 * Ultra-Smooth Movement Edition (60/120 FPS Sub-Frame Interpolation)
 * Dynamic Speed Scaling: Starts at 0.75x, grows with snake up to 1.30x MAX
 * Mobile Touch-to-Swipe: Instant continuous directional swiping anywhere on screen
 * Safe Border Portals: Death ONLY on Self-Collision
 */

(function () {
    'use strict';

    // Canvas & Context
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const canvasWrapper = document.getElementById('canvasWrapper');

    // UI Score Elements
    const scoreDisplay = document.getElementById('scoreDisplay');
    const highScoreDisplay = document.getElementById('highScoreDisplay');
    const applesDisplay = document.getElementById('applesDisplay');
    const scoreCard = document.getElementById('scoreCard');

    // Modals
    const startModal = document.getElementById('startModal');
    const pauseModal = document.getElementById('pauseModal');
    const gameOverModal = document.getElementById('gameOverModal');
    const newHighBadge = document.getElementById('newHighBadge');
    const gameOverIcon = document.getElementById('gameOverIcon');
    const gameOverTitle = document.getElementById('gameOverTitle');
    const finalScoreVal = document.getElementById('finalScoreVal');
    const finalBestVal = document.getElementById('finalBestVal');
    const finalApplesVal = document.getElementById('finalApplesVal');
    const finalSpeedVal = document.getElementById('finalSpeedVal');

    // Badges & Floating Alerts
    const goldenBadge = document.getElementById('goldenBadge');
    const bonusTimerFill = document.getElementById('bonusTimerFill');
    const speedBadge = document.getElementById('speedBadge');
    const speedDisplay = document.getElementById('speedDisplay');

    // Header & Control Buttons
    const startBtn = document.getElementById('startBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    const restartBtn = document.getElementById('restartBtn');
    const restartFromPauseBtn = document.getElementById('restartFromPauseBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const pauseIcon = document.getElementById('pauseIcon');
    const soundBtn = document.getElementById('soundBtn');
    const soundIcon = document.getElementById('soundIcon');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const shareBtn = document.getElementById('shareBtn');
    const howToPlayBtn = document.getElementById('howToPlayBtn');

    // Settings & Help Sheets
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsSheet = document.getElementById('settingsSheet');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const soundSwitch = document.getElementById('soundSwitch');
    const vibrationSwitch = document.getElementById('vibrationSwitch');
    const difficultyGroup = document.getElementById('difficultyGroup');
    const controlsGroup = document.getElementById('controlsGroup');

    const helpBtn = document.getElementById('helpBtn');
    const helpSheet = document.getElementById('helpSheet');
    const closeHelpBtn = document.getElementById('closeHelpBtn');
    const gotItBtn = document.getElementById('gotItBtn');

    // Virtual D-Pad Buttons
    const dpadUp = document.getElementById('dpadUp');
    const dpadDown = document.getElementById('dpadDown');
    const dpadLeft = document.getElementById('dpadLeft');
    const dpadRight = document.getElementById('dpadRight');
    const dpadCenter = document.getElementById('dpadCenter');
    const touchController = document.getElementById('touchController');

    // Grid Dimensions
    const GRID_SIZE = 20; // 20 x 20 logical grid
    let cellSize = 24;

    // Base step duration at 1.00x speed (in ms per step)
    const BASE_SPEEDS = {
        easy: 105,
        normal: 90,
        hard: 75
    };

    // SPEED SCALING: Start at 0.75x, scale up to 1.30x MAX as snake grows
    const MIN_SPEED_MULT = 0.75;
    const MAX_SPEED_MULT = 1.30;
    let speedMultiplier = MIN_SPEED_MULT;
    let currentSpeed = Math.round(BASE_SPEEDS.normal / MIN_SPEED_MULT); // ~120ms at start

    // Game Configuration State (Walls are ALWAYS safe wrap - zero wall death)
    const config = {
        difficulty: 'normal',
        wallMode: 'wrap', // Safe infinite portal wrap
        controlsMode: 'both', // 'both', 'swipe', 'dpad'
        sound: true,
        vibration: true
    };

    // Load persisted settings
    const savedConfig = localStorage.getItem('snake_config');
    if (savedConfig) {
        try {
            Object.assign(config, JSON.parse(savedConfig));
            config.wallMode = 'wrap'; // Enforce safe wrap
        } catch (e) {}
    }

    // High score
    let highScore = parseInt(localStorage.getItem('snake_highscore') || '0', 10);
    highScoreDisplay.textContent = highScore;

    // Game Engine State
    let isPlaying = false;
    let isPaused = false;
    let score = 0;
    let applesEaten = 0;
    let lastStepTime = 0;
    let animationFrameId = null;

    // Snake State: array of { x, y, prevX, prevY }
    let snake = [];
    let dir = { x: 1, y: 0 };
    let inputQueue = [];

    // Food State
    let apple = { x: 14, y: 10 };
    let goldenApple = null;
    const GOLDEN_DURATION = 6500; // 6.5 seconds

    // Visual Polish, Animation & Particle System
    let particles = [];
    let floatingTexts = [];
    let digestionBumps = []; // Bulges traveling down the snake when an apple is eaten
    let swipeIndicators = []; // Subtle glowing arrows confirming mobile touch swipes
    let screenShake = 0;

    /**
     * Canvas High-DPI Resizing
     */
    function resizeCanvas() {
        const rect = canvasWrapper.getBoundingClientRect();
        const displayWidth = Math.floor(rect.width);
        const displayHeight = Math.floor(rect.height);

        const dpr = window.devicePixelRatio || 1;
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;

        ctx.resetTransform();
        ctx.scale(dpr, dpr);

        cellSize = displayWidth / GRID_SIZE;
    }

    window.addEventListener('resize', resizeCanvas);

    /**
     * Vibrate Helper for Mobile Haptics
     */
    function triggerHaptic(pattern = 20) {
        if (!config.vibration) return;
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try {
                navigator.vibrate(pattern);
            } catch (e) {}
        }
    }

    /**
     * Speed Multiplier & Display Calculation
     * Starts at 0.75x, grows smoothly to 1.30x MAX as snake grows
     */
    function updateSpeed() {
        // Increases from 0.75x to 1.30x over 25 apples eaten (~0.022 per apple)
        speedMultiplier = Math.min(MAX_SPEED_MULT, +(MIN_SPEED_MULT + applesEaten * 0.022).toFixed(2));
        const base = BASE_SPEEDS[config.difficulty] || BASE_SPEEDS.normal;
        currentSpeed = Math.round(base / speedMultiplier);
        updateSpeedUI();
    }

    function updateSpeedUI() {
        if (!speedDisplay) return;
        if (speedMultiplier >= MAX_SPEED_MULT) {
            speedDisplay.textContent = '1.30x MAX';
            if (speedBadge) speedBadge.classList.add('max-speed');
        } else {
            speedDisplay.textContent = speedMultiplier.toFixed(2) + 'x';
            if (speedBadge) speedBadge.classList.remove('max-speed');
        }
    }

    /**
     * Spawn Random Food Position (never colliding with snake or existing food)
     */
    function getRandomGridPosition() {
        const freeSpots = [];
        for (let x = 0; x < GRID_SIZE; x++) {
            for (let y = 0; y < GRID_SIZE; y++) {
                const inSnake = snake.some(seg => seg.x === x && seg.y === y);
                const inApple = apple && apple.x === x && apple.y === y;
                const inGold = goldenApple && goldenApple.x === x && goldenApple.y === y;
                if (!inSnake && !inApple && !inGold) {
                    freeSpots.push({ x, y });
                }
            }
        }
        if (freeSpots.length === 0) return { x: 0, y: 0 };
        return freeSpots[Math.floor(Math.random() * freeSpots.length)];
    }

    function spawnApple() {
        apple = getRandomGridPosition();
    }

    function trySpawnGoldenApple() {
        if (!goldenApple && applesEaten > 0 && (applesEaten % 5 === 0 || Math.random() < 0.22)) {
            goldenApple = {
                ...getRandomGridPosition(),
                spawnTime: performance.now(),
                duration: GOLDEN_DURATION
            };
            if (goldenBadge) goldenBadge.classList.add('active');
        }
    }

    /**
     * Particle & Floating Score Spawners
     */
    function createParticles(x, y, color, count = 18) {
        const pixelX = (x + 0.5) * cellSize;
        const pixelY = (y + 0.5) * cellSize;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.2 + Math.random() * 3.8;
            particles.push({
                x: pixelX,
                y: pixelY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 2.5 + Math.random() * 3.5,
                color: color,
                alpha: 1,
                decay: 0.02 + Math.random() * 0.03
            });
        }
    }

    function createFloatingText(text, x, y, color = '#34d399') {
        floatingTexts.push({
            text: text,
            x: (x + 0.5) * cellSize,
            y: (y + 0.5) * cellSize,
            alpha: 1,
            color: color,
            vy: -1.2
        });
    }

    /**
     * Start / Reset Game
     */
    function initGame() {
        resizeCanvas();

        // Initial snake: 3 segments placed horizontally
        snake = [
            { x: 6, y: 10, prevX: 5, prevY: 10 },
            { x: 5, y: 10, prevX: 4, prevY: 10 },
            { x: 4, y: 10, prevX: 3, prevY: 10 }
        ];
        dir = { x: 1, y: 0 };
        inputQueue = [];

        score = 0;
        applesEaten = 0;

        // Reset speed to 0.75x
        speedMultiplier = MIN_SPEED_MULT;
        const base = BASE_SPEEDS[config.difficulty] || BASE_SPEEDS.normal;
        currentSpeed = Math.round(base / speedMultiplier);
        updateSpeedUI();

        scoreDisplay.textContent = '0';
        applesDisplay.textContent = '0';

        particles = [];
        floatingTexts = [];
        digestionBumps = [];
        swipeIndicators = [];
        goldenApple = null;
        if (goldenBadge) goldenBadge.classList.remove('active');

        spawnApple();

        isPlaying = true;
        isPaused = false;
        lastStepTime = performance.now();

        // Hide overlays
        startModal.classList.remove('active');
        pauseModal.classList.remove('active');
        gameOverModal.classList.remove('active');
        newHighBadge.style.display = 'none';

        pauseIcon.textContent = '⏸️';

        if (window.soundManager) {
            window.soundManager.playResume();
        }

        if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(gameLoop);
        }
    }

    /**
     * Direction Input Queuing (prevents 180-degree instant suicide)
     */
    function setDirection(newX, newY) {
        if (!isPlaying || isPaused) return;

        const lastDir = inputQueue.length > 0 ? inputQueue[inputQueue.length - 1] : dir;

        // Prevent 180-degree reversal into own neck
        if (newX === -lastDir.x && newY === -lastDir.y) return;
        // Prevent redundant identical direction
        if (newX === lastDir.x && newY === lastDir.y) return;

        // Queue input (up to 2 buffered turns)
        if (inputQueue.length < 2) {
            inputQueue.push({ x: newX, y: newY });
            if (window.soundManager) {
                window.soundManager.playTurn();
            }
        }
    }

    /**
     * Main Physics Update Step
     * Safe Portal Borders: Snake NEVER dies on walls.
     * Death happens ONLY when the snake collides with its own body.
     */
    function updateGame() {
        if (!isPlaying || isPaused) return;

        // Consume queued direction
        if (inputQueue.length > 0) {
            dir = inputQueue.shift();
        }

        // Calculate new head coordinate
        let newX = snake[0].x + dir.x;
        let newY = snake[0].y + dir.y;

        // SAFE PORTAL BORDERS: Wrap seamlessly across edges (never die on walls)
        newX = ((newX % GRID_SIZE) + GRID_SIZE) % GRID_SIZE;
        newY = ((newY % GRID_SIZE) + GRID_SIZE) % GRID_SIZE;

        // Check if food will be eaten this step
        const willGrow = (newX === apple.x && newY === apple.y) || 
                         (goldenApple && newX === goldenApple.x && newY === goldenApple.y);

        // SELF-COLLISION CHECK: ONLY self-collision can kill the snake!
        const checkLength = willGrow ? snake.length : snake.length - 1;
        for (let i = 0; i < checkLength; i++) {
            if (snake[i].x === newX && snake[i].y === newY) {
                handleGameOver('Self Collision');
                return;
            }
        }

        // Record previous positions for smooth 60fps sub-pixel interpolation
        const oldPositions = snake.map(seg => ({ x: seg.x, y: seg.y }));

        // Create new head segment
        const newHead = {
            x: newX,
            y: newY,
            prevX: snake[0].x,
            prevY: snake[0].y
        };

        // Update body segments
        for (let i = 0; i < snake.length; i++) {
            snake[i].prevX = oldPositions[i].x;
            snake[i].prevY = oldPositions[i].y;
            if (i > 0) {
                snake[i].x = oldPositions[i - 1].x;
                snake[i].y = oldPositions[i - 1].y;
            } else {
                snake[i].x = newX;
                snake[i].y = newY;
            }
        }

        snake.unshift(newHead);

        // Check Food Eaten
        let ateSomething = false;

        // 1. Regular Red Apple
        if (newX === apple.x && newY === apple.y) {
            ateSomething = true;
            score += 10;
            applesEaten++;
            scoreDisplay.textContent = score;
            applesDisplay.textContent = applesEaten;

            scoreDisplay.classList.add('bump');
            setTimeout(() => scoreDisplay.classList.remove('bump'), 150);

            createParticles(apple.x, apple.y, '#ef4444', 20);
            createFloatingText('+10', apple.x, apple.y, '#f87171');
            triggerHaptic(25);

            // Add digestion wave swell that travels down the snake
            digestionBumps.push({ segmentIndex: 0 });

            if (window.soundManager) {
                window.soundManager.playEat();
            }

            // DYNAMIC SPEED SCALING: Speed increases as snake grows (capped at 1.30x)
            updateSpeed();

            spawnApple();
            trySpawnGoldenApple();
        }

        // 2. Golden Apple
        if (goldenApple && newX === goldenApple.x && newY === goldenApple.y) {
            ateSomething = true;
            score += 30;
            scoreDisplay.textContent = score;

            scoreDisplay.classList.add('bump');
            setTimeout(() => scoreDisplay.classList.remove('bump'), 150);

            createParticles(goldenApple.x, goldenApple.y, '#f59e0b', 28);
            createFloatingText('+30 ⭐', goldenApple.x, goldenApple.y, '#fbbf24');
            triggerHaptic([30, 20, 40]);
            screenShake = 6;

            digestionBumps.push({ segmentIndex: 0 });

            if (window.soundManager) {
                window.soundManager.playGoldenEat();
            }

            goldenApple = null;
            if (goldenBadge) goldenBadge.classList.remove('active');
        }

        // If no food was eaten, pop tail
        if (!ateSomething) {
            snake.pop();
        } else {
            // Keep tail anchored for smooth stretching during eating
            const tail = snake[snake.length - 1];
            tail.prevX = tail.x;
            tail.prevY = tail.y;
        }

        // Advance digestion bumps down the snake
        for (let i = digestionBumps.length - 1; i >= 0; i--) {
            digestionBumps[i].segmentIndex++;
            if (digestionBumps[i].segmentIndex >= snake.length) {
                digestionBumps.splice(i, 1);
            }
        }

        // Check & Update High Score
        if (score > highScore) {
            highScore = score;
            highScoreDisplay.textContent = highScore;
            localStorage.setItem('snake_highscore', highScore.toString());
        }
    }

    /**
     * Game Over Handler - Triggered ONLY upon Self-Collision
     */
    function handleGameOver(reason) {
        isPlaying = false;
        screenShake = 14;
        triggerHaptic([60, 40, 90]);

        if (window.soundManager) {
            window.soundManager.playGameOver();
        }

        // Explode snake body into glowing particles
        snake.forEach(seg => {
            createParticles(seg.x, seg.y, '#10b981', 5);
        });

        // Update Game Over Modal Stats
        finalScoreVal.textContent = score;
        finalBestVal.textContent = highScore;
        finalApplesVal.textContent = applesEaten;
        if (finalSpeedVal) {
            finalSpeedVal.textContent = (speedMultiplier >= MAX_SPEED_MULT) ? '1.30x MAX' : speedMultiplier.toFixed(2) + 'x';
        }

        // High Score celebration check
        if (score > 0 && score >= highScore) {
            newHighBadge.style.display = 'inline-block';
            gameOverIcon.textContent = '🏆';
            gameOverTitle.textContent = 'New High Score!';
            if (window.soundManager) {
                setTimeout(() => window.soundManager.playNewHighScore(), 350);
            }
        } else {
            newHighBadge.style.display = 'none';
            gameOverIcon.textContent = '💥';
            gameOverTitle.textContent = 'Self Collision!';
        }

        setTimeout(() => {
            gameOverModal.classList.add('active');
        }, 450);
    }

    /**
     * Pause / Resume
     */
    function togglePause() {
        if (!isPlaying) return;

        isPaused = !isPaused;
        if (isPaused) {
            pauseModal.classList.add('active');
            pauseIcon.textContent = '▶️';
            if (window.soundManager) window.soundManager.playPause();
        } else {
            pauseModal.classList.remove('active');
            pauseIcon.textContent = '⏸️';
            lastStepTime = performance.now();
            if (window.soundManager) window.soundManager.playResume();
        }
    }

    /**
     * Helper: Continuous coordinate interpolation with safe screen wrap
     */
    function getInterpolatedCoord(prev, curr, progress) {
        let diff = curr - prev;
        if (diff < -GRID_SIZE / 2) {
            diff += GRID_SIZE; // Wrapped right-to-left
        } else if (diff > GRID_SIZE / 2) {
            diff -= GRID_SIZE; // Wrapped left-to-right
        }
        let val = prev + diff * progress;
        return ((val % GRID_SIZE) + GRID_SIZE) % GRID_SIZE;
    }

    /**
     * Main Render Routine
     */
    function render(timestamp) {
        const width = canvas.width / (window.devicePixelRatio || 1);
        const height = canvas.height / (window.devicePixelRatio || 1);

        ctx.save();

        // Screen Shake
        if (screenShake > 0) {
            const shakeX = (Math.random() - 0.5) * screenShake * 2;
            const shakeY = (Math.random() - 0.5) * screenShake * 2;
            ctx.translate(shakeX, shakeY);
            screenShake *= 0.88;
            if (screenShake < 0.5) screenShake = 0;
        }

        // Clear Canvas with sleek subtle background
        ctx.fillStyle = '#060911';
        ctx.fillRect(0, 0, width, height);

        // Clip to canvas arena so wrap portal transitions are crisp and clean
        ctx.beginPath();
        ctx.rect(0, 0, width, height);
        ctx.clip();

        drawGrid(width, height);

        // Draw Food (Apples)
        drawFood(timestamp);

        // Calculate sub-frame progress between 0 and 1 for buttery 60fps movement
        const progress = (isPlaying && !isPaused)
            ? Math.min(1, Math.max(0, (timestamp - lastStepTime) / currentSpeed))
            : 1;

        // Draw Smooth Connected Snake
        drawSmoothSnake(timestamp, progress);

        // Draw Swipe Direction Indicators (visual feedback for mobile touch gestures)
        drawSwipeIndicators();

        // Draw Particles & Floating Texts
        drawParticles();
        drawFloatingTexts();

        ctx.restore();
    }

    /**
     * Draw Grid Lines
     */
    function drawGrid(w, h) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
        ctx.lineWidth = 1;

        ctx.beginPath();
        for (let x = 0; x <= w; x += cellSize) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
        }
        for (let y = 0; y <= h; y += cellSize) {
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
        }
        ctx.stroke();
    }

    /**
     * Draw Food (Juicy Red Apple & Golden Apple)
     */
    function drawFood(timestamp) {
        const time = timestamp / 1000;

        // 1. Regular Apple
        if (apple) {
            const px = apple.x * cellSize;
            const py = apple.y * cellSize;
            const pulse = Math.sin(time * 4) * 0.07 + 1;

            ctx.save();
            ctx.translate(px + cellSize / 2, py + cellSize / 2);
            ctx.scale(pulse, pulse);

            // Red apple glow
            ctx.shadowColor = 'rgba(239, 68, 68, 0.7)';
            ctx.shadowBlur = 14;

            // Apple Body
            const rad = cellSize * 0.38;
            const appleGrad = ctx.createRadialGradient(-rad * 0.3, -rad * 0.3, rad * 0.2, 0, 0, rad);
            appleGrad.addColorStop(0, '#f87171');
            appleGrad.addColorStop(0.7, '#ef4444');
            appleGrad.addColorStop(1, '#b91c1c');

            ctx.fillStyle = appleGrad;
            ctx.beginPath();
            ctx.arc(0, 2, rad, 0, Math.PI * 2);
            ctx.fill();

            // Apple stem
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#78350f';
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(0, -rad + 2);
            ctx.quadraticCurveTo(2, -rad - 4, 4, -rad - 5);
            ctx.stroke();

            // Apple leaf
            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.ellipse(3, -rad - 2, 4, 2, Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();

            // Apple shine highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
            ctx.beginPath();
            ctx.ellipse(-rad * 0.35, -rad * 0.3, rad * 0.28, rad * 0.16, -Math.PI / 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }

        // 2. Golden Apple (Timed bonus)
        if (goldenApple) {
            const now = performance.now();
            const elapsed = now - goldenApple.spawnTime;
            const remainingRatio = Math.max(0, 1 - elapsed / goldenApple.duration);

            if (remainingRatio <= 0) {
                goldenApple = null;
                if (goldenBadge) goldenBadge.classList.remove('active');
                return;
            }

            if (bonusTimerFill) {
                bonusTimerFill.style.width = (remainingRatio * 100) + '%';
            }

            const gx = goldenApple.x * cellSize;
            const gy = goldenApple.y * cellSize;
            const floatOffset = Math.sin(time * 6) * 3;

            ctx.save();
            ctx.translate(gx + cellSize / 2, gy + cellSize / 2 + floatOffset);

            // Timer indicator ring
            ctx.beginPath();
            ctx.arc(0, 0, cellSize * 0.46, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * remainingRatio));
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Golden Glow
            ctx.shadowColor = 'rgba(251, 191, 36, 0.9)';
            ctx.shadowBlur = 18;

            const grad = ctx.createRadialGradient(-2, -2, 2, 0, 0, cellSize * 0.36);
            grad.addColorStop(0, '#fef08a');
            grad.addColorStop(0.5, '#f59e0b');
            grad.addColorStop(1, '#b45309');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, cellSize * 0.35, 0, Math.PI * 2);
            ctx.fill();

            // Star Sparkle
            ctx.fillStyle = '#ffffff';
            ctx.font = `${Math.floor(cellSize * 0.45)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⭐', 0, 0);

            ctx.restore();
        }
    }

    /**
     * Draw Ultra-Smooth Organic Connected Snake
     */
    function drawSmoothSnake(timestamp, progress) {
        if (snake.length === 0) return;

        const time = timestamp / 1000;
        const totalSegs = snake.length;

        // 1. Calculate smoothly interpolated positions
        const points = [];
        for (let i = 0; i < totalSegs; i++) {
            const seg = snake[i];
            const gx = getInterpolatedCoord(seg.prevX, seg.x, progress);
            const gy = getInterpolatedCoord(seg.prevY, seg.y, progress);

            const t = i / Math.max(1, totalSegs - 1);
            let radius = cellSize * (0.42 - 0.16 * t);

            if (digestionBumps.some(b => b.segmentIndex === i)) {
                radius *= 1.28;
            }

            points.push({
                gx: gx,
                gy: gy,
                px: (gx + 0.5) * cellSize,
                py: (gy + 0.5) * cellSize,
                radius: radius
            });
        }

        function drawCapsule(x1, y1, x2, y2, r1, r2, color) {
            ctx.strokeStyle = color;
            ctx.lineWidth = (r1 + r2);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        function drawJoint(x, y, r, color) {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        // 2. Draw Body
        ctx.shadowColor = 'rgba(16, 185, 129, 0.45)';
        ctx.shadowBlur = 10;

        for (let i = totalSegs - 1; i >= 1; i--) {
            const p1 = points[i];
            const p0 = points[i - 1];
            const normProgress = i / totalSegs;

            const redVal = Math.round(16 + (13 - 16) * normProgress);
            const greenVal = Math.round(185 + (148 - 185) * normProgress);
            const blueVal = Math.round(129 + (136 - 129) * normProgress);
            const bodyColor = `rgb(${redVal}, ${greenVal}, ${blueVal})`;

            const dx = p0.gx - p1.gx;
            const dy = p0.gy - p1.gy;
            const wrappedX = Math.abs(dx) > GRID_SIZE / 2;
            const wrappedY = Math.abs(dy) > GRID_SIZE / 2;

            if (!wrappedX && !wrappedY) {
                drawCapsule(p1.px, p1.py, p0.px, p0.py, p1.radius, p0.radius, bodyColor);
                drawJoint(p1.px, p1.py, p1.radius, bodyColor);
            } else {
                let p0VirtualX = p0.px;
                let p0VirtualY = p0.py;
                let p1VirtualX = p1.px;
                let p1VirtualY = p1.py;

                if (wrappedX) {
                    if (dx > 0) {
                        p0VirtualX -= GRID_SIZE * cellSize;
                        p1VirtualX += GRID_SIZE * cellSize;
                    } else {
                        p0VirtualX += GRID_SIZE * cellSize;
                        p1VirtualX -= GRID_SIZE * cellSize;
                    }
                }
                if (wrappedY) {
                    if (dy > 0) {
                        p0VirtualY -= GRID_SIZE * cellSize;
                        p1VirtualY += GRID_SIZE * cellSize;
                    } else {
                        p0VirtualY += GRID_SIZE * cellSize;
                        p1VirtualY -= GRID_SIZE * cellSize;
                    }
                }

                drawCapsule(p1.px, p1.py, p0VirtualX, p0VirtualY, p1.radius, p0.radius, bodyColor);
                drawCapsule(p1VirtualX, p1VirtualY, p0.px, p0.py, p1.radius, p0.radius, bodyColor);
                drawJoint(p1.px, p1.py, p1.radius, bodyColor);
            }

            // Interior spine shine
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
            ctx.beginPath();
            ctx.arc(p1.px, p1.py, p1.radius * 0.45, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 10;
        }

        // 3. Draw Head at points[0]
        const head = points[0];
        let headAngle = 0;

        if (totalSegs > 1) {
            let hdx = head.gx - points[1].gx;
            let hdy = head.gy - points[1].gy;
            if (hdx > GRID_SIZE / 2) hdx -= GRID_SIZE;
            if (hdx < -GRID_SIZE / 2) hdx += GRID_SIZE;
            if (hdy > GRID_SIZE / 2) hdy -= GRID_SIZE;
            if (hdy < -GRID_SIZE / 2) hdy += GRID_SIZE;
            headAngle = Math.atan2(hdy, hdx);
        } else {
            headAngle = Math.atan2(dir.y, dir.x);
        }

        function drawHeadAt(hx, hy) {
            ctx.save();
            ctx.translate(hx, hy);
            ctx.rotate(headAngle);

            ctx.shadowColor = 'rgba(16, 185, 129, 0.85)';
            ctx.shadowBlur = 16;
            ctx.fillStyle = '#10b981';

            ctx.beginPath();
            ctx.arc(0, 0, head.radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.arc(cellSize * 0.1, 0, head.radius * 0.88, -Math.PI / 2, Math.PI / 2);
            ctx.fill();

            ctx.shadowBlur = 0;

            // Expressive Eyes
            const eyeForward = cellSize * 0.12;
            const eyeSpread = cellSize * 0.22;
            const eyeRad = cellSize * 0.16;
            const pupilRad = cellSize * 0.085;

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(eyeForward, -eyeSpread, eyeRad, 0, Math.PI * 2);
            ctx.arc(eyeForward, eyeSpread, eyeRad, 0, Math.PI * 2);
            ctx.fill();

            const pupilForward = eyeForward + cellSize * 0.055;
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.arc(pupilForward, -eyeSpread, pupilRad, 0, Math.PI * 2);
            ctx.arc(pupilForward, eyeSpread, pupilRad, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.beginPath();
            ctx.arc(pupilForward - 1, -eyeSpread - 1, cellSize * 0.03, 0, Math.PI * 2);
            ctx.arc(pupilForward - 1, eyeSpread - 1, cellSize * 0.03, 0, Math.PI * 2);
            ctx.fill();

            // Flicking Tongue
            if (Math.sin(time * 3.5) > 0.65) {
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 2.2;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(head.radius * 0.9, 0);
                ctx.lineTo(head.radius * 1.55, 0);
                ctx.lineTo(head.radius * 1.8, -cellSize * 0.09);
                ctx.moveTo(head.radius * 1.55, 0);
                ctx.lineTo(head.radius * 1.8, cellSize * 0.09);
                ctx.stroke();
            }

            ctx.restore();
        }

        drawHeadAt(head.px, head.py);

        // Seamless Edge Wraps
        if (head.gx < 1) drawHeadAt(head.px + GRID_SIZE * cellSize, head.py);
        if (head.gx > GRID_SIZE - 1) drawHeadAt(head.px - GRID_SIZE * cellSize, head.py);
        if (head.gy < 1) drawHeadAt(head.px, head.py + GRID_SIZE * cellSize);
        if (head.gy > GRID_SIZE - 1) drawHeadAt(head.px, head.py - GRID_SIZE * cellSize);
    }

    /**
     * Visual Touch Swipe Feedback (Glowing Neon Directional Arrow on Screen)
     */
    function triggerSwipeVisual(dx, dy) {
        swipeIndicators.push({
            dx: dx,
            dy: dy,
            alpha: 1.0
        });
    }

    function drawSwipeIndicators() {
        const w = canvas.width / (window.devicePixelRatio || 1);
        const h = canvas.height / (window.devicePixelRatio || 1);

        for (let i = swipeIndicators.length - 1; i >= 0; i--) {
            const ind = swipeIndicators[i];
            ind.alpha -= 0.06;
            if (ind.alpha <= 0) {
                swipeIndicators.splice(i, 1);
                continue;
            }

            ctx.save();
            ctx.globalAlpha = ind.alpha * 0.45;
            ctx.strokeStyle = '#10b981';
            ctx.shadowColor = '#10b981';
            ctx.shadowBlur = 14;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            const cx = w / 2;
            const cy = h / 2;
            const sz = cellSize * 1.3;

            ctx.translate(cx, cy);
            if (ind.dx === 1) ctx.rotate(0);
            else if (ind.dx === -1) ctx.rotate(Math.PI);
            else if (ind.dy === 1) ctx.rotate(Math.PI / 2);
            else if (ind.dy === -1) ctx.rotate(-Math.PI / 2);

            ctx.beginPath();
            ctx.moveTo(-sz * 0.4, -sz * 0.4);
            ctx.lineTo(sz * 0.35, 0);
            ctx.lineTo(-sz * 0.4, sz * 0.4);
            ctx.stroke();

            ctx.restore();
        }
    }

    /**
     * Draw Particles
     */
    function drawParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.94;
            p.vy *= 0.94;
            p.alpha -= p.decay;

            if (p.alpha <= 0) {
                particles.splice(i, 1);
                continue;
            }

            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    /**
     * Draw Floating Score Popups
     */
    function drawFloatingTexts() {
        ctx.font = `bold ${Math.floor(cellSize * 0.55)}px ${getComputedStyle(document.body).getPropertyValue('--font-retro') || 'sans-serif'}`;
        ctx.textAlign = 'center';

        for (let i = floatingTexts.length - 1; i >= 0; i--) {
            const ft = floatingTexts[i];
            ft.y += ft.vy;
            ft.alpha -= 0.025;

            if (ft.alpha <= 0) {
                floatingTexts.splice(i, 1);
                continue;
            }

            ctx.fillStyle = ft.color;
            ctx.globalAlpha = ft.alpha;
            ctx.fillText(ft.text, ft.x, ft.y);
        }
        ctx.globalAlpha = 1;
    }

    /**
     * Main Animation & Game Loop (60/120 FPS requestAnimationFrame)
     */
    function gameLoop(timestamp) {
        if (isPlaying && !isPaused) {
            const elapsed = timestamp - lastStepTime;
            if (elapsed >= currentSpeed) {
                updateGame();
                lastStepTime = timestamp;
            }
        }

        render(timestamp);
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    /**
     * =========================================================================
     * MOBILE TOUCH-TO-SWIPE & PC KEYBOARD ENGINE
     * =========================================================================
     */

    // 1. Mobile Touch to Swipe (Instant response & continuous steering)
    let touchStartX = null;
    let touchStartY = null;
    let isTouchActive = false;
    const SWIPE_THRESHOLD = 16; // Snappy 16px threshold for instant turn reaction

    function handleTouchStart(e) {
        // Do not intercept taps on interactive controls
        if (e.target.closest('button, .modal-content, .sheet-panel')) return;

        if (e.touches && e.touches.length > 0) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            isTouchActive = true;
            if (window.soundManager) window.soundManager.resumeContext();
        }
    }

    function handleTouchMove(e) {
        if (!isTouchActive || touchStartX === null || touchStartY === null) return;
        if (e.target.closest('button, .modal-content, .sheet-panel')) return;

        // Prevent mobile browser page bouncing/scrolling during game
        if (e.cancelable) e.preventDefault();

        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const diffX = currentX - touchStartX;
        const diffY = currentY - touchStartY;

        // Check if movement exceeded threshold
        if (Math.abs(diffX) >= SWIPE_THRESHOLD || Math.abs(diffY) >= SWIPE_THRESHOLD) {
            if (Math.abs(diffX) > Math.abs(diffY)) {
                // Horizontal Swipe
                if (diffX > 0) {
                    setDirection(1, 0); // Right
                    highlightDpad(dpadRight);
                    triggerSwipeVisual(1, 0);
                } else {
                    setDirection(-1, 0); // Left
                    highlightDpad(dpadLeft);
                    triggerSwipeVisual(-1, 0);
                }
            } else {
                // Vertical Swipe
                if (diffY > 0) {
                    setDirection(0, 1); // Down
                    highlightDpad(dpadDown);
                    triggerSwipeVisual(0, 1);
                } else {
                    setDirection(0, -1); // Up
                    highlightDpad(dpadUp);
                    triggerSwipeVisual(0, -1);
                }
            }

            triggerHaptic(14);

            // Secret for continuous swiping: reset anchor to current point
            // This enables the player to steer through turns without lifting their finger!
            touchStartX = currentX;
            touchStartY = currentY;
        }
    }

    function handleTouchEnd(e) {
        isTouchActive = false;
        touchStartX = null;
        touchStartY = null;
    }

    // Attach touch-to-swipe listeners to canvas wrapper
    canvasWrapper.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvasWrapper.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvasWrapper.addEventListener('touchend', handleTouchEnd, { passive: true });
    canvasWrapper.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    // Also attach to the app container so players can swipe in the comfortable lower thumb zone!
    const appEl = document.getElementById('app');
    if (appEl) {
        appEl.addEventListener('touchstart', handleTouchStart, { passive: false });
        appEl.addEventListener('touchmove', handleTouchMove, { passive: false });
        appEl.addEventListener('touchend', handleTouchEnd, { passive: true });
        appEl.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    }

    // 2. PC Keyboard Controls
    window.addEventListener('keydown', (e) => {
        if (window.soundManager) window.soundManager.resumeContext();

        switch (e.code) {
            case 'ArrowUp':
            case 'KeyW':
                e.preventDefault();
                setDirection(0, -1);
                highlightDpad(dpadUp);
                break;
            case 'ArrowDown':
            case 'KeyS':
                e.preventDefault();
                setDirection(0, 1);
                highlightDpad(dpadDown);
                break;
            case 'ArrowLeft':
            case 'KeyA':
                e.preventDefault();
                setDirection(-1, 0);
                highlightDpad(dpadLeft);
                break;
            case 'ArrowRight':
            case 'KeyD':
                e.preventDefault();
                setDirection(1, 0);
                highlightDpad(dpadRight);
                break;
            case 'Space':
            case 'KeyP':
                e.preventDefault();
                togglePause();
                break;
            case 'KeyR':
                e.preventDefault();
                initGame();
                break;
            case 'KeyM':
                e.preventDefault();
                handleSoundToggle();
                break;
            case 'KeyF':
                e.preventDefault();
                toggleFullscreen();
                break;
        }
    });

    function highlightDpad(btn) {
        if (!btn) return;
        btn.classList.add('pressed');
        setTimeout(() => btn.classList.remove('pressed'), 120);
    }

    // 3. Virtual On-Screen D-Pad (Touch / Click)
    function setupDpadButton(btn, dx, dy) {
        if (!btn) return;

        const handlePress = (e) => {
            e.preventDefault();
            if (window.soundManager) window.soundManager.resumeContext();
            setDirection(dx, dy);
            triggerHaptic(15);
            btn.classList.add('pressed');
        };

        const handleRelease = (e) => {
            btn.classList.remove('pressed');
        };

        btn.addEventListener('pointerdown', handlePress);
        btn.addEventListener('pointerup', handleRelease);
        btn.addEventListener('pointerleave', handleRelease);
        btn.addEventListener('pointercancel', handleRelease);
    }

    setupDpadButton(dpadUp, 0, -1);
    setupDpadButton(dpadDown, 0, 1);
    setupDpadButton(dpadLeft, -1, 0);
    setupDpadButton(dpadRight, 1, 0);

    if (dpadCenter) {
        dpadCenter.addEventListener('click', (e) => {
            e.preventDefault();
            togglePause();
        });
    }

    // 4. Modal and Button Click Handlers
    startBtn.addEventListener('click', () => {
        initGame();
    });

    resumeBtn.addEventListener('click', () => {
        togglePause();
    });

    restartBtn.addEventListener('click', () => {
        initGame();
    });

    restartFromPauseBtn.addEventListener('click', () => {
        initGame();
    });

    pauseBtn.addEventListener('click', () => {
        togglePause();
    });

    // Sound Toggle Handler
    function handleSoundToggle() {
        if (!window.soundManager) return;
        const isMuted = window.soundManager.toggleMute();
        config.sound = !isMuted;
        soundIcon.textContent = isMuted ? '🔇' : '🔊';
        soundSwitch.checked = !isMuted;
        soundBtn.classList.toggle('active-warn', isMuted);
        saveConfig();
    }

    soundBtn.addEventListener('click', handleSoundToggle);

    // Fullscreen Toggle Handler
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
            fullscreenBtn.textContent = '⛶';
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            }
            fullscreenBtn.textContent = '⛶';
        }
    }

    fullscreenBtn.addEventListener('click', toggleFullscreen);

    // Share Score Handler
    shareBtn.addEventListener('click', async () => {
        const shareData = {
            title: 'Snake Arcade High Score',
            text: `🐍 I scored ${score} points at ${speedMultiplier >= MAX_SPEED_MULT ? '1.30x MAX' : speedMultiplier.toFixed(2) + 'x'} speed in Snake Arcade! Can you beat my score?`,
            url: window.location.href
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {}
        } else {
            try {
                await navigator.clipboard.writeText(shareData.text);
                shareBtn.innerHTML = '<span>✅</span> Copied to Clipboard!';
                setTimeout(() => {
                    shareBtn.innerHTML = '<span>📤</span> Share Score';
                }, 2000);
            } catch (e) {
                alert(shareData.text);
            }
        }
    });

    // Settings Modal Sheet handlers
    function openSettings() {
        if (isPlaying && !isPaused) togglePause();
        settingsSheet.classList.add('open');
    }

    function closeSettings() {
        settingsSheet.classList.remove('open');
    }

    settingsBtn.addEventListener('click', openSettings);
    closeSettingsBtn.addEventListener('click', closeSettings);

    // Difficulty buttons
    difficultyGroup.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            difficultyGroup.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            config.difficulty = e.target.dataset.diff;
            updateSpeed();
            saveConfig();
        }
    });

    // Controls Mode buttons
    controlsGroup.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            controlsGroup.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            config.controlsMode = e.target.dataset.ctrl;
            applyControlsMode();
            saveConfig();
        }
    });

    function applyControlsMode() {
        if (config.controlsMode === 'swipe') {
            document.body.classList.add('hide-dpad');
        } else {
            document.body.classList.remove('hide-dpad');
        }
    }

    soundSwitch.addEventListener('change', () => {
        config.sound = soundSwitch.checked;
        if (window.soundManager) {
            window.soundManager.muted = !config.sound;
            localStorage.setItem('snake_muted', (!config.sound).toString());
            soundIcon.textContent = config.sound ? '🔊' : '🔇';
            soundBtn.classList.toggle('active-warn', !config.sound);
        }
        saveConfig();
    });

    vibrationSwitch.addEventListener('change', () => {
        config.vibration = vibrationSwitch.checked;
        if (config.vibration) triggerHaptic(30);
        saveConfig();
    });

    saveSettingsBtn.addEventListener('click', closeSettings);

    // Help Modal Sheet handlers
    function openHelp() {
        if (isPlaying && !isPaused) togglePause();
        helpSheet.classList.add('open');
    }

    function closeHelp() {
        helpSheet.classList.remove('open');
    }

    helpBtn.addEventListener('click', openHelp);
    howToPlayBtn.addEventListener('click', openHelp);
    closeHelpBtn.addEventListener('click', closeHelp);
    gotItBtn.addEventListener('click', closeHelp);

    // Close sheets on backdrop click
    [settingsSheet, helpSheet].forEach(sheet => {
        sheet.addEventListener('click', (e) => {
            if (e.target === sheet) {
                sheet.classList.remove('open');
            }
        });
    });

    function saveConfig() {
        localStorage.setItem('snake_config', JSON.stringify(config));
    }

    function syncUIFromConfig() {
        // Sync difficulty
        difficultyGroup.querySelectorAll('.segment-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.diff === config.difficulty);
        });

        // Sync controls
        controlsGroup.querySelectorAll('.segment-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.ctrl === config.controlsMode);
        });
        applyControlsMode();

        // Sync Sound
        const isMuted = localStorage.getItem('snake_muted') === 'true';
        config.sound = !isMuted;
        soundSwitch.checked = config.sound;
        soundIcon.textContent = config.sound ? '🔊' : '🔇';
        soundBtn.classList.toggle('active-warn', !config.sound);

        // Sync Vibration
        vibrationSwitch.checked = config.vibration;
    }

    // Initialize UI and render first frame
    syncUIFromConfig();
    updateSpeedUI();
    resizeCanvas();
    render(0);
})();
