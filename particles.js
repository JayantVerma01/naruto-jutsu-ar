/* ============================================
   PARTICLE SYSTEM ENGINE
   ============================================ */

class Particle {
    constructor(x, y, options = {}) {
        this.x = x;
        this.y = y;
        this.vx = options.vx || 0;
        this.vy = options.vy || 0;
        this.ax = options.ax || 0;
        this.ay = options.ay || 0;
        this.life = options.life || 1;
        this.maxLife = this.life;
        this.decay = options.decay || 0.02;
        this.size = options.size || 3;
        this.sizeEnd = options.sizeEnd ?? 0;
        this.color = options.color || '79, 172, 254';
        this.alpha = options.alpha ?? 1;
        this.alphaEnd = options.alphaEnd ?? 0;
        this.rotation = options.rotation || 0;
        this.rotationSpeed = options.rotationSpeed || 0;
        this.type = options.type || 'circle'; // circle, spark, ring, lightning
        this.gravity = options.gravity || 0;
        this.friction = options.friction || 1;
        this.turbulence = options.turbulence || 0;
    }

    update(dt) {
        this.vx += this.ax * dt;
        this.vy += (this.ay + this.gravity) * dt;
        this.vx *= this.friction;
        this.vy *= this.friction;

        if (this.turbulence > 0) {
            this.vx += (Math.random() - 0.5) * this.turbulence;
            this.vy += (Math.random() - 0.5) * this.turbulence;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= this.decay * dt;
        this.rotation += this.rotationSpeed * dt;

        return this.life > 0;
    }

    draw(ctx) {
        const progress = 1 - (this.life / this.maxLife);
        const currentSize = this.size + (this.sizeEnd - this.size) * progress;
        const currentAlpha = this.alpha + (this.alphaEnd - this.alpha) * progress;

        if (currentAlpha <= 0 || currentSize <= 0) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.globalAlpha = Math.max(0, currentAlpha);

        switch (this.type) {
            case 'circle':
                ctx.beginPath();
                ctx.arc(0, 0, currentSize, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${this.color}, ${currentAlpha})`;
                ctx.fill();
                break;

            case 'glow':
                const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, currentSize);
                gradient.addColorStop(0, `rgba(${this.color}, ${currentAlpha})`);
                gradient.addColorStop(0.5, `rgba(${this.color}, ${currentAlpha * 0.4})`);
                gradient.addColorStop(1, `rgba(${this.color}, 0)`);
                ctx.beginPath();
                ctx.arc(0, 0, currentSize, 0, Math.PI * 2);
                ctx.fillStyle = gradient;
                ctx.fill();
                break;

            case 'spark':
                ctx.beginPath();
                ctx.moveTo(-currentSize * 3, 0);
                ctx.lineTo(0, -currentSize * 0.5);
                ctx.lineTo(currentSize * 3, 0);
                ctx.lineTo(0, currentSize * 0.5);
                ctx.closePath();
                ctx.fillStyle = `rgba(${this.color}, ${currentAlpha})`;
                ctx.fill();
                break;

            case 'ring':
                ctx.beginPath();
                ctx.arc(0, 0, currentSize, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(${this.color}, ${currentAlpha})`;
                ctx.lineWidth = Math.max(0.5, currentSize * 0.15);
                ctx.stroke();
                break;

            case 'streak':
                const len = Math.sqrt(this.vx * this.vx + this.vy * this.vy) * 3;
                const angle = Math.atan2(this.vy, this.vx);
                ctx.rotate(angle - this.rotation);
                ctx.beginPath();
                ctx.moveTo(-len, 0);
                ctx.lineTo(len, 0);
                ctx.strokeStyle = `rgba(${this.color}, ${currentAlpha})`;
                ctx.lineWidth = currentSize;
                ctx.lineCap = 'round';
                ctx.stroke();
                break;
        }

        ctx.restore();
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    add(particle) {
        this.particles.push(particle);
    }

    emit(x, y, count, options = {}) {
        for (let i = 0; i < count; i++) {
            const angle = options.angle ?? (Math.random() * Math.PI * 2);
            const spread = options.spread ?? Math.PI * 2;
            const dir = angle + (Math.random() - 0.5) * spread;
            const speed = (options.speedMin || 1) + Math.random() * ((options.speedMax || 3) - (options.speedMin || 1));

            this.add(new Particle(
                x + (options.offsetX || 0) * (Math.random() - 0.5),
                y + (options.offsetY || 0) * (Math.random() - 0.5),
                {
                    vx: Math.cos(dir) * speed,
                    vy: Math.sin(dir) * speed,
                    life: options.life || 1,
                    decay: options.decay || 0.02,
                    size: options.size || 3,
                    sizeEnd: options.sizeEnd ?? 0,
                    color: options.color || '79, 172, 254',
                    alpha: options.alpha ?? 1,
                    alphaEnd: options.alphaEnd ?? 0,
                    type: options.type || 'circle',
                    gravity: options.gravity || 0,
                    friction: options.friction || 1,
                    turbulence: options.turbulence || 0,
                    rotation: Math.random() * Math.PI * 2,
                    rotationSpeed: options.rotationSpeed || 0,
                    ...options.particleOverrides
                }
            ));
        }
    }

    update(dt) {
        this.particles = this.particles.filter(p => p.update(dt));
    }

    draw(ctx) {
        for (const p of this.particles) {
            p.draw(ctx);
        }
    }

    get count() {
        return this.particles.length;
    }

    clear() {
        this.particles = [];
    }
}
