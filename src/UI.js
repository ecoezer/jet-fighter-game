import * as THREE from 'three';

export class UI {
    constructor() {
        this.init();
    }

    init() {
        // Container
        this.container = document.createElement('div');
        this.container.style.position = 'absolute';
        this.container.style.bottom = '20px';
        this.container.style.left = '50%';
        this.container.style.transform = 'translateX(-50%)';
        this.container.style.width = '300px';
        this.container.style.height = '15px';
        this.container.style.border = '2px solid #00aaaa';
        this.container.style.borderRadius = '8px';
        this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.container.style.overflow = 'hidden';
        this.container.style.zIndex = '100';

        // Bar
        this.bar = document.createElement('div');
        this.bar.style.width = '100%';
        this.bar.style.height = '100%';
        this.bar.style.backgroundColor = '#00ffff';
        this.bar.style.boxShadow = '0 0 10px #00ffff';
        this.bar.style.transition = 'width 0.1s linear';

        // Label
        this.label = document.createElement('div');
        this.label.innerText = 'NITRO';
        this.label.style.position = 'absolute';
        this.label.style.top = '-25px';
        this.label.style.left = '0';
        this.label.style.color = '#00ffff';
        this.label.style.fontFamily = 'monospace';
        this.label.style.fontWeight = 'bold';
        this.label.style.textShadow = '0 0 5px #00aaaa';

        this.container.appendChild(this.bar);
        this.container.appendChild(this.label);
        document.body.appendChild(this.container);

        // -- CROSSHAIR --
        this.createCrosshair();

        // -- CIRCULAR SPEED HUD --
        this.speedContainer = document.createElement('div');
        this.speedContainer.style.position = 'absolute';
        this.speedContainer.style.right = '20px';
        this.speedContainer.style.bottom = '20px'; // Lower right corner
        this.speedContainer.style.width = '200px';
        this.speedContainer.style.height = '200px';
        this.speedContainer.style.pointerEvents = 'none';

        // SVG Gauge
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        svg.setAttribute("viewBox", "0 0 200 200");

        // Background Arc (Gray)
        // Path approx 270 degrees
        const trackPath = document.createElementNS(svgNS, "path");
        // Start 135deg (bottom left), End 405deg (bottom right)
        // Radius 80, Center 100,100
        const d = "M 43.4 156.6 A 80 80 0 1 1 156.6 156.6"; // Arc logic
        trackPath.setAttribute("d", d);
        trackPath.setAttribute("fill", "none");
        trackPath.setAttribute("stroke", "rgba(255, 255, 255, 0.1)");
        trackPath.setAttribute("stroke-width", "15");
        trackPath.setAttribute("stroke-linecap", "round");
        svg.appendChild(trackPath);

        // Progress Arc (Colored)
        this.progressPath = document.createElementNS(svgNS, "path");
        this.progressPath.setAttribute("d", d);
        this.progressPath.setAttribute("fill", "none");
        this.progressPath.setAttribute("stroke", "url(#speedGradient)"); // Use defs gradient
        this.progressPath.setAttribute("stroke-width", "15");
        this.progressPath.setAttribute("stroke-linecap", "round");
        // Dash array for animation: Full circle approx 2 * PI * 80 * 0.75 = 377
        const arcLen = 377;
        this.progressPath.setAttribute("stroke-dasharray", `${arcLen} ${arcLen}`);
        this.progressPath.setAttribute("stroke-dashoffset", String(arcLen)); // Start empty
        this.progressPath.style.transition = "stroke-dashoffset 0.1s linear";

        // Gradient Defs
        const defs = document.createElementNS(svgNS, "defs");
        const gradient = document.createElementNS(svgNS, "linearGradient");
        gradient.setAttribute("id", "speedGradient");
        gradient.setAttribute("x1", "0%");
        gradient.setAttribute("y1", "0%");
        gradient.setAttribute("x2", "100%");
        gradient.setAttribute("y2", "0%");

        const stop1 = document.createElementNS(svgNS, "stop");
        stop1.setAttribute("offset", "0%");
        stop1.setAttribute("stop-color", "#0088ff"); // Blue start

        const stop2 = document.createElementNS(svgNS, "stop");
        stop2.setAttribute("offset", "50%");
        stop2.setAttribute("stop-color", "#ffaa00"); // Orange mid

        const stop3 = document.createElementNS(svgNS, "stop");
        stop3.setAttribute("offset", "100%");
        stop3.setAttribute("stop-color", "#ff0000"); // Red max

        gradient.appendChild(stop1);
        gradient.appendChild(stop2);
        gradient.appendChild(stop3);
        defs.appendChild(gradient);
        svg.appendChild(defs);
        svg.appendChild(this.progressPath);

        this.speedContainer.appendChild(svg);

        // Text Overlay
        this.speedText = document.createElement('div');
        this.speedText.innerText = '000';
        this.speedText.style.position = 'absolute';
        this.speedText.style.top = '50%';
        this.speedText.style.left = '50%';
        this.speedText.style.transform = 'translate(-50%, -50%)';
        this.speedText.style.color = 'white';
        this.speedText.style.fontFamily = '"Courier New", monospace';
        this.speedText.style.fontSize = '48px';
        this.speedText.style.fontWeight = 'bold';
        this.speedText.style.textShadow = '0 0 10px rgba(255, 255, 255, 0.5)';
        this.speedContainer.appendChild(this.speedText);

        // Label subtext
        const subLabel = document.createElement('div');
        subLabel.innerText = 'km/h';
        subLabel.style.position = 'absolute';
        subLabel.style.top = '75%';
        subLabel.style.left = '50%';
        subLabel.style.transform = 'translate(-50%, -50%)';
        subLabel.style.color = '#888';
        subLabel.style.fontFamily = 'sans-serif';
        subLabel.style.fontSize = '12px';
        this.speedContainer.appendChild(subLabel);

        // Flight Info (Alt, Pitch)
        this.flightData = document.createElement('div');
        this.flightData.innerText = 'ALT: 0000\nPITCH: 00';
        this.flightData.style.position = 'absolute';
        this.flightData.style.top = '98%'; // Below km/h
        this.flightData.style.left = '50%';
        this.flightData.style.transform = 'translate(-50%, -50%)';
        this.flightData.style.color = '#00ccff';
        this.flightData.style.fontFamily = 'monospace';
        this.flightData.style.fontSize = '12px';
        this.flightData.style.textAlign = 'center';
        this.flightData.style.whiteSpace = 'pre';
        this.speedContainer.appendChild(this.flightData);

        document.body.appendChild(this.speedContainer);
    }

    updateSpeed(speed, maxSpeed) {
        // Display Speed
        const displaySpeed = Math.round(speed * 3.6);
        this.speedText.innerText = displaySpeed.toString();

        // Arc Progress
        // Approx 300 pixels arc length
        const maxArc = 377;
        const ratio = Math.min(speed / 300, 1.0); // Cap at 300 units/s (approx Mach 1 in game scale)
        const offset = maxArc * (1.0 - ratio);
        this.progressPath.setAttribute("stroke-dashoffset", String(offset));
    }

    updateNitro(percent, isOverheated) {
        // percent is 0 to 100
        this.bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;

        if (isOverheated) {
            this.bar.style.backgroundColor = '#ff0000'; // Red = LOCKED
            this.bar.style.boxShadow = '0 0 15px #ff0000';
            this.label.innerText = 'OVERHEAT';
            this.label.style.color = '#ff0000';
        } else {
            this.bar.style.backgroundColor = '#00ffff'; // Cyan = READY
            this.bar.style.boxShadow = '0 0 10px #00ffff';
            this.label.innerText = 'NITRO';
            this.label.style.color = '#00ffff';
        }
    }

    updateFlightData(altitude, pitch) {
        // Alt in meters, Pitch in degrees
        const altStr = Math.max(0, Math.round(altitude)).toString().padStart(4, '0');
        const pitchDeg = Math.round(THREE.MathUtils.radToDeg(pitch));
        this.flightData.innerText = `ALT: ${altStr}\nPITCH: ${pitchDeg}°`;
    }

    createCrosshair() {
        const crosshair = document.createElement('div');
        crosshair.style.position = 'absolute';
        crosshair.style.top = '50%';
        crosshair.style.left = '50%';
        crosshair.style.transform = 'translate(-50%, -50%)';
        crosshair.style.width = '40px';
        crosshair.style.height = '40px';
        crosshair.style.pointerEvents = 'none';

        // Simple SVG Reticle
        crosshair.innerHTML = `
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="18" stroke="rgba(0, 255, 0, 0.5)" stroke-width="2" />
                <circle cx="20" cy="20" r="2" fill="rgba(0, 255, 0, 0.8)" />
                <line x1="20" y1="5" x2="20" y2="15" stroke="rgba(0, 255, 0, 0.8)" stroke-width="2" />
                <line x1="20" y1="35" x2="20" y2="25" stroke="rgba(0, 255, 0, 0.8)" stroke-width="2" />
                <line x1="5" y1="20" x2="15" y2="20" stroke="rgba(0, 255, 0, 0.8)" stroke-width="2" />
                <line x1="35" y1="20" x2="25" y2="20" stroke="rgba(0, 255, 0, 0.8)" stroke-width="2" />
            </svg>
        `;
        document.body.appendChild(crosshair);
    }
}
