import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const htmlPath = resolve('/home/user/000/index.html');
const html = readFileSync(htmlPath, 'utf8');

// Inject CSS that makes every slide visible as a separate print page
const printCSS = `<style id="pdf-override">
@page { size: 1366px 768px; margin: 0; }
html, body { width: 1366px !important; height: auto !important; overflow: visible !important; background: var(--bg) !important; }
.slide {
  position: relative !important;
  opacity: 1 !important;
  pointer-events: auto !important;
  transform: none !important;
  width: 1366px !important;
  height: 768px !important;
  display: flex !important;
  page-break-after: always;
  break-after: page;
  overflow: hidden !important;
}
#progress, #section-tag, #hint { display: none !important; }
</style>`;

const patched = html.replace('</head>', printCSS + '</head>');

// Spin up a tiny HTTP server so the file isn't blocked by data: URI limits
const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(patched);
});

await new Promise(r => server.listen(9988, '127.0.0.1', r));
console.log('Server up on :9988');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1366, height: 768 });
await page.goto('http://127.0.0.1:9988/', { waitUntil: 'networkidle', timeout: 30000 });

await page.waitForTimeout(1500);

// Remove page-break-after from last slide to prevent blank final page
await page.evaluate(() => {
  const slides = document.querySelectorAll('.slide');
  const last = slides[slides.length - 1];
  last.style.pageBreakAfter = 'avoid';
  last.style.breakAfter = 'avoid';
});

const slideCount = await page.locator('.slide').count();
console.log(`Found ${slideCount} slides`);

await page.pdf({
  path: '/home/user/000/presentation.pdf',
  width: '1366px',
  height: '768px',
  printBackground: true,
});

await browser.close();
server.close();
console.log('PDF saved → /home/user/000/presentation.pdf');
