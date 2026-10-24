const fs = require('fs');
const content = fs.readFileSync('C:/Users/G HEMANTH/OneDrive/Documents/class.html/anti/neuro-music-app/frontend/app.js', 'utf8');
const idx = content.indexOf('notice.innerHTML = ');
if (idx === -1) {
  console.log('notice.innerHTML not found');
} else {
  const snippet = content.substring(idx, idx + 500);
  let backtickCount = 0;
  for (let i = 0; i < 500; i++) {
    if (snippet[i] === '`') {
      console.log('Backtick at offset', i, 'context:', JSON.stringify(snippet.substring(Math.max(0,i-20), i+20)));
    }
  }
  console.log('Done checking template literal');