import { App, TFile, Notice } from 'obsidian';

export interface VocabularyItem {
	id: string; // unique normalized key from the French word and translation
	french: string;
	russian: string;
	category: string;
}

export class VocabularyManager {
	app: App;
	vocabFilePath: string;
    items: VocabularyItem[] = [];

	constructor(app: App, vocabFilePath: string) {
		this.app = app;
		this.vocabFilePath = vocabFilePath;
	}

	async loadVocabulary(): Promise<VocabularyItem[]> {
		console.log(`Loading vocabulary from: ${this.vocabFilePath}`);
		let file = this.app.vault.getAbstractFileByPath(this.vocabFilePath);
		
		// If not found by exact path, try to find it in the vault by name
		if (!(file instanceof TFile)) {
			console.warn(`Vocabulary file not found at exact path ${this.vocabFilePath}. Searching by name...`);
			const allFiles = this.app.vault.getMarkdownFiles();
			file = allFiles.find(f => f.name === this.vocabFilePath || f.path.endsWith('/' + this.vocabFilePath));
		}

		if (!(file instanceof TFile)) {
			console.error(`Vocabulary file not found at ${this.vocabFilePath}`);
			new Notice(`Vocabulary file not found: ${this.vocabFilePath}`);
			return [];
		}

		console.log(`Reading vocabulary file: ${file.path}`);
		const content = await this.app.vault.read(file);
		this.items = this.parseVocabulary(content);
		console.log(`Parsed ${this.items.length} items from ${file.path}`);
        return this.items;
	}

	private createVocabularyId(french: string, russian: string): string {
		const normalize = (text: string) =>
			text
				.trim()
				.toLowerCase()
				.normalize('NFD')
				.replace(/[\u0300-\u036f]/g, '')
				.replace(/\s+/g, ' ');

		return `${normalize(french)}||${russian.trim()}`;
	}

	private createVocabularyItem(french: string, russian: string, category: string): VocabularyItem {
		return {
			id: this.createVocabularyId(french, russian),
			french,
			russian,
			category,
		};
	}

	private hasCyrillic(text: string): boolean {
		return /[\u0400-\u04FF]/.test(text);
	}

	private inferFrenchRussian(first: string, second: string): { french: string; russian: string } {
		const firstHasCyrillic = this.hasCyrillic(first);
		const secondHasCyrillic = this.hasCyrillic(second);

		if (firstHasCyrillic && !secondHasCyrillic) {
			return { french: second, russian: first };
		}

		if (secondHasCyrillic && !firstHasCyrillic) {
			return { french: first, russian: second };
		}

		return { french: first, russian: second };
	}

	private parseVocabulary(content: string): VocabularyItem[] {
		const items: VocabularyItem[] = [];
		const lines = content.split('\n');
		let currentCategory = 'Uncategorized';

		let tableHeaders: string[] = [];
		let isInsideTable = false;

		for (const line of lines) {
			const trimmedLine = line.trim();

			if (trimmedLine.startsWith('# ')) {
				currentCategory = trimmedLine.substring(2).trim();
				continue;
			}

			if (trimmedLine.startsWith('## ')) {
				currentCategory = trimmedLine.substring(3).trim();
				continue;
			}

			if (!trimmedLine) {
				isInsideTable = false;
				tableHeaders = [];
				continue;
			}

			if (trimmedLine.startsWith('|')) {
				const cells = trimmedLine.split('|').map(c => c.trim()).slice(1, -1);

				if (!isInsideTable) {
					if (trimmedLine.includes('---')) {
						continue;
					}
					tableHeaders = cells;
					isInsideTable = true;
					continue;
				}

				if (trimmedLine.includes('---')) {
					continue;
				}

				const frenchIdx = tableHeaders.findIndex(h =>
					h.toLowerCase().includes('french') ||
					h.toLowerCase().includes('verb') ||
					h.toLowerCase().includes('word')
				);
				const russianIdx = tableHeaders.findIndex(h =>
					h.toLowerCase().includes('russian') ||
					h.toLowerCase().includes('translate') ||
					h.toLowerCase().includes('translation')
				);

				if (frenchIdx !== -1 && russianIdx !== -1 && cells[frenchIdx] && cells[russianIdx]) {
					items.push(this.createVocabularyItem(cells[frenchIdx], cells[russianIdx], currentCategory));
				} else if (cells.length >= 2) {
					const pair = this.inferFrenchRussian(cells[0], cells[cells.length - 1]);
					items.push(this.createVocabularyItem(pair.french, pair.russian, currentCategory));
				}

				continue;
			}

			let processedLine = trimmedLine;
			if (processedLine.startsWith('- ') || processedLine.startsWith('* ') || processedLine.startsWith('• ')) {
				processedLine = processedLine.substring(2).trim();
			}

			let parts: string[] = [];
			const separators = [' - ', ' : ', ' = ', ' – ', ' — ', ' :: ', ' -', '- ', ' :', ': '];

			for (const sep of separators) {
				if (processedLine.includes(sep)) {
					parts = processedLine.split(sep);
					break;
				}
			}

			if (parts.length < 2) {
				const fallback = processedLine.match(/(.+?)\s*[-–—=]{1,2}\s*(.+)/);
				if (fallback) {
					parts = [fallback[1], fallback[2]];
				}
			}

			if (parts.length >= 2) {
				const firstPart = parts[0].trim();
				const secondPart = parts.slice(1).join(' - ').replace(/\[\]\(\)/g, '').trim();
				const pair = this.inferFrenchRussian(firstPart, secondPart);

				if (pair.french && pair.russian && !pair.french.endsWith(':')) {
					items.push(this.createVocabularyItem(pair.french, pair.russian, currentCategory));
				}
			}
		}

		return items;
	}

}