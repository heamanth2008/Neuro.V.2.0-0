const fs = require('fs');
const content = fs.readFileSync('C:/Users/G HEMANTH/OneDrive/Documents/class.html/anti/neuro-music-app/frontend/app.js', 'utf8');
const idx = content.indexOf('function showStaticPage(page) {');
const snippet = content.substring(idx, idx + 3000);
let count = 0;
for (let i = 0; i < snippet.length; i++) {
  if (snippet[i] === '`') {
    console.log('Backtick at offset', i, 'context:', JSON.stringify(snippet.substring(Math.max(0,i-30), i+30)));
    count++;
  }
}
console.log('Total backticks in snippet:', count);