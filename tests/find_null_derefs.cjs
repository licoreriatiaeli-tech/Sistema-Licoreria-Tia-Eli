const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const idRegex = /id=["']([^"']+)["']/g;
const htmlIds = new Set();
let match;
while ((match = idRegex.exec(html)) !== null) {
  htmlIds.add(match[1]);
}

const jsFiles = ['app.js', 'gestion.js', 'ventas.js', 'sync.js', 'extras.js', 'charts.js'];

console.log('--- POTENTIAL NULL DEREFERENCES (ID missing and accessed directly) ---');

jsFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    // Look for getElementById('xyz').value or .style or .textContent or .innerHTML or .addEventListener without ?
    const m = /getElementById\(['"]([a-zA-Z0-9_\-]+)['"]\)(\.|\s*\.\s*)([a-zA-Z0-9_]+)/.exec(line);
    if (m) {
      const id = m[1];
      const prop = m[3];
      if (!htmlIds.has(id)) {
        console.log(`${file}:${index + 1} -> document.getElementById('${id}').${prop} (ID NOT IN HTML!)`);
        console.log(`   Line: ${line.trim()}`);
      }
    }
  });
});
