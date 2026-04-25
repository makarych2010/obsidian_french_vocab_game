import { App, Plugin, PluginSettingTab, Setting, ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import { VocabularyManager, VocabularyItem } from './VocabularyManager';
import { SRSEngine, SRSData } from './SRSEngine';

interface FrenchVocabGameSettings {
	vocabFilePath: string;
	srsData: Record<string, SRSData>;
}

const DEFAULT_SETTINGS: FrenchVocabGameSettings = {
	vocabFilePath: 'Vocabulaire.md',
	srsData: {}
}

export const VIEW_TYPE_HANGMAN = "hangman-view";

class HangmanView extends ItemView {
	plugin: FrenchVocabGamePlugin;
	currentWord: VocabularyItem | null = null;
	guessedLetters: Set<string> = new Set();
	mistakes: number = 0;
	maxMistakes: number = 6;
	direction: 'ru->fr' | 'fr->ru' = 'ru->fr';
	
	container: HTMLElement;
	wordDisplay: HTMLElement;
	promptDisplay: HTMLElement;
	keyboardContainer: HTMLElement;
	statusDisplay: HTMLElement;
	hangmanDrawing: HTMLElement;
	directionDisplay: HTMLElement;

	constructor(leaf: WorkspaceLeaf, plugin: FrenchVocabGamePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return VIEW_TYPE_HANGMAN;
	}

	getDisplayText() {
		return "French Hangman";
	}

	async onOpen() {
		this.container = this.contentEl;
		this.container.empty();
		this.container.addClass('french-hangman-container');

		this.container.createEl("h2", { text: "Hangman: Apprenons le français!" });
		
		this.hangmanDrawing = this.container.createEl("div", { cls: "hangman-drawing" });
		this.promptDisplay = this.container.createEl("div", { cls: "hangman-prompt" });
		this.wordDisplay = this.container.createEl("div", { cls: "hangman-word" });
		this.statusDisplay = this.container.createEl("div", { cls: "hangman-status" });
		this.keyboardContainer = this.container.createEl("div", { cls: "hangman-keyboard" });

		const controls = this.container.createEl("div", { cls: "hangman-controls" });
		this.directionDisplay = controls.createEl("div", { cls: "hangman-direction" });
		const nextBtn = controls.createEl("button", { text: "Next Word" });
		nextBtn.onclick = () => this.startNewGame();
		const switchBtn = controls.createEl("button", { text: "Switch Direction" });
		switchBtn.onclick = () => this.startNewGame(this.direction === 'ru->fr' ? 'fr->ru' : 'ru->fr');

		// FOOTER
		this.container.createEl("div", { cls: "hangman-footer", text: "Created by Makarych - Source on GitHub" });

		await this.plugin.loadVocabulary();
		this.startNewGame();
	}

	startNewGame(direction?: 'ru->fr' | 'fr->ru') {
		if (direction) {
			this.direction = direction;
		} else {
			this.direction = Math.random() < 0.5 ? 'ru->fr' : 'fr->ru';
		}
		const word = this.plugin.getNextWordToReview();
		if (!word) {
			this.currentWord = null;
			this.guessedLetters.clear();
			this.mistakes = 0;
			this.promptDisplay.setText("No words available. Check your vocabulary file.");
			this.wordDisplay.setText("");
			this.statusDisplay.setText("");
			this.hangmanDrawing.setText("");
			this.keyboardContainer.empty();
			return;
		}

		this.currentWord = word;
		this.guessedLetters.clear();
		this.mistakes = 0;
		this.updateDisplay();
		this.renderKeyboard();
	}

	cleanWordForGame(word: string): string {
		if (this.direction === 'ru->fr') {
			return word.replace(/\([mf]\)/g, '').trim().toLowerCase();
		}
		return word.trim().toLowerCase();
	}

	handleGuess(letter: string) {
		if (!this.currentWord || this.guessedLetters.has(letter) || this.mistakes >= this.maxMistakes || this.isGameWon()) {
			return;
		}

		this.guessedLetters.add(letter);
		const targetWord = this.cleanWordForGame(this.direction === 'ru->fr' ? this.currentWord.french : this.currentWord.russian);
		
		const unaccentedTarget = targetWord.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
		
		if (!targetWord.includes(letter) && !unaccentedTarget.includes(letter)) {
			this.mistakes++;
		}

		this.updateDisplay();
		this.renderKeyboard();
		this.checkGameEnd();
	}

	isGameWon(): boolean {
		if (!this.currentWord) return false;
		const targetWord = this.cleanWordForGame(this.direction === 'ru->fr' ? this.currentWord.french : this.currentWord.russian);
		const letterPattern = this.direction === 'ru->fr' ? /[a-zœæ]/i : /[а-яё]/i;
		for (const char of targetWord) {
			if (char.match(letterPattern)) {
				const unaccentedChar = char.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
				if (!this.guessedLetters.has(char) && !this.guessedLetters.has(unaccentedChar)) {
					return false;
				}
			}
		}
		return true;
	}

	checkGameEnd() {
		if (this.isGameWon()) {
			this.statusDisplay.setText("🎉 Félicitations! You got it right!");
			this.plugin.recordReview(this.currentWord!.id, this.mistakes === 0 ? 5 : (this.mistakes <= 2 ? 4 : 3));
		} else if (this.mistakes >= this.maxMistakes) {
			const answer = this.direction === 'ru->fr' ? this.currentWord?.french : this.currentWord?.russian;
			this.statusDisplay.setText(`❌ Dommage... The word was: ${answer}`);
			this.plugin.recordReview(this.currentWord!.id, 1); // Failed
		}
	}

	updateDisplay() {
		if (!this.currentWord) return;

		const promptText = this.direction === 'ru->fr' ? this.currentWord.russian : this.currentWord.french;
		const targetWord = this.cleanWordForGame(this.direction === 'ru->fr' ? this.currentWord.french : this.currentWord.russian);
		const letterPattern = this.direction === 'ru->fr' ? /[a-zéèêëàâäùûüôöîïçœæ]/i : /[а-яё]/i;

		this.directionDisplay.setText(this.direction === 'ru->fr' ? 'Direction: Russian → French' : 'Direction: French → Russian');
		this.promptDisplay.setText(promptText);
		this.hangmanDrawing.setText(`Mistakes: ${this.mistakes} / ${this.maxMistakes}`);
		let displayText = '';

		for (const char of targetWord) {
			if (char.match(letterPattern)) {
				const unaccentedChar = char.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
				if (this.guessedLetters.has(char) || this.guessedLetters.has(unaccentedChar)) {
					displayText += char + ' ';
				} else {
					displayText += '_ ';
				}
			} else {
				displayText += char + '   '; // spaces, hyphens, etc.
			}
		}

		this.wordDisplay.setText(displayText.trim());
		
		if (this.mistakes < this.maxMistakes && !this.isGameWon()) {
			this.statusDisplay.setText("");
		}
	}

	renderKeyboard() {
		this.keyboardContainer.empty();
		const frenchKeys = "abcdefghijklmnopqrstuvwxyzéèêëàâäùûüôöîïçœæ-".split('');
		const russianKeys = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя-".split('');
		const alphabet = this.direction === 'ru->fr' ? frenchKeys : russianKeys;
		
		for (const letter of alphabet) {
			const btn = this.keyboardContainer.createEl('button', { text: letter });
			if (this.guessedLetters.has(letter)) {
				btn.disabled = true;
				btn.addClass('guessed');
			}
			btn.onclick = () => this.handleGuess(letter);
		}
	}

	async onClose() {
		// Nothing to clean up.
	}
}

export default class FrenchVocabGamePlugin extends Plugin {
	settings: FrenchVocabGameSettings;
	vocabManager: VocabularyManager;

	async onload() {
		await this.loadSettings();

		this.vocabManager = new VocabularyManager(this.app, this.settings.vocabFilePath);

        this.registerView(
            VIEW_TYPE_HANGMAN,
            (leaf) => new HangmanView(leaf, this)
        );

		this.addRibbonIcon('dice', 'Play French Hangman', () => {
			this.activateView();
		});

		this.addCommand({
			id: 'open-french-hangman',
			name: 'Open French Hangman Game',
			callback: () => {
				this.activateView();
			}
		});

		this.addSettingTab(new FrenchVocabGameSettingTab(this.app, this));
	}

	async loadVocabulary() {
		try {
			await this.vocabManager.loadVocabulary();
		} catch (e) {
			new Notice("Failed to load vocabulary. Check the file path in settings.");
		}
	}

	getNextWordToReview(): VocabularyItem | null {
		if (this.vocabManager.items.length === 0) return null;

		const now = Date.now();
		let dueWords: VocabularyItem[] = [];
		let newWords: VocabularyItem[] = [];

		for (const item of this.vocabManager.items) {
			const srs = this.settings.srsData[item.id];
			if (!srs) {
				newWords.push(item);
			} else if (srs.nextReviewDate <= now) {
				dueWords.push(item);
			}
		}

		// Prefer due words, otherwise pick a random new word
		if (dueWords.length > 0) {
			return dueWords[Math.floor(Math.random() * dueWords.length)];
		} else if (newWords.length > 0) {
			return newWords[Math.floor(Math.random() * newWords.length)];
		}

		// If nothing is due, just pick random
		return this.vocabManager.items[Math.floor(Math.random() * this.vocabManager.items.length)];
	}

	async recordReview(wordId: string, quality: number) {
		const currentSrs = this.settings.srsData[wordId];
		const updatedSrs = SRSEngine.processReview(currentSrs, wordId, quality);
		this.settings.srsData[wordId] = updatedSrs;
		await this.saveSettings();
	}

    async activateView() {
        const { workspace } = this.app;
        
        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_HANGMAN);

        if (leaves.length > 0) {
            leaf = leaves[0];
        } else {
            leaf = workspace.getLeaf(true);
            await leaf.setViewState({ type: VIEW_TYPE_HANGMAN, active: true });
        }

        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class FrenchVocabGameSettingTab extends PluginSettingTab {
	plugin: FrenchVocabGamePlugin;

	constructor(app: App, plugin: FrenchVocabGamePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Vocabulary File Path')
			.setDesc('Path to the markdown file containing vocabulary (e.g., Vocabulaire.md)')
			.addText(text => text
				.setPlaceholder('Vocabulaire.md')
				.setValue(this.plugin.settings.vocabFilePath)
				.onChange(async (value) => {
					this.plugin.settings.vocabFilePath = value;
					this.plugin.vocabManager.vocabFilePath = value;
					await this.plugin.saveSettings();
					await this.plugin.loadVocabulary();
				}));
	}
}