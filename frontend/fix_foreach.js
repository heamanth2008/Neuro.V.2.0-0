const fs = require('fs');
let content = fs.readFileSync('C:/Users/G HEMANTH/OneDrive/Documents/class.html/anti/neuro-music-app/frontend/app.js', 'utf8');

// Fix the second occurrence (showOfflineLibraryNotice) - add parentheses around arrow function parameter
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('panels.forEach(id => {') && i > 4000) {
    lines[i] = lines[i].replace('panels.forEach(id => {', 'panels.forEach((id) => {');
    console.log('Fixed line', i+1);
  }
}
content = lines.join('\n');
fs.writeFileSync('C:/Users/G HEMANTH/OneDrive/Documents/class.html/anti/neuro-music-app/frontend/app.js', content);
console.log('Done');