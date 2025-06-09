const { Engine, Collision, Runner, Bodies, Body, Composite, Events, Common } = Matter;
import { Level } from './classes/level.js';
import { Player } from './classes/player.js';

// Create engine and world (physics)
const PHYSICS_RATE = 1000 / 60;
const engine = Engine.create({ gravity: { x: 0, y: 0 } });
const world = engine.world;

// Create player
const player = new Player(world);

let cameraContainer = null;
let fogOverlay = null;
let cameraPos = { x: player.position.x, y: player.position.y };

// Create PIXI app (rendering)
const app = new PIXI.Application();

// Physics loop
setInterval(() => {
    // Update player
    player.physicsUpdate();
    // Update physics
    Engine.update(engine, PHYSICS_RATE);
}, PHYSICS_RATE);

let currentLevel = null;

app.init({
    resizeTo: window,
    backgroundColor: 0x222222,
    antialias: true
}).then(() => {
    document.body.appendChild(app.canvas);
    cameraContainer = new PIXI.Container();
    app.stage.addChild(cameraContainer);

    cameraContainer.addChild(player.graphic);

    const fogTexture = createFogWithHole(600);
    fogOverlay = new PIXI.Sprite(fogTexture);
    fogOverlay.anchor.set(0.5);
    fogOverlay.zIndex = 100;

    cameraContainer.addChild(fogOverlay);

    // main game loop
    app.ticker.add(() => {
        const cameraLerp = 0.2 / app.ticker.deltaMS;

        // Lerp position
        player.renderUpdate(app.ticker.deltaMS);

        fogOverlay.position.set(player.graphicPosition.x, player.graphicPosition.y);

        // camera smoothing
        cameraPos.x = lerp(cameraPos.x, player.graphicPosition.x, cameraLerp)
        cameraPos.y = lerp(cameraPos.y, player.graphicPosition.y, cameraLerp)

        cameraContainer.position.set(app.renderer.width / 2 - cameraPos.x, app.renderer.height / 2 - cameraPos.y);

        // update level
        if (currentLevel) {
            currentLevel.update();
        }
    });

    switchLevel('lineland');
});


let sphere = null;
let sphereBody = null;

async function sphereSpawn(doAnim = true) {
    sphere = new PIXI.Graphics()
        .circle(0, 0, 1)
        .fill(0xFFFFFF, 0)
        .stroke({ width: 4, color: 0xFFFFFF });
    sphereBody = Bodies.circle(-140, 0, 30, {
        isStatic: true,
        friction: 0,
        restitution: 0
    })
    Body.setPosition(sphereBody, { x: -140, y: 0 });
    Composite.add(world, sphereBody);
    cameraContainer.addChild(sphere);
    if (doAnim) {
        for (let i = 0; i < 120; i++) {
            await new Promise(resolve => setTimeout(resolve, 10));
            sphere.clear().circle(0, 0, i / 4).fill(0xFFFFFF, 0).stroke({ width: 4, color: 0xFFFFFF });
        }
    }
    app.ticker.add(() => {
        const sphereLerp = 0.5 / app.ticker.deltaMS;
        sphere.position.set(
            lerp(sphere.position.x, sphereBody.position.x, sphereLerp),
            lerp(sphere.position.y, sphereBody.position.y, sphereLerp)
        );
    })
}

async function sphereDisappear() {
    for (let i = 120; i >= 0; i--) {
        await new Promise(resolve => setTimeout(resolve, 10));
        sphere.clear().circle(0, 0, i / 4).fill(0xFFFFFF, 0).stroke({ width: 4, color: 0xFFFFFF });
    }
    Composite.remove(world, sphereBody);
}

async function sphereAppear() {
    Composite.add(world, sphereBody);
    cameraContainer.addChild(sphere);
    for (let i = 0; i < 120; i++) {
        await new Promise(resolve => setTimeout(resolve, 10));
        sphere.clear().circle(0, 0, i / 4).fill(0xFFFFFF, 0).stroke({ width: 4, color: 0xFFFFFF });
    }
}

async function switchLevel(levelName) {

    if (currentLevel) {
        currentLevel.destroy();
    }

    const response = await fetch(`./levels/${levelName}.json`);
    const data = await response.json();
    currentLevel = new Level(app, cameraContainer, engine, data, switchLevel);
    if (data.playerSpawn) {
        Body.setPosition(player.body, data.playerSpawn);
        player.graphic.position.set(data.playerSpawn.x, data.playerSpawn.y);
        cameraPos = { x: player.graphicPosition.x, y: player.graphicPosition.y };
    }

    if (data.canRotate === false) {
        player.canRotate = false;
        player.body.angle = 0;
        player.graphic.rotation = 0;
    } else {
        player.canRotate = true;
    }

    if (levelName === 'lineland') {
        currentLevel.dialogueManager.registerCallback('attack', async () => {
            let colliders = currentLevel.mapObjects.filter(obj => obj.id && (obj.id === "monarch" || obj.id.includes("guard")));
            let interv = setInterval(() => {
                colliders.forEach(async (col) => {
                    if (col.id === "monarch") {
                        Body.setPosition(col.body, { x: col.body.position.x + 1, y: col.body.position.y });
                    }
                    if (col.id.includes("guard")) {
                        const dir = col.body.position.x > 0 ? -1 : 1;
                        Body.setPosition(col.body, { x: col.body.position.x + dir, y: col.body.position.y });
                    }
                    if (Collision.collides(player.body, col.body)) {
                        clearInterval(interv);
                        const fullscreenQuad = new PIXI.Graphics()
                            .rect(0, 0, app.screen.width, app.screen.height)
                            .fill(0x000000, 1);
                        app.stage.addChild(fullscreenQuad);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        switchLevel('flatland');
                        await new Promise(resolve => setTimeout(resolve, 250))
                        app.stage.removeChild(fullscreenQuad);
                        fullscreenQuad.destroy();
                    }
                });
            }, 16);
            await until(() => !interv);
        });
    }

    if (levelName === 'flatland2') {
        player.body.isSensor = false;
        player.graphic.clear().rect(-20, -20, 40, 40).fill(0xFFFFFF, 0).stroke({ width: 4, color: 0xFFFFFF });
        player.speed = 0.005;
    }

    if (levelName == 'flatland3') {
        const grandson = new PIXI.Graphics()
            .regularPoly(0, 0, 30, 6)
            .fill(0xFFFFFF, 0)
            .stroke({ width: 4, color: 0xFFFFFF });
        grandson.position.set(-700, 80);
        const grandsonBody = Bodies.polygon(-700, 80, 6, 30, {
            friction: 0,
            restitution: 0,
            isStatic: true,
        });

        Composite.add(world, grandsonBody);
        cameraContainer.addChild(grandson);
        currentLevel.dialogueManager.registerCallback('callgrandson', async () => {
            let x = -1000;
            while (x < -100) {
                await new Promise(resolve => setTimeout(resolve, 10));
                x += 5;
                Body.setPosition(grandsonBody, { x, y: grandsonBody.position.y });
                grandson.position.x = x;
            }
        });

        currentLevel.dialogueManager.registerCallback('leave', async () => {
            let x = grandson.position.x;
            while (x > -700) {
                await new Promise(resolve => setTimeout(resolve, 10));
                x -= 5;
                Body.setPosition(grandsonBody, { x, y: grandsonBody.position.y });
                grandson.position.x = x;
            }
            Composite.remove(world, grandsonBody);
            cameraContainer.removeChild(grandson);
            grandson.destroy();
        });
    }

    if (levelName === 'pointland') {
        if (!sphere) {
            await sphereSpawn(false);
        }
        await sphereAppear();

        currentLevel.dialogueManager.registerCallback('dreamLeave', sphereDisappear);
    }

    if (levelName === 'flatland') {
        const grandson = new PIXI.Graphics()
            .regularPoly(0, 0, 30, 6)
            .fill(0xFFFFFF, 0)
            .stroke({ width: 4, color: 0xFFFFFF });
        grandson.position.set(-700, 80);
        const grandsonBody = Bodies.polygon(-700, 80, 6, 30, {
            friction: 0,
            restitution: 0,
            isStatic: true,
        });

        Composite.add(world, grandsonBody);
        cameraContainer.addChild(grandson);
        currentLevel.dialogueManager.registerCallback('sphere2', sphereSpawn);
        currentLevel.dialogueManager.registerCallback('grandson one', async () => {
            let x = -1000;
            while (x < -100) {
                await new Promise(resolve => setTimeout(resolve, 10));
                x += 5;
                Body.setPosition(grandsonBody, { x, y: grandsonBody.position.y });
                grandson.position.x = x;
            }
        });

        currentLevel.dialogueManager.registerCallback("sphere's response", async () => {
            let x = grandson.position.x;
            while (x > -700) {
                await new Promise(resolve => setTimeout(resolve, 10));
                x -= 5;
                Body.setPosition(grandsonBody, { x, y: grandsonBody.position.y });
                grandson.position.x = x;
            }
            Composite.remove(world, grandsonBody);
            cameraContainer.removeChild(grandson);
            grandson.destroy();
        });

        currentLevel.dialogueManager.registerCallback("analogy2", sphereDisappear)
        currentLevel.dialogueManager.registerCallback("attack", sphereAppear)
        currentLevel.dialogueManager.registerCallback("disappear", sphereDisappear)
    }

    if (levelName === 'spaceland') {
        const radialGradient = new PIXI.FillGradient({
            type: 'radial',
            center: { x: 0.5, y: 0.5 },
            innerRadius: 0,
            outerCenter: { x: 0.5, y: 0.5 },
            outerRadius: 0.5,
            colorStops: [
                { offset: 0, color: 'white' }, // Center color
                { offset: 1, color: 'gray' }   // Edge color
            ],
            textureSpace: 'local'
        });
        if (!sphere) {
            await sphereSpawn(false);
        }
        sphere.clear().circle(0, 0, 30).fill(radialGradient);
        const linearGradient = new PIXI.FillGradient({
            type: 'linear',
            gradientSpace: 'local',
            start: { x: 1, y: 0 },
            end: { x: 0, y: 0 },
            center: { x: 0.5, y: 0.5 },
            colorStops: [
                { offset: 0, color: 'white' },
                { offset: 1, color: 'gray' }
            ],
            textureSpace: 'local'
        });
        sphere.zIndex = 100;
        player.graphic.zIndex = 100;
        player.graphic.clear().rect(-20, -20, 40, 40).fill(linearGradient);
        player.speed = 0;
        player.canRotate = false;
        player.body.isSensor = true;

        const flatlandWorld = await fetch("levels/flatland.json").then(res => res.json())
        currentLevel.loadObjects(flatlandWorld.objects);
        setAllAlpha(currentLevel.mapContainer, .5);
        currentLevel.mapContainer.scale.set(0.1);

        currentLevel.dialogueManager.registerCallback('monologue', async () => {
            let y = 0;
            let scale = 0.12;
            while (y > -11000 * scale) {
                await new Promise(resolve => setTimeout(resolve, 10));
                y -= 100 * scale;
                scale += 0.001;
                currentLevel.mapContainer.scale.set(scale);
                Body.setPosition(sphereBody, { x: sphereBody.position.x, y: y });
                Body.setPosition(player.body, { x: 70, y: y + 70 });
            }
        });

        currentLevel.dialogueManager.registerCallback('sphereEnters', async () => {
            let scale = currentLevel.mapContainer.scale.x;
            while (scale < 0.7) {
                await new Promise(resolve => setTimeout(resolve, 10));
                let y = -11000 * scale;
                scale += 0.01;
                currentLevel.mapContainer.scale.set(scale);
                Body.setPosition(sphereBody, { x: sphereBody.position.x, y });
                Body.setPosition(player.body, { x: 70, y });
                sphere.position.set(sphereBody.position.x, sphereBody.position.y);
                player.graphic.position.set(player.body.position.x, player.body.position.y);
                cameraPos = { x: player.graphicPosition.x, y: player.graphicPosition.y };
            }
            let x = sphereBody.position.x;
            let y = sphereBody.position.y;
            let tint = 255;
            let targetY = -11000 * scale;
            while (Math.round(x) != 0 && Math.round(y) != targetY) {
                if (Math.round(x) != 0) {
                    x = lerp(x, 0, 0.05);
                }
                if (Math.round(y) != targetY) {
                    y = lerp(y, targetY, 0.05);
                }
                tint = lerp(tint, 150, 0.05);
                Body.setPosition(sphereBody, { x, y });
                sphere.tint = 'rgb(' + tint + ',' + tint + ',' + tint + ')';
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        });

        currentLevel.dialogueManager.registerCallback('guardsAttack', async () => {
            let guard = currentLevel.mapObjects.find(obj => obj.id === "guard");
            let guardX = guard.body.position.x;
            let guardY = guard.body.position.y;
            let tint = 150;
            let scale = currentLevel.mapContainer.scale.x;
            let alpha = 0.5;
            while (alpha > 0 && tint < 254) {
                if (guardX < sphereBody.position.x) {
                    guardX = lerp(guardX, sphereBody.position.x, 0.05);
                }
                if (guardY < sphereBody.position.y) {
                    guardY = lerp(guardY, sphereBody.position.y, 0.05);
                }
                Body.setPosition(guard.body, { x: guardX, y: guardY });
                if (tint < 255) {
                    tint = lerp(tint, 255, 0.05);
                    sphere.tint = 'rgb(' + tint + ',' + tint + ',' + tint + ')';
                }
                if (scale > 0.1) {
                    scale = lerp(scale, 0.1, 0.05);
                    currentLevel.mapContainer.scale.set(scale);
                    Body.setPosition(sphereBody, { x: sphereBody.position.x, y: -11000 * scale });
                    Body.setPosition(player.body, { x: 70, y: -11000 * scale + 70 });
                    sphere.position.set(sphereBody.position.x, sphereBody.position.y);
                    player.graphic.position.set(player.body.position.x, player.body.position.y);
                    cameraPos = { x: player.graphicPosition.x, y: player.graphicPosition.y };
                }
                if (alpha > 0) {
                    alpha = lerp(alpha, 0, 0.05);
                    setAllAlpha(currentLevel.mapContainer, alpha);
                }
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            Body.setPosition(sphereBody, { x: -150, y: sphereBody.position.y });
            sphere.tint = 'rgb(255,255,255)';
        });

        let cube = null;
        currentLevel.dialogueManager.registerCallback('showSolids', async () => {

            Body.setPosition(sphereBody, { x: -150, y: 0 });
            sphere.position.set(sphereBody.position.x, sphereBody.position.y);
            Body.setPosition(player.body, { x: 150, y: 0 });
            player.graphic.position.set(player.body.position.x, player.body.position.y);
            cameraPos = { x: player.graphicPosition.x, y: player.graphicPosition.y };

            cube = createIsometricCube(50, 0xFFFFFF);
            cube.scale.set(0);

            cameraContainer.addChild(cube);
            cube.position.set(0, 0);
            while (cube.scale.x < 1) {
                await new Promise(resolve => setTimeout(resolve, 10));
                cube.scale.set(cube.scale.x + 0.01);
            }
        });

        currentLevel.dialogueManager.registerCallback('seeInside', async () => {
            Body.setPosition(player.body, { x: 30, y: 0 });
            await new Promise(resolve => setTimeout(resolve, 1000));
            Body.setPosition(player.body, { x: 150, y: 0 });
            await new Promise(resolve => setTimeout(resolve, 1000));
        });

        currentLevel.dialogueManager.registerCallback('whyAsk', async () => {
            while (cube.scale.x > 0) {
                await new Promise(resolve => setTimeout(resolve, 10));
                cube.scale.set(cube.scale.x - 0.01);
            }
            cameraContainer.removeChild(cube);
            cube.destroy();
        })

        currentLevel.dialogueManager.registerCallback('sphereLeaves', sphereDisappear);
        currentLevel.dialogueManager.registerCallback('sphereLeavesAngry', sphereDisappear);
    }
}

function createIsometricCube(size, color) {
    const cube = new PIXI.Container();
    const halfSize = size / 2;

    // Front face
    const front = new PIXI.Graphics()
        .beginFill(color)
        .drawRect(0, 0, size, size)
        .endFill();

    // Top face (parallelogram)
    const top = new PIXI.Graphics()
        .beginFill(color * 0.8) // Slightly darker
        .moveTo(0, 0)
        .lineTo(halfSize, -halfSize)
        .lineTo(size + halfSize, -halfSize)
        .lineTo(size, 0)
        .closePath()
        .endFill();

    // Side face (parallelogram)
    const side = new PIXI.Graphics()
        .beginFill(color * 0.6) // Even darker
        .moveTo(size, 0)
        .lineTo(size + halfSize, -halfSize)
        .lineTo(size + halfSize, size - halfSize)
        .lineTo(size, size)
        .closePath()
        .endFill();

    cube.addChild(front, top, side);
    return cube;
}

function createFogWithHole(radius = 600, size = 4096) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    ctx.fillRect(0, 0, size, size);

    const gradient = ctx.createRadialGradient(
        size / 2, size / 2, 0,
        size / 2, size / 2, radius
    );
    gradient.addColorStop(0, 'rgba(0,0,0,1)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    return PIXI.Texture.from(canvas);
}

function lerp(a, b, alpha) {
    return a + (b - a) * alpha;
}

function until(conditionFunction) {

    const poll = resolve => {
        if (conditionFunction()) resolve();
        else setTimeout(_ => poll(resolve), 400);
    }

    return new Promise(poll);
}

function setAllAlpha(container, alphaValue) {
    container.children.forEach(child => {
        child.alpha = alphaValue;
        if (child.children && child.children.length > 0) {
            setAllAlpha(child, alphaValue);
        }
    });
}