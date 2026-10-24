const fs = require('fs');
let content = fs.readFileSync('C:/Users/G HEMANTH/OneDrive/Documents/class.html/anti/neuro-music-app/frontend/app.js', 'utf8');

// Normalize all line endings to LF
content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

// Ensure file ends with newline
if (!content.endsWith('\n')) {
  content += '\n';
}

fs.writeFileSync('C:/Users/G HEMANTH/OneDrive/Documents/class.html/anti/neuro-music-app/frontend/app.js', content, 'utf8');
console.log('Fixed line endings');