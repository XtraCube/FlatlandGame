export class ResizableContainer extends PIXI.Container {
    constructor(spacing, maxWidth) {
        super();
        this.spacing = spacing;
        this.maxWidth = maxWidth;
    }

    resize(maxWidth) {
        this.maxWidth = maxWidth;
        this.updateChildren();
    }

    updateChildren() {
        let xCursor = 0;
        let yCursor = 0;

        this.children.forEach(child => {
            if (xCursor + child.width > this.maxWidth) {
                xCursor = 0;
                yCursor += child.height + this.spacing;
            }
            child.position.set(xCursor, yCursor);
            xCursor += child.width + this.spacing;
        })

        this.updateCacheTexture();        
    }
}