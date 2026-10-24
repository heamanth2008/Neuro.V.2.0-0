const fs = require('fs');
const content = fs.readFileSync('C:/Users/G HEMANTH/OneDrive/Documents/class.html/anti/neuro-music-app/frontend/app.js', 'utf8');
const idx = content.indexOf('panels.forEach(id => {');
const snippet = content.substring(idx, idx + 3000);
const pos = snippet.indexOf('});');
console.log('Context around });: ' + JSON.stringify(snippet.substring(snippet.indexOf('});') - 30, snippet.indexOf('});') + 30));
var codes = [];
for (var j = 0; j < 20; j++) {
  var idx2 = snippet.indexOf('});') - 10 + j;
  if (idx2 >= 0 && idx2 < snippet.length) {
    console.log(j + ': ' + snippet.charCodeAt(snippet.indexOf('});') - 10 + j).toString(16).padStart(2, '0'));
  }
}