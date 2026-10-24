const fs = require('fs');
const content = fs.readFileSync('C:/Users/G HEMANTH/OneDrive/Documents/class.html/anti/neuro-music-app/frontend/app.js', 'utf8');
const idx = content.indexOf('panels.forEach(id => {');
const snippet = content.substring(Math.max(0, idx - 200), idx + 600);
let bal = 0;
let parenBal = 0;
for (let i = 0; i < snippet.length; i++) {
  if (snippet[i] === '{') { console.log('{ at', i, snippet.substring(Math.max(0,i-30), i+30)); bal++; }
  else if (snippet[i] === '}') { console.log('} at', i, snippet.substring(Math.max(0,i-30), i+30)); }
  else if (snippet[i] === '(') { console.log('( at', i, snippet.substring(Math.max(0,i-20), i+20)); }
  else if (snippet[i] === ')') { console.log(') at', i, snippet.substring(Math.max(0,i-20), i+20)); }
}
console.log('Final balance:', bal);