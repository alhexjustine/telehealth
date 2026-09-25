import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsRoot = resolve(__dirname, '..');

const dom = new JSDOM('<!DOCTYPE html><body></body>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
});
globalThis.SVGElement = dom.window.SVGElement;

const { default: mermaid } = await import('mermaid');
mermaid.initialize({ startOnLoad: false });

function findMarkdownFiles(dir) {
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    if (entry === 'node_modules' || entry.startsWith('.vitepress')) continue;
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...findMarkdownFiles(fullPath));
    } else if (extname(entry) === '.md') {
      files.push(fullPath);
    }
  }
  return files;
}

function extractMermaidBlocks(content) {
  const blocks = [];
  const regex = /```mermaid\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

const files = findMarkdownFiles(docsRoot);
let errorCount = 0;

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const blocks = extractMermaidBlocks(content);
  for (const [index, block] of blocks.entries()) {
    try {
      await mermaid.parse(block);
    } catch (error) {
      errorCount += 1;
      console.error(`Invalid mermaid diagram in ${file} (block ${index + 1}):`);
      console.error(error instanceof Error ? error.message : error);
    }
  }
}

if (errorCount > 0) {
  console.error(`\n${errorCount} invalid mermaid diagram(s) found.`);
  process.exit(1);
}

console.log(`Validated mermaid diagrams in ${files.length} file(s), no errors.`);
