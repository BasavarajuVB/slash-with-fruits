const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const timerDisplay = document.getElementById('timer');
const gameOverDisplay = document.getElementById('game-over');
const restartBtn = document.getElementById('restart');
const instructionsPopup = document.createElement('div');

// Setup instructions popup
instructionsPopup.id = 'instructions';
instructionsPopup.innerHTML = `
  <div class="popup-content">
    <div class="popup-header">
        <h2>Fruit Ninja Instructions</h2>
    </div>
    <div class="popup-body">
        <div class="instruction-main">
            <div class="swipe-icon">👉</div>
            <p>Slice fruits by swiping across them!</p>
        </div>
        <div class="scoring-section">
            <h3>Scoring:</h3>
            <div class="score-grid">
                <div class="score-item">🍎 <span>+1 point</span></div>
                <div class="score-item">🍊 <span>+3 points</span></div>
                <div class="score-item">🍇 <span>+5 points</span></div>
                <div class="score-item">🍓 <span>+5 points</span></div>
                <div class="score-item">💣 <span>-5 points</span></div>
            </div>
        </div>
    </div>
    <div class="popup-footer">
        <button id="startBtn" class="game-button">OK, Let's Play!</button>
    </div>
</div>
`;
document.body.appendChild(instructionsPopup);

let lastPos = {x: 0, y: 0};
let isDragging = false;
let slashPoints = [];
let shineParticles = [];
let slicedFruitParticles = [];
let spawnCounter = 0;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

let fruits = [];
let score = 0;
let gameOver = false;
let gameLoop;
let spawnInterval;
let timeRemaining = 60;
let timerInterval;

class SlicedFruitParticle {
    constructor(x, y, emoji, direction) {
        this.x = x;
        this.y = y;
        this.emoji = emoji;
        this.direction = direction;
        this.velocityX = (direction === 'left' ? -3 : 3);
        this.velocityY = -6;
        this.gravity = 0.3;
        this.rotation = 0;
        this.rotationSpeed = (direction === 'left' ? -0.15 : 0.15);
        this.scale = 1;
    }

    update() {
        this.x += this.velocityX;
        this.velocityY += this.gravity;
        this.y += this.velocityY;
        this.rotation += this.rotationSpeed;
        this.scale *= 0.99;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.scale(this.scale, this.scale);
        ctx.font = '40px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.emoji, 0, 0);
        ctx.restore();
    }
}

class ShineParticle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.color = `hsl(${Math.random() * 360}, 100%, 75%)`;
        this.size = Math.random() * 6 + 3;
        this.speedX = (Math.random() - 0.5) * 8;
        this.speedY = (Math.random() - 0.5) * 8;
        this.life = 1;
        this.opacity = 1;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= 0.02;
        this.opacity = this.life;
        this.size = Math.max(0, this.size - 0.1);
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Fruit {
    constructor() {
        this.size = 40;
        this.resetPosition();
        this.emoji = this.getRandomEmoji();
        this.points = this.getPoints();
        this.isSliced = false;
    }

    resetPosition() {
        this.x = Math.random() * (canvas.width - this.size);
        this.y = -this.size;
        this.velocityX = (Math.random() - 0.5) * 1.5; // Reduced horizontal speed
        this.velocityY = Math.random() * 1.5 + 3; // Reduced vertical speed
    }

    getRandomEmoji() {
        const emojis = ['🍎', '🍊', '🍇', '🍓', '💣'];
        return emojis[Math.floor(Math.random() * emojis.length)];
    }

    getPoints() {
        const pointsMap = {
            '🍎': 1,
            '🍊': 3,
            '🍇': 5,
            '🍓': 5,
            '💣': -5
        };
        return pointsMap[this.emoji] || 1;
    }

    update() {
        if (!this.isSliced) {
            this.velocityY += 0.1; // Reduced gravity
            this.x += this.velocityX;
            this.y += this.velocityY;
        }
        return this.y > canvas.height + this.size;
    }

    createShineEffect() {
        const particles = [];
        for (let i = 0; i < 30; i++) {
            particles.push(new ShineParticle(
                this.x + this.size/2,
                this.y + this.size/6
            ));
        }
        return particles;
    }

    createSlicedPieces() {
        return [
            new SlicedFruitParticle(this.x, this.y, this.emoji, 'left'),
            new SlicedFruitParticle(this.x, this.y, this.emoji, 'right')
        ];
    }

    draw() {
        if (this.isSliced) return;
        ctx.font = '40px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.emoji, this.x + this.size/2, this.y + this.size/2);
    }

    checkSlice(x1, y1, x2, y2) {
        if (this.isSliced) return false;
        const centerX = this.x + this.size/2;
        const centerY = this.y + this.size/2;
        const dist = this.pointToLineDistance(centerX, centerY, x1, y1, x2, y2);
        return dist < this.size/2;
    }

    pointToLineDistance(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        const dot = A * C + B * D;
        const len_sq = C * C + D * D;
        let param = -1;
        if (len_sq != 0) param = dot / len_sq;
        let xx, yy;
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }
}

function spawnFruit() {
    if (!gameOver) {
        spawnCounter++;
        if (spawnCounter % 2 === 0) { // Spawn multiple fruits
            const fruitCount = Math.floor(Math.random() * 2) + 2; // 2-3 fruits at once
            for (let i = 0; i < fruitCount; i++) {
                fruits.push(new Fruit());
            }
        } else {
            fruits.push(new Fruit());
        }
    }
}

function startGame() {
    clearInterval(gameLoop);
    clearInterval(spawnInterval);
    clearInterval(timerInterval);
    
    fruits = [];
    score = 0;
    timeRemaining = 60;
    gameOver = false;
    slashPoints = [];
    shineParticles = [];
    slicedFruitParticles = [];
    spawnCounter = 0;
    
    scoreDisplay.innerHTML = `Score: ${score}`;
    timerDisplay.innerHTML = `Time: ${timeRemaining}`;
    gameOverDisplay.style.display = 'none';
    restartBtn.style.display = 'none';

    gameLoop = setInterval(updateGame, 1000/60);
    spawnInterval = setInterval(spawnFruit, 1500); // Spawn interval reduced
    timerInterval = setInterval(updateTimer, 1000);
}

function updateGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update and draw particles
    for (let i = shineParticles.length - 1; i >= 0; i--) {
        shineParticles[i].update();
        shineParticles[i].draw(ctx);
        if (shineParticles[i].life <= 0) {
            shineParticles.splice(i, 1);
        }
    }

    for (let i = slicedFruitParticles.length - 1; i >= 0; i--) {
        slicedFruitParticles[i].update();
        slicedFruitParticles[i].draw(ctx);
        if (slicedFruitParticles[i].y > canvas.height) {
            slicedFruitParticles.splice(i, 1);
        }
    }

    // Update and draw fruits
    for (let i = fruits.length - 1; i >= 0; i--) {
        const fruit = fruits[i];
        const isOffscreen = fruit.update();
        if (isOffscreen) {
            fruits.splice(i, 1);
        } else {
            fruit.draw();
        }
    }

    // Draw slash trail
    if (slashPoints.length > 1) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(slashPoints[0].x, slashPoints[0].y);
        for (let i = 1; i < slashPoints.length; i++) {
            ctx.lineTo(slashPoints[i].x, slashPoints[i].y);
        }
        ctx.stroke();
    }
}

function updateTimer() {
    if (timeRemaining > 0) {
        timeRemaining--;
        timerDisplay.innerHTML = `Time: ${timeRemaining}`;
        if (timeRemaining === 0) {
            endGame();
        }
    }
}

function endGame() {
    gameOver = true;
    clearInterval(gameLoop);
    clearInterval(spawnInterval);
    clearInterval(timerInterval);
    gameOverDisplay.style.display = 'block';
    restartBtn.style.display = 'block';
}

function handleSlice(points) {
    if (gameOver || points.length < 2) return;

    const x1 = points[points.length - 2].x;
    const y1 = points[points.length - 2].y;
    const x2 = points[points.length - 1].x;
    const y2 = points[points.length - 1].y;

    let sliceHappened = false;
    fruits.forEach(fruit => {
        if (!fruit.isSliced && fruit.checkSlice(x1, y1, x2, y2)) {
            score += fruit.points;
            fruit.isSliced = true;
            shineParticles.push(...fruit.createShineEffect());
            slicedFruitParticles.push(...fruit.createSlicedPieces());
            scoreDisplay.innerHTML = `Score: ${score}`;
            sliceHappened = true;
        }
    });

    if (!sliceHappened) {
        slashPoints = [points[points.length - 1]];
    }
}

// Event Listeners
canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    const rect = canvas.getBoundingClientRect();
    lastPos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
    slashPoints = [lastPos];
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const rect = canvas.getBoundingClientRect();
    const currentPos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
    slashPoints.push(currentPos);
    handleSlice(slashPoints);
    lastPos = currentPos;
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
    slashPoints = [];
});

canvas.addEventListener('mouseleave', () => {
    isDragging = false;
    slashPoints = [];
});

// Touch events
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    isDragging = true;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    lastPos = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
    };
    slashPoints = [lastPos];
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!isDragging) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const currentPos = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
    };
    slashPoints.push(currentPos);
    handleSlice(slashPoints);
    lastPos = currentPos;
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    isDragging = false;
    slashPoints = [];
});

// Modified restart button event listener to directly start game
restartBtn.addEventListener('click', startGame);

document.getElementById('startBtn').addEventListener('click', () => {
    hideInstructions();
    startGame();
});

// Prevent default scrolling on mobile
document.body.addEventListener('touchstart', (e) => {
    if (e.target === canvas) {
        e.preventDefault();
    }
}, { passive: false });

document.body.addEventListener('touchmove', (e) => {
    if (e.target === canvas) {
        e.preventDefault();
    }
}, { passive: false });

document.body.addEventListener('touchend', (e) => {
    if (e.target === canvas) {
        e.preventDefault();
    }
}, { passive: false });

// Show instructions only on initial load
document.addEventListener('DOMContentLoaded', () => {
    showInstructions();
});

function showInstructions() {
    instructionsPopup.style.display = 'flex';
}

function hideInstructions() {
    instructionsPopup.style.display = 'none';
}
