const fs = require('fs');
const content = fs.readFileSync('C:/Users/G HEMANTH/OneDrive/Documents/class.html/anti/neuro-music-app/frontend/app.js', 'utf8');
const idx = content.indexOf('function showOfflineLibraryNotice() {');
const snippet = content.substring(idx, idx + 1000);
console.log('First 1000 chars of showOfflineLibraryNotice:');
console.log(JSON.stringify(snippet.substring(0, 1000)));