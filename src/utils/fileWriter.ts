import * as fs from 'fs';
import * as path from 'path';
import { StudentSubmission } from '../types';

/**
 * Saves results in different formats
 */
export async function saveResults(results: StudentSubmission[], outputDir: string): Promise<void> {
	// Create output directory if it doesn't exist
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}

	// Save as JSON
	const jsonPath = path.join(outputDir, 'students_repos.json');
	fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf-8');

	// Save as CSV
	const csvPath = path.join(outputDir, 'students_repos.csv');
	const csvLines = ['nombre,id,repositorio,carpeta'];
	for (const result of results) {
		// Escape fields containing commas
		const escapeCsv = (field: string) =>
			field.includes(',') || field.includes('"') ? `"${field.replace(/"/g, '""')}"` : field;

		csvLines.push([
			escapeCsv(result.nombre),
			escapeCsv(result.id),
			escapeCsv(result.repositorio),
			escapeCsv(result.carpeta)
		].join(','));
	}
	fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf-8');

	// Save as formatted text
	const txtPath = path.join(outputDir, 'students_repos.txt');
	const lines = [
		'='.repeat(80),
		'STUDENTS AND REPOSITORIES LIST',
		'='.repeat(80),
		''
	];

	results.forEach((result, index) => {
		lines.push(`${index + 1}. ${result.nombre}`);
		lines.push(`   ID: ${result.id}`);
		lines.push(`   Repositorio: ${result.repositorio}`);
		lines.push(`   Carpeta: ${result.carpeta}`);
		lines.push('-'.repeat(80));
	});

	fs.writeFileSync(txtPath, lines.join('\n'), 'utf-8');
}
