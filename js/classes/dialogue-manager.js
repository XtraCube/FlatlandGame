import { MessageBox } from './message-box.js';

export class DialogueManager {
  constructor(app, dialogueNodes, onChoice = (choice) => {}) {
    this.app = app;
    this.dialogueNodes = dialogueNodes;
    this.callbacks = {};
    this.onChoice = onChoice;

    this.messageBox = new MessageBox(app.screen.width - 100, 180);
    app.stage.addChild(this.messageBox);
    this.currentNode = null;

    window.addEventListener('resize', () => this.reposition())
    this.reposition();
  }

  startDialogue(nodeId) {
    if (this.currentNode?.id === nodeId) {
      return;
    }

    this.lastNode = this.currentNode;
    this.currentNode = this.dialogueNodes[nodeId];
    this.showNode(this.currentNode);
  }

  registerCallback(nodeId, callback) {
    this.callbacks[nodeId] = callback
  }

  reposition() {
    this.messageBox.setPosition(50, this.app.screen.height - this.messageBox.height - 25);
    this.messageBox.resize(this.app.screen.width - 100, 180);
  }

  async showNode(node) {
    if (!node) {
      this.endDialogue();
    }
    if (this.callbacks[node.id]) {
      await this.callbacks[node.id]();
    }

    this.messageBox.visible = true;
    this.messageBox.showMessage(node.speaker, node.message, node.choices, (choiceIndex) => {
      const choice = node.choices[choiceIndex];
      this.onChoice(choice);

      if (choice.nextId === '{previous}') {
        this.currentNode = this.lastNode;
        this.showNode(this.currentNode);
        return;
      }

      if (!choice || !choice.nextId) {
        this.endDialogue();
        return;
      }

      if (!this.dialogueNodes[choice.nextId]) {
        this.endDialogue();
        return;
      }
      
      this.lastNode = this.currentNode;
      this.currentNode = this.dialogueNodes[choice.nextId];
      this.showNode(this.currentNode);
    });
  }

  endDialogue() {
    this.messageBox.visible = false;
    this.currentNode = null;
  }

  destroy() {
    this.endDialogue();
    this.app.stage.removeChild(this.messageBox);
    this.messageBox.destroy();
  }
}
