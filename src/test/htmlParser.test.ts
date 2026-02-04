import * as assert from 'assert';
import { extractTextFromHTML, extractURLFromHTML } from '../utils/htmlParser';

suite('HTML Parser Test Suite', () => {

	suite('extractTextFromHTML', () => {
		test('should remove HTML tags', () => {
			const html = '<p>Hello <strong>World</strong></p>';
			const result = extractTextFromHTML(html);
			// Multiple spaces may remain after tag removal
			assert.strictEqual(result.replace(/\s+/g, ' '), 'Hello World');
		});

		test('should decode HTML entities', () => {
			const html = 'Hello&nbsp;&amp;&nbsp;World';
			const result = extractTextFromHTML(html);
			assert.strictEqual(result, 'Hello & World');
		});

		test('should handle empty string', () => {
			const result = extractTextFromHTML('');
			assert.strictEqual(result, '');
		});
	});

	suite('extractURLFromHTML', () => {
		test('should extract URL from plain text', () => {
			const html = '<p>Check this: https://github.com/user/repo</p>';
			const result = extractURLFromHTML(html);
			assert.strictEqual(result, 'https://github.com/user/repo');
		});

		test('should extract URL from href attribute', () => {
			const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><p dir="ltr" style="text-align: left;"><a href="https://github.com/Ezequielpasto/Menu">Ezequielpasto/Menu</a><br></p></body></html>';
			const result = extractURLFromHTML(html);
			assert.strictEqual(result, 'https://github.com/Ezequielpasto/Menu');
		});

		test('should extract URL with single quotes in href', () => {
			const html = '<a href=\'https://github.com/user/project\'>Link</a>';
			const result = extractURLFromHTML(html);
			assert.strictEqual(result, 'https://github.com/user/project');
		});

		test('should extract first URL when multiple exist', () => {
			const html = '<a href="https://github.com/first/repo">First</a> <a href="https://github.com/second/repo">Second</a>';
			const result = extractURLFromHTML(html);
			assert.strictEqual(result, 'https://github.com/first/repo');
		});

		test('should return null when no URL found', () => {
			const html = '<p>No URL here</p>';
			const result = extractURLFromHTML(html);
			assert.strictEqual(result, null);
		});

		test('should handle http URLs', () => {
			const html = '<a href="http://example.com/repo">Repo</a>';
			const result = extractURLFromHTML(html);
			assert.strictEqual(result, 'http://example.com/repo');
		});

		test('should extract URL from complex HTML with attributes', () => {
			const html = '<p><a href="https://github.com/user/repo" target="_blank" rel="noopener">Repository</a></p>';
			const result = extractURLFromHTML(html);
			assert.strictEqual(result, 'https://github.com/user/repo');
		});
	});
});
