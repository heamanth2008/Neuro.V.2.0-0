const fs = require('fs');
const content = fs.readFileSync('C:/Users/G HEMANTH/OneDrive/Documents/class.html/anti/neuro-music-app/frontend/app.js', 'utf8');
const idx = content.indexOf('panels.forEach(id => {');
const snippet = content.substring(idx, idx + 3000);
const pos = snippet.indexOf('});');
console.log('Context around });: ' + JSON.stringify(snippet.substring(snippet.indexOf('});') - 30, snippet.indexOf('});') + 30));
console.log('Char codes: ' + [...snippet.substring(snippet.indexOf('});') - 10, snippet.indexOf('});') + 10].map(c => c.charCodeAt(0).toString(16).padStart(2,'0')).join(' '));