/**
 * Snake Arcade - Core Game Engine
 * Features:
 * - Dynamic Food Variety: Diverse snake foods (Apple, Mouse, Frog, Egg, Berry, Golden Treat) appearing one by one!
 * - Ultra-Smooth Movement: 60/120 FPS sub-pixel continuous interpolation
 * - Speed Scaling: Starts at 0.75x, grows with snake up to 1.30x MAX
 * - Mobile Touch-to-Swipe: Instant continuous directional swiping anywhere on screen
 * - Safe Border Portals: Zero wall death (death ONLY on self-collision)
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
    const foodCardIcon = document.getElementById('foodCardIcon');
    const foodCardText = document.getElementById('foodCardText');

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
    const currentFoodBadge = document.getElementById('currentFoodBadge');
    const currentFoodBadgeContent = document.getElementById('currentFoodBadgeContent');
    const goldenTimerBar = document.getElementById('goldenTimerBar');
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
    const howToPlayBtn = document.getElementById('howToPlayBtn');

    // Settings & Help Sheets
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsSheet = document.getElementById('settingsSheet');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const soundSwitch = document.getElementById('soundSwitch');
    const vibrationSwitch = document.getElementById('vibrationSwitch');
    const difficultyGroup = document.getElementById('difficultyGroup');

    const helpBtn = document.getElementById('helpBtn');
    const helpSheet = document.getElementById('helpSheet');
    const closeHelpBtn = document.getElementById('closeHelpBtn');
    const gotItBtn = document.getElementById('gotItBtn');

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

    // DIVERSE SNAKE FOOD CATALOG (What snakes love! Appearing one by one)
    const FOOD_CATALOG = [
        {
            id: 'apple',
            name: 'Crisp Apple',
            icon: '🍎',
            points: 10,
            color: '#ef4444',
            particleColors: ['#ef4444', '#f87171', '#22c55e']
        },
        {
            id: 'mouse',
            name: 'Tiny Mouse',
            icon: '🐭',
            points: 15,
            color: '#d1d5db',
            particleColors: ['#9ca3af', '#f3f4f6', '#f472b6']
        },
        {
            id: 'frog',
            name: 'Green Frog',
            icon: '🐸',
            points: 20,
            color: '#10b981',
            particleColors: ['#10b981', '#34d399', '#6ee7b7']
        },
        {
            id: 'egg',
            name: 'Bird Egg',
            icon: '🥚',
            points: 15,
            color: '#38bdf8',
            particleColors: ['#38bdf8', '#7dd3fc', '#f0f9ff']
        },
        {
            id: 'strawberry',
            name: 'Sweet Berry',
            icon: '🍓',
            points: 12,
            color: '#f43f5e',
            particleColors: ['#f43f5e', '#fb7185', '#fef08a']
        },
        {
            id: 'golden',
            name: 'Golden Treat',
            icon: '⭐',
            points: 35,
            color: '#f59e0b',
            particleColors: ['#f59e0b', '#fbbf24', '#fef08a'],
            duration: 6500 // 6.5s bonus timer
        }
    ];

    let foodCycleIndex = 0;
    let currentFood = null;

    // Game Configuration State (Walls are ALWAYS safe wrap - zero wall death)
    const config = {
        difficulty: 'normal',
        wallMode: 'wrap', // Safe infinite portal wrap
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

    // Visual Polish, Animation & Particle System
    let particles = [];
    let floatingTexts = [];
    let digestionBumps = [];
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
        // Increases from 0.75x to 1.30x over 25 treats eaten (~0.022 per treat)
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
     * Spawn Random Free Grid Position
     */
    function getRandomGridPosition() {
        const freeSpots = [];
        for (let x = 0; x < GRID_SIZE; x++) {
            for (let y = 0; y < GRID_SIZE; y++) {
                const inSnake = snake.some(seg => seg.x === x && seg.y === y);
                const inFood = currentFood && currentFood.x === x && currentFood.y === y;
                if (!inSnake && !inFood) {
                    freeSpots.push({ x, y });
                }
            }
        }
        if (freeSpots.length === 0) return { x: 0, y: 0 };
        return freeSpots[Math.floor(Math.random() * freeSpots.length)];
    }

    /**
     * Spawn Next Food Item in Rotation (One by One)
     */
    function spawnNextFood() {
        const pos = getRandomGridPosition();
        const def = FOOD_CATALOG[foodCycleIndex % FOOD_CATALOG.length];

        currentFood = {
            x: pos.x,
            y: pos.y,
            type: def.id,
            def: def,
            spawnTime: performance.now(),
            duration: def.duration || null
        };

        updateFoodUI();
    }

    function updateFoodUI() {
        if (!currentFood) return;
        if (foodCardIcon) {
            foodCardIcon.textContent = currentFood.def.icon;
        }
        if (currentFoodBadgeContent) {
            currentFoodBadgeContent.innerHTML = `${currentFood.def.icon} ${currentFood.def.name} (+${currentFood.def.points} pts)`;
        }
        if (goldenTimerBar) {
            goldenTimerBar.style.display = currentFood.duration ? 'block' : 'none';
        }
    }

    /**
     * Particle Spawner with Custom Multi-Color Palette
     */
    function createMultiColorParticles(x, y, colors, count = 20) {
        const pixelX = (x + 0.5) * cellSize;
        const pixelY = (y + 0.5) * cellSize;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.2 + Math.random() * 3.8;
            const color = colors[Math.floor(Math.random() * colors.length)];
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
        foodCycleIndex = 0;

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

        // Spawn first food: 🍎 Apple
        spawnNextFood();

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
     * Returns true if input was accepted & queued, false otherwise.
     */
    function setDirection(newX, newY) {
        if (!isPlaying || isPaused) return false;

        const lastDir = inputQueue.length > 0 ? inputQueue[inputQueue.length - 1] : dir;

        // Prevent 180-degree reversal into own neck
        if (newX === -lastDir.x && newY === -lastDir.y) return false;
        // Prevent redundant identical direction
        if (newX === lastDir.x && newY === lastDir.y) return false;

        // Queue input (up to 2 buffered turns)
        if (inputQueue.length < 2) {
            inputQueue.push({ x: newX, y: newY });
            if (window.soundManager) {
                window.soundManager.playTurn();
            }
            return true;
        } else {
            // Buffer already has a pending turn; update the second one with latest player intent
            inputQueue[1] = { x: newX, y: newY };
            return true;
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
        const willGrow = currentFood && (newX === currentFood.x && newY === currentFood.y);

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

        if (willGrow) {
            ateSomething = true;
            const eaten = currentFood;

            score += eaten.def.points;
            applesEaten++;
            scoreDisplay.textContent = score;
            applesDisplay.textContent = applesEaten;

            scoreDisplay.classList.add('bump');
            setTimeout(() => scoreDisplay.classList.remove('bump'), 150);

            // Explosive particles in food's custom palette
            createMultiColorParticles(eaten.x, eaten.y, eaten.def.particleColors, eaten.type === 'golden' ? 28 : 20);

            // Floating score popup with food icon & points
            createFloatingText(`+${eaten.def.points} ${eaten.def.icon}`, eaten.x, eaten.y, eaten.def.color);

            triggerHaptic(eaten.type === 'golden' ? [30, 20, 40] : 25);
            if (eaten.type === 'golden') screenShake = 7;

            // Digestion wave pulse
            digestionBumps.push({ segmentIndex: 0 });

            // Sound effect specific to this food type
            if (window.soundManager) {
                window.soundManager.playEatFood(eaten.type);
            }

            // Progressive speed adjustment (0.75x to 1.30x MAX)
            updateSpeed();

            // ADVANCE TO NEXT UNIQUE FOOD ITEM!
            foodCycleIndex++;
            spawnNextFood();
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
            createMultiColorParticles(seg.x, seg.y, ['#10b981', '#34d399', '#059669'], 5);
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

        // Draw Current Food Item
        drawFoodItem(currentFood, timestamp);

        // Calculate sub-frame progress between 0 and 1 for buttery 60fps movement
        const progress = (isPlaying && !isPaused)
            ? Math.min(1, Math.max(0, (timestamp - lastStepTime) / currentSpeed))
            : 1;

        // Draw Smooth Connected Snake
        drawSmoothSnake(timestamp, progress);

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
     * Draw Diverse Food Items with Custom Animations & Shading
     * Handles: Apple, Mouse, Frog, Bird Egg, Strawberry, Golden Star Treat
     */
    function drawFoodItem(food, timestamp) {
        if (!food) return;

        const time = timestamp / 1000;
        const px = food.x * cellSize;
        const py = food.y * cellSize;
        const cx = px + cellSize / 2;
        const cy = py + cellSize / 2;

        ctx.save();
        ctx.translate(cx, cy);

        // If it's a timed bonus, check timer and draw countdown ring
        if (food.duration) {
            const elapsed = performance.now() - food.spawnTime;
            const remainingRatio = Math.max(0, 1 - elapsed / food.duration);
            if (remainingRatio <= 0) {
                // Expired! Transition to next regular treat
                foodCycleIndex++;
                spawnNextFood();
                ctx.restore();
                return;
            }

            if (bonusTimerFill) {
                bonusTimerFill.style.width = (remainingRatio * 100) + '%';
            }

            // Countdown timer ring
            ctx.beginPath();
            ctx.arc(0, 0, cellSize * 0.47, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * remainingRatio));
            ctx.strokeStyle = food.def.color;
            ctx.lineWidth = 2.5;
            ctx.stroke();
        }

        // Glowing halo in the food's primary color
        ctx.shadowColor = food.def.color;
        ctx.shadowBlur = 14;

        switch (food.type) {
            case 'apple': {
                const pulse = Math.sin(time * 4) * 0.07 + 1;
                ctx.scale(pulse, pulse);

                const rad = cellSize * 0.38;
                const grad = ctx.createRadialGradient(-rad * 0.3, -rad * 0.3, rad * 0.2, 0, 0, rad);
                grad.addColorStop(0, '#f87171');
                grad.addColorStop(0.7, '#ef4444');
                grad.addColorStop(1, '#b91c1c');

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(0, 2, rad, 0, Math.PI * 2);
                ctx.fill();

                // Stem
                ctx.shadowBlur = 0;
                ctx.strokeStyle = '#78350f';
                ctx.lineWidth = 2.4;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(0, -rad + 2);
                ctx.quadraticCurveTo(2, -rad - 4, 4, -rad - 5);
                ctx.stroke();

                // Leaf
                ctx.fillStyle = '#22c55e';
                ctx.beginPath();
                ctx.ellipse(3, -rad - 2, 4, 2, Math.PI / 4, 0, Math.PI * 2);
                ctx.fill();

                // Shine
                ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
                ctx.beginPath();
                ctx.ellipse(-rad * 0.35, -rad * 0.3, rad * 0.28, rad * 0.16, -Math.PI / 5, 0, Math.PI * 2);
                ctx.fill();
                break;
            }

            case 'mouse': {
                // Little squeaky mouse!
                const bodyRadX = cellSize * 0.34;
                const bodyRadY = cellSize * 0.26;
                const twitch = Math.sin(time * 7) * 0.08;

                ctx.rotate(twitch);

                // Tail curling behind with animated wiggle
                ctx.shadowBlur = 0;
                ctx.strokeStyle = '#f472b6';
                ctx.lineWidth = 2.2;
                ctx.lineCap = 'round';
                const tailWiggle = Math.sin(time * 8) * 3;
                ctx.beginPath();
                ctx.moveTo(-bodyRadX + 2, 2);
                ctx.quadraticCurveTo(-bodyRadX - 6, 4 + tailWiggle, -bodyRadX - 8, -3 + tailWiggle);
                ctx.stroke();

                ctx.shadowColor = 'rgba(209, 213, 219, 0.6)';
                ctx.shadowBlur = 10;

                // Mouse body
                const mGrad = ctx.createRadialGradient(-2, -2, 2, 0, 0, bodyRadX);
                mGrad.addColorStop(0, '#e5e7eb');
                mGrad.addColorStop(0.7, '#9ca3af');
                mGrad.addColorStop(1, '#6b7280');
                ctx.fillStyle = mGrad;

                ctx.beginPath();
                ctx.ellipse(0, 0, bodyRadX, bodyRadY, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.shadowBlur = 0;

                // Ears
                const earRad = cellSize * 0.13;
                ctx.fillStyle = '#9ca3af';
                ctx.beginPath();
                ctx.arc(-bodyRadX * 0.35, -bodyRadY * 0.9, earRad, 0, Math.PI * 2);
                ctx.arc(bodyRadX * 0.25, -bodyRadY * 0.9, earRad, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#f472b6';
                ctx.beginPath();
                ctx.arc(-bodyRadX * 0.35, -bodyRadY * 0.9, earRad * 0.6, 0, Math.PI * 2);
                ctx.arc(bodyRadX * 0.25, -bodyRadY * 0.9, earRad * 0.6, 0, Math.PI * 2);
                ctx.fill();

                // Eyes
                ctx.fillStyle = '#111827';
                ctx.beginPath();
                ctx.arc(bodyRadX * 0.35, -bodyRadY * 0.25, cellSize * 0.05, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(bodyRadX * 0.37, -bodyRadY * 0.3, cellSize * 0.02, 0, Math.PI * 2);
                ctx.fill();

                // Pink nose
                ctx.fillStyle = '#f472b6';
                ctx.beginPath();
                ctx.arc(bodyRadX * 0.9, 0, cellSize * 0.055, 0, Math.PI * 2);
                ctx.fill();

                // Whiskers
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(bodyRadX * 0.7, 0);
                ctx.lineTo(bodyRadX * 1.25, -cellSize * 0.14);
                ctx.moveTo(bodyRadX * 0.7, 2);
                ctx.lineTo(bodyRadX * 1.25, cellSize * 0.14);
                ctx.stroke();
                break;
            }

            case 'frog': {
                // Cute green tree frog!
                const throatPulse = Math.sin(time * 5) * 0.08 + 1;
                ctx.scale(throatPulse, throatPulse);

                const fRadX = cellSize * 0.34;
                const fRadY = cellSize * 0.28;

                const fGrad = ctx.createRadialGradient(-2, -2, 2, 0, 0, fRadX);
                fGrad.addColorStop(0, '#34d399');
                fGrad.addColorStop(0.7, '#10b981');
                fGrad.addColorStop(1, '#047857');
                ctx.fillStyle = fGrad;

                ctx.beginPath();
                ctx.ellipse(0, 2, fRadX, fRadY, 0, 0, Math.PI * 2);
                ctx.fill();

                // Front feet
                ctx.fillStyle = '#059669';
                ctx.beginPath();
                ctx.arc(-fRadX * 0.8, fRadY * 0.6, cellSize * 0.08, 0, Math.PI * 2);
                ctx.arc(fRadX * 0.8, fRadY * 0.6, cellSize * 0.08, 0, Math.PI * 2);
                ctx.fill();

                // Light tummy
                ctx.fillStyle = 'rgba(167, 243, 208, 0.45)';
                ctx.beginPath();
                ctx.ellipse(0, 5, fRadX * 0.55, fRadY * 0.45, 0, 0, Math.PI * 2);
                ctx.fill();

                // Big protruding eyes on top
                const eyeBulbRad = cellSize * 0.14;
                ctx.fillStyle = '#10b981';
                ctx.beginPath();
                ctx.arc(-fRadX * 0.45, -fRadY * 0.65, eyeBulbRad, 0, Math.PI * 2);
                ctx.arc(fRadX * 0.45, -fRadY * 0.65, eyeBulbRad, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(-fRadX * 0.45, -fRadY * 0.65, eyeBulbRad * 0.8, 0, Math.PI * 2);
                ctx.arc(fRadX * 0.45, -fRadY * 0.65, eyeBulbRad * 0.8, 0, Math.PI * 2);
                ctx.fill();

                // Horizontal frog pupils
                ctx.fillStyle = '#064e3b';
                ctx.beginPath();
                ctx.ellipse(-fRadX * 0.45, -fRadY * 0.65, eyeBulbRad * 0.5, eyeBulbRad * 0.28, 0, 0, Math.PI * 2);
                ctx.ellipse(fRadX * 0.45, -fRadY * 0.65, eyeBulbRad * 0.5, eyeBulbRad * 0.28, 0, 0, Math.PI * 2);
                ctx.fill();

                // Smile
                ctx.strokeStyle = '#065f46';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(0, 3, cellSize * 0.16, 0.2, Math.PI - 0.2);
                ctx.stroke();
                break;
            }

            case 'egg': {
                // Speckled bird egg!
                const wobble = Math.sin(time * 4) * 0.08;
                ctx.rotate(wobble);

                const eggRadX = cellSize * 0.28;
                const eggRadY = cellSize * 0.36;

                const eggGrad = ctx.createRadialGradient(-eggRadX * 0.3, -eggRadY * 0.3, 2, 0, 0, eggRadY);
                eggGrad.addColorStop(0, '#f0f9ff');
                eggGrad.addColorStop(0.6, '#7dd3fc');
                eggGrad.addColorStop(1, '#0284c7');
                ctx.fillStyle = eggGrad;

                ctx.beginPath();
                ctx.ellipse(0, 0, eggRadX, eggRadY, 0, 0, Math.PI * 2);
                ctx.fill();

                // Speckles
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#0369a1';
                const speckles = [
                    [-eggRadX * 0.4, -eggRadY * 0.3, 1.4],
                    [eggRadX * 0.3, -eggRadY * 0.4, 1.2],
                    [-eggRadX * 0.2, eggRadY * 0.3, 1.6],
                    [eggRadX * 0.4, eggRadY * 0.2, 1.3],
                    [0, -eggRadY * 0.1, 1.5]
                ];
                speckles.forEach(([sx, sy, sr]) => {
                    ctx.beginPath();
                    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
                    ctx.fill();
                });

                // Gloss sheen
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.beginPath();
                ctx.ellipse(-eggRadX * 0.35, -eggRadY * 0.35, eggRadX * 0.3, eggRadY * 0.18, -Math.PI / 4, 0, Math.PI * 2);
                ctx.fill();
                break;
            }

            case 'strawberry': {
                // Sweet Ruby Strawberry
                const pulse = Math.sin(time * 4) * 0.06 + 1;
                ctx.scale(pulse, pulse);

                const bRad = cellSize * 0.34;
                const bGrad = ctx.createRadialGradient(-2, -2, 2, 0, 0, bRad);
                bGrad.addColorStop(0, '#fb7185');
                bGrad.addColorStop(0.7, '#f43f5e');
                bGrad.addColorStop(1, '#9f1239');
                ctx.fillStyle = bGrad;

                // Tapered berry shape
                ctx.beginPath();
                ctx.moveTo(0, bRad);
                ctx.bezierCurveTo(-bRad * 1.2, 0, -bRad * 0.8, -bRad * 0.8, 0, -bRad * 0.4);
                ctx.bezierCurveTo(bRad * 0.8, -bRad * 0.8, bRad * 1.2, 0, 0, bRad);
                ctx.fill();

                // Calyx green leaf crown
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#22c55e';
                ctx.beginPath();
                ctx.ellipse(-cellSize * 0.15, -bRad * 0.65, 4, 2, -Math.PI / 4, 0, Math.PI * 2);
                ctx.ellipse(cellSize * 0.15, -bRad * 0.65, 4, 2, Math.PI / 4, 0, Math.PI * 2);
                ctx.ellipse(0, -bRad * 0.7, 4, 2, 0, 0, Math.PI * 2);
                ctx.fill();

                // Golden seeds
                ctx.fillStyle = '#fef08a';
                const seeds = [
                    [-4, -2], [4, -2],
                    [-7, 3], [0, 4], [7, 3],
                    [-3, 8], [3, 8],
                    [0, 12]
                ];
                seeds.forEach(([sx, sy]) => {
                    ctx.beginPath();
                    ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
                    ctx.fill();
                });
                break;
            }

            case 'golden': {
                // Radiant Golden Star Treat
                const floatOffset = Math.sin(time * 6) * 3;
                ctx.translate(0, floatOffset);

                ctx.shadowColor = 'rgba(251, 191, 36, 0.95)';
                ctx.shadowBlur = 20;

                const gRad = cellSize * 0.36;
                const grad = ctx.createRadialGradient(-2, -2, 2, 0, 0, gRad);
                grad.addColorStop(0, '#fef08a');
                grad.addColorStop(0.5, '#f59e0b');
                grad.addColorStop(1, '#b45309');

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(0, 0, gRad, 0, Math.PI * 2);
                ctx.fill();

                // Center star sparkle
                ctx.fillStyle = '#ffffff';
                ctx.font = `${Math.floor(cellSize * 0.45)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('⭐', 0, 0);
                break;
            }
        }

        ctx.restore();
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
                lastStepTime = timestamp - (elapsed % currentSpeed);
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

    // 1. Mobile Touch to Swipe (Ultra-smooth, responsive & continuous gesture steering)
    let touchStartX = null;
    let touchStartY = null;
    let touchOriginX = null;
    let touchOriginY = null;
    let touchStartTime = 0;
    let isTouchActive = false;
    let lastTurnTime = 0;
    const SWIPE_MIN_DIST = 14; // Snappy 14px threshold for immediate turn reaction

    function handleTouchStart(e) {
        // Do not intercept taps on buttons, modals, or dialog sheets
        if (e.target.closest('button, .modal-content, .sheet-panel, .icon-btn')) return;

        if (e.touches && e.touches.length > 0) {
            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            touchOriginX = touch.clientX;
            touchOriginY = touch.clientY;
            touchStartTime = performance.now();
            isTouchActive = true;
            if (window.soundManager) window.soundManager.resumeContext();
        }
    }

    function handleTouchMove(e) {
        if (!isTouchActive || touchStartX === null || touchStartY === null) return;
        if (e.target.closest('button, .modal-content, .sheet-panel, .icon-btn')) return;

        if (e.cancelable) e.preventDefault();

        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const diffX = currentX - touchStartX;
        const diffY = currentY - touchStartY;
        const absX = Math.abs(diffX);
        const absY = Math.abs(diffY);
        const distance = Math.hypot(diffX, diffY);

        if (distance >= SWIPE_MIN_DIST) {
            // Determine dominant direction
            const isHorizontal = absX >= absY;
            const targetX = isHorizontal ? (diffX > 0 ? 1 : -1) : 0;
            const targetY = isHorizontal ? 0 : (diffY > 0 ? 1 : -1);

            const changed = setDirection(targetX, targetY);
            if (changed) {
                triggerHaptic(12);
                lastTurnTime = performance.now();
            }

            // Continuously update tracking anchor for smooth multi-turn strokes without lifting thumb
            touchStartX = currentX;
            touchStartY = currentY;
        }
    }

    function handleTouchEnd(e) {
        if (!isTouchActive) return;

        // Support quick flick gesture if player swiftly swipes and lifts thumb (< 280ms)
        const duration = performance.now() - touchStartTime;
        if (duration < 280 && touchOriginX !== null && touchOriginY !== null) {
            const endTouch = (e.changedTouches && e.changedTouches.length > 0) ? e.changedTouches[0] : null;
            if (endTouch) {
                const totalDiffX = endTouch.clientX - touchOriginX;
                const totalDiffY = endTouch.clientY - touchOriginY;
                const totalDist = Math.hypot(totalDiffX, totalDiffY);

                if (totalDist >= 12 && (performance.now() - lastTurnTime > 80)) {
                    const isHorizontal = Math.abs(totalDiffX) >= Math.abs(totalDiffY);
                    const targetX = isHorizontal ? (totalDiffX > 0 ? 1 : -1) : 0;
                    const targetY = isHorizontal ? 0 : (totalDiffY > 0 ? 1 : -1);
                    if (setDirection(targetX, targetY)) {
                        triggerHaptic(12);
                    }
                }
            }
        }

        isTouchActive = false;
        touchStartX = null;
        touchStartY = null;
        touchOriginX = null;
        touchOriginY = null;
    }

    // Attach single universal touch listeners to window (captures entire screen without duplicate bubbling)
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    // 2. PC Keyboard Controls
    window.addEventListener('keydown', (e) => {
        if (window.soundManager) window.soundManager.resumeContext();

        switch (e.code) {
            case 'ArrowUp':
            case 'KeyW':
                e.preventDefault();
                setDirection(0, -1);
                break;
            case 'ArrowDown':
            case 'KeyS':
                e.preventDefault();
                setDirection(0, 1);
                break;
            case 'ArrowLeft':
            case 'KeyA':
                e.preventDefault();
                setDirection(-1, 0);
                break;
            case 'ArrowRight':
            case 'KeyD':
                e.preventDefault();
                setDirection(1, 0);
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
