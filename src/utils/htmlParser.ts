/**
 * Extracts text content from simple HTML
 */
export function extractTextFromHTML(htmlContent: string): string {
	// Remove HTML tags
	let text = htmlContent.replace(/<[^>]*>/g, ' ');
	// Decode common HTML entities
	text = text.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"');
	return text.trim();
}

/**
 * Extracts repository URL from HTML content
 */
export function extractURLFromHTML(htmlContent: string): string | null {
	// First, try to extract URL from href attributes
	const hrefPattern = /href=["']([^"']+)["']/gi;
	let match;

	while ((match = hrefPattern.exec(htmlContent)) !== null) {
		const url = match[1];
		// Check if it's a valid http/https URL
		if (/^https?:\/\/.+/.test(url)) {
			return url;
		}
	}

	// If no href found, try extracting from text content
	const text = extractTextFromHTML(htmlContent);

	// Search for URL using regex
	const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
	const matches = text.match(urlPattern);

	if (matches && matches.length > 0) {
		return matches[0];
	}

	return null;
}
