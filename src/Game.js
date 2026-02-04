import * as THREE from 'three';
import { Jet } from './Jet.js';

export class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer();
        
        this.clock = new THREE.Clock();
        this.jet = new Jet(this.scene);
        
        this.init();
    }

    init() {
        // Setup Renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        // Setup Scene
        // Add some basic lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 10, 7.5);
        this.scene.add(directionalLight);

        // Simple Ground/Ocean (for reference)
        const gridHelper = new THREE.GridHelper(1000, 100, 0x555555, 0x333333);
        this.scene.add(gridHelper);

        // Skybox-ish background
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue

        // Camera positioning (follow the jet)
        this.camera.position.set(0, 5, 10);

        // Handle Window Resize
        window.addEventListener('resize', () => this.onWindowResize(), false);

        // Start Loop
        this.animate();
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const deltaTime = this.clock.getDelta();

        // Update Game Objects
        this.jet.update(deltaTime);

        // Camera Follow Logic (Simple backend follow)
        const relativeCameraOffset = new THREE.Vector3(0, 5, 15);
        const cameraOffset = relativeCameraOffset.applyMatrix4(this.jet.mesh.matrixWorld);

        this.camera.position.lerp(cameraOffset, 0.1);
        this.camera.lookAt(this.jet.mesh.position);

        this.renderer.render(this.scene, this.camera);
    }
}
