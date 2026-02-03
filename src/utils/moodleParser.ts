import * as fs from 'fs';
import * as path from 'path';
import { StudentSubmission } from '../types';
import { extractURLFromHTML } from './htmlParser';

/**
 * Parses folder name to extract student name and ID
 * Format: NAME_ID_assignsubmission_onlinetext
 */
export function parseFolderName(folderName: string): { name: string; id: string } {
	// Remove Moodle standard suffix
	let cleaned = folderName.replace('_assignsubmission_onlinetext', '');

	// Split by last underscore to get the ID
	const lastUnderscoreIndex = cleaned.lastIndexOf('_');

	if (lastUnderscoreIndex !== -1) {
		const name = cleaned.substring(0, lastUnderscoreIndex);
		const id = cleaned.substring(lastUnderscoreIndex + 1);
		return { name, id };
	}

	return { name: cleaned, id: 'N/A' };
}

/**
 * Processes all submission folders in the base directory
 */
export async function processSubmissions(basePath: string): Promise<StudentSubmission[]> {
	const results: StudentSubmission[] = [];

	if (!fs.existsSync(basePath)) {
		throw new Error(`Path ${basePath} does not exist`);
	}

	const entries = fs.readdirSync(basePath, { withFileTypes: true });

	for (const entry of entries) {
		if (entry.isDirectory() && !entry.name.startsWith('.')) {
			const folderPath = path.join(basePath, entry.name);
			const { name, id } = parseFolderName(entry.name);

			// Look for onlinetext.html file
			const htmlFilePath = path.join(folderPath, 'onlinetext.html');
			let repoUrl = 'Not found';

			if (fs.existsSync(htmlFilePath)) {
				try {
					const htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
					const url = extractURLFromHTML(htmlContent);
					if (url) {
						repoUrl = url;
					}
				} catch (error) {
					console.error(`Error reading ${htmlFilePath}:`, error);
				}
			}

			results.push({
				nombre: name,
				id: id,
				repositorio: repoUrl,
				carpeta: entry.name
			});
		}
	}

	// Sort by name
	results.sort((a, b) => a.nombre.localeCompare(b.nombre));

	return results;
}
