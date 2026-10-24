const fs = require('fs');
let content = fs.readFileSync('C:/Users/G HEMANTH/OneDrive/Documents/class.html/anti/neuro-music-app/frontend/app.js', 'utf8');
const lines = content.split('\n');

// Remove the stray })
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === '})' && i > 5500) {
    console.log('Found stray }) at line', i+1);
    lines.splice(i, 1);
    break;
  }
}

const newContent = lines.join('\n');
fs.writeFileSync('C:/Users/G HEMANTH/OneDrive/Documents/class.html/anti/neuro-music-app/frontend/app.js', newContent);
console.log('Removed stray })');