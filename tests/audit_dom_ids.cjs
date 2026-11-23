const fs = require('fs');
const path = require('path');

const html = fs.readFileSync('index.html', 'utf8');

// Extract all id="..." from index.html
const idRegex = /id=["']([^"']+)["']/g;
const htmlIds = new Set();
let match;
while ((match = idRegex.exec(html)) !== null) {
  htmlIds.add(match[1]);
}

console.log(`Total unique IDs in index.html: ${htmlIds.size}`);

// JS files to check
const jsFiles = ['app.js', 'gestion.js', 'ventas.js', 'sync.js', 'extras.js', 'charts.js'];

const getElementByIdRegex = /getElementById\(['"]([^'"]+)['"]\)/g;
const missing = [];

jsFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = getElementByIdRegex.exec(content)) !== null) {
    const id = m[1];
    // Ignore dynamically constructed IDs or known dynamic prefixes
    if (id.includes('${') || id.startsWith('dynamic_')) continue;
    if (!htmlIds.has(id)) {
      missing.push({ file, id });
    }
  }
});

// Group by file
const grouped = {};
missing.forEach(({ file, id }) => {
  if (!grouped[file]) grouped[file] = new Set();
  grouped[file].add(id);
});

console.log('--- MISSING DOM IDs REFERENCED IN JS ---');
for (const [file, ids] of Object.entries(grouped)) {
  console.log(`\n${file}:`);
  ids.forEach(id => console.log(`  - ${id}`));
}
