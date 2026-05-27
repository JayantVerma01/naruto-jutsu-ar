# Naruto Jutsu AR — Technical Documentation


## 1. Overview & Core Features
**Naruto Jutsu AR** is a real-time, camera-driven Augmented Reality (AR) web application that tracks a user's hand movements and patterns to render procedural visual effects:
- **Right Hand**: Standard **Rasengan** that evolves into **Wind Style: Rasenshuriken** after 3.5 seconds of sustained activation.
- **Left Hand**: High-voltage **Chidori** featuring branching lightning paths and screen-shaking effects.
- **Action Control**: Closing your palm while moving launches the attack as a flying projectile in the direction of motion.
- **Interaction/Collisions**: Thrown projectiles explode upon timeout or wall contact. If a Rasengan and Chidori collide (in-flight or directly in hands), they trigger a massive combined shockwave explosion.

---

## 2. Tech Stack & External Libraries

The application runs entirely client-side using vanilla web technologies and CDNs for tracking.

| Component | Library/API | CDN / Source |
| :--- | :--- | :--- |
| **Hand Tracking** | MediaPipe Hands | `https://cdn.jsdelivr.net/npm/@mediapipe/hands` |
| **Camera Utilities** | MediaPipe Camera Utils | `https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils` |
| **Drawing Utilities** | MediaPipe Drawing Utils | `https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils` |
| **Rendering Canvas** | HTML5 2D Canvas API | Native Browser |
| **Styling & HUD** | Vanilla CSS (Flexbox, Glassmorphism) | Native Browser |
| **Dev Server** | `serve` static file hosting | Node.js / `npx serve` |

### Why Procedural Rendering over Assets?
To minimize latency and avoid downloading heavy sprites or video assets, all visual effects (lightning, wind, spheres, orbits) are generated procedurally frame-by-frame on HTML5 Canvas.

---

## 3. Application File Architecture

```
naruto-jutsu-ar/
├── index.html          # Webpage layout, loading/start UI, overlay canvases, HUD
├── styles.css          # Dark-themed Naruto style, glassmorphic layout, buttons
├── particles.js        # Core custom 2D particle engine
├── rasengan.js         # Rasengan & Rasenshuriken procedural physics & rendering
├── chidori.js          # Chidori lightning & lens flare rendering
├── projectiles.js      # Projectile physics, explosions, and collision manager
└── app.js              # MediaPipe orchestration, gesture detection, game loop
```

---

## 4. Architectural Details & Logic Flow

### A. Hand Detection & Landmark Mapping (`app.js`)
1. **Camera Stream**: Camera utils read frames from the user's webcam and send them to the `Hands` model.
2. **Landmark Extraction**: The model returns 21 landmarks (`x`, `y`, `z`) for up to 2 detected hands.
3. **Mirror-Mode Correction**: By default, frames are mirrored to match natural physical coordinate space:
   ```javascript
   const renderLandmarks = mirrorMode
       ? pixelLandmarks.map(p => ({ x: w - p.x, y: p.y, z: p.z }))
       : pixelLandmarks;
   ```
4. **Jutsu-Hand Mapping**:
   - In Mirror Mode: Right hand index labels as "Left" from MediaPipe (and vice versa). The code swaps label checks to keep **Rasengan on the Right Hand** and **Chidori on the Left Hand** relative to user view.

### B. Gesture Recognition & State Engine
- **Active State (Open Palm)**:
  Recognized by comparing distances from wrist landmark (0) to finger tips (8, 12, 16, 20) vs joint landmarks (6, 10, 14, 18). If $\ge 3$ fingers are extended, the hand is "open".
- **Throw Gesture (Closed Fist + Speed)**:
  1. Palm centers are tracked over a moving window of 6 frames.
  2. If the hand transitions from **Open** to **Closed** (fingers curled in), velocity is computed:
     $$\vec{v} = \frac{\vec{p}_{\text{recent}} - \vec{p}_{\text{older}}}{\Delta t}$$
  3. If speed $\|\vec{v}\|$ exceeds a threshold ($400\text{ px/s}$), the active jutsu is deactivated and a `Projectile` is spawned carrying the velocity vector.

---

## 5. Procedural Rendering Details

### 🔵 Rasengan (`rasengan.js`)
- **Dense Opaque Sphere**: Uses layered radial gradients from cyan to dark blue to create a high-density, three-dimensional look.
- **Energy Veins**: Renders 14 pre-generated chaotic paths clipped within the sphere boundaries using `ctx.clip()`.
- **Tilted Orbit Rings**: Simulates 3D orbits by rotating and scaling the 2D canvas context along the Y-axis:
  ```javascript
  ctx.rotate(oa + orb.tiltY);
  ctx.scale(1, scaleY);
  ```
- **White Core**: A white hot center overlay completes the energy look.

### 🌀 Rasenshuriken (`rasengan.js`)
- **Tri-Blade Pinwheel**: Spawns 3 curved magatama (comma) blades rotating dynamically around the central core.
- **Quadratic Curve Geometry**: Curves the blades mathematically:
  ```javascript
  const curveAngle = t * t * 1.2;
  const width = outerR * 0.22 * st * Math.sin(t * Math.PI) * (1 - t * 0.3);
  ```
- **Wind Swirl Trails**: Feathery white/grey particle trails fly tangent to the blade rotations.

### ⚡ Chidori (`chidori.js`)
- **Branching Jagged Lightning**: Generates random lightning bolts recursively:
  - If recursive depth is greater than 0, branches are generated off segments at random angles.
- **Blinding Center**: Overlay of bright white radial core gradients and a 4-point rotating cross lens flare.

---

## 6. Physics & Collision System (`projectiles.js`)

1. **Projectile Motion**: Projectiles update positions linearly:
   $$\vec{p}_{t} = \vec{p}_{t-1} + \vec{v}\Delta t$$
2. **Projectile-to-Projectile Collision**: Checks distance between active projectiles. If a Rasengan projectile and Chidori projectile are closer than their combined radii, both are destroyed to spawn a massive **Collision Explosion** at the midpoint.
3. **Hand-to-Hand Collision**: Checks distance between left and right hands. If both are active and cross path bounds, a collision explosion triggers, deactivating both jutsus with a 2-second cooldown to prevent infinite looping.
4. **Screen Shake**: Explosions add a temporary decaying noise vector applied directly via `ctx.translate(shakeX, shakeY)` to give impact weight.

---

## 7. Performance Optimizations

To maintain a smooth 60 FPS on low-power devices and mobile browsers:
- **Eliminated `ctx.filter = 'blur()'`**: Canvas-level blur filters are extremely CPU/GPU intensive. All glow effects are now rendered using **concentric semi-transparent strokes** or **radial gradients** which perform up to 10x faster.
- **Hard Bolt Caps**: Cap maximum concurrent lightning bolts to 30 to prevent frame spikes during intense action.
- **Particle Pools**: Capped maximum particle counts in update systems.
- **Delta-Time (`dt`) Animation Loop**: Frame updates are normalized using actual time delta, keeping the physics consistent regardless of rendering speed.
