/* ============================================
   NARUTO JUTSU AR — Main Application
   Hand tracking + Effect Rendering + Throw
   Detection + Projectile Management
   ============================================ */

(function () {
    'use strict';

    // ===== DOM Elements =====
    const loadingScreen = document.getElementById('loading-screen');
    const startScreen = document.getElementById('start-screen');
    const arView = document.getElementById('ar-view');
    const startBtn = document.getElementById('start-btn');
    const video = document.getElementById('video');
    const overlayCanvas = document.getElementById('overlay');
    const effectsCanvas = document.getElementById('effects');
    const overlayCtx = overlayCanvas.getContext('2d');
    const effectsCtx = effectsCanvas.getContext('2d');
    const progressFill = document.getElementById('progress-fill');
    const loaderHint = document.getElementById('loader-hint');
    const detectionStatus = document.getElementById('detection-status');
    const fpsCounter = document.getElementById('fps-counter');
    const leftChakraFill = document.getElementById('left-chakra-fill');
    const rightChakraFill = document.getElementById('right-chakra-fill');
    const rightJutsuName = document.getElementById('right-jutsu-name');

    // ===== State =====
    let showSkeleton = false;
    let showEffects = true;
    let mirrorMode = true;
    let lastFrameTime = 0;
    let frameCount = 0;
    let fpsUpdateTime = 0;
    let currentFps = 0;

    // ===== Effects =====
    const rasengan = new RasenganEffect();
    const chidori = new ChidoriEffect();
    const projectileManager = new ProjectileManager();

    // ===== Hand Tracking State =====
    let leftHandDetected = false;
    let rightHandDetected = false;
    let leftPalmData = null;
    let rightPalmData = null;

    // ===== Throw Detection State =====
    const rightPalmHistory = [];
    const leftPalmHistory = [];
    const HISTORY_SIZE = 6;
    const THROW_SPEED_THRESHOLD = 350; // px/sec

    // Per-hand throw cooldowns to prevent rapid-fire
    let rightThrowCooldown = 0;
    let leftThrowCooldown = 0;

    // Collision cooldown
    let collisionCooldown = 0;

    // ===== Control Buttons =====
    document.getElementById('toggle-skeleton').addEventListener('click', function () {
        showSkeleton = !showSkeleton;
        this.classList.toggle('active', showSkeleton);
    });

    document.getElementById('toggle-mirror').addEventListener('click', function () {
        mirrorMode = !mirrorMode;
        video.classList.toggle('no-mirror', !mirrorMode);
        this.classList.toggle('active', !mirrorMode);
    });

    document.getElementById('toggle-effects').addEventListener('click', function () {
        showEffects = !showEffects;
        this.classList.toggle('active', showEffects);
    });

    // ===== Loading & Initialization =====
    function updateProgress(pct, hint) {
        progressFill.style.width = pct + '%';
        loaderHint.textContent = hint;
    }

    function showStartScreen() {
        loadingScreen.style.opacity = '0';
        loadingScreen.style.transition = 'opacity 0.5s ease';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            startScreen.style.display = 'flex';
            startScreen.style.opacity = '0';
            startScreen.style.transition = 'opacity 0.5s ease';
            requestAnimationFrame(() => { startScreen.style.opacity = '1'; });
        }, 500);
    }

    function showARView() {
        startScreen.style.opacity = '0';
        startScreen.style.transition = 'opacity 0.5s ease';
        setTimeout(() => {
            startScreen.style.display = 'none';
            arView.style.display = 'block';
            arView.style.opacity = '0';
            arView.style.transition = 'opacity 0.5s ease';
            requestAnimationFrame(() => { arView.style.opacity = '1'; });
            startCamera();
        }, 500);
    }

    startBtn.addEventListener('click', showARView);

    // ===== MediaPipe Hands Setup =====
    updateProgress(10, 'Loading MediaPipe Hands...');

    const hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.6,
    });

    updateProgress(40, 'Loading hand detection model...');
    hands.onResults(onResults);
    updateProgress(70, 'Preparing effects engine...');

    setTimeout(() => updateProgress(85, 'Almost ready...'), 800);
    setTimeout(() => updateProgress(100, 'Ready!'), 1500);
    setTimeout(showStartScreen, 2200);

    // ===== Camera Setup =====
    function startCamera() {
        const camera = new Camera(video, {
            onFrame: async () => { await hands.send({ image: video }); },
            width: 1280,
            height: 720,
        });
        camera.start();
    }

    // ===== Throw Detection =====
    function addToHistory(history, pos, time) {
        history.push({ x: pos.x, y: pos.y, time });
        while (history.length > HISTORY_SIZE) history.shift();
    }

    function getVelocity(history) {
        if (history.length < 3) return { vx: 0, vy: 0, speed: 0 };
        const recent = history[history.length - 1];
        const older = history[Math.max(0, history.length - 4)];
        const dt = (recent.time - older.time) / 1000;
        if (dt < 0.001) return { vx: 0, vy: 0, speed: 0 };
        const vx = (recent.x - older.x) / dt;
        const vy = (recent.y - older.y) / dt;
        return { vx, vy, speed: Math.sqrt(vx * vx + vy * vy) };
    }

    function tryThrow(isFullyOpen, history, type, handSize) {
        // Throw = all fingers fully open + moving fast
        if (!isFullyOpen) return false;
        const vel = getVelocity(history);
        if (vel.speed < THROW_SPEED_THRESHOLD) return false;

        const launchSpeed = 350 + vel.speed * 0.3;
        const dir = Math.atan2(vel.vy, vel.vx);
        const last = history[history.length - 1];

        projectileManager.throw(
            last.x, last.y,
            Math.cos(dir) * launchSpeed,
            Math.sin(dir) * launchSpeed,
            type,
            handSize * 0.4
        );
        return true;
    }

    // ===== Process Hand Results =====
    function onResults(results) {
        if (overlayCanvas.width !== video.videoWidth || overlayCanvas.height !== video.videoHeight) {
            overlayCanvas.width = video.videoWidth;
            overlayCanvas.height = video.videoHeight;
            effectsCanvas.width = video.videoWidth;
            effectsCanvas.height = video.videoHeight;
        }

        const w = overlayCanvas.width;
        const h = overlayCanvas.height;

        overlayCtx.clearRect(0, 0, w, h);
        effectsCtx.clearRect(0, 0, w, h);

        // FPS
        const now = performance.now();
        frameCount++;
        if (now - fpsUpdateTime > 1000) {
            currentFps = frameCount;
            frameCount = 0;
            fpsUpdateTime = now;
            fpsCounter.textContent = currentFps + ' FPS';
        }
        const dt = Math.min(0.1, (now - lastFrameTime) / 1000);
        lastFrameTime = now;

        // Cooldowns
        if (collisionCooldown > 0) collisionCooldown -= dt;

        leftHandDetected = false;
        rightHandDetected = false;
        leftPalmData = null;
        rightPalmData = null;

        if (results.multiHandLandmarks && results.multiHandedness) {
            for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                const landmarks = results.multiHandLandmarks[i];
                const handedness = results.multiHandedness[i];
                const label = handedness.label;

                const pixelLandmarks = landmarks.map(lm => ({
                    x: lm.x * w, y: lm.y * h, z: lm.z
                }));

                const renderLandmarks = mirrorMode
                    ? pixelLandmarks.map(p => ({ x: w - p.x, y: p.y, z: p.z }))
                    : pixelLandmarks;

                const palmCenter = getPalmCenter(renderLandmarks);
                const handSize = getHandSize(renderLandmarks);
                const openness = getHandOpenness(pixelLandmarks);
                const fullyOpen = openness >= 0.99;

                if (showSkeleton) drawHandSkeleton(overlayCtx, renderLandmarks, label);

                const palmData = { center: palmCenter, size: handSize, openness, fullyOpen };

                if (mirrorMode) {
                    if (label === 'Left') {
                        rightHandDetected = true;
                        rightPalmData = palmData;
                    } else {
                        leftHandDetected = true;
                        leftPalmData = palmData;
                    }
                } else {
                    if (label === 'Right') {
                        rightHandDetected = true;
                        rightPalmData = palmData;
                    } else {
                        leftHandDetected = true;
                        leftPalmData = palmData;
                    }
                }
            }
        }

        // ===== Effects + Throw Logic =====
        if (showEffects) {
            // Get hand openness (0.0 - 1.0) for intensity scaling
            const rightOpenness = rightPalmData ? rightPalmData.openness : 0;
            const leftOpenness = leftPalmData ? leftPalmData.openness : 0;
            const rightFullyOpen = rightPalmData ? rightPalmData.fullyOpen : false;
            const leftFullyOpen = leftPalmData ? leftPalmData.fullyOpen : false;

            // Track palm history
            if (rightPalmData) addToHistory(rightPalmHistory, rightPalmData.center, now);
            if (leftPalmData) addToHistory(leftPalmHistory, leftPalmData.center, now);

            // Throw cooldowns
            rightThrowCooldown = Math.max(0, rightThrowCooldown - dt);
            leftThrowCooldown = Math.max(0, leftThrowCooldown - dt);

            // Throw: fully open palm + moving fast + cooldown expired
            if (rightHandDetected && rightFullyOpen && rightThrowCooldown <= 0) {
                const type = rasengan.isRasenshuriken() ? 'rasenshuriken' : 'rasengan';
                if (tryThrow(true, rightPalmHistory, type, rightPalmData.size)) {
                    rasengan.deactivate();
                    rightThrowCooldown = 0.8;
                }
            }
            if (leftHandDetected && leftFullyOpen && leftThrowCooldown <= 0) {
                if (tryThrow(true, leftPalmHistory, 'chidori', leftPalmData.size)) {
                    chidori.deactivate();
                    leftThrowCooldown = 0.8;
                }
            }

            // Effects: ALWAYS active when hand detected, intensity scales with openness
            // Closed fist = minimum dim glow, open hand = full power
            if (rightHandDetected) {
                rasengan.activate(rightOpenness);
            } else {
                rasengan.deactivate();
            }
            rasengan.update(dt, rightPalmData?.center, rightPalmData?.size || 80);

            if (leftHandDetected) {
                chidori.activate(leftOpenness);
            } else {
                chidori.deactivate();
            }
            chidori.update(dt, leftPalmData?.center, leftPalmData?.size || 80);

            // Hand-to-hand collision (both hands active with decent intensity)
            if (collisionCooldown <= 0 && rightHandDetected && leftHandDetected &&
                rightOpenness > 0.4 && leftOpenness > 0.4 &&
                rightPalmData && leftPalmData) {
                const collided = projectileManager.checkHandCollision(
                    rightPalmData.center, leftPalmData.center,
                    true, true,
                    rightPalmData.size, leftPalmData.size
                );
                if (collided) {
                    collisionCooldown = 2;
                    rasengan.deactivate();
                    chidori.deactivate();
                }
            }

            // Update projectiles
            projectileManager.update(dt, w, h);

            // Apply screen shake from projectiles
            if (Math.abs(projectileManager.screenShake.x) > 0.5) {
                effectsCtx.save();
                effectsCtx.translate(projectileManager.screenShake.x, projectileManager.screenShake.y);
            }

            // Draw effects
            rasengan.draw(effectsCtx);
            chidori.draw(effectsCtx);
            projectileManager.draw(effectsCtx);

            if (Math.abs(projectileManager.screenShake.x) > 0.5) {
                effectsCtx.restore();
            }
        }

        updateHUD();
    }

    // ===== Hand Analysis =====
    function getPalmCenter(landmarks) {
        const indices = [0, 5, 9, 13, 17];
        let x = 0, y = 0;
        for (const idx of indices) { x += landmarks[idx].x; y += landmarks[idx].y; }
        const wrist = landmarks[0];
        const mid = landmarks[9];
        const cx = x / indices.length;
        const cy = y / indices.length;
        return {
            x: cx + (mid.x - wrist.x) * 0.35,
            y: cy + (mid.y - wrist.y) * 0.35
        };
    }

    function getHandSize(landmarks) {
        const w = landmarks[0], t = landmarks[12];
        return Math.sqrt((t.x - w.x) ** 2 + (t.y - w.y) ** 2);
    }

    // Returns 0.0 - 1.0 based on how many fingers+thumb are extended
    function getHandOpenness(landmarks) {
        const wrist = landmarks[0];
        let extCount = 0;

        // Thumb: tip (4) vs IP joint (3) — check if tip is further from palm center
        const palmCx = (landmarks[0].x + landmarks[5].x + landmarks[17].x) / 3;
        const thumbTipDist = Math.abs(landmarks[4].x - palmCx);
        const thumbIPDist = Math.abs(landmarks[3].x - palmCx);
        if (thumbTipDist > thumbIPDist * 1.1) extCount++;

        // Fingers: tip farther from wrist than PIP joint
        const tips = [8, 12, 16, 20];
        const pips = [6, 10, 14, 18];
        for (let i = 0; i < tips.length; i++) {
            const td = Math.sqrt((landmarks[tips[i]].x - wrist.x) ** 2 + (landmarks[tips[i]].y - wrist.y) ** 2);
            const pd = Math.sqrt((landmarks[pips[i]].x - wrist.x) ** 2 + (landmarks[pips[i]].y - wrist.y) ** 2);
            if (td > pd * 1.05) extCount++;
        }

        return extCount / 5; // 0.0, 0.2, 0.4, 0.6, 0.8, 1.0
    }

    // Returns true only when ALL 5 digits (thumb + 4 fingers) are fully extended
    function isFullyOpen(landmarks) {
        return getHandOpenness(landmarks) >= 0.99;
    }

    // ===== Draw Hand Skeleton =====
    function drawHandSkeleton(ctx, landmarks, label) {
        const conns = [
            [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],
            [0,9],[9,10],[10,11],[11,12],[0,13],[13,14],[14,15],[15,16],
            [0,17],[17,18],[18,19],[19,20],[5,9],[9,13],[13,17],
        ];
        const isRight = (mirrorMode && label === 'Left') || (!mirrorMode && label === 'Right');
        const color = isRight ? 'rgba(79,172,254,0.8)' : 'rgba(165,180,252,0.8)';
        const dot = isRight ? 'rgba(194,233,251,0.9)' : 'rgba(224,231,255,0.9)';

        ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = 'round';
        for (const [a, b] of conns) {
            ctx.beginPath();
            ctx.moveTo(landmarks[a].x, landmarks[a].y);
            ctx.lineTo(landmarks[b].x, landmarks[b].y);
            ctx.stroke();
        }
        for (const lm of landmarks) {
            ctx.beginPath(); ctx.arc(lm.x, lm.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = dot; ctx.fill();
        }
    }

    // ===== HUD =====
    function updateHUD() {
        const rp = rasengan.getChargePower();
        const cp = chidori.getChargePower();
        rightChakraFill.style.width = (rp * 100) + '%';
        leftChakraFill.style.width = (cp * 100) + '%';

        if (rasengan.isRasenshuriken()) {
            rightJutsuName.textContent = '風遁・RASENSHURIKEN';
            rightJutsuName.style.color = '#f97316';
            rightJutsuName.style.textShadow = '0 0 10px rgba(249,115,22,0.5)';
            rightChakraFill.style.background = 'linear-gradient(90deg, #4facfe, #f97316)';
        } else {
            rightJutsuName.textContent = 'RASENGAN';
            rightJutsuName.style.color = '';
            rightJutsuName.style.textShadow = '';
            rightChakraFill.style.background = '';
        }

        const statusEl = detectionStatus;
        const statusText = statusEl.querySelector('.status-text');
        const any = leftHandDetected || rightHandDetected;

        if (any) {
            statusEl.classList.add('active');
            const parts = [];
            if (rightHandDetected) {
                parts.push(rasengan.isRasenshuriken() ? 'Right: RASENSHURIKEN' : 'Right: Rasengan');
            }
            if (leftHandDetected) parts.push('Left: Chidori');
            if (projectileManager.projectiles.length > 0) parts.push('🎯 ' + projectileManager.projectiles.length);
            statusText.textContent = parts.join(' • ');
        } else {
            statusEl.classList.remove('active');
            statusText.textContent = projectileManager.hasActivity
                ? '💥 Attacks in flight!'
                : 'Show your hands to activate jutsu';
        }
    }
})();
