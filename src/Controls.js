export class Controls {
    constructor() {
        this.keys = {
            w: false,
            s: false,
            a: false,
            d: false,
            q: false,
            e: false,
            Shift: false,
            Control: false // or Space
        };

        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
    }

    onKeyDown(event) {
        if (this.keys.hasOwnProperty(event.key.toLowerCase())) {
            this.keys[event.key.toLowerCase()] = true;
        } else if (event.key === 'Shift' || event.key === 'Control' || event.key === ' ') {
            // Handle special keys mapping
            if (event.code === 'ShiftLeft') this.keys.Shift = true;
            if (event.code === 'Space') this.keys.Space = true; // Use space for brake?
        }
    }

    onKeyUp(event) {
        if (this.keys.hasOwnProperty(event.key.toLowerCase())) {
            this.keys[event.key.toLowerCase()] = false;
        } else if (event.key === 'Shift' || event.key === 'Control' || event.key === ' ') {
            if (event.code === 'ShiftLeft') this.keys.Shift = false;
            if (event.code === 'Space') this.keys.Space = false;
        }
    }

    getInput() {
        return {
            pitchUp: this.keys.w,
            pitchDown: this.keys.s,
            rollLeft: this.keys.a,
            rollRight: this.keys.d,
            yawLeft: this.keys.q,
            yawRight: this.keys.e,
            throttle: this.keys.Shift, // Shift to speed up
            brake: this.keys.Space // Space to slow down
        };
    }
}
