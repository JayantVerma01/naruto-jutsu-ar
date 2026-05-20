/* ============================================
   RASENGAN + RASENSHURIKEN EFFECT — Right Hand
   
   OPTIMIZED: No ctx.filter blur calls.
   
   Rasengan: Dense opaque sphere with energy
   veins and orbital rings.
   
   Rasenshuriken: 3 thick curved magatama blades
   inside a large sphere, matching the anime
   tri-blade pinwheel design.
   ============================================ */

class RasenganEffect {
    constructor() {
        this.particles = new ParticleSystem();
        this.time = 0;
        this.intensity = 0;
        this.targetIntensity = 0;
        this.chargeLevel = 0;
        this.activeTime = 0;
        this.phase = 'idle';
        this.shurikenTransition = 0;
        this.smoothX = 0;
        this.smoothY = 0;
        this.smoothRadius = 0;
        this.shakeOffset = { x: 0, y: 0 };
        this.flashAlpha = 0;
        this.shurikenAngle = 0;

        // Pre-generate vein paths
        this.veins = [];
        for (let v = 0; v < 14; v++) {
            const pts = [];
            let angle = Math.random() * Math.PI * 2;
            let r = Math.random() * 0.2;
            const segs = 8 + Math.floor(Math.random() * 8);
            for (let i = 0; i < segs; i++) {
                angle += (Math.random() - 0.5) * 1.6;
                r += (Math.random() - 0.5) * 0.12;
                r = Math.max(0, Math.min(0.85, r));
                pts.push({ angle, r });
            }
            this.veins.push({
                pts,
                w: 0.5 + Math.random() * 1.2,
                a: 0.12 + Math.random() * 0.2,
                speed: (Math.random() - 0.5) * 2,
            });
        }

        this.orbits = [
            { tiltX: 0.3, tiltY: 0.8, speed: 3, phase: 0 },
            { tiltX: -0.6, tiltY: 0.4, speed: -2.5, phase: 1.2 },
            { tiltX: 0.1, tiltY: -0.7, speed: 4, phase: 2.5 },
        ];
    }

    activate(openness) {
        // openness: 0 = fist, 1 = fully open palm
        // Map to intensity: minimum 0.12 (always visible), max 1.0
        this.targetIntensity = 0.12 + (openness || 0) * 0.88;
        if (this.phase === 'idle') {
            this.phase = 'charging';
            this.chargeLevel = 0;
            this.activeTime = 0;
            this.shurikenTransition = 0;
        }
    }

    deactivate() {
        this.targetIntensity = 0;
        if (this.phase !== 'idle') this.phase = 'releasing';
    }

    update(dt, palmCenter, handSize) {
        this.time += dt;
        this.flashAlpha *= 0.9;

        const spd = this.targetIntensity > this.intensity ? 4 : 2;
        this.intensity += (this.targetIntensity - this.intensity) * spd * dt;

        if (this.intensity < 0.01 && this.phase === 'releasing') {
            this.phase = 'idle';
            this.chargeLevel = 0;
            this.activeTime = 0;
            this.shurikenTransition = 0;
        }

        if (!palmCenter || this.intensity < 0.01) {
            this.particles.update(dt);
            return;
        }

        this.smoothX += (palmCenter.x - this.smoothX) * 0.3;
        this.smoothY += (palmCenter.y - this.smoothY) * 0.3;
        this.smoothRadius += ((handSize * 0.5) - this.smoothRadius) * 0.3;

        if (this.phase === 'charging') {
            this.chargeLevel = Math.min(1, this.chargeLevel + dt * 1.5);
            if (this.chargeLevel >= 1) { this.phase = 'active'; this.activeTime = 0; }
        }

        if (this.phase === 'active' || this.phase === 'rasenshuriken') {
            this.activeTime += dt;
            if (this.activeTime > 3.5 && this.phase === 'active') {
                this.phase = 'rasenshuriken';
                this.flashAlpha = 0.4;
            }
            if (this.phase === 'rasenshuriken') {
                this.shurikenTransition = Math.min(1, this.shurikenTransition + dt * 1.5);
            }
        }

        this.shurikenAngle += dt * (2 + this.shurikenTransition * 5);

        const power = this.intensity * (this.phase === 'charging' ? this.chargeLevel : 1);
        const cx = this.smoothX, cy = this.smoothY, r = this.smoothRadius;

        this.shakeOffset.x = (Math.random() - 0.5) * power * (this.phase === 'rasenshuriken' ? 4 : 1.5);
        this.shakeOffset.y = (Math.random() - 0.5) * power * (this.phase === 'rasenshuriken' ? 4 : 1.5);

        // Inward wisps (reduced count)
        const wc = Math.floor(4 * power);
        for (let i = 0; i < wc; i++) {
            const a = Math.random() * Math.PI * 2;
            const d = r * (1.2 + Math.random() * 1);
            const toC = Math.atan2(cy - (cy + Math.sin(a) * d), cx - (cx + Math.cos(a) * d));
            this.particles.add(new Particle(cx + Math.cos(a) * d, cy + Math.sin(a) * d, {
                vx: Math.cos(toC) * (3 + Math.random() * 4),
                vy: Math.sin(toC) * (3 + Math.random() * 4),
                life: 0.3, decay: 0.04,
                size: 1.5 + Math.random() * 1.5, sizeEnd: 0,
                color: '79, 172, 254', alpha: 0.25 * power, alphaEnd: 0,
                type: 'streak', friction: 0.95,
            }));
        }

        this.particles.update(dt);
    }

    draw(ctx) {
        if (this.intensity < 0.01) return;
        const cx = this.smoothX + this.shakeOffset.x;
        const cy = this.smoothY + this.shakeOffset.y;
        const r = this.smoothRadius;
        const power = this.intensity * (this.phase === 'charging' ? this.chargeLevel : 1);
        const isShuriken = this.phase === 'rasenshuriken';
        const st = this.shurikenTransition;

        ctx.save();

        // Screen flash
        if (this.flashAlpha > 0.01) {
            ctx.fillStyle = `rgba(120, 200, 255, ${this.flashAlpha})`;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }

        // Outer glow
        const gr = r * (isShuriken ? (3 + st * 3) : 2.5);
        const g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, gr);
        g1.addColorStop(0, `rgba(90, 190, 255, ${0.15 * power})`);
        g1.addColorStop(0.4, `rgba(50, 150, 235, ${0.06 * power})`);
        g1.addColorStop(1, 'rgba(30, 100, 200, 0)');
        ctx.beginPath(); ctx.arc(cx, cy, gr, 0, Math.PI * 2);
        ctx.fillStyle = g1; ctx.fill();

        this.particles.draw(ctx);

        // Rasenshuriken
        if (isShuriken && st > 0.05) {
            this._drawRasenshuriken(ctx, cx, cy, r, st, power);
        }

        // Rasengan sphere (smaller when rasenshuriken)
        this._drawSphere(ctx, cx, cy, r, power, isShuriken ? 0.35 : 1);

        ctx.restore();
    }

    _drawSphere(ctx, cx, cy, r, power, scale) {
        const sr = r * 0.72 * scale;
        if (sr < 2) return;

        ctx.save();

        // Solid sphere fill
        const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, sr);
        bg.addColorStop(0, `rgba(180, 235, 255, ${0.85 * power})`);
        bg.addColorStop(0.25, `rgba(100, 200, 250, ${0.7 * power})`);
        bg.addColorStop(0.55, `rgba(50, 160, 230, ${0.5 * power})`);
        bg.addColorStop(0.8, `rgba(30, 120, 210, ${0.3 * power})`);
        bg.addColorStop(1, 'rgba(20, 80, 180, 0)');
        ctx.beginPath(); ctx.arc(cx, cy, sr, 0, Math.PI * 2);
        ctx.fillStyle = bg; ctx.fill();

        // Inner bright layer
        const bg2 = ctx.createRadialGradient(cx - sr * 0.08, cy - sr * 0.08, 0, cx, cy, sr * 0.65);
        bg2.addColorStop(0, `rgba(220, 248, 255, ${0.55 * power})`);
        bg2.addColorStop(0.5, `rgba(140, 215, 250, ${0.3 * power})`);
        bg2.addColorStop(1, 'rgba(80, 180, 240, 0)');
        ctx.beginPath(); ctx.arc(cx, cy, sr * 0.65, 0, Math.PI * 2);
        ctx.fillStyle = bg2; ctx.fill();

        // Energy veins (clipped to sphere)
        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, sr * 0.92, 0, Math.PI * 2);
        ctx.clip();

        for (const vein of this.veins) {
            if (vein.pts.length < 2) continue;
            ctx.beginPath();
            const tOff = this.time * vein.speed;
            for (let i = 0; i < vein.pts.length; i++) {
                const p = vein.pts[i];
                const x = cx + Math.cos(p.angle + tOff) * (p.r * sr);
                const y = cy + Math.sin(p.angle + tOff) * (p.r * sr);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = `rgba(180, 240, 255, ${vein.a * power})`;
            ctx.lineWidth = vein.w;
            ctx.lineCap = 'round';
            ctx.stroke();
        }

        // Quick random veins
        for (let v = 0; v < 4; v++) {
            ctx.beginPath();
            let a = this.time * (1.5 + v * 0.4) + v;
            let vr = Math.random() * 0.15 * sr;
            ctx.moveTo(cx + Math.cos(a) * vr, cy + Math.sin(a) * vr);
            for (let i = 0; i < 5; i++) {
                a += (Math.random() - 0.5) * 1.4;
                vr += (Math.random() - 0.3) * sr * 0.12;
                vr = Math.max(0, Math.min(sr * 0.85, vr));
                ctx.lineTo(cx + Math.cos(a) * vr, cy + Math.sin(a) * vr);
            }
            ctx.strokeStyle = `rgba(200, 245, 255, ${(0.08 + Math.random() * 0.1) * power})`;
            ctx.lineWidth = 0.5 + Math.random() * 0.8;
            ctx.stroke();
        }
        ctx.restore();

        // Orbital rings
        for (const orb of this.orbits) {
            const oa = this.time * orb.speed + orb.phase;
            const oR = sr * 1.08;
            ctx.save();
            ctx.translate(cx, cy);
            const sY = 0.25 + Math.abs(Math.sin(oa * 0.7 + orb.tiltX)) * 0.25;
            ctx.rotate(oa + orb.tiltY);
            ctx.scale(1, sY);
            ctx.beginPath(); ctx.arc(0, 0, oR, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(160, 225, 255, ${0.25 * power})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();
        }

        // White core
        const c1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, sr * 0.3);
        c1.addColorStop(0, `rgba(255, 255, 255, ${0.95 * power})`);
        c1.addColorStop(0.3, `rgba(220, 248, 255, ${0.65 * power})`);
        c1.addColorStop(0.7, `rgba(150, 220, 250, ${0.25 * power})`);
        c1.addColorStop(1, 'rgba(100, 200, 255, 0)');
        ctx.beginPath(); ctx.arc(cx, cy, sr * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = c1; ctx.fill();

        ctx.restore();
    }

    _drawRasenshuriken(ctx, cx, cy, r, st, power) {
        // The Rasenshuriken from the anime: a large sphere with 3 thick
        // curved magatama/comma-shaped blades forming a tri-blade pinwheel.

        const outerR = r * (1.5 + st * 2.5); // large sphere radius
        const bladeCount = 3;

        ctx.save();

        // === Outer sphere shell ===
        ctx.beginPath(); ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
        const shellGrad = ctx.createRadialGradient(cx, cy, outerR * 0.7, cx, cy, outerR);
        shellGrad.addColorStop(0, 'rgba(200, 230, 250, 0)');
        shellGrad.addColorStop(0.6, `rgba(200, 225, 245, ${0.08 * st * power})`);
        shellGrad.addColorStop(0.85, `rgba(180, 215, 240, ${0.15 * st * power})`);
        shellGrad.addColorStop(1, `rgba(160, 200, 235, ${0.05 * st * power})`);
        ctx.fillStyle = shellGrad; ctx.fill();

        // Sphere outline ring
        ctx.beginPath(); ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(190, 220, 245, ${0.3 * st * power})`;
        ctx.lineWidth = 2 * st;
        ctx.stroke();

        // Second inner ring
        ctx.beginPath(); ctx.arc(cx, cy, outerR * 0.92, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(200, 230, 250, ${0.15 * st * power})`;
        ctx.lineWidth = 1.5 * st;
        ctx.stroke();

        // === 3 thick curved magatama blades ===
        // Each blade is a thick comma/teardrop that curves around, creating
        // the characteristic tri-blade pinwheel pattern
        for (let b = 0; b < bladeCount; b++) {
            const baseAngle = this.shurikenAngle + (b / bladeCount) * Math.PI * 2;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(baseAngle);

            const innerStart = r * 0.35; // start from near center
            const bladeR = outerR * 0.85; // reach near outer edge

            // Thick curved blade shape — magatama style
            // The blade starts narrow at the center, curves wide, then tapers
            ctx.beginPath();

            // Build blade as a curved shape
            // Top edge: curves outward in one direction
            const segments = 20;
            const topPoints = [];
            const botPoints = [];

            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                // Distance from center increases along t
                const dist = innerStart + t * (bladeR - innerStart);
                // The blade curves — angle offset increases along length
                const curveAngle = t * t * 1.2; // quadratic curve

                // Width: starts thin, gets thick, then tapers at tip
                const widthT = Math.sin(t * Math.PI) * (1 - t * 0.3);
                const width = outerR * 0.22 * st * widthT;

                const x = Math.cos(curveAngle) * dist;
                const y = Math.sin(curveAngle) * dist;

                // Perpendicular direction for width
                const perpAngle = curveAngle + Math.PI / 2;
                const px = Math.cos(perpAngle) * width;
                const py = Math.sin(perpAngle) * width;

                topPoints.push({ x: x + px, y: y + py });
                botPoints.push({ x: x - px, y: y - py });
            }

            // Draw the blade shape
            ctx.moveTo(topPoints[0].x, topPoints[0].y);
            for (let i = 1; i < topPoints.length; i++) {
                ctx.lineTo(topPoints[i].x, topPoints[i].y);
            }
            // Connect to bottom edge (reverse)
            for (let i = botPoints.length - 1; i >= 0; i--) {
                ctx.lineTo(botPoints[i].x, botPoints[i].y);
            }
            ctx.closePath();

            // Blade fill — white/grey wind style
            const bladeGrad = ctx.createLinearGradient(innerStart, 0, bladeR, 0);
            bladeGrad.addColorStop(0, `rgba(220, 235, 250, ${0.55 * st * power})`);
            bladeGrad.addColorStop(0.3, `rgba(240, 248, 255, ${0.5 * st * power})`);
            bladeGrad.addColorStop(0.6, `rgba(255, 255, 255, ${0.4 * st * power})`);
            bladeGrad.addColorStop(0.85, `rgba(230, 240, 250, ${0.25 * st * power})`);
            bladeGrad.addColorStop(1, `rgba(200, 225, 245, ${0.08 * st * power})`);
            ctx.fillStyle = bladeGrad;
            ctx.fill();

            // Blade edge highlight
            ctx.strokeStyle = `rgba(230, 243, 255, ${0.35 * st * power})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // Inner swirl lines along the blade curve
            for (let w = 0; w < 3; w++) {
                ctx.beginPath();
                const wOffset = (w - 1) * outerR * 0.04 * st;
                for (let i = 0; i <= segments; i++) {
                    const t = i / segments;
                    const dist = innerStart + t * (bladeR - innerStart);
                    const curveAngle = t * t * 1.2;
                    const x = Math.cos(curveAngle) * dist;
                    const y = Math.sin(curveAngle) * dist + wOffset * (1 - t * 0.5);
                    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                ctx.strokeStyle = `rgba(200, 230, 250, ${0.1 * st * power})`;
                ctx.lineWidth = 0.7;
                ctx.stroke();
            }

            ctx.restore();
        }

        // === Wind swirl marks between blades ===
        for (let b = 0; b < bladeCount; b++) {
            const midAngle = this.shurikenAngle + ((b + 0.5) / bladeCount) * Math.PI * 2;
            const swR = outerR * 0.6;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(midAngle);

            // Curved wind wisp
            ctx.beginPath();
            for (let i = 0; i <= 10; i++) {
                const t = i / 10;
                const dist = r * 0.5 + t * swR;
                const curve = Math.sin(t * Math.PI) * 0.3;
                const x = Math.cos(curve) * dist;
                const y = Math.sin(curve) * dist;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = `rgba(200, 225, 245, ${0.12 * st * power})`;
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.restore();
        }

        ctx.restore();
    }

    getChargePower() {
        return this.intensity * (this.phase === 'charging' ? this.chargeLevel : 1);
    }

    isRasenshuriken() {
        return this.phase === 'rasenshuriken';
    }
}
