import * as THREE from 'three';

export class Terrain {
    constructor(scene) {
        this.scene = scene;
        this.chunkSize = 20000;

        // Groups
        this.mesh = new THREE.Group();
        this.scene.add(this.mesh);

        this.generateTerrain();
        this.addVegetation();
    }

    generateTerrain() {
        // High resolution plane for mountains
        const segments = 256;
        const geometry = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize, segments, segments);
        geometry.rotateX(-Math.PI / 2);

        const positions = geometry.attributes.position;
        const width = this.chunkSize;

        // Colors for vertex painting
        const colors = [];
        const colorAttribute = new THREE.BufferAttribute(new Float32Array(positions.count * 3), 3);

        const darkGreen = new THREE.Color(0x004400);
        const brown = new THREE.Color(0x3e2723); // Earthy
        const grey = new THREE.Color(0x555555);
        const white = new THREE.Color(0xffffff);

        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const z = positions.getZ(i);

            // Simple "Noise" using multiple sine waves
            // Low freq (Mountains)
            let y = Math.sin(x / 2000) * Math.cos(z / 2000) * 800;
            // Medium freq (Hills)
            y += Math.sin(x / 500) * Math.sin(z / 500) * 150;
            // High freq (Noise)
            y += Math.sin(x / 50) * Math.cos(z / 50) * 10;

            // Bias height to be mostly positive (0 to max)
            y = Math.max(y, -200);

            positions.setY(i, y);

            // Coloring based on Height
            const color = new THREE.Color();
            if (y < -100) {
                color.setHex(0x002244); // Water level deep
            } else if (y < 200) {
                // Grass / Forest
                color.lerpColors(darkGreen, brown, (y + 100) / 300);
            } else if (y < 700) {
                // Rock
                color.lerpColors(brown, grey, (y - 200) / 500);
            } else {
                // Snow
                color.lerpColors(grey, white, (y - 700) / 300);
            }

            colors.push(color.r, color.g, color.b);
        }

        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.8,
            metalness: 0.1,
            flatShading: true
        });

        this.terrainMesh = new THREE.Mesh(geometry, material);
        this.mesh.add(this.terrainMesh);

        // Store height data for tree placement (very rough approx)
        this.heightData = { geometry, width, segments };
    }

    addVegetation() {
        // Add random trees (Cones)
        const treeCount = 5000;
        const treeGeo = new THREE.ConeGeometry(8, 25, 6);
        treeGeo.translate(0, 12, 0); // Pivot at base
        const treeMat = new THREE.MeshStandardMaterial({ color: 0x002200, roughness: 1.0 });

        const instancedTrees = new THREE.InstancedMesh(treeGeo, treeMat, treeCount);
        const dummy = new THREE.Object3D();

        let count = 0;
        for (let i = 0; i < treeCount * 3; i++) { // Try 3x times to find spots
            if (count >= treeCount) break;

            const x = (Math.random() - 0.5) * this.chunkSize;
            const z = (Math.random() - 0.5) * this.chunkSize;

            // Get Height at X,Z
            const height = this.getHeightAt(x, z);

            // Only place on "grass" levels (approx < 200 and > -50)
            if (height > -50 && height < 300) {
                dummy.position.set(x, height, z);

                // Random scale
                const s = 1 + Math.random();
                dummy.scale.set(s, s, s);

                dummy.updateMatrix();
                instancedTrees.setMatrixAt(count, dummy.matrix);
                count++;
            }
        }

        this.mesh.add(instancedTrees);
    }

    getHeightAt(x, z) {
        // Re-run the formula logic
        let y = Math.sin(x / 2000) * Math.cos(z / 2000) * 800;
        y += Math.sin(x / 500) * Math.sin(z / 500) * 150;
        y += Math.sin(x / 50) * Math.cos(z / 50) * 10;
        return Math.max(y, -200);
    }

    update(playerPos) {
        // Infinite Loop Logic?
        // For now, just keep centered or let player fly off edge.
        // A true infinite terrain requires chunk manager, which is complex.
        // We will just snap the big plane to player for "fake" infinity if textures align,
        // but since we rely on world coordinates for height, we can't just slide the mesh.
        // We would need to regenerate vertices. 
        // Given complexity, let's keep the map FIXED but HUGE (20km x 20km).
        // That is plenty of flight time.
    }
}
