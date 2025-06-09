import { ResizableContainer } from './resizable-container.js'

export class MessageBox extends PIXI.Container {
    constructor(width, height) {
        super();

        this.width = width;
        this.height = height;

        // Background
        this.background = new PIXI.Graphics()
            .roundRect(0, 0, width, height, 16)
            .fill({color: 0x000000, alpha: 0.7});
        this.addChild(this.background);

        // Speaker text
        this.speakerText = new PIXI.Text('', { fontSize: 22, fill: 0xffffaa, fontWeight: 'bold' });
        this.speakerText.position.set(20, 10);
        this.addChild(this.speakerText);

        // Message text
        this.messageText = new PIXI.Text('', {
            fontSize: 18,
            fill: 0xffffff,
            wordWrap: true,
            wordWrapWidth: width - 40,
        });
        this.messageText.position.set(20, 45);
        this.addChild(this.messageText);

        // Container for choice buttons
        this.choiceButtons = new ResizableContainer(10, width - 40);
        this.choiceButtons.position.set(20, height - 70);
        this.addChild(this.choiceButtons);

        this.isTyping = false;
        this.currentText = '';
        this.typingSpeed = 20;

        this.onChoiceSelected = null;
    }

    resize(width, height) {
        this.background.clear();
        this.messageText.style.wordWrapWidth = width - 40;
        this.choiceButtons.resize(width - 40);

        width = Math.max(this.width, width);
        height = Math.max(this.height, height);

        this.background
            .roundRect(0, 0, width, height, 16)
            .fill({color: 0x000000, alpha: 0.7});
    }

    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }

    showMessage(speaker, message, choices = [], onChoiceSelected = null) {
        this.speakerText.text = speaker;
        this.messageText.text = '';
        this.currentText = message;
        this.isTyping = true;
        this.charIndex = 0;
        this.onChoiceSelected = onChoiceSelected;
    
        this.choiceButtons.removeChildren();

        choices.forEach((choice, i) => {
            const btn = this.createChoiceButton(choice.text, i);
            btn.on('pointerdown', () => this.selectChoice(i));
            this.choiceButtons.addChild(btn);
        });

        this.choiceButtons.updateChildren();

        this.typeNextChar();
    }

    typeNextChar() {
        if (!this.isTyping) return;
        if (this.charIndex >= this.currentText.length) {
            this.isTyping = false;
            return;
        }
        this.messageText.text += this.currentText[this.charIndex++];
        setTimeout(() => this.typeNextChar(), this.typingSpeed);
    }

    createChoiceButton(text, index) {
        const btn = new PIXI.Container();
        btn.interactive = true;
        btn.buttonMode = true;
    
        const paddingX = 15;
        const paddingY = 6;
    
        const label = new PIXI.Text(text, { fontSize: 16, fill: 0xffffff });
        const btnWidth = label.width + paddingX * 2;
        const btnHeight = label.height + paddingY * 2;
    
        const bg = new PIXI.Graphics()
            .beginFill(0x333333)
            .drawRoundedRect(0, 0, btnWidth, btnHeight, 8)
            .endFill();
        btn.addChild(bg);
    
        label.position.set(paddingX, paddingY);
        btn.addChild(label);
    
        btn.width = btnWidth;
        btn.height = btnHeight;
    
        btn.on('pointerover', () => bg.tint = 0x555555);
        btn.on('pointerout', () => bg.tint = 0xffffff);
    
        return btn;
    }

    selectChoice(index) {
        if (this.isTyping) {
            this.isTyping = false;
            this.messageText.text = this.currentText;
            return;
        }
        this.visible = false;
        if (this.onChoiceSelected) this.onChoiceSelected(index);
    }
}
