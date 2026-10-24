const fs = require('fs');
const content = fs.readFileSync('C:/Users/G HEMANTH/OneDrive/Documents/class.html/anti/neuro-music-app/frontend/app.js', 'utf8');
const idx = content.indexOf('panels.forEach(id => {');
const snippet = content.substring(Math.max(0, idx - 500), idx + 600);
let bal = 0;
for (let i = 0; i < snippet.length; i++) {
  if (snippet[i] === '{') bal++;
  else if (snippet[i] === '}') {
    bal--;
    if (bal < 0) {
      console.log('NEGATIVE at', i);
      console.log('Context:', snippet.substring(Math.max(0,i-100), i+100));
      break;
    }
  }
  console.log('Final balance:', bal);
