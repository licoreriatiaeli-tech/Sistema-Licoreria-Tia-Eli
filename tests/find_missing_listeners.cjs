const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const idRegex = /id=["']([^"']+)["']/g;
const htmlIds = new Set();
let match;
while ((match = idRegex.exec(html)) !== null) {
  htmlIds.add(match[1]);
}

const jsFiles = ['app.js', 'gestion.js', 'ventas.js', 'sync.js', 'extras.js', 'charts.js'];

console.log('--- EVENT LISTENERS ON POTENTIALLY NULL ELEMENTS ---');

jsFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    const m = /getElementById\(['"]([a-zA-Z0-9_\-]+)['"]\)\s*\.\s*addEventListener/.exec(line);
    if (m) {
      const id = m[1];
      if (!htmlIds.has(id)) {
        console.log(`${file}:${index + 1} -> document.getElementById('${id}').addEventListener (ID MISSING FROM HTML!)`);
        console.log(`   Line: ${line.trim()}`);
      }
    }
  });
});
