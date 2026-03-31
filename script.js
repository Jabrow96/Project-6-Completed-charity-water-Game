// Game State
const gameState = {
    phase: 'start', // start, instruction, countdown, playing, end
    score: 0,
    streak: 0,
    lives: 3,
    maxLives: 3,
    drops: [],
    bucket: {
        x: window.innerWidth / 2 - 50,
        y: window.innerHeight - 120,
        width: 100,
        height: 100,
    },
    gameLoopId: null,
    dropSpawnId: null,
    bucketSpeed: 8,
    minDropSpacing: 55,
    spawnCheckHeight: 220,
    baseSpawnInterval: 800,
    minSpawnInterval: 220,
    speedRampFactor: 1.18,
    speedLevel: 0,
    speedMultiplier: 1,
};

// DOM Elements
const screens = {
    start: document.getElementById('startScreen'),
    instruction: document.getElementById('instructionScreen'),
    countdown: document.getElementById('countdownScreen'),
    game: document.getElementById('gameScreen'),
    end: document.getElementById('endScreen'),
};

const gameElements = {
    bucket: document.getElementById('bucket'),
    gameDrops: document.getElementById('gameDrops'),
    speedPopup: document.getElementById('speedPopup'),
    streakCelebration: document.getElementById('streakCelebration'),
    resetBtn: document.getElementById('resetBtn'),
    dropCounter: document.getElementById('dropCounter'),
    streakText: document.getElementById('streakText'),
    heartSvg: document.getElementById('heartSvg'),
    countdownText: document.getElementById('countdownText'),
    finalScore: document.getElementById('finalScore'),
    previewDrops: document.getElementById('previewDrops'),
};

let speedPopupTimeoutId = null;
let streakCelebrationTimeoutId = null;

function syncBucketSizeFromCSS() {
    const bucketRect = gameElements.bucket.getBoundingClientRect();
    gameState.bucket.width = Math.round(bucketRect.width);
    gameState.bucket.height = Math.round(bucketRect.height);
}

// ============ SCREEN MANAGEMENT ============

function switchScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    if (screens[screenName]) {
        screens[screenName].classList.add('active');
    }
    gameState.phase = screenName;
}

// ============ DROP CREATION ============

function createDrop() {
    const dropType = Math.random() > 0.7 ? 'bad' : 'good'; // 30% bad, 70% good
    const x = Math.random() * (window.innerWidth - 30);
    let speed = 2 + Math.random() * 2; // Default speed range: 2-4

    // Add stronger speed variety using slow, normal, and fast tiers.
    const speedRoll = Math.random();
    if (speedRoll < 0.25) {
        speed = 0.9 + Math.random() * 1.1; // Slow: 0.9-2.0
    } else if (speedRoll > 0.75) {
        speed = 5 + Math.random() * 3.2; // Fast: 5.0-8.2
    }
    
    return {
        x,
        y: -30,
        width: 26,
        height: 36,
        type: dropType,
        speed,
        element: null,
    };
}

function getSpacedSpawnX() {
    const maxX = window.innerWidth - 30;
    let bestX = Math.random() * maxX;
    let bestDistance = -1;

    // Only compare against drops near the top where new drops enter the screen.
    const nearbyDrops = gameState.drops.filter((drop) => drop.y < gameState.spawnCheckHeight);

    // Try multiple positions and keep the first one that meets spacing rules.
    for (let attempt = 0; attempt < 12; attempt++) {
        const candidateX = Math.random() * maxX;
        let closestDistance = Infinity;

        for (const existingDrop of nearbyDrops) {
            const distance = Math.abs(existingDrop.x - candidateX);
            closestDistance = Math.min(closestDistance, distance);
        }

        if (nearbyDrops.length === 0 || closestDistance >= gameState.minDropSpacing) {
            return candidateX;
        }

        if (closestDistance > bestDistance) {
            bestDistance = closestDistance;
            bestX = candidateX;
        }
    }

    // Fallback: if the screen is crowded, use the best available position.
    return bestX;
}

function spawnDropPreviewDrops() {
    // Spawn preview drops for the start screen preview container
    const container = gameElements.previewDrops;
    if (!container) return;

    const containerWidth = container.clientWidth || 300;
    const containerHeight = container.clientHeight || 300;

    const drop = createDrop();
    const dropEl = document.createElement('div');
    dropEl.className = `drop ${drop.type}`;
    dropEl.style.left = drop.x % containerWidth + 'px';
    dropEl.style.top = '-30px';

    container.appendChild(dropEl);

    // Animate fall
    let y = -30;
    const interval = setInterval(() => {
        y += 3;
        dropEl.style.top = y + 'px';

        if (y > containerHeight) {
            clearInterval(interval);
            dropEl.remove();
        }
    }, 30);
}

function spawnGameDrops() {
    // Main game drop spawning
    const drop = createDrop();
    drop.x = getSpacedSpawnX();
    const dropEl = document.createElement('div');
    dropEl.className = `drop ${drop.type}`;
    dropEl.style.left = drop.x + 'px';
    dropEl.style.top = '-30px';
    drop.element = dropEl;

    gameElements.gameDrops.appendChild(dropEl);
    gameState.drops.push(drop);
}

// ============ BUCKET CONTROL ============

let keyStates = {};
let isDraggingBucket = false;

document.addEventListener('keydown', (e) => {
    keyStates[e.key] = true;
});

document.addEventListener('keyup', (e) => {
    keyStates[e.key] = false;
});

// Press-and-drag bucket movement
gameElements.bucket.addEventListener('pointerdown', (e) => {
    if (gameState.phase !== 'game') return;

    isDraggingBucket = true;
    gameElements.bucket.setPointerCapture(e.pointerId);
    updateBucketPositionXY(
        e.clientX - gameState.bucket.width / 2,
        e.clientY - gameState.bucket.height / 2
    );
});

// Prevent native image drag behavior
gameElements.bucket.addEventListener('dragstart', (e) => {
    e.preventDefault();
});

document.addEventListener('pointermove', (e) => {
    if (gameState.phase !== 'game' || !isDraggingBucket) return;
    updateBucketPositionXY(
        e.clientX - gameState.bucket.width / 2,
        e.clientY - gameState.bucket.height / 2
    );
});

document.addEventListener('pointerup', () => {
    isDraggingBucket = false;
});

document.addEventListener('pointercancel', () => {
    isDraggingBucket = false;
});

function updateBucketPositionXY(x, y) {
    const minX = 10;
    const maxX = window.innerWidth - gameState.bucket.width - 10;
    const minY = 80;
    const maxY = window.innerHeight - gameState.bucket.height - 20;

    gameState.bucket.x = Math.max(minX, Math.min(x, maxX));
    gameState.bucket.y = Math.max(minY, Math.min(y, maxY));

    gameElements.bucket.style.left = gameState.bucket.x + 'px';
    gameElements.bucket.style.top = gameState.bucket.y + 'px';
}

function moveBucketWithKeyboard() {
    if (gameState.phase !== 'game') return;

    let dx = 0;
    let dy = 0;

    if (keyStates['ArrowLeft'] || keyStates['a'] || keyStates['A']) dx -= gameState.bucketSpeed;
    if (keyStates['ArrowRight'] || keyStates['d'] || keyStates['D']) dx += gameState.bucketSpeed;
    if (keyStates['ArrowUp'] || keyStates['w'] || keyStates['W']) dy -= gameState.bucketSpeed;
    if (keyStates['ArrowDown'] || keyStates['s'] || keyStates['S']) dy += gameState.bucketSpeed;

    if (dx !== 0 || dy !== 0) {
        updateBucketPositionXY(gameState.bucket.x + dx, gameState.bucket.y + dy);
    }
}

// ============ COLLISION DETECTION ============

function getBucketBounds() {
    const top = gameState.bucket.y;
    const bottom = top + gameState.bucket.height;
    const left = gameState.bucket.x;
    const right = left + gameState.bucket.width;

    return { left, right, top, bottom };
}

function checkCollision(drop) {
    const bucket = getBucketBounds();
    const dropBounds = {
        left: drop.x,
        right: drop.x + drop.width,
        top: drop.y,
        bottom: drop.y + drop.height,
    };

    return !(
        dropBounds.right < bucket.left ||
        dropBounds.left > bucket.right ||
        dropBounds.bottom < bucket.top ||
        dropBounds.top > bucket.bottom
    );
}

// ============ GAME LOOP ============

function gameLoop() {
    moveBucketWithKeyboard();

    // Update drops
    for (let i = gameState.drops.length - 1; i >= 0; i--) {
        const drop = gameState.drops[i];
        drop.y += drop.speed * gameState.speedMultiplier;

        // Update visual position
        if (drop.element) {
            drop.element.style.top = drop.y + 'px';
        }

        // Check collision
        if (checkCollision(drop)) {
            if (drop.type === 'good') {
                gameState.score++;
                gameState.streak++;
                updateGameSpeed();
                updateHUD();
                // Check if streak hits milestone for healing
                if (gameState.streak > 0 && gameState.streak % 10 === 0) {
                    gameState.lives = Math.min(gameState.lives + 1, gameState.maxLives);
                    updateHeart();
                    showStreakCelebration(gameState.streak);
                    animateHeartChange('gain');
                }
            } else {
                // Hit bad drop
                gameState.lives--;
                gameState.streak = 0;
                updateHUD();
                animateHeartChange('loss');

                if (gameState.lives <= 0) {
                    endGame();
                    return;
                }
            }

            // Remove drop
            if (drop.element) {
                drop.element.remove();
            }
            gameState.drops.splice(i, 1);
        } else if (drop.y > window.innerHeight) {
            // Missed drop (was good, should have caught it)
            if (drop.type === 'good') {
                gameState.lives--;
                gameState.streak = 0;
                updateHUD();
                animateHeartChange('loss');

                if (gameState.lives <= 0) {
                    endGame();
                    return;
                }
            }

            // Remove drop
            if (drop.element) {
                drop.element.remove();
            }
            gameState.drops.splice(i, 1);
        }
    }
}

function updateGameSpeed() {
    const newSpeedLevel = Math.floor(gameState.score / 25);

    if (newSpeedLevel === gameState.speedLevel) {
        return;
    }

    gameState.speedLevel = newSpeedLevel;
    gameState.speedMultiplier = Math.pow(gameState.speedRampFactor, gameState.speedLevel);

    if (gameState.speedLevel > 0) {
        showSpeedPopup();
    }

    // Rebuild spawn loop so drops also spawn faster as speed levels increase.
    const nextSpawnInterval = Math.max(
        gameState.minSpawnInterval,
        Math.round(gameState.baseSpawnInterval / gameState.speedMultiplier)
    );

    clearInterval(gameState.dropSpawnId);
    gameState.dropSpawnId = setInterval(spawnGameDrops, nextSpawnInterval);
}

function showSpeedPopup() {
    if (!gameElements.speedPopup) return;

    gameElements.speedPopup.textContent = 'Very Good! The drops get faster!';
    gameElements.speedPopup.classList.add('show');

    clearTimeout(speedPopupTimeoutId);
    speedPopupTimeoutId = setTimeout(() => {
        gameElements.speedPopup.classList.remove('show');
    }, 1500);
}

function getWaterCelebrationMessage(streakCount) {
    if (streakCount >= 50) return 'TIDAL FORCE!';
    if (streakCount >= 40) return 'HYDRATION HERO!';
    if (streakCount >= 30) return 'WELL BUILDER!';
    if (streakCount >= 20) return 'CLEAN WATER WAVE!';
    return 'SPLASH STREAK!';
}

function showStreakCelebration(streakCount) {
    if (!gameElements.streakCelebration) return;

    const splashLabels = gameElements.streakCelebration.querySelectorAll('.splash-label');
    const message = getWaterCelebrationMessage(streakCount);

    // Keep the exact milestone number while adding a themed message.
    splashLabels.forEach((label) => {
        label.textContent = `${streakCount}x ${message}`;
    });

    gameElements.streakCelebration.classList.remove('show');

    // Force reflow so rapid milestones can replay the animation from the start.
    void gameElements.streakCelebration.offsetWidth;

    gameElements.streakCelebration.classList.add('show');

    clearTimeout(streakCelebrationTimeoutId);
    streakCelebrationTimeoutId = setTimeout(() => {
        gameElements.streakCelebration.classList.remove('show');
    }, 2820);
}

function animateHeartChange(changeType) {
    if (!gameElements.heartSvg) return;

    const heartSvg = gameElements.heartSvg;
    const className = changeType === 'gain' ? 'heart-pop' : 'heart-shake';

    heartSvg.classList.remove('heart-pop', 'heart-shake');

    // Force reflow so repeated life changes still replay the animation.
    void heartSvg.offsetWidth;

    heartSvg.classList.add(className);

    setTimeout(() => {
        heartSvg.classList.remove(className);
    }, 450);
}

// ============ HUD UPDATE ============

function updateHUD() {
    gameElements.dropCounter.textContent = gameState.score;
    gameElements.streakText.textContent = gameState.streak;
    updateHeart();
}

function updateHeart() {
    // Simple heart damage visualization: change opacity based on lives
    const opacity = (gameState.lives / gameState.maxLives) * 1;
    gameElements.heartSvg.style.opacity = opacity;

    // Add crack effect at low health
    if (gameState.lives === 1) {
        gameElements.heartSvg.style.filter = 'drop-shadow(0 0 5px rgba(245, 64, 44, 0.8))';
    } else {
        gameElements.heartSvg.style.filter = 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))';
    }
}

// ============ PHASE TRANSITIONS ============

// Start Button -> Instructions
document.getElementById('collectBtn').addEventListener('click', () => {
    switchScreen('instruction');
    // Stop preview drops
    gameElements.previewDrops.innerHTML = '';
});

// Instructions -> Countdown
document.getElementById('continueBtn').addEventListener('click', () => {
    switchScreen('countdown');
    startCountdown();
});

function startCountdown() {
    let count = 3;
    gameElements.countdownText.textContent = count;

    const countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
            gameElements.countdownText.textContent = count;
        } else {
            gameElements.countdownText.textContent = 'GO!';
            clearInterval(countdownInterval);
            setTimeout(() => {
                startGame();
            }, 500);
        }
    }, 1000);
}

function startGame() {
    // Safety: reset any existing loops before starting a fresh run.
    clearInterval(gameState.dropSpawnId);
    clearInterval(gameState.gameLoopId);

    switchScreen('game');
    syncBucketSizeFromCSS();

    // Reset game state
    gameState.score = 0;
    gameState.streak = 0;
    gameState.lives = gameState.maxLives;
    gameState.drops = [];
    gameElements.gameDrops.innerHTML = '';
    gameState.bucket.x = window.innerWidth / 2 - gameState.bucket.width / 2;
    gameState.bucket.y = window.innerHeight - gameState.bucket.height - 20;
    gameState.speedLevel = 0;
    gameState.speedMultiplier = 1;
    if (gameElements.speedPopup) {
        gameElements.speedPopup.classList.remove('show');
    }
    if (gameElements.streakCelebration) {
        gameElements.streakCelebration.classList.remove('show');
    }
    clearTimeout(streakCelebrationTimeoutId);
    gameElements.bucket.style.left = gameState.bucket.x + 'px';
    gameElements.bucket.style.top = gameState.bucket.y + 'px';
    updateHUD();

    // Start spawn loop
    gameState.dropSpawnId = setInterval(spawnGameDrops, gameState.baseSpawnInterval);

    // Start game loop
    gameState.gameLoopId = setInterval(gameLoop, 30);
}

function endGame() {
    // Stop loops
    clearInterval(gameState.dropSpawnId);
    clearInterval(gameState.gameLoopId);

    // Show end screen
    gameElements.finalScore.textContent = gameState.score;
    switchScreen('end');
}

function returnToStartScreen() {
    // Stop gameplay loops and clear active drops before showing start screen.
    clearInterval(gameState.dropSpawnId);
    clearInterval(gameState.gameLoopId);

    gameState.drops = [];
    gameElements.gameDrops.innerHTML = '';

    if (gameElements.speedPopup) {
        gameElements.speedPopup.classList.remove('show');
    }
    if (gameElements.streakCelebration) {
        gameElements.streakCelebration.classList.remove('show');
    }
    clearTimeout(streakCelebrationTimeoutId);

    switchScreen('start');
}

// Retry Button
document.getElementById('retryBtn').addEventListener('click', () => {
    returnToStartScreen();
});

// In-game Reset Button
if (gameElements.resetBtn) {
    gameElements.resetBtn.addEventListener('click', () => {
        if (gameState.phase === 'game') {
            returnToStartScreen();
        }
    });
}

// ============ INITIALIZATION ============

function spawnPreviewDropsLoop() {
    // Continuously spawn preview drops for start screen
    setInterval(() => {
        if (gameState.phase === 'start') {
            spawnDropPreviewDrops();
        }
    }, 1000);
}

function preloadGameImages() {
    // Fallback preload in JS so the game background is ready before gameplay starts.
    const waterBackgroundImage = new Image();
    waterBackgroundImage.src = 'img/waterbackground.jpg';
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    preloadGameImages();
    switchScreen('start');
    syncBucketSizeFromCSS();
    gameElements.bucket.style.left = gameState.bucket.x + 'px';
    gameElements.bucket.style.top = gameState.bucket.y + 'px';
    spawnPreviewDropsLoop();
    updateHUD();
});

// Handle window resize
window.addEventListener('resize', () => {
    syncBucketSizeFromCSS();
    updateBucketPositionXY(gameState.bucket.x, gameState.bucket.y);
});
