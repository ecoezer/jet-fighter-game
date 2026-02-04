import * as THREE from 'three';

export class TargetDrone {
    constructor(scene, startPos) {
        this.scene = scene;
        this.active = true;
        this.radius = 2.0; // Hitbox radius

        // -- VISUALS --
        const geo = new THREE.IcosahedronGeometry(1.5, 1);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xff3300,
            emissive: 0x550000,
            roughness: 0.4,
            metalness: 0.8,
            flatShading: true
        });

        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.copy(startPos);
        this.scene.add(this.mesh);

        // Core Glow
        const glowGeo = new THREE.SphereGeometry(2.5, 16, 16);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0.3,
            side: THREE.BackSide // Fake glow
        });
        this.glow = new THREE.Mesh(glowGeo, glowMat);
        this.mesh.add(this.glow);

        // Movement Props
        this.time = Math.random() * 100;
        this.baseY = startPos.y;
        this.speed = 40; // Slower than jet
    }

    update(dt, playerPos) {
        if (!this.active) return;

        this.time += dt;

        // Move Forward (Z)
        this.mesh.position.z -= this.speed * dt;

        // Sine Wave Motion (X/Y)
        this.mesh.position.y = this.baseY + Math.sin(this.time) * 10;
        this.mesh.position.x += Math.cos(this.time * 0.5) * 10 * dt;

        // Rotate
        this.mesh.rotation.z += dt;
        this.mesh.rotation.y += dt * 0.5;

        // Pulse Glow
        const pulse = 0.3 + Math.sin(this.time * 5) * 0.1;
        this.glow.material.opacity = pulse;
    }

    takeDamage() {
        // One hit kill for now
        this.active = false;

        // Simple Explosion visual (scaled up instantly then removed)
        // In a real system we'd use a ParticleSystem manager
        const explosionGeo = new THREE.SphereGeometry(5, 8, 8);
        const explosionMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        const bang = new THREE.Mesh(explosionGeo, explosionMat);
        bang.position.copy(this.mesh.position);
        this.scene.add(bang);

        // Animate explosion roughly
        let scale = 1.0;
        const animateBang = () => {
            scale += 0.5;
            bang.scale.setScalar(scale);
            bang.material.opacity = Math.max(0, 1.0 - (scale - 1.0) * 0.2);
            bang.material.transparent = true;

            if (scale < 5.0) {
                requestAnimationFrame(animateBang);
            } else {
                this.scene.remove(bang);
            }
        };
        animateBang();

        // Cleanup self
        this.scene.remove(this.mesh);
    }
}
