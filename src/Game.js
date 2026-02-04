import * as THREE from 'three';
import { Jet } from './Jet.js';
import { TargetDrone } from './TargetDrone.js';
import { Terrain } from './Terrain.js';
import { Clouds } from './Clouds.js';
import { UI } from './UI.js';
import { Sky } from 'three/addons/objects/Sky.js';
import Stats from 'stats.js';

export class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        this.renderer.shadowMap.enabled = true;

        // -- STATS --
        this.stats = new Stats();
        this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
        this.stats.dom.style.position = 'absolute';
        this.stats.dom.style.left = '10px';
        this.stats.dom.style.top = '10px';
        document.body.appendChild(this.stats.dom);

        this.clock = new THREE.Clock();
        this.jet = new Jet(this.scene);
        this.jet.mesh.position.y = 1000; // FIX: Start very high up to avoid spawn kill

        this.explosions = []; // Track active explosions
        this.isGameOver = false;

        this.init();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(this.renderer.domElement);

        this.createEnvironment();

        window.addEventListener('resize', () => this.onWindowResize(), false);
        this.animate();
    }

    createEnvironment() {
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
        this.scene.add(hemiLight);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
        sunLight.position.set(100, 500, 100);
        sunLight.castShadow = true;

        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 2000;
        const d = 500;
        sunLight.shadow.camera.left = -d;
        sunLight.shadow.camera.right = d;
        sunLight.shadow.camera.top = d;
        sunLight.shadow.camera.bottom = -d;

        this.scene.add(sunLight);
        this.sunLight = sunLight;

        // Sky
        this.sky = new Sky();
        this.sky.scale.setScalar(10000);
        this.scene.add(this.sky);

        const skyUniforms = this.sky.material.uniforms;
        skyUniforms['turbidity'].value = 8;
        skyUniforms['rayleigh'].value = 1.5;
        skyUniforms['mieCoefficient'].value = 0.005;
        skyUniforms['mieDirectionalG'].value = 0.7;

        const phi = THREE.MathUtils.degToRad(85);
        const theta = THREE.MathUtils.degToRad(180);
        const sunPosition = new THREE.Vector3();
        sunPosition.setFromSphericalCoords(1, phi, theta);

        skyUniforms['sunPosition'].value.copy(sunPosition);
        sunLight.position.copy(sunPosition).multiplyScalar(500);

        this.clouds = new Clouds(this.scene);
        this.ui = new UI();

        this.terrain = new Terrain(this.scene);

        this.scene.fog = new THREE.FogExp2(0xaaccff, 0.00025);
    }

    createExplosion(position) {
        // Simple particle explosion
        const particleCount = 20;
        const geometry = new THREE.SphereGeometry(2, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0xff4400 });

        for (let i = 0; i < particleCount; i++) {
            const mesh = new THREE.Mesh(geometry, material.clone());
            mesh.position.copy(position);

            // Random velocity
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 50,
                (Math.random() - 0.5) * 50 + 20, // Upward bias
                (Math.random() - 0.5) * 50
            );

            this.scene.add(mesh);
            this.explosions.push({ mesh, velocity, age: 0 });
        }

        // Big flash
        const flashGeo = new THREE.SphereGeometry(10, 16, 16);
        const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.position.copy(position);
        this.scene.add(flash);
        this.explosions.push({ mesh: flash, velocity: new THREE.Vector3(0, 0, 0), age: 0, isFlash: true });
    }

    updateExplosions(deltaTime) {
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const expl = this.explosions[i];
            expl.age += deltaTime;

            if (expl.age > 2.0) {
                this.scene.remove(expl.mesh);
                this.explosions.splice(i, 1);
                continue;
            }

            if (expl.isFlash) {
                expl.mesh.scale.multiplyScalar(1.0 + 5 * deltaTime);
                expl.mesh.material.opacity -= 2 * deltaTime;
            } else {
                expl.mesh.position.addScaledVector(expl.velocity, deltaTime);
                expl.velocity.y -= 20 * deltaTime; // Gravity
                expl.mesh.scale.multiplyScalar(0.95); // Shrink
            }
        }
    }

    updateDrones(dt) {
        if (!this.drones) this.drones = [];

        // Spawn logic: Try to keep 5 drones active
        if (this.drones.length < 5) {
            // Spawn 2000 units ahead of player, random offset
            const spawnDist = 1000 + Math.random() * 500;
            const jetPos = this.jet.mesh.position;
            const jetDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.jet.mesh.quaternion);

            const spawnPos = new THREE.Vector3()
                .copy(jetPos)
                .add(jetDir.multiplyScalar(spawnDist));

            // Random offset Y/X
            spawnPos.y += (Math.random() - 0.5) * 500;
            spawnPos.x += (Math.random() - 0.5) * 1000;
            spawnPos.y = Math.max(spawnPos.y, 200); // Don't spawn in ground

            const drone = new TargetDrone(this.scene, spawnPos);
            this.drones.push(drone);
        }

        // Update & Despawn
        for (let i = this.drones.length - 1; i >= 0; i--) {
            const drone = this.drones[i];
            drone.update(dt, this.jet.mesh.position);

            // Cleanup if destroyed
            if (!drone.active) {
                this.drones.splice(i, 1);
                continue;
            }

            // Cleanup if too far behind
            const dist = drone.mesh.position.distanceTo(this.jet.mesh.position);
            if (dist > 3000) {
                this.scene.remove(drone.mesh);
                this.drones.splice(i, 1);
            }
        }
    }

    checkCombatCollisions() {
        if (!this.jet.bullets || !this.drones) return;

        for (let bIndex = this.jet.bullets.length - 1; bIndex >= 0; bIndex--) {
            const bullet = this.jet.bullets[bIndex];

            for (let dIndex = 0; dIndex < this.drones.length; dIndex++) {
                const drone = this.drones[dIndex];
                if (!drone.active) continue;

                // Simple sphere check
                const dist = bullet.mesh.position.distanceTo(drone.mesh.position);
                if (dist < 4.0) { // Drone radius approx 2-3
                    // HIT!
                    drone.takeDamage();
                    this.createExplosion(drone.mesh.position);

                    // Remove bullet
                    this.scene.remove(bullet.mesh);
                    this.jet.bullets.splice(bIndex, 1);

                    break; // Bullet can only hit one drone
                }
            }
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    gameOver() {
        if (this.isGameOver) return;
        this.isGameOver = true;

        this.createExplosion(this.jet.mesh.position);

        // Hide Jet
        this.jet.mesh.visible = false;
        this.jet.speed = 0;

        // Reset after 3 seconds
        setTimeout(() => {
            this.resetGame();
        }, 3000);
    }

    resetGame() {
        this.isGameOver = false;
        this.jet.mesh.visible = true;
        this.jet.mesh.position.set(0, 1000, 0); // Start high
        this.jet.mesh.rotation.set(0, 0, 0);
        this.jet.speed = 0;
        // Do not clear mesh to preserve loaded models

        // Ensure above ground
        const groundH = this.terrain.getHeightAt(0, 0);
        if (this.jet.mesh.position.y < groundH + 50) {
            this.jet.mesh.position.y = groundH + 200;
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        this.stats.begin();

        const deltaTime = this.clock.getDelta();

        if (!this.isGameOver) {
            this.jet.update(deltaTime);
            if (this.clouds) this.clouds.update(this.jet.mesh.position, deltaTime);
            if (this.ui) {
                this.ui.updateNitro(this.jet.nitroFuel, this.jet.isOverheated);
                this.ui.updateSpeed(this.jet.speed, this.jet.maxSpeed);
                // Extract flight data
                // Altitude: y position
                // Pitch: Local X rotation (approximate)
                const pitch = this.jet.mesh.rotation.x;
                this.ui.updateFlightData(this.jet.mesh.position.y, pitch);
            }
        }

        // -- COLLISION CHECK --
        const jetPos = this.jet.mesh.position;
        const groundHeight = this.terrain.getHeightAt(jetPos.x, jetPos.z);

        if (jetPos.y < groundHeight + 5) { // +5 buffer
            this.gameOver();
        }

        this.updateDrones(deltaTime);
        this.checkCombatCollisions();

        this.updateExplosions(deltaTime);

        // Env follow
        this.sunLight.position.x = this.jet.mesh.position.x + 100;
        this.sunLight.position.z = this.jet.mesh.position.z + 100;
        this.sunLight.target.position.copy(this.jet.mesh.position);
        this.sunLight.target.updateMatrixWorld();

        // Camera Follow Logic 
        // If game over, just look at the crash site
        if (!this.isGameOver) {
            // Initialize zoom state if undefined
            if (this.currentCameraZ === undefined) this.currentCameraZ = 18;

            // Dynamic Zoom Logic:
            // Base Z: 18. Max Zoom: 100% more (36)
            const input = this.jet.controls ? this.jet.controls.getInput() : { throttle: false };
            const isThrusting = this.jet.nitroFuel > 0 && input.throttle;

            // Set Target
            const targetZ = isThrusting ? 36 : 18;

            // Lerp controls: Fast OUT, Snappy RETURN
            const zoomSpeed = isThrusting ? 0.8 : 2.0;

            this.currentCameraZ = THREE.MathUtils.lerp(this.currentCameraZ, targetZ, zoomSpeed * deltaTime);

            const relativeCameraOffset = new THREE.Vector3(0, 6, this.currentCameraZ);
            const cameraOffset = relativeCameraOffset.applyMatrix4(this.jet.mesh.matrixWorld);

            // Revert to Soft Follow (0.1) for cinematic feel, since we handle zoom explicitly now.
            // This fixes the "jitter" caused by the stiff 0.5 lerp.
            this.camera.position.lerp(cameraOffset, 0.1);

            const lookTarget = new THREE.Vector3(0, 0, -30).applyMatrix4(this.jet.mesh.matrixWorld);
            this.camera.lookAt(lookTarget);
        }

        this.renderer.render(this.scene, this.camera);

        this.stats.end();
    }
}
