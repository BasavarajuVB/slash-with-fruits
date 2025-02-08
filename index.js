(function() {
    const styleElem = document.createElement('style');
    styleElem.innerHTML = `
      @keyframes shake {
        0% { transform: translate(1px, 1px) rotate(0deg); }
        10% { transform: translate(-1px, -2px) rotate(-1deg); }
        20% { transform: translate(-3px, 0px) rotate(1deg); }
        30% { transform: translate(3px, 2px) rotate(0deg); }
        40% { transform: translate(1px, -1px) rotate(1deg); }
        50% { transform: translate(-1px, 2px) rotate(-1deg); }
        60% { transform: translate(-3px, 1px) rotate(0deg); }
        70% { transform: translate(3px, 1px) rotate(-1deg); }
        80% { transform: translate(-1px, -1px) rotate(1deg); }
        90% { transform: translate(1px, 2px) rotate(0deg); }
        100% { transform: translate(1px, -2px) rotate(-1deg); }
      }
      .shake {
        animation: shake 0.5s;
        animation-iteration-count: 4;
      }
    `;
    document.head.appendChild(styleElem);
  })();
  
  // ------------------------------
  // Get DOM Elements
  // ------------------------------
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const scoreDisplay = document.getElementById('score');
  const timerDisplay = document.getElementById('timer');
  const gameOverDisplay = document.getElementById('game-over');
  const restartBtn = document.getElementById('restart');
  
  // ------------------------------
  // Setup Instructions Popup (includes ice fruit info)
  // ------------------------------
  const instructionsPopup = document.createElement('div');
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
                  <div class="score-item">❄️ <span>+2 points &amp; timer paused for 5s</span></div>
              </div>
          </div>
      </div>
      <div class="popup-footer">
          <button id="startBtn" class="game-button">OK, Let's Play!</button>
      </div>
    </div>
  `;
  document.body.appendChild(instructionsPopup);
  
  // ------------------------------
  // Global Variables
  // ------------------------------
  let lastPos = { x: 0, y: 0 };
  let isDragging = false;
  let slashPoints = [];
  let shineParticles = [];
  let slicedFruitParticles = [];
  let scorePopups = [];
  let fruits = [];
  let score = 0;
  let gameOver = false;
  let gameLoop;
  let spawnInterval;
  let timerInterval;
  let timeRemaining = 60;
  let isTimerPaused = false;
  let spawnCounter = 0;
  
  // ------------------------------
  // Resize Canvas to Fit Window
  // ------------------------------
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  // ------------------------------
  // Classes
  // ------------------------------
  
  // Floating Score Popup Class – enhanced style for shine
  class ScorePopup {
    constructor(x, y, text, color) {
      this.x = x;
      this.y = y;
      this.text = text;
      this.alpha = 1;
      this.color = color;
      this.dy = -1; // Moves upward
    }
    update() {
      this.y += this.dy;
      this.alpha -= 0.02;
    }
    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.font = 'bold 30px Arial';
      ctx.fillStyle = this.color;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
      ctx.shadowBlur = 10;
      ctx.fillText(this.text, this.x, this.y);
      ctx.restore();
    }
  }
  
  // Shine Particle (for slicing effect)
  class ShineParticle {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.color = `hsl(${Math.random() * 360}, 100%, 75%)`;
      this.size = Math.random() * 8 + 4;
      this.speedX = (Math.random() - 0.5) * 10;
      this.speedY = (Math.random() - 0.5) * 10;
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
      ctx.shadowBlur = 20;
      ctx.shadowColor = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  
  // Particle for Sliced Fruit Pieces
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
  
  // Fruit Class – "Stone Throw" style: Spawns at the border and arcs across
  class Fruit {
    constructor() {
      this.size = 120; // Increased fruit size
      this.resetPosition();
      this.emoji = this.getRandomEmoji();
      this.points = this.getPoints();
      this.isSliced = false;
    }
    resetPosition() {
      // Vertical spawn: random between 10vh and 90vh
      const vh = window.innerHeight / 100;
      const allowedTop = 10 * vh;
      const allowedBottom = 90 * vh;
      this.y = allowedTop + Math.random() * (allowedBottom - allowedTop - this.size);
      // Decide spawn border: left or right
      this.zone = Math.random() < 0.5 ? 'left' : 'right';
      if (this.zone === 'left') {
        this.x = 0; // Spawn at left border
        // Force horizontal velocity to be positive (moving right) and add a parabolic arc
        this.velocityX = Math.random() * 3 + 3; // between 3 and 6
        this.velocityY = - (Math.random() * 2 + 8); // initial upward velocity between -8 and -10
      } else {
        this.x = canvas.width - this.size; // Spawn at right border
        // Force horizontal velocity to be negative (moving left)
        this.velocityX = - (Math.random() * 3 + 3); // between -3 and -6
        this.velocityY = - (Math.random() * 2 + 8);
      }
    }
    getRandomEmoji() {
      const emojis = ['🍎', '🍊', '🍇', '🍓', '💣', '❄️'];
      return emojis[Math.floor(Math.random() * emojis.length)];
    }
    getPoints() {
      const pointsMap = {
        '🍎': 1,
        '🍊': 3,
        '🍇': 5,
        '🍓': 5,
        '💣': -5,
        '❄️': 2
      };
      return pointsMap[this.emoji] || 1;
    }
    update() {
      if (!this.isSliced) {
        this.velocityY += 0.3; // Gravity
        this.x += this.velocityX;
        this.y += this.velocityY;
      }
      // Remove fruit if it leaves the canvas horizontally or falls off the bottom
      if (this.x > canvas.width || (this.x + this.size) < 0 || this.y > canvas.height) {
        return true;
      }
      return false;
    }
    createShineEffect() {
      const particles = [];
      for (let i = 0; i < 40; i++) {
        particles.push(new ShineParticle(
          this.x + this.size / 2,
          this.y + this.size / 6
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
      ctx.fillText(this.emoji, this.x + this.size / 2, this.y + this.size / 2);
    }
    checkSlice(x1, y1, x2, y2) {
      if (this.isSliced) return false;
      const centerX = this.x + this.size / 2;
      const centerY = this.y + this.size / 2;
      const dist = this.pointToLineDistance(centerX, centerY, x1, y1, x2, y2);
      return dist < this.size / 2;
    }
    pointToLineDistance(px, py, x1, y1, x2, y2) {
      const A = px - x1;
      const B = py - y1;
      const C = x2 - x1;
      const D = y2 - y1;
      const dot = A * C + B * D;
      const len_sq = C * C + D * D;
      let param = -1;
      if (len_sq !== 0) param = dot / len_sq;
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
    
  // ------------------------------
  // Timer and Special Effects
  // ------------------------------
  
  // Ice Effect: Pause the timer for 5 seconds and show a centered positive overlay for 1 second
  function iceEffect() {
    clearInterval(timerInterval);
    let iceOverlay = document.createElement('div');
    iceOverlay.id = 'ice-overlay';
    iceOverlay.style.position = 'fixed';
    iceOverlay.style.top = '50%';
    iceOverlay.style.left = '50%';
    iceOverlay.style.transform = 'translate(-50%, -50%)';
    iceOverlay.style.backgroundColor = 'rgba(173,216,230,0.7)';
    iceOverlay.style.padding = '20px 30px';
    iceOverlay.style.borderRadius = '10px';
    iceOverlay.style.zIndex = '10000';
    iceOverlay.style.fontSize = '36px';
    iceOverlay.style.fontWeight = 'bold';
    iceOverlay.style.color = '#FF69B4';
    // Positive message with emojis
    iceOverlay.innerText = '⏸️ Timer frozen! Enjoy this break! 😊';
    iceOverlay.style.pointerEvents = 'none';
    document.body.appendChild(iceOverlay);
    scoreDisplay.style.opacity = '0.7';
    timerDisplay.style.opacity = '0.7';
    // Remove overlay after 1 second
    setTimeout(() => {
      if(document.body.contains(iceOverlay)) {
        document.body.removeChild(iceOverlay);
      }
    }, 1000);
    // Resume timer after 5 seconds
    setTimeout(() => {
      scoreDisplay.style.opacity = '1';
      timerDisplay.style.opacity = '1';
      timerInterval = setInterval(updateTimer, 1000);
    }, 5000);
  }
    
  // Bomb Effect: Flash red overlay with centered message and shake canvas for 2 seconds
  function bombEffect() {
    const bombOverlay = document.createElement('div');
    bombOverlay.id = 'bomb-overlay';
    bombOverlay.style.position = 'fixed';
    bombOverlay.style.top = '0';
    bombOverlay.style.left = '0';
    bombOverlay.style.width = '100%';
    bombOverlay.style.height = '100%';
    bombOverlay.style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
    bombOverlay.style.zIndex = '9999';
    bombOverlay.style.display = 'flex';
    bombOverlay.style.justifyContent = 'center';
    bombOverlay.style.alignItems = 'center';
    bombOverlay.style.fontSize = '36px';
    bombOverlay.style.fontWeight = 'bold';
    bombOverlay.style.color = '#fff';
    bombOverlay.innerHTML = '💣 Ohh, you lost 5 points! 😢';
    document.body.appendChild(bombOverlay);
    canvas.classList.add('shake');
    setTimeout(() => {
      if (document.body.contains(bombOverlay)) {
        document.body.removeChild(bombOverlay);
      }
      canvas.classList.remove('shake');
    }, 2000);
  }
    
  // ------------------------------
  // Game Functions
  // ------------------------------
    
  // Spawn fruits in bursts (choose a random count from [10, 6, 8, 4])
  function spawnFruit() {
    if (!gameOver) {
      const fruitCounts = [10, 6, 8, 4];
      const count = fruitCounts[Math.floor(Math.random() * fruitCounts.length)];
      for (let i = 0; i < count; i++) {
        fruits.push(new Fruit());
      }
    }
  }
    
  function startGame() {
    clearInterval(gameLoop);
    clearInterval(spawnInterval);
    clearInterval(timerInterval);
      
    fruits = [];
    scorePopups = [];
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
    
    gameLoop = setInterval(updateGame, 1000 / 60);
    spawnInterval = setInterval(spawnFruit, 1500);
    timerInterval = setInterval(updateTimer, 1000);
  }
    
  function updateGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Update and draw shine particles
    for (let i = shineParticles.length - 1; i >= 0; i--) {
      shineParticles[i].update();
      shineParticles[i].draw(ctx);
      if (shineParticles[i].life <= 0) {
        shineParticles.splice(i, 1);
      }
    }
    
    // Update and draw sliced fruit particles
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
      if (fruit.update()) {
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
    
    // Update and draw floating score popups
    for (let i = scorePopups.length - 1; i >= 0; i--) {
      scorePopups[i].update();
      scorePopups[i].draw(ctx);
      if (scorePopups[i].alpha <= 0) {
        scorePopups.splice(i, 1);
      }
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
    
  // When slicing, check collision with fruits and apply effects
  function handleSlice(points) {
    if (gameOver || points.length < 2) return;
    
    const x1 = points[points.length - 2].x;
    const y1 = points[points.length - 2].y;
    const x2 = points[points.length - 1].x;
    const y2 = points[points.length - 1].y;
    
    let sliceHappened = false;
    fruits.forEach(fruit => {
      if (!fruit.isSliced && fruit.checkSlice(x1, y1, x2, y2)) {
        fruit.isSliced = true;
        score += fruit.points;
        scoreDisplay.innerHTML = `Score: ${score}`;
        scorePopups.push(new ScorePopup(
          fruit.x + fruit.size / 2,
          fruit.y + fruit.size / 2,
          (fruit.points > 0 ? '+' : '') + fruit.points,
          fruit.points >= 0 ? 'lime' : 'red'
        ));
        if (fruit.emoji === '❄️') {
          shineParticles.push(...fruit.createShineEffect());
          slicedFruitParticles.push(...fruit.createSlicedPieces());
          iceEffect();
        } else if (fruit.emoji === '💣') {
          let bombParticles = [];
          for (let i = 0; i < 10; i++) {
            bombParticles.push(new ShineParticle(
              fruit.x + fruit.size / 2,
              fruit.y + fruit.size / 6
            ));
          }
          shineParticles.push(...bombParticles);
          slicedFruitParticles.push(...fruit.createSlicedPieces());
          bombEffect();
        } else {
          shineParticles.push(...fruit.createShineEffect());
          slicedFruitParticles.push(...fruit.createSlicedPieces());
        }
        sliceHappened = true;
      }
    });
    
    if (!sliceHappened) {
      slashPoints = [points[points.length - 1]];
    }
  }
    
  // ------------------------------
  // Event Listeners
  // ------------------------------
    
  // Mouse Events
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
    
  // Touch Events
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
    
  // Prevent default scrolling on mobile when interacting with the canvas
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
    
  // Restart Button Event Listener (starts the game)
  restartBtn.addEventListener('click', startGame);
    
  // Start Button on the Instructions Popup
  document.getElementById('startBtn').addEventListener('click', () => {
    hideInstructions();
    startGame();
  });
    
  // Show Instructions on Initial Load
  document.addEventListener('DOMContentLoaded', () => {
    showInstructions();
  });
    
  function showInstructions() {
    instructionsPopup.style.display = 'flex';
  }
    
  function hideInstructions() {
    instructionsPopup.style.display = 'none';
  }
