/* ============================================
   CHIDORI EFFECT — Left Hand
   
   OPTIMIZED: No ctx.filter blur calls.
   All glow simulated with layered strokes.
   Bolt count capped for performance.
   ============================================ */

class ChidoriEffect {
    constructor() {
        this.sparkParticles = new ParticleSystem();
        this.time = 0;
        this.intensity = 0;
        this.targetIntensity = 0;
        this.chargeLevel = 0;
        this.phase = 'idle';
        this.smoothX = 0;
        this.smoothY = 0;
        this.smoothRadius = 0;
        this.bolts = [];
        this.boltTimer = 0;
        this.shakeOffset = { x: 0, y: 0 };
        this.flashAlpha = 0;
        this.activeTime = 0;
    }

    activate(openness) {
        // openness: 0 = fist, 1 = fully open palm
        this.targetIntensity = 0.12 + (openness || 0) * 0.88;
        if (this.phase === 'idle') {
            this.phase = 'charging';
            this.chargeLevel = 0;
            this.activeTime = 0;
        }
    }

    deactivate() {
        this.targetIntensity = 0;
        if (this.phase !== 'idle') this.phase = 'releasing';
    }

    _genBolt(sx, sy, angle, length, depth, ws) {
        const segs = 8 + Math.floor(Math.random() * 5);
        const segLen = length / segs;
        const pts = [{ x: sx, y: sy }];
        let a = angle, x = sx, y = sy;

        for (let i = 0; i < segs; i++) {
            a += (Math.random() - 0.5) * 1.5;
            x += Math.cos(a) * segLen * (0.7 + Math.random() * 0.6);
            y += Math.sin(a) * segLen * (0.7 + Math.random() * 0.6);
            pts.push({ x, y });
        }

        const bolt = {
            pts,
            alpha: 0.85 + Math.random() * 0.15,
            w: (1.2 + Math.random() * 1.8) * ws,
            branches: [],
        };

        if (depth > 0 && pts.length > 4) {
            const bc = 1 + Math.floor(Math.random() * 2);
            for (let b = 0; b < bc; b++) {
                const idx = 2 + Math.floor(Math.random() * (pts.length - 3));
                const bp = pts[idx];
                const ba = a + (Math.random() - 0.5) * Math.PI;
                bolt.branches.push(this._genBolt(bp.x, bp.y, ba, length * (0.2 + Math.random() * 0.3), depth - 1, ws * 0.6));
            }
        }
        return bolt;
    }

    update(dt, palmCenter, handSize) {
        this.time += dt;
        this.flashAlpha *= 0.88;

        const spd = this.targetIntensity > this.intensity ? 4 : 2;
        this.intensity += (this.targetIntensity - this.intensity) * spd * dt;

        if (this.intensity < 0.01 && this.phase === 'releasing') {
            this.phase = 'idle';
            this.chargeLevel = 0;
        }

        if (!palmCenter || this.intensity < 0.01) {
            this.sparkParticles.update(dt);
            return;
        }

        this.smoothX += (palmCenter.x - this.smoothX) * 0.35;
        this.smoothY += (palmCenter.y - this.smoothY) * 0.35;
        const radius = handSize * 0.45;
        this.smoothRadius += (radius - this.smoothRadius) * 0.35;

        if (this.phase === 'charging') {
            this.chargeLevel = Math.min(1, this.chargeLevel + dt * 2);
            if (this.chargeLevel >= 1) { this.phase = 'active'; this.flashAlpha = 0.3; }
        }
        if (this.phase === 'active') this.activeTime += dt;

        const power = this.intensity * (this.phase === 'charging' ? this.chargeLevel : 1);
        const cx = this.smoothX, cy = this.smoothY, r = this.smoothRadius;

        this.shakeOffset.x = (Math.random() - 0.5) * power * 4;
        this.shakeOffset.y = (Math.random() - 0.5) * power * 4;

        // === BOLTS (capped at 30 total for performance) ===
        this.boltTimer += dt;
        if (this.boltTimer > 0.04) {
            this.boltTimer = 0;
            this.bolts = this.bolts.filter(b => b.alpha > 0.04);

            // Only generate if under cap
            if (this.bolts.length < 30) {
                const count = Math.floor(3 + 5 * power);
                for (let i = 0; i < count; i++) {
                    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
                    const isLong = Math.random() < 0.3;
                    const len = isLong
                        ? r * (2.5 + Math.random() * 3.5) * power
                        : r * (1 + Math.random() * 2) * power;
                    this.bolts.push(this._genBolt(cx, cy, angle, len, isLong ? 2 : 1, isLong ? 1.2 : 1));
                }
            }

            if (Math.random() < 0.4 * power) {
                this.flashAlpha = (0.03 + Math.random() * 0.08) * power;
            }
        }

        for (const b of this.bolts) b.alpha *= 0.78;

        // === SPARKS (reduced count) ===
        const sc = Math.floor(5 * power);
        for (let i = 0; i < sc; i++) {
            const a = Math.random() * Math.PI * 2;
            this.sparkParticles.add(new Particle(
                cx + (Math.random() - 0.5) * r * 0.3,
                cy + (Math.random() - 0.5) * r * 0.3,
                {
                    vx: Math.cos(a) * (6 + Math.random() * 12),
                    vy: Math.sin(a) * (6 + Math.random() * 12),
                    life: 0.2 + Math.random() * 0.3, decay: 0.035,
                    size: 1 + Math.random() * 1.2, sizeEnd: 0,
                    color: Math.random() > 0.3 ? '200, 215, 255' : '255, 255, 255',
                    alpha: 0.5 * power, alphaEnd: 0,
                    type: 'streak', friction: 0.97, gravity: 0.3,
                }
            ));
        }

        this.sparkParticles.update(dt);
    }

    _stroke(ctx, pts) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    }

    _renderBolt(ctx, bolt) {
        if (bolt.alpha < 0.03 || bolt.pts.length < 2) return;
        const a = bolt.alpha;

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Layer 1: Wide blue glow (no filter, just thick + transparent)
        this._stroke(ctx, bolt.pts);
        ctx.strokeStyle = `rgba(70, 100, 220, ${a * 0.2})`;
        ctx.lineWidth = bolt.w * 6;
        ctx.stroke();

        // Layer 2: Mid blue
        this._stroke(ctx, bolt.pts);
        ctx.strokeStyle = `rgba(120, 150, 255, ${a * 0.4})`;
        ctx.lineWidth = bolt.w * 2.5;
        ctx.stroke();

        // Layer 3: White-blue core
        this._stroke(ctx, bolt.pts);
        ctx.strokeStyle = `rgba(200, 220, 255, ${a * 0.75})`;
        ctx.lineWidth = bolt.w * 1.2;
        ctx.stroke();

        // Layer 4: White center
        this._stroke(ctx, bolt.pts);
        ctx.strokeStyle = `rgba(255, 255, 255, ${a * 0.85})`;
        ctx.lineWidth = bolt.w * 0.5;
        ctx.stroke();

        for (const br of bolt.branches) {
            br.alpha = a * 0.55;
            this._renderBolt(ctx, br);
        }
    }

    draw(ctx) {
        if (this.intensity < 0.01) return;
        const cx = this.smoothX + this.shakeOffset.x;
        const cy = this.smoothY + this.shakeOffset.y;
        const r = this.smoothRadius;
        const power = this.intensity * (this.phase === 'charging' ? this.chargeLevel : 1);

        ctx.save();

        // Screen flash
        if (this.flashAlpha > 0.005) {
            ctx.fillStyle = `rgba(140, 170, 255, ${this.flashAlpha})`;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }

        // Outer glow (simple radial, no filter)
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 4);
        g.addColorStop(0, `rgba(110, 140, 255, ${0.25 * power})`);
        g.addColorStop(0.2, `rgba(90, 120, 240, ${0.12 * power})`);
        g.addColorStop(0.5, `rgba(70, 100, 220, ${0.04 * power})`);
        g.addColorStop(1, 'rgba(50, 70, 200, 0)');
        ctx.beginPath(); ctx.arc(cx, cy, r * 4, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();

        // Lightning bolts
        ctx.globalCompositeOperation = 'screen';
        for (const bolt of this.bolts) this._renderBolt(ctx, bolt);
        ctx.globalCompositeOperation = 'source-over';

        // Sparks
        this.sparkParticles.draw(ctx);

        // Blinding white core (layered gradients, no filter)
        const c1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1);
        c1.addColorStop(0, `rgba(255, 255, 255, ${0.9 * power})`);
        c1.addColorStop(0.15, `rgba(230, 240, 255, ${0.65 * power})`);
        c1.addColorStop(0.4, `rgba(160, 195, 255, ${0.3 * power})`);
        c1.addColorStop(0.7, `rgba(100, 140, 240, ${0.1 * power})`);
        c1.addColorStop(1, 'rgba(70, 100, 220, 0)');
        ctx.beginPath(); ctx.arc(cx, cy, r * 1, 0, Math.PI * 2);
        ctx.fillStyle = c1; ctx.fill();

        // Hot center
        const c2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.25);
        c2.addColorStop(0, `rgba(255, 255, 255, ${power})`);
        c2.addColorStop(0.5, `rgba(240, 248, 255, ${0.7 * power})`);
        c2.addColorStop(1, 'rgba(220, 235, 255, 0)');
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = c2; ctx.fill();

        // Cross lens flare
        if (power > 0.3) {
            const fl = r * 1.2 * power;
            const fw = r * 0.04;
            ctx.globalCompositeOperation = 'screen';
            for (let i = 0; i < 4; i++) {
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate((i / 4) * Math.PI + this.time * 0.2);
                const fg = ctx.createLinearGradient(-fl, 0, fl, 0);
                fg.addColorStop(0, 'rgba(200, 220, 255, 0)');
                fg.addColorStop(0.45, `rgba(230, 240, 255, ${0.12 * power})`);
                fg.addColorStop(0.5, `rgba(255, 255, 255, ${0.25 * power})`);
                fg.addColorStop(0.55, `rgba(230, 240, 255, ${0.12 * power})`);
                fg.addColorStop(1, 'rgba(200, 220, 255, 0)');
                ctx.fillStyle = fg;
                ctx.fillRect(-fl, -fw, fl * 2, fw * 2);
                ctx.restore();
            }
            ctx.globalCompositeOperation = 'source-over';
        }

        ctx.restore();
    }

    getChargePower() {
        return this.intensity * (this.phase === 'charging' ? this.chargeLevel : 1);
    }
}
