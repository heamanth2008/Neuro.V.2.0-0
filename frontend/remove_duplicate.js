const fs = require('fs');
let content = fs.readFileSync('C:/Users/G HEMANTH/OneDrive/Documents/class.html/anti/neuro-music-app/frontend/app.js', 'utf8');
const lines = content.split('\n');

// Find both occurrences of showOfflineLibraryNotice
let indices = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('function showOfflineLibraryNotice() {')) {
    indices.push(i);
  }
}

console.log('Found at lines:', indices.map(i => i+1));

// Remove the second occurrence (the old forEach version)
if (indices.length >= 2) {
  // Find the end of the second function
  let secondStart = indices[1];
  let braceCount = 0;
  let secondEnd = -1;
  for (let i = secondStart; i < lines.length; i++) {
    for (let j = 0; j < lines[i].length; j++) {
      if (lines[i][j] === '{') braceCount++;
      else if (lines[i][j] === '}') {
        braceCount--;
        if (braceCount === 0) {
          secondEnd = i;
          break;
        }
      }
    }
    if (secondEnd !== -1) break;
  }
  
  console.log('Second function: lines', secondStart+1, 'to', secondEnd+1);
  
  // Remove the second function
  lines.splice(secondStart, secondEnd - secondStart + 1);
  
  const newContent = lines.join('\n');
  fs.writeFileSync('C:/Users/G HEMANTH/OneDrive/Documents/class.html/anti/neuro-music-app/frontend/app.js', newContent);
  console.log('Removed duplicate function');
}