/* ============================================
   PROJECTILE & EXPLOSION SYSTEM
   Handles thrown attacks, flying projectiles,
   explosions, and collision detection.
   ============================================ */

// ===== EXPLOSION =====
class Explosion {
    constructor(x, y, type, size) {
        this.x = x;
        this.y = y;
        this.type = type; // 'rasengan', 'chidori', 'collision'
        this.size = size || 120;
        this.time = 0;
        this.duration = type === 'collision' ? 1.8 : 1.2;
        this.done = false;
        this.particles = new ParticleSystem();
        this.flashAlpha = type === 'collision' ? 0.7 : 0.5;
        this.shockwaves = [];
        this._burst();
    }

    _burst() {
        const s = this.size;
        const isCol = this.type === 'collision';
        const isRas = this.type === 'rasengan';

        // Shockwave rings
        const ringCount = isCol ? 4 : 3;
        for (let i = 0; i < ringCount; i++) {
            this.shockwaves.push({ r: 0, maxR: s * (1.5 + i * 0.8), alpha: 0.5 - i * 0.1, w: 3 - i * 0.5 });
        }

        // Particle burst
        const count = isCol ? 80 : 50;
        for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2 + Math.random() * 0.3;
            const spd = 4 + Math.random() * (isCol ? 18 : 12);
            const colors = isRas
                ? ['79, 172, 254', '120, 200, 255', '194, 233, 251']
                : isCol
                    ? ['79, 172, 254', '140, 160, 255', '200, 215, 255', '255, 200, 100']
                    : ['130, 160, 255', '200, 215, 255', '255, 255, 255'];

            this.particles.add(new Particle(this.x, this.y, {
                vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
                life: 0.5 + Math.random() * 0.6, decay: 0.018,
                size: 2 + Math.random() * 4, sizeEnd: 0,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 0.8, alphaEnd: 0,
                type: Math.random() > 0.4 ? 'glow' : 'circle',
                friction: 0.97, gravity: 0.2, turbulence: 0.3,
            }));
        }

        // Streaks
        const streakCount = isCol ? 30 : 18;
        for (let i = 0; i < streakCount; i++) {
            const a = Math.random() * Math.PI * 2;
            const spd = 8 + Math.random() * 15;
            this.particles.add(new Particle(this.x, this.y, {
                vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
                life: 0.3 + Math.random() * 0.4, decay: 0.025,
                size: 1 + Math.random() * 1.5, sizeEnd: 0,
                color: isRas ? '194, 233, 251' : '220, 230, 255',
                alpha: 0.7, alphaEnd: 0,
                type: 'streak', friction: 0.98, gravity: 0.5,
            }));
        }

        // Lightning bolts for chidori/collision
        if (!isRas) {
            this._boltBurst = [];
            const bc = isCol ? 12 : 8;
            for (let i = 0; i < bc; i++) {
                this._boltBurst.push(this._makeBolt(this.x, this.y, Math.random() * Math.PI * 2, s * (1 + Math.random() * 2)));
            }
        }
    }

    _makeBolt(sx, sy, angle, len) {
        const pts = [{ x: sx, y: sy }];
        const segs = 6 + Math.floor(Math.random() * 4);
        let a = angle, x = sx, y = sy;
        for (let i = 0; i < segs; i++) {
            a += (Math.random() - 0.5) * 1.4;
            x += Math.cos(a) * (len / segs);
            y += Math.sin(a) * (len / segs);
            pts.push({ x, y });
        }
        return { pts, alpha: 1, w: 1 + Math.random() * 2 };
    }

    update(dt) {
        this.time += dt;
        this.flashAlpha *= 0.88;
        this.particles.update(dt);

        for (const sw of this.shockwaves) {
            sw.r += (sw.maxR - sw.r) * 4 * dt;
            sw.alpha *= 0.94;
        }

        if (this._boltBurst) {
            for (const b of this._boltBurst) b.alpha *= 0.9;
        }

        if (this.time > this.duration) this.done = true;
    }

    draw(ctx) {
        const progress = this.time / this.duration;
        const isRas = this.type === 'rasengan';

        ctx.save();

        // Screen flash
        if (this.flashAlpha > 0.01) {
            const fc = isRas ? '100, 200, 255' : this.type === 'collision' ? '200, 180, 255' : '140, 170, 255';
            ctx.fillStyle = `rgba(${fc}, ${this.flashAlpha})`;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }

        // Central glow
        const glowA = Math.max(0, (1 - progress * 1.5) * 0.6);
        if (glowA > 0.01) {
            const gr = this.size * (0.5 + progress * 2);
            const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, gr);
            const gc = isRas ? '100, 200, 255' : '140, 160, 255';
            g.addColorStop(0, `rgba(255, 255, 255, ${glowA})`);
            g.addColorStop(0.3, `rgba(${gc}, ${glowA * 0.5})`);
            g.addColorStop(1, `rgba(${gc}, 0)`);
            ctx.beginPath(); ctx.arc(this.x, this.y, gr, 0, Math.PI * 2);
            ctx.fillStyle = g; ctx.fill();
        }

        // Shockwave rings
        for (const sw of this.shockwaves) {
            if (sw.alpha < 0.02) continue;
            ctx.beginPath(); ctx.arc(this.x, this.y, sw.r, 0, Math.PI * 2);
            const rc = isRas ? '79, 172, 254' : '160, 180, 255';
            ctx.strokeStyle = `rgba(${rc}, ${sw.alpha})`;
            ctx.lineWidth = Math.max(0.5, sw.w);
            ctx.stroke();
        }

        // Lightning bolts
        if (this._boltBurst) {
            ctx.globalCompositeOperation = 'screen';
            for (const b of this._boltBurst) {
                if (b.alpha < 0.03) continue;
                ctx.beginPath();
                ctx.moveTo(b.pts[0].x, b.pts[0].y);
                for (let i = 1; i < b.pts.length; i++) ctx.lineTo(b.pts[i].x, b.pts[i].y);
                ctx.strokeStyle = `rgba(200, 215, 255, ${b.alpha * 0.4})`;
                ctx.lineWidth = b.w * 4; ctx.lineCap = 'round'; ctx.stroke();
                ctx.strokeStyle = `rgba(255, 255, 255, ${b.alpha * 0.8})`;
                ctx.lineWidth = b.w; ctx.stroke();
            }
            ctx.globalCompositeOperation = 'source-over';
        }

        // Particles
        this.particles.draw(ctx);

        ctx.restore();
    }
}

// ===== PROJECTILE =====
class Projectile {
    constructor(x, y, vx, vy, type, size) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.type = type; // 'rasengan', 'rasenshuriken', 'chidori'
        this.size = size || 40;
        this.time = 0;
        this.done = false;
        this.exploded = false;
        this.trail = new ParticleSystem();
        this.angle = 0;
    }

    update(dt, canvasW, canvasH) {
        this.time += dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.angle += dt * (this.type === 'rasenshuriken' ? 10 : 5);

        // Trail particles
        const isRas = this.type !== 'chidori';
        const tc = 3;
        for (let i = 0; i < tc; i++) {
            const a = Math.random() * Math.PI * 2;
            const col = isRas ? '79, 172, 254' : '160, 180, 255';
            this.trail.add(new Particle(
                this.x + (Math.random() - 0.5) * this.size * 0.4,
                this.y + (Math.random() - 0.5) * this.size * 0.4,
                {
                    vx: -this.vx * 0.1 + (Math.random() - 0.5) * 2,
                    vy: -this.vy * 0.1 + (Math.random() - 0.5) * 2,
                    life: 0.3 + Math.random() * 0.2, decay: 0.04,
                    size: 2 + Math.random() * 3, sizeEnd: 0,
                    color: col, alpha: 0.4, alphaEnd: 0,
                    type: 'glow', friction: 0.95,
                }
            ));
        }

        // Chidori sparks
        if (!isRas && Math.random() < 0.6) {
            const a = Math.random() * Math.PI * 2;
            this.trail.add(new Particle(this.x, this.y, {
                vx: Math.cos(a) * (3 + Math.random() * 5),
                vy: Math.sin(a) * (3 + Math.random() * 5),
                life: 0.15, decay: 0.07,
                size: 1, sizeEnd: 0,
                color: '220, 230, 255', alpha: 0.5, alphaEnd: 0,
                type: 'streak', friction: 0.96,
            }));
        }

        this.trail.update(dt);

        // Off-screen or timeout = explode
        const margin = this.size * 2;
        if (this.x < -margin || this.x > canvasW + margin ||
            this.y < -margin || this.y > canvasH + margin ||
            this.time > 3) {
            this.done = true;
        }
    }

    draw(ctx) {
        this.trail.draw(ctx);

        const isRas = this.type !== 'chidori';

        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.type === 'rasenshuriken') {
            // Small spinning disc
            ctx.rotate(this.angle);
            const sr = this.size * 0.7;
            // Outer ring
            ctx.beginPath(); ctx.arc(0, 0, sr, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(200, 230, 250, 0.3)`;
            ctx.lineWidth = 1.5; ctx.stroke();
            // 3 blades
            for (let b = 0; b < 3; b++) {
                const ba = (b / 3) * Math.PI * 2;
                ctx.save(); ctx.rotate(ba);
                ctx.beginPath();
                ctx.moveTo(this.size * 0.15, 0);
                const segs = 10;
                for (let i = 0; i <= segs; i++) {
                    const t = i / segs;
                    const d = this.size * 0.15 + t * sr * 0.8;
                    const w = Math.sin(t * Math.PI) * sr * 0.18 * (1 - t * 0.3);
                    if (i === 0) ctx.moveTo(d, -w);
                    else ctx.lineTo(d, -w * (1 - Math.pow(t, 0.5) * 0.3));
                }
                for (let i = segs; i >= 0; i--) {
                    const t = i / segs;
                    const d = this.size * 0.15 + t * sr * 0.8;
                    const w = Math.sin(t * Math.PI) * sr * 0.18 * (1 - t * 0.3);
                    ctx.lineTo(d, w * (1 - Math.pow(t, 0.5) * 0.3));
                }
                ctx.closePath();
                ctx.fillStyle = 'rgba(220, 240, 255, 0.35)';
                ctx.fill();
                ctx.restore();
            }
            // Core
            const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size * 0.2);
            cg.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
            cg.addColorStop(0.5, 'rgba(150, 220, 255, 0.5)');
            cg.addColorStop(1, 'rgba(80, 180, 240, 0)');
            ctx.beginPath(); ctx.arc(0, 0, this.size * 0.2, 0, Math.PI * 2);
            ctx.fillStyle = cg; ctx.fill();
        } else if (isRas) {
            // Rasengan sphere
            const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size * 0.5);
            sg.addColorStop(0, 'rgba(200, 240, 255, 0.85)');
            sg.addColorStop(0.3, 'rgba(100, 200, 250, 0.6)');
            sg.addColorStop(0.7, 'rgba(50, 160, 230, 0.3)');
            sg.addColorStop(1, 'rgba(30, 120, 210, 0)');
            ctx.beginPath(); ctx.arc(0, 0, this.size * 0.5, 0, Math.PI * 2);
            ctx.fillStyle = sg; ctx.fill();
            // White core
            const wc = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size * 0.15);
            wc.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
            wc.addColorStop(1, 'rgba(200, 240, 255, 0)');
            ctx.beginPath(); ctx.arc(0, 0, this.size * 0.15, 0, Math.PI * 2);
            ctx.fillStyle = wc; ctx.fill();
            // Glow
            const og = ctx.createRadialGradient(0, 0, this.size * 0.3, 0, 0, this.size);
            og.addColorStop(0, 'rgba(79, 172, 254, 0.15)');
            og.addColorStop(1, 'rgba(79, 172, 254, 0)');
            ctx.beginPath(); ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.fillStyle = og; ctx.fill();
        } else {
            // Chidori ball
            const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size * 0.4);
            sg.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
            sg.addColorStop(0.3, 'rgba(200, 215, 255, 0.6)');
            sg.addColorStop(0.7, 'rgba(130, 160, 255, 0.25)');
            sg.addColorStop(1, 'rgba(100, 130, 240, 0)');
            ctx.beginPath(); ctx.arc(0, 0, this.size * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = sg; ctx.fill();
            // Mini bolts
            ctx.globalCompositeOperation = 'screen';
            for (let i = 0; i < 5; i++) {
                const ba = Math.random() * Math.PI * 2;
                const bl = this.size * (0.5 + Math.random() * 0.8);
                ctx.beginPath();
                let bx = 0, by = 0, bAngle = ba;
                ctx.moveTo(0, 0);
                for (let j = 0; j < 4; j++) {
                    bAngle += (Math.random() - 0.5) * 1.2;
                    bx += Math.cos(bAngle) * (bl / 4);
                    by += Math.sin(bAngle) * (bl / 4);
                    ctx.lineTo(bx, by);
                }
                ctx.strokeStyle = `rgba(200, 220, 255, ${0.3 + Math.random() * 0.3})`;
                ctx.lineWidth = 1 + Math.random(); ctx.lineCap = 'round'; ctx.stroke();
            }
            ctx.globalCompositeOperation = 'source-over';
            // Glow
            const og = ctx.createRadialGradient(0, 0, this.size * 0.2, 0, 0, this.size);
            og.addColorStop(0, 'rgba(120, 150, 255, 0.2)');
            og.addColorStop(1, 'rgba(100, 130, 240, 0)');
            ctx.beginPath(); ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.fillStyle = og; ctx.fill();
        }

        ctx.restore();
    }
}

// ===== PROJECTILE MANAGER =====
class ProjectileManager {
    constructor() {
        this.projectiles = [];
        this.explosions = [];
        this.screenShake = { x: 0, y: 0 };
    }

    throw(x, y, vx, vy, type, size) {
        this.projectiles.push(new Projectile(x, y, vx, vy, type, size));
    }

    update(dt, canvasW, canvasH) {
        this.screenShake.x *= 0.9;
        this.screenShake.y *= 0.9;

        // Update projectiles
        for (const p of this.projectiles) {
            p.update(dt, canvasW, canvasH);
            if (p.done && !p.exploded) {
                p.exploded = true;
                this.explosions.push(new Explosion(p.x, p.y, p.type === 'chidori' ? 'chidori' : 'rasengan', p.size * 2));
                this.screenShake.x = (Math.random() - 0.5) * 12;
                this.screenShake.y = (Math.random() - 0.5) * 12;
            }
        }
        this.projectiles = this.projectiles.filter(p => !p.done);

        // Collision check: rasengan-type vs chidori-type
        for (let i = 0; i < this.projectiles.length; i++) {
            for (let j = i + 1; j < this.projectiles.length; j++) {
                const a = this.projectiles[i];
                const b = this.projectiles[j];
                const aIsRas = a.type !== 'chidori';
                const bIsRas = b.type !== 'chidori';
                if (aIsRas === bIsRas) continue; // same type, no collision

                const dx = a.x - b.x, dy = a.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const collisionDist = (a.size + b.size) * 0.6;

                if (dist < collisionDist) {
                    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
                    this.explosions.push(new Explosion(mx, my, 'collision', Math.max(a.size, b.size) * 3));
                    a.done = true; a.exploded = true;
                    b.done = true; b.exploded = true;
                    this.screenShake.x = (Math.random() - 0.5) * 25;
                    this.screenShake.y = (Math.random() - 0.5) * 25;
                }
            }
        }

        // Also check: active hand effects close to projectiles
        // (handled externally via checkProximity)

        // Update explosions
        for (const e of this.explosions) e.update(dt);
        this.explosions = this.explosions.filter(e => !e.done);
    }

    // Check if active hand effects are close enough to collide
    checkHandCollision(rasenganPos, chidoriPos, rasenganActive, chidoriActive, rasenganSize, chidoriSize) {
        if (!rasenganActive || !chidoriActive || !rasenganPos || !chidoriPos) return false;

        const dx = rasenganPos.x - chidoriPos.x;
        const dy = rasenganPos.y - chidoriPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const threshold = (rasenganSize + chidoriSize) * 0.5;

        if (dist < threshold) {
            const mx = (rasenganPos.x + chidoriPos.x) / 2;
            const my = (rasenganPos.y + chidoriPos.y) / 2;
            this.explosions.push(new Explosion(mx, my, 'collision', Math.max(rasenganSize, chidoriSize) * 3));
            this.screenShake.x = (Math.random() - 0.5) * 30;
            this.screenShake.y = (Math.random() - 0.5) * 30;
            return true;
        }
        return false;
    }

    draw(ctx) {
        for (const p of this.projectiles) p.draw(ctx);
        for (const e of this.explosions) e.draw(ctx);
    }

    get hasActivity() {
        return this.projectiles.length > 0 || this.explosions.length > 0;
    }
}
