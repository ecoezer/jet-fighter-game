export class Controls {
    constructor() {
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            yawLeft: false,
            yawRight: false,
            boost: false,
            brake: false,
            fire: false
        };

        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
        window.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('mouseup', (e) => this.onMouseUp(e));
    }

    onMouseDown(event) {
        if (event.button === 0) this.keys.fire = true; // Left Click
    }

    onMouseUp(event) {
        if (event.button === 0) this.keys.fire = false;
    }

    onKeyDown(event) {
        if (this.handleKey(event.code, true)) {
            event.preventDefault();
        }
    }

    onKeyUp(event) {
        this.handleKey(event.code, false);
    }

    handleKey(code, isDown) {
        let changed = false;
        switch (code) {
            case 'ArrowDown':
            case 'KeyS':
                this.keys.forward = isDown;
                changed = true;
                break;
            case 'ArrowUp':
            case 'KeyW':
                this.keys.backward = isDown;
                changed = true;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.keys.left = isDown;
                changed = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.keys.right = isDown;
                changed = true;
                break;
            case 'KeyQ':
                this.keys.yawLeft = isDown;
                changed = true;
                break;
            case 'KeyE':
                this.keys.yawRight = isDown;
                changed = true;
                break;
            case 'Space':
                // Fire
                this.keys.fire = isDown;
                changed = true;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                // Boost
                this.keys.boost = isDown;
                changed = true;
                break;
            case 'KeyZ':
            case 'ControlLeft':
                // Brake/Airbrake
                this.keys.brake = isDown;
                changed = true;
                break;
        }
        return changed;
    }

    getInput() {
        return {
            pitchUp: this.keys.forward, // Inverted: Down/S -> Pitch Up
            pitchDown: this.keys.backward, // Inverted: Up/W -> Pitch Down
            rollLeft: this.keys.left,
            rollRight: this.keys.right,
            yawLeft: this.keys.yawLeft,
            yawRight: this.keys.yawRight,
            throttle: this.keys.boost,
            brake: this.keys.brake,
            fire: this.keys.fire,
            mouseX: 0,
            mouseY: 0
        };
    }
}
