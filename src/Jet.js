import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Controls } from './Controls.js';

export class Jet {
    constructor(scene) {
        this.scene = scene;
        this.mesh = new THREE.Group();
        this.scene.add(this.mesh);

        this.modelContainer = new THREE.Group();
        this.mesh.add(this.modelContainer);

        // Track effects
        this.engineGlows = [];
        this.engineLights = [];
        this.wingVapors = []; // [NEW] Vapor sheets
        // -- CINEMATIC CONTRAILS (InstancedMesh) --
        this.contrailMaxCount = 1000;
        this.contrailIndex = 0;
        this.contrailData = []; // Store age, life, velocity for each instance

        // 1. Generate Puffy Cloud Texture
        const canvas = document.createElement('canvas');
        canvas.width = 128; // Higher res for detail
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // Base Glow
        const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
        grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.2)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);

        // Add "Noise Blobs" for texture
        for (let i = 0; i < 10; i++) {
            const x = Math.random() * 128;
            const y = Math.random() * 128;
            const r = Math.random() * 30 + 10;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, 0.1)`;
            ctx.fill();
        }

        const texture = new THREE.CanvasTexture(canvas);

        // 2. Geometry & Material
        const geo = new THREE.PlaneGeometry(1, 1);
        const mat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.4,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });

        // 3. InstancedMesh
        this.contrailMesh = new THREE.InstancedMesh(geo, mat, this.contrailMaxCount);
        this.contrailMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.scene.add(this.contrailMesh);

        // Initialize instances off-screen & data array
        const dummy = new THREE.Object3D();
        dummy.position.set(0, -99999, 0); // Hide initially
        dummy.updateMatrix();

        for (let i = 0; i < this.contrailMaxCount; i++) {
            this.contrailMesh.setMatrixAt(i, dummy.matrix);
            this.contrailData.push({
                active: false,
                age: 0,
                life: 0,
                scale: 1.0,
                pos: new THREE.Vector3(),
                rot: 0
            });
        }
        this.contrailMesh.instanceMatrix.needsUpdate = true;
        this.dummy = new THREE.Object3D(); // Reusable helper

        this.createFallbackMesh();
        this.loadModel();

        // Physics
        this.speed = 0;
        this.maxSpeed = 120;
        this.minSpeed = 15;
        this.acceleration = 40;
        this.deceleration = 10;

        // Nitro System
        this.maxNitro = 100;
        this.nitroFuel = 100;
        this.isOverheated = false;

        this.controls = new Controls();

        // Control Sensitivity
        this.rollSpeed = 2.5;
        this.pitchSpeed = 2.0;
        this.yawSpeed = 0.8;
    }

    generateCamoTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Base: Air Superiority Gray
        ctx.fillStyle = '#99aebb';
        ctx.fillRect(0, 0, 512, 512);

        // Camo Pattern: Darker Blobs
        ctx.fillStyle = '#7a8e9d';
        for (let i = 0; i < 20; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const r = 50 + Math.random() * 100;
            ctx.beginPath();
            ctx.ellipse(x, y, r, r * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        // Noise Overlay for grime
        for (let i = 0; i < 5000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
            ctx.fillRect(x, y, 2, 2);
        }

        // Panel Lines
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 10; i++) {
            ctx.beginPath();
            ctx.moveTo(0, i * 50);
            ctx.lineTo(512, i * 50);
            ctx.stroke();
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }

    createMissile() { return new THREE.Group(); } // Removed
    createTank() { return new THREE.Group(); } // Removed

    createFallbackMesh() {
        this.modelContainer.clear();
        this.engineGlows = [];
        this.engineLights = [];
        this.wingVapors = [];
        this.modelContainer.rotation.set(0, 0, 0);

        // -- MATERIALS --
        // High-Tech Stealth Material (Darker Gray, Matte)
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x444b52, // Dark Blue-Gray
            roughness: 0.6,
            metalness: 0.3,
            flatShading: false
        });
        const noseMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
        const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
        const glassMat = new THREE.MeshPhysicalMaterial({
            color: 0xffd700, // Gold Tint
            metalness: 0.9,
            roughness: 0.1,
            transmission: 0.3,
            transparent: true,
            opacity: 0.8
        });

        // -- 1. FUSELAGE (Blended Wing Body - F-22 Style) --
        const bodyShape = new THREE.Shape();
        bodyShape.moveTo(0, 0.5); // Top Spine
        bodyShape.lineTo(1.2, 0.1); // Chine Line (Sharp Edge)
        bodyShape.lineTo(0.8, -0.5); // Bottom Corner
        bodyShape.lineTo(-0.8, -0.5);
        bodyShape.lineTo(-1.2, 0.1);
        bodyShape.lineTo(0, 0.5);

        const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
            depth: 7,
            bevelEnabled: true,
            bevelSize: 0.1,
            bevelThickness: 0.1
        });
        const fuselage = new THREE.Mesh(bodyGeo, bodyMat);
        fuselage.position.set(0, 0.2, -4.5); // Center it
        this.modelContainer.add(fuselage);

        // -- 2. NOSE (Sharp Pyramid) --
        const noseGeo = new THREE.ConeGeometry(0.8, 3.5, 6); // Hexagonal Cone
        noseGeo.rotateX(-Math.PI / 2);
        noseGeo.scale(1.5, 0.7, 1); // Flatten it
        const nose = new THREE.Mesh(noseGeo, bodyMat);
        nose.position.set(0, 0.3, -5.5); // In front of body
        this.modelContainer.add(nose);

        // Radome Tip (Darker)
        const tipGeo = new THREE.ConeGeometry(0.4, 1.0, 6);
        tipGeo.rotateX(-Math.PI / 2);
        tipGeo.scale(1.5, 0.7, 1);
        const tip = new THREE.Mesh(tipGeo, noseMat);
        tip.position.set(0, 0.3, -7.5); // Very front
        this.modelContainer.add(tip);

        // -- 3. WINGS (Large Diamond Delta) --
        const wingShape = new THREE.Shape();
        wingShape.moveTo(0, 0);
        wingShape.lineTo(5.5, 3.5); // Wingtip Back
        wingShape.lineTo(5.5, 4.5); // Wingtip Trailing
        wingShape.lineTo(0.5, 4.0); // Root Trailing
        const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.15, bevelEnabled: true, bevelSize: 0.05 });

        const wingL = new THREE.Mesh(wingGeo, bodyMat);
        wingL.rotateX(-Math.PI / 2);
        wingL.position.set(0.8, 0.1, -2.0);
        this.modelContainer.add(wingL);

        const wingR = new THREE.Mesh(wingGeo, bodyMat);
        wingR.rotateX(-Math.PI / 2);
        wingR.scale.x = -1;
        wingR.position.set(-0.8, 0.1, -2.0);
        this.modelContainer.add(wingR);

        // -- 4. TAILS (Twin V-Tail) --
        const tailShape = new THREE.Shape();
        tailShape.moveTo(0, 0);
        tailShape.lineTo(1.5, 3.2); // Top Back
        tailShape.lineTo(2.8, 3.2); // Top Trailing
        tailShape.lineTo(2.5, 0); // Bottom
        const tailGeo = new THREE.ExtrudeGeometry(tailShape, { depth: 0.15 });

        // Left Tail
        const tailL = new THREE.Mesh(tailGeo, bodyMat);
        tailL.rotateY(-Math.PI / 2);
        tailL.rotateX(-0.4); // Canted outward (V-shape)
        tailL.position.set(0.8, 0.6, 1.5);
        this.modelContainer.add(tailL);

        // Right Tail
        const tailR = new THREE.Mesh(tailGeo, bodyMat);
        tailR.rotateY(-Math.PI / 2);
        tailR.rotateX(0.4); // Canted outward
        tailR.position.set(-0.8, 0.6, 1.5);
        this.modelContainer.add(tailR);

        // Stabilators (Horizontal)
        const stabShape = new THREE.Shape();
        stabShape.moveTo(0, 0);
        stabShape.lineTo(2.5, 2.0);
        stabShape.lineTo(2.5, 3.0);
        stabShape.lineTo(0.5, 2.5);
        const stabGeo = new THREE.ExtrudeGeometry(stabShape, { depth: 0.1 });

        const stabL = new THREE.Mesh(stabGeo, bodyMat);
        stabL.rotateX(-Math.PI / 2);
        stabL.position.set(0.6, 0.1, 2.5);
        this.modelContainer.add(stabL);

        const stabR = new THREE.Mesh(stabGeo, bodyMat);
        stabR.rotateX(-Math.PI / 2);
        stabR.scale.x = -1;
        stabR.position.set(-0.6, 0.1, 2.5);
        this.modelContainer.add(stabR);

        // -- 5. INTAKES (Side Mounted) --
        const intakeGeo = new THREE.BoxGeometry(0.8, 0.8, 2.5);
        const intakeL = new THREE.Mesh(intakeGeo, bodyMat);
        intakeL.position.set(0.9, -0.2, -3.0);
        this.modelContainer.add(intakeL);

        const intakeR = new THREE.Mesh(intakeGeo, bodyMat);
        intakeR.position.set(-0.9, -0.2, -3.0);
        this.modelContainer.add(intakeR);

        // -- 6. CANOPY (Seamless Bubble) --
        const canopyGeo = new THREE.CapsuleGeometry(0.55, 1.8, 4, 16);
        canopyGeo.rotateX(Math.PI / 2.05);
        const canopy = new THREE.Mesh(canopyGeo, glassMat);
        canopy.position.set(0, 0.7, -2.5);
        this.modelContainer.add(canopy);

        // -- 7. ENGINES (Twin Nozzles) --
        const nozzleGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5); // Square Vectoring
        const nozL = new THREE.Mesh(nozzleGeo, nozzleMat);
        nozL.position.set(0.5, 0, 2.8);
        this.modelContainer.add(nozL);

        const nozR = new THREE.Mesh(nozzleGeo, nozzleMat);
        nozR.position.set(-0.5, 0, 2.8);
        this.modelContainer.add(nozR);

        // Two glows
        this.addEngineGlow(new THREE.Vector3(0.5, 0, 3.0), null);
        this.addEngineGlow(new THREE.Vector3(-0.5, 0, 3.0), null);

        this.createWingVapor();
    }

    addEngineGlow(posL, posR) {
        // Handle Single Engine (F-16) or Dual (F-22)
        const positions = [posL];
        if (posR) positions.push(posR);

        const glowGeo = new THREE.ConeGeometry(0.4, 1.5, 16, 1, true);
        glowGeo.rotateX(-Math.PI / 2); // Point back
        glowGeo.translate(0, 0, 0.75); // Pivot at base

        const glowMat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uThrottle: { value: 0 }
            },
            vertexShader: `
            varying vec2 vUv;
            varying vec3 vPos;
            uniform float uTime;
            uniform float uThrottle;

            // Simple noise for vertex jitter (Heat distortion)
            float random (vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898,78.233)))* 43758.5453123);
            }

            void main() {
                vUv = uv;
                vPos = position;
                
                vec3 pos = position;
                
                // Heat Jitter Effect at high throttle
                if (uThrottle > 0.5) {
                    float jitter = (random(uv + uTime) - 0.5) * 0.05 * uThrottle;
                    pos.x += jitter;
                    pos.y += jitter;
                }
                
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
            fragmentShader: `
            uniform float uTime;
            uniform float uThrottle;
            varying vec2 vUv;

            // Simplex Noise (Approximation)
            vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

            float snoise(vec2 v) {
                const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                                    0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                                    -0.577350269189626,  // -1.0 + 2.0 * C.x
                                    0.024390243902439); // 1.0 / 41.0
                vec2 i  = floor(v + dot(v, C.yy) );
                vec2 x0 = v -   i + dot(i, C.xx);
                vec2 i1;
                i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                vec4 x12 = x0.xyxy + C.xxzz;
                x12.xy -= i1;
                i = mod289(i); // Avoid truncation effects in permutation
                vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
                    + i.x + vec3(0.0, i1.x, 1.0 ));
                vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
                m = m*m ;
                m = m*m ;
                vec3 x = 2.0 * fract(p * C.www) - 1.0;
                vec3 h = abs(x) - 0.5;
                vec3 ox = floor(x + 0.5);
                vec3 a0 = x - ox;
                m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
                vec3 g;
                g.x  = a0.x  * x0.x  + h.x  * x0.y;
                g.yz = a0.yz * x12.xz + h.yz * x12.yw;
                return 130.0 * dot(m, g);
            }

            void main() {
                // Coordinates
                float y = vUv.y; // 0 (base) to 1 (tip)
                
                // -- Physics: Flow & Turbulence --
                float speed = 20.0 + uThrottle * 30.0;
                float noiseVal = snoise(vec2(vUv.x * 5.0, vUv.y * 2.0 - uTime * speed));
                
                // -- Shock Diamonds (Mach Disks) --
                float diamondFreq = 10.0 + uThrottle * 5.0; // More rings at speed
                float diamondPhase = uTime * 15.0;
                float diamonds = abs(sin(y * diamondFreq - diamondPhase));
                diamonds = pow(diamonds, 4.0); // Sharpen
                
                // -- Color Gradient (Thermodynamics) --
                // Core: White-Hot -> Blue Plasma -> Orange/Red cooling -> Smoke
                vec3 colCore = vec3(0.8, 0.9, 1.0); // White-Blue
                vec3 colPlasma = vec3(0.0, 0.6, 1.0); // Electric Blue
                vec3 colHeat = vec3(1.0, 0.4, 0.0); // Orange
                
                // Mix based on throttle and position
                vec3 color = mix(colHeat, colPlasma, uThrottle);
                color = mix(color, colCore, diamonds * 0.6 * uThrottle); // Add diamonds
                
                // -- Alpha / Transparency --
                float alpha = 1.0 - y;
                alpha = pow(alpha, 1.5); // Fade out tip
                
                // Sides fade soft (Cylinder volume illusion)
                float sideFade = 1.0 - abs(vUv.x - 0.5) * 2.0;
                sideFade = pow(sideFade, 2.0);
                
                alpha *= sideFade;
                
                // Intensity boost from throttle
                alpha *= (0.3 + uThrottle * 0.7);
                
                // Add Noise to Alpha for "Flame flicker"
                alpha *= (0.8 + noiseVal * 0.2);

                gl_FragColor = vec4(color, alpha);
            }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        positions.forEach(p => {
            const glow = new THREE.Mesh(glowGeo, glowMat.clone());
            glow.position.copy(p);
            glow.position.z += 0.2;
            this.modelContainer.add(glow);
            this.engineGlows.push(glow);

            // Light
            const engineLight = new THREE.PointLight(0x0088ff, 2, 10);
            engineLight.position.copy(p);
            engineLight.position.z += 1.0;
            this.modelContainer.add(engineLight);
            this.engineLights.push(engineLight);
        });
    }

    updateBullets(dt) {
        if (!this.bullets) this.bullets = [];
        const aliveBullets = [];
        for (let b of this.bullets) {
            b.mesh.translateZ(-b.speed * dt);
            b.life -= dt;
            if (b.life > 0) {
                aliveBullets.push(b);
            } else {
                this.modelContainer.remove(b.mesh); // Remove from container
                if (b.mesh.parent) b.mesh.parent.remove(b.mesh); // double check
            }
        }
        this.bullets = aliveBullets;
    }

    fireGun() {
        if (!this.bullets) this.bullets = [];
        const now = performance.now();
        if (this.lastShotTime && now - this.lastShotTime < 66) return; // 15 RPS
        this.lastShotTime = now;

        const geo = new THREE.BoxGeometry(0.05, 0.05, 2.0);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const bullet = new THREE.Mesh(geo, mat);

        bullet.position.copy(this.mesh.position);
        bullet.quaternion.copy(this.mesh.quaternion);

        // Offset
        bullet.translateX(0.8); // Right gun
        bullet.translateY(-0.2);
        bullet.translateZ(-3.0);

        // Spread
        bullet.rotateX((Math.random() - 0.5) * 0.005);
        bullet.rotateY((Math.random() - 0.5) * 0.005);

        // Add to SCENE root, not model container, so they don't move with jet turns
        // actually for simple logic: add to scene. We need reference to scene.
        // Assuming this.scene exists (passed in constructor?)
        // Jet constructor: constructor(scene, camera, listener)
        this.scene.add(bullet);

        this.bullets.push({
            mesh: bullet,
            speed: this.speed + 400, // Bullet velocity
            life: 2.0
        });
    }

    createWingVapor() {
        // Geometry: thin planes sitting just above the wing surface
        const geo = new THREE.PlaneGeometry(5, 4, 1, 1);
        geo.rotateX(-Math.PI / 2); // Flat horizontal

        // Shader
        const vertexShader = `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;

        const fragmentShader = `
            uniform float uTime;
            uniform float uOpacity; // Controlled by speed/G-force
            varying vec2 vUv;

            // Simple noise function
            float random (vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898,78.233)))* 43758.5453123);
            }

            float noise (in vec2 st) {
                vec2 i = floor(st);
                vec2 f = fract(st);

                // Four corners in 2D of a tile
                float a = random(i);
                float b = random(i + vec2(1.0, 0.0));
                float c = random(i + vec2(0.0, 1.0));
                float d = random(i + vec2(1.0, 1.0));

                vec2 u = f * f * (3.0 - 2.0 * f);

                return mix(a, b, u.x) +
                        (c - a)* u.y * (1.0 - u.x) +
                        (d - b) * u.x * u.y;
            }

            void main() {
                // Scroll UVs for flow
                vec2 flowUv = vUv;
                flowUv.y -= uTime * 2.0; // Fast scroll backwards
                
                // Turbulent ridges
                float n = noise(flowUv * 10.0);
                n += noise(flowUv * 20.0) * 0.5;
                
                // Streaks effect
                float streaks = smoothstep(0.4, 0.8, n);
                
                // Edge fading (Soft particles)
                float alpha = streaks * uOpacity;
                
                // Fade out at trailing edge (vUv.y 0 to 1)
                alpha *= smoothstep(0.0, 0.2, vUv.y); // Fade in front
                alpha *= smoothstep(1.0, 0.6, vUv.y); // Fade out back
                alpha *= smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x); // Sides

                gl_FragColor = vec4(1.0, 1.0, 1.0, alpha * 0.5);
            }
        `;

        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uOpacity: { value: 0 }
            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });

        // Create meshes
        const vaporL = new THREE.Mesh(geo, mat);
        vaporL.position.set(-2, 0.1, 1); // Left Wing
        this.modelContainer.add(vaporL);
        this.wingVapors.push(vaporL);

        const vaporR = new THREE.Mesh(geo, mat.clone());
        vaporR.position.set(2, 0.1, 1); // Right Wing
        this.modelContainer.add(vaporR);
        this.wingVapors.push(vaporR);
    }

    loadModel() {
        const loader = new GLTFLoader();
        loader.load(
            '/jet.glb',
            (gltf) => {
                console.log('Use Custom Model');
                this.modelContainer.clear();
                this.engineGlows = [];
                this.engineLights = [];
                this.wingVapors = []; // Correctly clear old references

                const model = gltf.scene;
                model.scale.set(1, 1, 1);
                model.rotation.y = Math.PI;
                this.modelContainer.add(model);
                this.addEngineGlow(new THREE.Vector3(0, 0, 0));
                this.createWingVapor(); // Re-add vapor for custom model
            },
            undefined,
            (error) => { }
        );
    }

    update(deltaTime) {
        const input = this.controls.getInput();

        // -- NITRO & SPEED --
        let isThrusting = input.throttle;
        const baseMaxSpeed = 120;

        // Check Overheat
        if (this.isOverheated) {
            isThrusting = false; // Disable thrust
            if (this.nitroFuel > 25) {
                this.isOverheated = false; // Cooled down
            }
        } else if (this.nitroFuel <= 0) {
            this.isOverheated = true; // Overheated
            isThrusting = false;
        }

        if (isThrusting && this.nitroFuel > 0) {
            // Nitro Mode
            this.nitroFuel -= 15 * deltaTime;
            this.maxSpeed = baseMaxSpeed * 2.5;
            this.speed = Math.min(this.speed + this.acceleration * 2 * deltaTime, this.maxSpeed);
        } else {
            // Normal / Cooldown Mode
            this.maxSpeed = baseMaxSpeed;
            this.nitroFuel += 5 * deltaTime;

            if (input.brake) {
                this.speed = Math.max(this.speed - this.acceleration * deltaTime, this.minSpeed);
            } else {
                // Drag
                if (this.speed > this.maxSpeed) {
                    // Heavy Drag if overspeeding (e.g. after nitro)
                    this.speed -= this.deceleration * 3 * deltaTime;
                } else {
                    this.speed = Math.max(this.speed - this.deceleration * deltaTime * 0.2, 0);
                }
            }
        }

        this.nitroFuel = THREE.MathUtils.clamp(this.nitroFuel, 0, 100);

        // -- GUN SYSTEM --
        this.updateBullets(deltaTime);
        if (input.fire) {
            this.fireGun();
        }

        // -- STEERING (KEYBOARD ONLY) --

        let targetPitch = 0;
        let targetRoll = 0;
        let targetYaw = 0;

        if (input.pitchUp) targetPitch = 1;
        if (input.pitchDown) targetPitch = -1;
        if (input.rollLeft) targetRoll = 1;
        if (input.rollRight) targetRoll = -1;

        if (input.yawLeft) targetYaw = 1;
        if (input.yawRight) targetYaw = -1;

        const pitchAmount = targetPitch * this.pitchSpeed * deltaTime;
        const rollAmount = targetRoll * this.rollSpeed * deltaTime;
        const yawAmount = targetYaw * this.yawSpeed * deltaTime;

        this.mesh.rotateX(pitchAmount);
        this.mesh.rotateY(targetRoll * -0.5 * deltaTime + yawAmount);
        this.mesh.rotateZ(rollAmount);

        // -- VISUAL BANKING --
        const maxVisualBank = 0.9;
        const targetVisualBank = targetRoll * maxVisualBank;
        this.modelContainer.rotation.z = THREE.MathUtils.lerp(this.modelContainer.rotation.z, targetVisualBank, 5 * deltaTime);

        // -- CONTRAILS --

        // -- CONTRAILS --
        // Spawn particles if high speed OR thrusting
        if (this.speed > 100 || (isThrusting && this.nitroFuel > 0)) {
            this.spawnContrail();
        }
        this.updateContrails(deltaTime);

        // -- AFTERBURNER SHADER UPDATE --
        // Use the let isThrusting from above
        const time = performance.now() / 1000;

        // Target throttle value (0 to 1)
        const targetThrottle = isThrusting ? 1.0 : 0.0;

        this.engineGlows.forEach(glow => {
            if (!glow.material.uniforms) return; // Safety check

            // Update Time Uniform
            glow.material.uniforms.uTime.value = time;

            // Lerp throttle uniform manually for smoothness
            const currentT = glow.material.uniforms.uThrottle.value;
            glow.material.uniforms.uThrottle.value = THREE.MathUtils.lerp(currentT, targetThrottle, 10 * deltaTime);

            // Scale geometry based on throttle (LENGTH ONLY)
            const throttleVal = glow.material.uniforms.uThrottle.value;
            // Lengthen the cone as throttle increases
            glow.scale.z = 1.0 + throttleVal * 5.0;
            glow.scale.x = 1.0 + throttleVal * 0.5;
            glow.scale.y = 1.0 + throttleVal * 0.5;
        });

        this.engineLights.forEach(light => {
            const throttleVal = this.engineGlows[0] && this.engineGlows[0].material.uniforms ? this.engineGlows[0].material.uniforms.uThrottle.value : (isThrusting ? 1 : 0);
            light.intensity = THREE.MathUtils.lerp(1, 10, throttleVal);
            light.color.setHex(isThrusting ? 0x88ccff : 0xffaa00);
        });


        // -- MOVEMENT --
        this.mesh.translateZ(-this.speed * deltaTime);



    }

    spawnContrail() {
        // Spawn from SINGLE ENGINE (Center)
        // High density spawn: Create multiple particles per call to fill gaps
        const offset = new THREE.Vector3(0, 0, 3.0).applyMatrix4(this.modelContainer.matrixWorld);

        // Spawn 2 particles slightly offset to make it thick
        this.activateContrailInstance(offset, 1.5);

        // Interpolate for even smoother line if speed is high? 
        // For now, simple double-spawn
        const offset2 = new THREE.Vector3(0, 0, 3.5).applyMatrix4(this.modelContainer.matrixWorld);
        this.activateContrailInstance(offset2, 1.5);
    }

    activateContrailInstance(pos, scaleMult = 1.0) {
        // Ring buffer logic
        const idx = this.contrailIndex;
        this.contrailIndex = (this.contrailIndex + 1) % this.contrailMaxCount;

        const data = this.contrailData[idx];
        data.active = true;
        data.age = 0;
        data.life = 2.0 + Math.random(); // Longer life (2-3s)
        data.pos.copy(pos);
        data.scale = (3.0 + Math.random()) * scaleMult; // Big initial puffs
        data.rot = Math.random() * Math.PI; // Random rotation

        // Jitter position slightly for "Roiling" effect
        data.pos.x += (Math.random() - 0.5) * 0.8;
        data.pos.y += (Math.random() - 0.5) * 0.8;
        data.pos.z += (Math.random() - 0.5) * 0.8;

        // Update Matrix immediately
        this.dummy.position.copy(data.pos);
        this.dummy.rotation.set(0, 0, data.rot);
        this.dummy.scale.setScalar(data.scale);
        this.dummy.updateMatrix();

        this.contrailMesh.setMatrixAt(idx, this.dummy.matrix);
        this.contrailMesh.instanceMatrix.needsUpdate = true;
    }

    updateContrails(deltaTime) {
        let activeCount = 0;

        for (let i = 0; i < this.contrailMaxCount; i++) {
            const data = this.contrailData[i];
            if (!data.active) continue;

            data.age += deltaTime;

            if (data.age > data.life) {
                data.active = false;
                this.dummy.position.set(0, -99999, 0);
                this.dummy.updateMatrix();
                this.contrailMesh.setMatrixAt(i, this.dummy.matrix);
                continue;
            }
            activeCount++;

            // Physics: Expand MASSIVELY
            const ratio = data.age / data.life;
            const currentScale = data.scale * (1.0 + ratio * 5.0); // Expand 5x

            this.dummy.position.copy(data.pos);
            this.dummy.scale.setScalar(currentScale);
            // Rotate slowly for turbulence
            this.dummy.rotation.z = data.rot + ratio;

            this.dummy.updateMatrix();
            this.contrailMesh.setMatrixAt(i, this.dummy.matrix);
        }

        if (activeCount > 0) {
            this.contrailMesh.instanceMatrix.needsUpdate = true;
        }
    }
}
