const fs = require('fs');
const content = fs.readFileSync('C:/Users/G HEMANTH/OneDrive/Documents/class.html/anti/neuro-music-app/frontend/app.js', 'utf8');
const idx = content.indexOf('function showOfflineLibraryNotice() {');
const snippet = content.substring(idx, idx + 3000);
let parenBal = 0;
let braceBal = 0;
for (let i = 0; i < 3000; i++) {
  const c = snippet[i];
  if (c === '(') { console.log('( at offset ' + i + ' (global ' + (idx + i) + ') context: ' + JSON.stringify(content.substring(idx + Math.max(0,i-30), idx + i + 30))); }
  else if (c === ')') console.log(') at offset ' + i + ' (global ' + (idx + i) + ') context: ' + JSON.stringify(content.substring(idx + Math.max(0,i-30), idx + i + 30)));
  else if (c === '{') console.log('{ at offset ' + i + ' (global ' + (idx + i) + ') context: ' + JSON.stringify(content.substring(idx + Math.max(0,i-30), idx + i + 30)));
  else if (snippet[i] === '}') console.log('} at offset ' + i + ' (global ' + (idx + i) + ') context: ' + JSON.stringify(content.substring(idx + Math.max(0,i-30), idx + i + 30)));
}