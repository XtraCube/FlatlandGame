const { Bodies, Body, Composite } = Matter

function lerp(a, b, alpha) {
    return a + (b - a) * alpha;
}

export class Player {

    constructor(world) {
        this.world = world;
        this.body = Bodies.rectangle(0, 0, 40, 40, {
            inertia: Infinity,
            frictionAir: 0.1,
            friction: 0,
        });

        this.graphic = new PIXI.Graphics()
            .rect(-20, -20, 40, 40)
            .fill(0x000000, 0)
            .stroke({ width: 4, color: 0xFFFFFF });

        this.speed = 0.005;
        this.keys = {};
        this.mouse = { x: 0, y: 0 };
        window.addEventListener('keydown', e => this.keys[e.key.toLowerCase()] = true);
        window.addEventListener('keyup', e => this.keys[e.key.toLowerCase()] = false);
        window.addEventListener('mousemove', e => this.mouse = { x: e.clientX, y: e.clientY });

        this.canRotate = true;

        Composite.add(world, this.body);
    }

    get position() {
        return this.body.position;
    }

    get graphicPosition() {
        return this.graphic.position;
    }

    renderUpdate(deltaMs) {
        const lerpAmount = 0.75 / deltaMs;

        this.graphic.position.x = lerp(this.graphic.position.x, this.body.position.x, lerpAmount);
        this.graphic.position.y = lerp(this.graphic.position.y, this.body.position.y, lerpAmount);
    }

    physicsUpdate() {
        if (this.keys['w'] || this.keys['arrowup']) Body.applyForce(this.body, this.body.position, { x: 0, y: -this.speed });
        if (this.keys['a'] || this.keys['arrowleft']) Body.applyForce(this.body, this.body.position, { x: -this.speed, y: 0 });
        if (this.keys['s'] || this.keys['arrowdown']) Body.applyForce(this.body, this.body.position, { x: 0, y: this.speed });
        if (this.keys['d'] || this.keys['arrowright']) Body.applyForce(this.body, this.body.position, { x: this.speed, y: 0 });

        if (!this.canRotate) {
            this.body.angle = 0;
            this.graphic.rotation = 0;
            return;
        }
        
        const angle = Math.atan2(this.mouse.y - window.innerHeight / 2, this.mouse.x - window.innerWidth / 2);
        this.body.angle = angle;
        this.graphic.rotation = this.body.angle;
    }
}