const fs = require('fs');
const content = fs.readFileSync('C:/Users/G HEMANTH/OneDrive/Documents/class.html/anti/neuro-music-app/frontend/app.js', 'utf8');
const idx = content.indexOf('panels.forEach(id => {');
const snippet = content.substring(content.indexOf('panels.forEach(id => {'), idx + 3000);
const pos = snippet.indexOf('});');
console.log('Position of });:', snippet.indexOf('});'));
var context = snippet.substring(snippet.indexOf('});') - 20, snippet.indexOf('});') + 20);
console.log('Context: ' + JSON.stringify(context));
var lines = content.split('\n');
var line = lines[4915];
console.log('Line 4916: ' + JSON.stringify(line));
console.log('Length: ' + line.length);
var codes = [];
for (var j = 0; j < line.length; j++) {
  codes.push(line.charCodeAt(j).toString(16).padStart(2, '0'));
}
console.log('Char codes: ' + codes.join(' '));
console.log('Ends with CR: ' + line.endsWith('\r'));
console.log('Ends with );: ' + line.endsWith(');'));