const { Body, Bodies, Composite, Events } = Matter
import { DialogueManager } from './dialogue-manager.js'

function createPentagonHouseWithHoles(x, y, radius, wallWidth, westHoleLength, eastHoleLength) {
  // Generate base pentagon points (clockwise from bottom)
  const points = [];
  const angleOffset = -Math.PI / 2; // Start at bottom
  for (let i = 0; i < 5; i++) {
    const angle = angleOffset + (i * 2 * Math.PI / 5);
    points.push({
      x: x + radius * Math.cos(angle),
      y: y + radius * Math.sin(angle)
    });
  }

  // Calculate wall segments with holes
  const walls = [];
  const wallPairs = [
    { index1: 1, index2: 2, holeLength: eastHoleLength },
    { index1: 4, index2: 3, holeLength: westHoleLength }
  ];

  wallPairs.forEach(pair => {
    const start = points[pair.index1];
    const end = points[pair.index2];
    const length = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));

    // Calculate hole positions (centered)
    const holeStart = (length - pair.holeLength) / 2;
    const holeEnd = holeStart + pair.holeLength;

    // Create wall segments
    if (holeStart > 0) {
      walls.push(createWallSegment(
        start.x, start.y,
        start.x + (end.x - start.x) * (holeStart / length),
        start.y + (end.y - start.y) * (holeStart / length),
        wallWidth
      ));
    }

    if (holeEnd < length) {
      walls.push(createWallSegment(
        start.x + (end.x - start.x) * (holeEnd / length),
        start.y + (end.y - start.y) * (holeEnd / length),
        end.x, end.y,
        wallWidth
      ));
    }
  });

  // Add remaining walls (without holes)
  const solidWalls = [
    [0, 1],
    [2, 3],
    [4, 0]
  ];

  solidWalls.forEach(indices => {
    walls.push(createWallSegment(
      points[indices[0]].x, points[indices[0]].y,
      points[indices[1]].x, points[indices[1]].y,
      wallWidth
    ));
  });

  return walls;
}

function createWallSegment(x1, y1, x2, y2, width) {
  const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  const angle = Math.atan2(y2 - y1, x2 - x1);

  return {
    x: (x1 + x2) / 2,
    y: (y1 + y2) / 2,
    length: length,
    width: width,
    angle: angle
  };
}

function drawHouseWalls(graphics, walls, color) {

  graphics.lineStyle(1, 0x000000); // Black border
  graphics.beginFill(color); // Copper color

  walls.forEach(wall => {
    // Calculate the corners of the wall rectangle
    const halfLength = wall.length / 2;
    const halfWidth = wall.width / 2;

    // Calculate the four corners
    const cos = Math.cos(wall.angle);
    const sin = Math.sin(wall.angle);

    const corners = [
      {
        x: wall.x - halfLength * cos - halfWidth * sin,
        y: wall.y - halfLength * sin + halfWidth * cos
      },
      {
        x: wall.x + halfLength * cos - halfWidth * sin,
        y: wall.y + halfLength * sin + halfWidth * cos
      },
      {
        x: wall.x + halfLength * cos + halfWidth * sin,
        y: wall.y + halfLength * sin - halfWidth * cos
      },
      {
        x: wall.x - halfLength * cos + halfWidth * sin,
        y: wall.y - halfLength * sin - halfWidth * cos
      }
    ];

    // Draw the wall segment
    graphics.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
      graphics.lineTo(corners[i].x, corners[i].y);
    }
    graphics.lineTo(corners[0].x, corners[0].y);
  });

  graphics.endFill();

  // Optional: Draw the outline of the entire house
  const outline = new PIXI.Graphics();
  outline.lineStyle(2, 0x000000);

  // Find the first point (bottom point)
  const firstWall = walls.find(w => w.x1 === walls[0].x1 && w.y1 === walls[0].y1);
  outline.moveTo(firstWall.x1, firstWall.y1);

  // Connect all wall segments
  let currentX = firstWall.x2;
  let currentY = firstWall.y2;
  outline.lineTo(currentX, currentY);

  let remainingWalls = walls.filter(w => !(w.x1 === firstWall.x1 && w.y1 === firstWall.y1));

  while (remainingWalls.length > 0) {
    const nextWall = remainingWalls.find(w =>
      Math.abs(w.x1 - currentX) < 0.1 && Math.abs(w.y1 - currentY) < 0.1
    );

    if (nextWall) {
      currentX = nextWall.x2;
      currentY = nextWall.y2;
      outline.lineTo(currentX, currentY);
      remainingWalls = remainingWalls.filter(w => !(w.x1 === nextWall.x1 && w.y1 === nextWall.y1));
    } else {
      break; // No connecting wall found
    }
  }
}


export class Level {
  constructor(app, container, engine, levelData, levelChange = (level) => { }) {
    this.app = app;
    this.container = container;
    this.engine = engine;
    this.levelData = levelData;
    this.levelChange = levelChange;

    this.dialogueManager = null;
    this.mapContainer = new PIXI.Container();
    this.mapObjects = [];
    this.mapComposite = Composite.create();
    Composite.add(this.engine.world, this.mapComposite);

    this.init();
  }

  async init() {
    this.dialogueManager = new DialogueManager(this.app, this.levelData.dialogueTree, this.handleChoice.bind(this));

    await this.loadMap();

    this.container.addChild(this.mapContainer);
    this.app.stage.addChild(this.dialogueManager.messageBox);
    this.dialogueManager.startDialogue('root');
    this.dialogueManager.reposition();
  }

  handleChoice(choice) {
    if (choice.nextId.startsWith('level:')) {
      const levelName = choice.nextId.split(':')[1];
      this.levelChange(levelName);
    }
  }

  async loadMap() {
    try {
      await this.loadObjects(this.levelData.objects);      
    } catch (err) {
      console.error('Error loading map:', err);
    }
  }

  async update() {
    for (const obj of this.mapObjects) {
      if (obj.type === 'house') {
        obj.graphic.position.set(0, 0);
        continue;
      }
      obj.graphic.position.set(obj.body.position.x, obj.body.position.y);
    }
  }

  destroy() {
    this.dialogueManager.destroy();
    this.container.removeChild(this.mapContainer);
    this.container.removeChild(this.dialogueManager.messageBox);
    this.mapContainer.destroy();
    Composite.remove(this.engine.world, this.mapComposite);
  }

  async loadObjects(objects) {
    for (const obj of objects) {
      let pixiGraphic = new PIXI.Graphics();
      let matterBody = null;
      const bodyOptions = {
        isStatic: true,
        friction: obj.friction || 0,
        restitution: 0,
        isSensor: obj.sensor || false,
        angle: obj.angle || 0
      };

      switch (obj.type) {
        case 'house':
          const walls = createPentagonHouseWithHoles(obj.x, obj.y, obj.radius, obj.wallWidth, obj.westHoleLength, obj.eastHoleLength);
          const bodies = [];
          for (const wall of walls) {
            const body = Bodies.rectangle(wall.x, wall.y, wall.length, wall.width, {
              ...bodyOptions,
              angle: wall.angle
            });
            bodies.push(body);
          }
          matterBody = Body.create(bodyOptions);
          Body.setParts(matterBody, bodies);
          Body.setCentre(matterBody, { x: obj.x, y: obj.y }, false);
          drawHouseWalls(pixiGraphic, walls, obj.strokeColor);
          break;

        case 'verts':
          matterBody = Bodies.fromVertices(obj.x, obj.y, obj.verts, bodyOptions, false);

          const localVertices = matterBody.parts.map(part => part.vertices.map(vertex => [vertex.x, vertex.y])).flat()

          pixiGraphic = pixiGraphic.poly(localVertices);
          break;

        case 'polygon':
          const angleOffset = Math.PI / 2; // matter.js uses a different starting angle
          pixiGraphic = pixiGraphic.regularPoly(0, 0, obj.radius, obj.sides);
          bodyOptions.angle += angleOffset;
          matterBody = Bodies.polygon(obj.x, obj.y, obj.sides, obj.radius, bodyOptions);
          break;

        case 'circle':
          pixiGraphic = pixiGraphic.circle(0, 0, obj.radius);
          matterBody = Bodies.circle(obj.x, obj.y, obj.radius, bodyOptions);
          break;

        case 'rect':
          pixiGraphic = pixiGraphic.rect(0, 0, obj.width, obj.height);
          pixiGraphic.pivot.set(obj.width / 2, obj.height / 2);
          matterBody = Bodies.rectangle(obj.x, obj.y, obj.width, obj.height, bodyOptions);
          break;
        
        case 'triangle':
          const base = obj.base;
          const height = obj.height;

          const vertices = [
            { x: -base / 2, y: 0 },
            { x: base / 2, y: 0 },
            { x: 0, y: -height }
          ];

          matterBody = Bodies.fromVertices(obj.x, obj.y, vertices, bodyOptions, false);                pixiGraphic = pixiGraphic.poly(vertices);
          break;
      }

      pixiGraphic = pixiGraphic
        .fill(obj.fillColor)
        .stroke({ width: obj.strokeWidth, color: obj.strokeColor });
      pixiGraphic.rotation = obj.angle || 0;

      if (obj.trigger) {
        Events.on(this.engine, 'collisionStart', (event) => {
          const pairs = event.pairs;
          for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];
            if (pair.bodyA === matterBody || pair.bodyB === matterBody) {
              this.dialogueManager.startDialogue(obj.trigger);
            }
          }
        });
      }

      Composite.add(this.mapComposite, matterBody);
      this.mapContainer.addChild(pixiGraphic);
      this.mapObjects.push({ type: obj.type, id: obj.id, graphic: pixiGraphic, body: matterBody });
    }
  }
}
