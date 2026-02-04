import * as THREE from 'three';

export class Clouds {
    constructor(scene) {
        this.scene = scene;
        this.clouds = [];
        this.createClouds();
    }

    createCloudTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        // Radial gradient for soft puff
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.2)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    createClouds() {
        const texture = this.createCloudTexture();
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0.6,
            depthWrite: false, // Don't block other clouds
            blending: THREE.NormalBlending
        });

        const cloudGroup = new THREE.Group();
        const range = 20000;
        const altitude = 1500;
        const cloudCount = 100; // clusters

        for (let i = 0; i < cloudCount; i++) {
            // Create a cluster of sprites
            const cluster = new THREE.Group();
            const cx = (Math.random() - 0.5) * range;
            const cz = (Math.random() - 0.5) * range;
            const cy = altitude + (Math.random() - 0.5) * 400;

            cluster.position.set(cx, cy, cz);

            const puffCount = 5 + Math.random() * 10;
            for (let j = 0; j < puffCount; j++) {
                const sprite = new THREE.Sprite(material);

                // Offset within cluster
                const ox = (Math.random() - 0.5) * 400;
                const oy = (Math.random() - 0.5) * 100; // Flatter
                const oz = (Math.random() - 0.5) * 400;

                sprite.position.set(ox, oy, oz);

                // Random scale
                const scale = 200 + Math.random() * 300;
                sprite.scale.set(scale, scale, 1);

                cluster.add(sprite);
            }

            cloudGroup.add(cluster);
            this.clouds.push(cluster);
        }

        this.scene.add(cloudGroup);
        this.mesh = cloudGroup;
    }

    update(playerPos, deltaTime) {
        // Slow drift
        this.clouds.forEach(cloud => {
            cloud.position.x += 10 * deltaTime; // Wind

            // Loop around if too far logic could go here, 
            // but for 20km map it's fine for now.
        });
    }
}
