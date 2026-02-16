/**
 * Pixel-art 2D game visualization for the replay tab.
 * Renders two player characters in a duel with animated actions per round.
 * Includes synthesized retro sound effects via Web Audio API.
 */
const GameCanvas = (() => {
    // --- Constants ---
    const W = 160, H = 70;
    const SCALE = 4;
    const DISPLAY_W = W * SCALE, DISPLAY_H = H * SCALE;

    const P1_COLOR = { r: 108, g: 92, b: 231 };   // #6c5ce7
    const P2_COLOR = { r: 0, g: 184, b: 148 };     // #00b894
    const WALL_COLOR = { r: 120, g: 80, b: 60 };
    const WALL_HIGHLIGHT = { r: 160, g: 110, b: 80 };
    const GROUND_DIRT = { r: 90, g: 65, b: 45 };
    const GROUND_GRASS = { r: 40, g: 100, b: 50 };
    const SKY_TOP = { r: 10, g: 10, b: 30 };
    const SKY_BOT = { r: 25, g: 25, b: 60 };
    const AMMO_LOADED = { r: 253, g: 203, b: 110 }; // yellow
    const AMMO_EMPTY = { r: 50, g: 50, b: 60 };
    const AMMO_BORDER = { r: 180, g: 150, b: 90 };
    const SHIELD_COLOR = { r: 116, g: 185, b: 255 }; // blue
    const PROJECTILE_COLOR = { r: 255, g: 200, b: 80 };
    const FLASH_WHITE = { r: 255, g: 255, b: 255 };
    const MUZZLE_COLOR = { r: 255, g: 220, b: 100 };
    const SPARK_COLOR = { r: 255, g: 255, b: 150 };

    const P1_X = 28;   // center of player 1
    const P2_X = 132;  // center of player 2
    const WALL_X = 76;  // wall center
    const WALL_W = 8;
    const GROUND_Y = 58;
    const PLAYER_Y = 36; // foot position

    // --- Sprite data (16x24, 1=body, 2=head, 3=arm/gun, 0=transparent) ---
    const SPRITE_RIGHT = [
        [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
        [0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0],
        [0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0],
        [0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0],
        [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
        [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
        [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
        [0,0,0,1,1,1,1,1,1,1,1,1,1,3,0,0],
        [0,0,0,1,1,1,1,1,1,1,1,1,1,3,0,0],
        [0,0,0,1,1,1,1,1,1,1,1,1,1,3,3,0],
        [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
        [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
        [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
        [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
        [0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0],
        [0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0],
        [0,0,0,0,1,1,1,0,0,1,1,1,0,0,0,0],
        [0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0],
        [0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0],
        [0,0,0,1,1,1,0,0,0,0,1,1,1,0,0,0],
        [0,0,0,1,1,1,0,0,0,0,1,1,1,0,0,0],
        [0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0],
    ];

    // --- State ---
    let canvas, ctx, offCanvas, offCtx;
    let animId = null;
    let currentRound = null;
    let soundsTriggered = false; // per-animation flag

    // ========== WEB AUDIO SOUND ENGINE ==========
    let audioCtx = null;
    let soundEnabled = true;

    function ensureAudioCtx() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    function playShootSound() {
        if (!soundEnabled) return;
        const ac = ensureAudioCtx();
        const t = ac.currentTime;
        // Sharp "pew" - quick frequency sweep down
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(900, t);
        osc.frequency.exponentialRampToValueAtTime(150, t + 0.15);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(gain).connect(ac.destination);
        osc.start(t);
        osc.stop(t + 0.2);
    }

    function playBlockSound() {
        if (!soundEnabled) return;
        const ac = ensureAudioCtx();
        const t = ac.currentTime;
        // Metallic shield "clang" - two quick tones
        const osc1 = ac.createOscillator();
        const osc2 = ac.createOscillator();
        const gain = ac.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(1200, t);
        osc1.frequency.exponentialRampToValueAtTime(800, t + 0.1);
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(600, t);
        osc2.frequency.exponentialRampToValueAtTime(400, t + 0.1);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ac.destination);
        osc1.start(t);
        osc1.stop(t + 0.15);
        osc2.start(t);
        osc2.stop(t + 0.15);
    }

    function playReloadSound() {
        if (!soundEnabled) return;
        const ac = ensureAudioCtx();
        const t = ac.currentTime;
        // Mechanical "click-click" - two short chirps going up
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.setValueAtTime(400, t + 0.06);
        osc.frequency.setValueAtTime(600, t + 0.12);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.setValueAtTime(0.001, t + 0.05);
        gain.gain.setValueAtTime(0.12, t + 0.06);
        gain.gain.setValueAtTime(0.001, t + 0.11);
        gain.gain.setValueAtTime(0.10, t + 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(gain).connect(ac.destination);
        osc.start(t);
        osc.stop(t + 0.2);
    }

    function playHitSound() {
        if (!soundEnabled) return;
        const ac = ensureAudioCtx();
        const t = ac.currentTime;
        // Explosion impact - noise burst + low thump
        const bufSize = ac.sampleRate * 0.15;
        const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
        }
        const noise = ac.createBufferSource();
        noise.buffer = buf;
        const noiseGain = ac.createGain();
        noiseGain.gain.setValueAtTime(0.2, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        noise.connect(noiseGain).connect(ac.destination);
        // Low thump
        const osc = ac.createOscillator();
        const oscGain = ac.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.2);
        oscGain.gain.setValueAtTime(0.25, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.connect(oscGain).connect(ac.destination);
        noise.start(t);
        osc.start(t);
        osc.stop(t + 0.25);
    }

    function playDeflectSound() {
        if (!soundEnabled) return;
        const ac = ensureAudioCtx();
        const t = ac.currentTime;
        // "Ping" ricochet
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(500, t);
        osc.frequency.exponentialRampToValueAtTime(2000, t + 0.08);
        osc.frequency.exponentialRampToValueAtTime(1500, t + 0.2);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.connect(gain).connect(ac.destination);
        osc.start(t);
        osc.stop(t + 0.25);
    }

    function playWinSound() {
        if (!soundEnabled) return;
        const ac = ensureAudioCtx();
        const t = ac.currentTime;
        // Short victory fanfare - ascending notes
        const notes = [523, 659, 784]; // C5, E5, G5
        notes.forEach((freq, i) => {
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, t + i * 0.1);
            gain.gain.setValueAtTime(0, t);
            gain.gain.setValueAtTime(0.12, t + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.15);
            osc.connect(gain).connect(ac.destination);
            osc.start(t + i * 0.1);
            osc.stop(t + i * 0.1 + 0.15);
        });
    }

    function playTieSound() {
        if (!soundEnabled) return;
        const ac = ensureAudioCtx();
        const t = ac.currentTime;
        // Two descending notes (both lose)
        [400, 250].forEach((freq, i) => {
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, t + i * 0.12);
            gain.gain.setValueAtTime(0.1, t + i * 0.12);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.15);
            osc.connect(gain).connect(ac.destination);
            osc.start(t + i * 0.12);
            osc.stop(t + i * 0.12 + 0.15);
        });
    }

    /** Play action sounds for both players at animation phase start */
    function playActionSounds(p1Action, p2Action, p1Ammo, p2Ammo) {
        const soundMap = { 'S': playShootSound, 'B': playBlockSound, 'R': playReloadSound };
        if (p1Action === 'S' && p1Ammo > 0) playShootSound();
        else if (soundMap[p1Action]) soundMap[p1Action]();
        // Slight delay so sounds don't overlap identically
        setTimeout(() => {
            if (p2Action === 'S' && p2Ammo > 0) playShootSound();
            else if (soundMap[p2Action]) soundMap[p2Action]();
        }, 40);
    }

    /** Play outcome sounds at result phase */
    function playOutcomeSound(outcome, p1Action, p2Action) {
        if (outcome === 'P1Win' || outcome === 'P2Win') {
            // Shoot hit someone
            playHitSound();
            setTimeout(playWinSound, 150);
        } else if (outcome === 'Tie') {
            playHitSound();
            setTimeout(playTieSound, 100);
        } else {
            // Continue - check for deflections (shoot vs block)
            if ((p1Action === 'S' && p2Action === 'B') || (p2Action === 'S' && p1Action === 'B')) {
                playDeflectSound();
            }
        }
    }

    // --- Helpers ---
    function rgb(c, a) {
        if (a !== undefined) return `rgba(${c.r},${c.g},${c.b},${a})`;
        return `rgb(${c.r},${c.g},${c.b})`;
    }

    function lerpColor(c1, c2, t) {
        return {
            r: Math.round(c1.r + (c2.r - c1.r) * t),
            g: Math.round(c1.g + (c2.g - c1.g) * t),
            b: Math.round(c1.b + (c2.b - c1.b) * t),
        };
    }

    function setPixel(x, y, color) {
        x = Math.round(x);
        y = Math.round(y);
        if (x < 0 || x >= W || y < 0 || y >= H) return;
        offCtx.fillStyle = rgb(color);
        offCtx.fillRect(x, y, 1, 1);
    }

    function fillRect(x, y, w, h, color, alpha) {
        offCtx.fillStyle = alpha !== undefined ? rgb(color, alpha) : rgb(color);
        offCtx.fillRect(Math.round(x), Math.round(y), w, h);
    }

    // --- Drawing functions ---
    function drawBackground() {
        // Sky gradient (vertical)
        for (let y = 0; y < GROUND_Y; y++) {
            const t = y / GROUND_Y;
            const c = lerpColor(SKY_TOP, SKY_BOT, t);
            fillRect(0, y, W, 1, c);
        }
        // Stars
        const stars = [[10,5],[30,12],[55,3],[90,8],[120,6],[145,14],[70,10],[15,18],[100,15],[135,4]];
        stars.forEach(([sx, sy]) => {
            setPixel(sx, sy, FLASH_WHITE);
        });
        // Ground - grass line then dirt
        fillRect(0, GROUND_Y, W, 1, GROUND_GRASS);
        fillRect(0, GROUND_Y + 1, W, 1, GROUND_GRASS);
        fillRect(0, GROUND_Y + 2, W, H - GROUND_Y - 2, GROUND_DIRT);
        // Grass tufts
        for (let x = 0; x < W; x += 5) {
            setPixel(x, GROUND_Y - 1, GROUND_GRASS);
            if (x % 10 === 0) setPixel(x + 1, GROUND_Y - 1, GROUND_GRASS);
        }
    }

    function drawWall() {
        const wx = WALL_X - WALL_W / 2;
        const wallTop = GROUND_Y - 22;
        // Brick pattern
        for (let y = wallTop; y < GROUND_Y; y++) {
            for (let x = wx; x < wx + WALL_W; x++) {
                const row = Math.floor((y - wallTop) / 4);
                const offset = (row % 2 === 0) ? 0 : 2;
                const bx = (x - wx + offset) % 4;
                if (bx === 0 || (y - wallTop) % 4 === 0) {
                    setPixel(x, y, WALL_HIGHLIGHT);
                } else {
                    setPixel(x, y, WALL_COLOR);
                }
            }
        }
        // Wall cap
        fillRect(wx - 1, wallTop - 1, WALL_W + 2, 2, WALL_HIGHLIGHT);
    }

    function drawSprite(cx, cy, color, flipX, offsetX, offsetY) {
        offsetX = offsetX || 0;
        offsetY = offsetY || 0;
        const sprite = SPRITE_RIGHT;
        const sw = 16, sh = 24;
        const startX = cx - sw / 2 + offsetX;
        const startY = cy - sh + offsetY;

        const bodyColor = color;
        const headColor = lerpColor(color, FLASH_WHITE, 0.3);
        const armColor = lerpColor(color, { r: 50, g: 50, b: 50 }, 0.3);

        for (let py = 0; py < sh; py++) {
            for (let px = 0; px < sw; px++) {
                const sx = flipX ? (sw - 1 - px) : px;
                const v = sprite[py][sx];
                if (v === 0) continue;
                let c;
                if (v === 2) c = headColor;
                else if (v === 3) c = armColor;
                else c = bodyColor;
                setPixel(startX + px, startY + py, c);
            }
        }
    }

    function drawAmmoBox(cx, y, count) {
        // Ammo box: 8x8 with border, bullet icon inside, and label above
        const bx = cx - 4;
        const by = y;
        const bw = 8, bh = 8;
        const loaded = count > 0;

        // Box background
        fillRect(bx, by, bw, bh, { r: 30, g: 30, b: 40 });
        // Box border
        for (let i = 0; i < bw; i++) {
            setPixel(bx + i, by, AMMO_BORDER);         // top
            setPixel(bx + i, by + bh - 1, AMMO_BORDER); // bottom
        }
        for (let i = 0; i < bh; i++) {
            setPixel(bx, by + i, AMMO_BORDER);         // left
            setPixel(bx + bw - 1, by + i, AMMO_BORDER); // right
        }
        // Bullet icon inside (centered, 4x4 area)
        const color = loaded ? AMMO_LOADED : AMMO_EMPTY;
        // Bullet body: 2px wide, 4px tall
        fillRect(cx - 1, by + 2, 2, 4, color);
        // Bullet tip
        setPixel(cx - 1, by + 1, color);
        setPixel(cx, by + 1, color);
        // Glow if loaded
        if (loaded) {
            setPixel(cx - 2, by + 3, lerpColor(color, FLASH_WHITE, 0.3));
            setPixel(cx + 1, by + 3, lerpColor(color, FLASH_WHITE, 0.3));
        }
    }

    function drawLabel(text, cx, y, color) {
        const FONT = {
            'P': [[1,1,0],[1,0,1],[1,1,0],[1,0,0],[1,0,0]],
            '1': [[0,1,0],[1,1,0],[0,1,0],[0,1,0],[1,1,1]],
            '2': [[1,1,0],[0,0,1],[0,1,0],[1,0,0],[1,1,1]],
            'W': [[1,0,1],[1,0,1],[1,1,1],[1,1,1],[1,0,1]],
            'I': [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[1,1,1]],
            'N': [[1,0,1],[1,1,1],[1,1,1],[1,0,1],[1,0,1]],
            'S': [[0,1,1],[1,0,0],[0,1,0],[0,0,1],[1,1,0]],
            'T': [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[0,1,0]],
            'E': [[1,1,1],[1,0,0],[1,1,0],[1,0,0],[1,1,1]],
            'D': [[1,1,0],[1,0,1],[1,0,1],[1,0,1],[1,1,0]],
            'R': [[1,1,0],[1,0,1],[1,1,0],[1,0,1],[1,0,1]],
            'A': [[0,1,0],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
            'O': [[0,1,0],[1,0,1],[1,0,1],[1,0,1],[0,1,0]],
            'L': [[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,1,1]],
            'C': [[0,1,1],[1,0,0],[1,0,0],[1,0,0],[0,1,1]],
            'K': [[1,0,1],[1,1,0],[1,0,0],[1,1,0],[1,0,1]],
            'B': [[1,1,0],[1,0,1],[1,1,0],[1,0,1],[1,1,0]],
            'H': [[1,0,1],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
            '!': [[0,1,0],[0,1,0],[0,1,0],[0,0,0],[0,1,0]],
            ' ': [[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]],
        };

        const chars = text.toUpperCase().split('');
        const charW = 4;
        const totalW = chars.length * charW - 1;
        let startX = cx - Math.floor(totalW / 2);

        chars.forEach(ch => {
            const glyph = FONT[ch];
            if (glyph) {
                for (let gy = 0; gy < 5; gy++) {
                    for (let gx = 0; gx < 3; gx++) {
                        if (glyph[gy][gx]) {
                            setPixel(startX + gx, y + gy, color);
                        }
                    }
                }
            }
            startX += charW;
        });
    }

    // --- Scene drawing ---
    function drawScene(roundData) {
        if (!offCtx) return;
        offCtx.clearRect(0, 0, W, H);

        drawBackground();
        drawWall();

        const p1Ammo = roundData ? roundData.ammo_before[0] : 1;
        const p2Ammo = roundData ? roundData.ammo_before[1] : 1;

        // Players
        drawSprite(P1_X, PLAYER_Y + 24, P1_COLOR, false, 0, 0);
        drawSprite(P2_X, PLAYER_Y + 24, P2_COLOR, true, 0, 0);

        // Labels
        drawLabel('P1', P1_X, 8, lerpColor(P1_COLOR, FLASH_WHITE, 0.5));
        drawLabel('P2', P2_X, 8, lerpColor(P2_COLOR, FLASH_WHITE, 0.5));

        // Ammo boxes
        drawAmmoBox(P1_X, GROUND_Y + 2, p1Ammo);
        drawAmmoBox(P2_X, GROUND_Y + 2, p2Ammo);

        presentFrame();
    }

    function presentFrame() {
        ctx.clearRect(0, 0, DISPLAY_W, DISPLAY_H);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(offCanvas, 0, 0, DISPLAY_W, DISPLAY_H);
    }

    // --- Animation system ---
    function cancelAnimation() {
        if (animId !== null) {
            cancelAnimationFrame(animId);
            animId = null;
        }
    }

    function playRoundTransition(roundData) {
        cancelAnimation();
        currentRound = roundData;
        if (!roundData) return;

        const p1Action = roundData.actions[0];
        const p2Action = roundData.actions[1];
        const outcome = roundData.outcome;
        const p1Ammo = roundData.ammo_before[0];
        const p2Ammo = roundData.ammo_before[1];
        const duration = 1000;
        const start = performance.now();
        let actionSoundPlayed = false;
        let outcomeSoundPlayed = false;

        function animate(now) {
            const elapsed = now - start;
            const t = Math.min(elapsed / duration, 1);

            offCtx.clearRect(0, 0, W, H);
            drawBackground();
            drawWall();

            // Phase timings
            const anticipation = t < 0.2;
            const action = t >= 0.2 && t < 0.7;
            const result = t >= 0.7;
            const actionT = action ? (t - 0.2) / 0.5 : (result ? 1 : 0);
            const resultT = result ? (t - 0.7) / 0.3 : 0;

            // Trigger action sounds once at phase start
            if (action && !actionSoundPlayed) {
                actionSoundPlayed = true;
                playActionSounds(p1Action, p2Action, p1Ammo, p2Ammo);
            }

            // Trigger outcome sounds once at result phase
            if (result && !outcomeSoundPlayed) {
                outcomeSoundPlayed = true;
                playOutcomeSound(outcome, p1Action, p2Action);
            }

            // Player offsets for anticipation
            let p1OffX = 0, p2OffX = 0;
            if (anticipation) {
                const at = t / 0.2;
                p1OffX = -2 * Math.sin(at * Math.PI);
                p2OffX = 2 * Math.sin(at * Math.PI);
            }

            // Draw players
            drawSprite(P1_X, PLAYER_Y + 24, P1_COLOR, false, p1OffX, 0);
            drawSprite(P2_X, PLAYER_Y + 24, P2_COLOR, true, p2OffX, 0);

            // Labels
            drawLabel('P1', P1_X, 8, lerpColor(P1_COLOR, FLASH_WHITE, 0.5));
            drawLabel('P2', P2_X, 8, lerpColor(P2_COLOR, FLASH_WHITE, 0.5));

            // P1 Action Effects
            if (action || result) {
                drawActionEffect(p1Action, P1_X, P2_X, PLAYER_Y, false, actionT, p1Ammo);
            }

            // P2 Action Effects
            if (action || result) {
                drawActionEffect(p2Action, P2_X, P1_X, PLAYER_Y, true, actionT, p2Ammo);
            }

            // Outcome effects
            if (result) {
                drawOutcomeEffect(outcome, resultT);
            }

            // Ammo (after actions resolve so reload shows)
            const p1AmmoDisplay = (result && p1Action === 'R') ? 1 : p1Ammo;
            const p2AmmoDisplay = (result && p2Action === 'R') ? 1 : p2Ammo;
            drawAmmoBox(P1_X, GROUND_Y + 2, p1AmmoDisplay);
            drawAmmoBox(P2_X, GROUND_Y + 2, p2AmmoDisplay);

            presentFrame();

            if (t < 1) {
                animId = requestAnimationFrame(animate);
            } else {
                animId = null;
                drawScenePostRound(roundData);
            }
        }

        animId = requestAnimationFrame(animate);
    }

    function drawActionEffect(action, srcX, targetX, playerY, isFlipped, actionT, ammo) {
        const gunY = playerY + 9;
        const direction = isFlipped ? -1 : 1;

        if (action === 'S' && ammo > 0) {
            // Muzzle flash (early part)
            if (actionT < 0.3) {
                const flashSize = 3 - Math.floor(actionT / 0.3 * 3);
                const flashX = srcX + direction * 10;
                fillRect(flashX - flashSize / 2, gunY - flashSize / 2, flashSize, flashSize, MUZZLE_COLOR);
            }
            // Projectile
            const projStartX = srcX + direction * 12;
            const wallEdge = isFlipped ? (WALL_X + WALL_W / 2 + 2) : (WALL_X - WALL_W / 2 - 6);
            const projX = projStartX + (wallEdge - projStartX) * actionT;
            fillRect(Math.round(projX), gunY - 1, 4, 2, PROJECTILE_COLOR);
            // Trail
            if (actionT > 0.1) {
                const trailX = projStartX + (wallEdge - projStartX) * (actionT - 0.1);
                for (let i = 0; i < 3; i++) {
                    const tx = Math.round(trailX - direction * i * 3);
                    setPixel(tx, gunY, lerpColor(PROJECTILE_COLOR, SKY_BOT, 0.5 + i * 0.15));
                }
            }
        } else if (action === 'B') {
            // Shield - solid rectangle, no flickering randomness
            const shieldX = srcX + direction * 10;
            const shieldAlpha = Math.min(actionT * 3, 1);
            const shieldH = 20;
            const shieldW = 3;
            const shieldY = playerY + 24 - shieldH - 2;
            // Draw solid shield bars with shimmer
            for (let sy = 0; sy < shieldH; sy++) {
                const brightness = 0.3 + 0.2 * Math.sin(sy * 0.6 + actionT * 8);
                const c = lerpColor(SHIELD_COLOR, FLASH_WHITE, brightness);
                for (let sx = 0; sx < shieldW; sx++) {
                    if (shieldAlpha >= 1 || ((sy + sx) % 2 === 0)) {
                        setPixel(shieldX + sx, shieldY + sy, c);
                    }
                }
            }
            // Shield top/bottom cap
            if (shieldAlpha >= 0.5) {
                fillRect(shieldX - 1, shieldY - 1, shieldW + 2, 1, FLASH_WHITE);
                fillRect(shieldX - 1, shieldY + shieldH, shieldW + 2, 1, FLASH_WHITE);
            }
        } else if (action === 'R') {
            // Reload sparkle at ammo position - deterministic pattern, no randomness
            const sparkX = srcX;
            const sparkY = GROUND_Y + 5;
            const sparkFrame = Math.floor(actionT * 8);
            const offsets = [[-2,-2],[2,-2],[-2,2],[2,2],[0,-3],[0,3],[-3,0],[3,0]];
            for (let i = 0; i < offsets.length; i++) {
                if ((i + sparkFrame) % 3 === 0) {
                    setPixel(sparkX + offsets[i][0], sparkY + offsets[i][1], SPARK_COLOR);
                }
            }
            // Center glow
            setPixel(sparkX - 1, sparkY, AMMO_LOADED);
            setPixel(sparkX, sparkY, FLASH_WHITE);
            setPixel(sparkX + 1, sparkY, AMMO_LOADED);
        }
    }

    function drawOutcomeEffect(outcome, resultT) {
        const flashAlpha = Math.max(0, 1 - resultT * 2);

        if (outcome === 'P1Win') {
            if (flashAlpha > 0) {
                fillRect(P2_X - 12, PLAYER_Y, 24, 28, { r: 255, g: 80, b: 60 }, flashAlpha * 0.5);
            }
            if (resultT > 0.3) {
                drawLabel('P1 WINS!', W / 2, 2, { r: 100, g: 255, b: 150 });
            }
        } else if (outcome === 'P2Win') {
            if (flashAlpha > 0) {
                fillRect(P1_X - 12, PLAYER_Y, 24, 28, { r: 255, g: 80, b: 60 }, flashAlpha * 0.5);
            }
            if (resultT > 0.3) {
                drawLabel('P2 WINS!', W / 2, 2, { r: 255, g: 100, b: 80 });
            }
        } else if (outcome === 'Tie') {
            if (flashAlpha > 0) {
                const ex = WALL_X;
                const ey = PLAYER_Y + 12;
                const radius = 4 + resultT * 6;
                // Deterministic explosion pattern
                for (let i = 0; i < 12; i++) {
                    const angle = (i / 12) * Math.PI * 2;
                    const dist = radius * (0.6 + 0.4 * Math.sin(i * 2.5));
                    const c = (i % 2 === 0) ? MUZZLE_COLOR : { r: 255, g: 100, b: 50 };
                    setPixel(Math.round(ex + Math.cos(angle) * dist), Math.round(ey + Math.sin(angle) * dist), c);
                }
            }
            if (resultT > 0.3) {
                drawLabel('TIE!', W / 2, 2, AMMO_LOADED);
            }
        } else if (outcome === 'Continue') {
            if (resultT > 0.3) {
                drawLabel('TIME OUT', W / 2, 2, { r: 139, g: 144, b: 165 });
            }
        } else {
            // Continue - brief wall flash
            if (flashAlpha > 0.5) {
                fillRect(WALL_X - WALL_W / 2, GROUND_Y - 22, WALL_W, 22, FLASH_WHITE, flashAlpha * 0.2);
            }
        }
    }

    function drawScenePostRound(roundData) {
        if (!roundData) return;
        const p1Ammo = roundData.ammo_after ? roundData.ammo_after[0] :
            (roundData.actions[0] === 'S' ? 0 : (roundData.actions[0] === 'R' ? 1 : roundData.ammo_before[0]));
        const p2Ammo = roundData.ammo_after ? roundData.ammo_after[1] :
            (roundData.actions[1] === 'S' ? 0 : (roundData.actions[1] === 'R' ? 1 : roundData.ammo_before[1]));

        offCtx.clearRect(0, 0, W, H);
        drawBackground();
        drawWall();
        drawSprite(P1_X, PLAYER_Y + 24, P1_COLOR, false, 0, 0);
        drawSprite(P2_X, PLAYER_Y + 24, P2_COLOR, true, 0, 0);
        drawLabel('P1', P1_X, 8, lerpColor(P1_COLOR, FLASH_WHITE, 0.5));
        drawLabel('P2', P2_X, 8, lerpColor(P2_COLOR, FLASH_WHITE, 0.5));
        drawAmmoBox(P1_X, GROUND_Y + 2, p1Ammo);
        drawAmmoBox(P2_X, GROUND_Y + 2, p2Ammo);

        const outcome = roundData.outcome;
        if (outcome === 'P1Win') drawLabel('P1 WINS!', W / 2, 2, { r: 100, g: 255, b: 150 });
        else if (outcome === 'P2Win') drawLabel('P2 WINS!', W / 2, 2, { r: 255, g: 100, b: 80 });
        else if (outcome === 'Tie') drawLabel('TIE!', W / 2, 2, AMMO_LOADED);
        else if (outcome === 'Continue') drawLabel('TIME OUT', W / 2, 2, { r: 139, g: 144, b: 165 });

        presentFrame();
    }

    // --- Public API ---
    function init(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        canvas = document.createElement('canvas');
        canvas.width = DISPLAY_W;
        canvas.height = DISPLAY_H;
        canvas.id = 'game-canvas-el';
        container.appendChild(canvas);
        ctx = canvas.getContext('2d');

        offCanvas = document.createElement('canvas');
        offCanvas.width = W;
        offCanvas.height = H;
        offCtx = offCanvas.getContext('2d');

        // Sound toggle button
        const btn = document.createElement('button');
        btn.className = 'btn-secondary btn-sound-toggle';
        btn.textContent = 'Sound: ON';
        btn.addEventListener('click', () => {
            soundEnabled = !soundEnabled;
            btn.textContent = soundEnabled ? 'Sound: ON' : 'Sound: OFF';
        });
        container.appendChild(btn);

        drawScene(null);
    }

    function reset() {
        cancelAnimation();
        currentRound = null;
        drawScene(null);
    }

    return {
        init,
        drawScene,
        playRoundTransition,
        reset,
    };
})();
