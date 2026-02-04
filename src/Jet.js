import * as THREE from 'three';
import { Controls } from './Controls.js';

export class Jet {
    constructor(scene) {
        this.scene = scene;
        this.mesh = this.createMesh();
        this.scene.add(this.mesh);

        // Flight physics properties
        this.speed = 0;
        this.maxSpeed = 50;
        this.minSpeed = 10;
        this.acceleration = 20;
        this.deceleration = 10;

        this.controls = new Controls();

        // Rotation sensitivity
        this.rollSpeed = 2.0;
        this.pitchSpeed = 1.5;
        this.yawSpeed = 0.5;
    }

    createMesh() {
        // Simple Jet Representation (Group of shapes)
        const group = new THREE.Group();

        // Body
        const bodyGeo = new THREE.ConeGeometry(1, 4, 32);
        bodyGeo.rotateX(Math.PI / 2); // Point forward
        const bodyMat = new THREE.MeshPhongMaterial({ color: 0xcc0000 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        group.add(body);

        // Wings
        const wingGeo = new THREE.BoxGeometry(4, 0.1, 1.5);
        const wingMat = new THREE.MeshPhongMaterial({ color: 0x990000 });
        const wings = new THREE.Mesh(wingGeo, wingMat);
        wings.position.set(0, 0, 0.5);
        group.add(wings);

        // Tail
        const tailGeo = new THREE.BoxGeometry(1.5, 0.1, 1);
        const tail = new THREE.Mesh(tailGeo, wingMat);
        tail.position.set(0, 0, 1.8);
        group.add(tail);

        // Vertical Stabilizer
        const stabGeo = new THREE.BoxGeometry(0.1, 1, 1);
        const stabilizer = new THREE.Mesh(stabGeo, wingMat);
        stabilizer.position.set(0, 0.5, 1.8);
        group.add(stabilizer);

        return group;
    }

    update(deltaTime) {
        const input = this.controls.getInput();

        // Thrust Management
        if (input.throttle) {
            this.speed = Math.min(this.speed + this.acceleration * deltaTime, this.maxSpeed);
        } else if (input.brake) {
            this.speed = Math.max(this.speed - this.acceleration * deltaTime, this.minSpeed);
        } else {
            // Auto decelerate to cruising speed if not pressing anything? 
            // For now, just drag
            this.speed = Math.max(this.speed - this.deceleration * deltaTime * 0.2, 0);
        }

        // Rotations
        // Pitch (Up/Down) - W/S
        if (input.pitchDown) this.mesh.rotateX(this.pitchSpeed * deltaTime);
        if (input.pitchUp) this.mesh.rotateX(-this.pitchSpeed * deltaTime);

        // Roll (Bank Left/Right) - A/D
        if (input.rollLeft) this.mesh.rotateZ(this.rollSpeed * deltaTime);
        if (input.rollRight) this.mesh.rotateZ(-this.rollSpeed * deltaTime);

        // Yaw (Rudder) - Q/E (Optional, good for fine tuning)
        if (input.yawLeft) this.mesh.rotateY(this.yawSpeed * deltaTime);
        if (input.yawRight) this.mesh.rotateY(-this.yawSpeed * deltaTime);


        // Move Forward
        this.mesh.translateZ(-this.speed * deltaTime); // Negative Z is forward in our localized mesh space due to rotation
    }
}
