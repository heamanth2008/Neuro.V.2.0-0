const fs = require('fs');
let content = fs.readFileSync('C:/Users/G HEMANTH/OneDrive/Documents/class.html/anti/neuro-music-app/frontend/app.js', 'utf8');
const lines = content.split('\n');

// Find the showOfflineLibraryNotice function (forEach version) and replace with for-loop version
let startIdx = -1;
let endIdx = -1;
let braceCount = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('function showOfflineLibraryNotice() {')) {
    if (startIdx === -1) {
      startIdx = i;
      braceCount = 0;
    } else {
      // This is the second occurrence (old forEach version)
      startIdx = i;
      braceCount = 0;
    }
  }
  if (startIdx !== -1 && i >= startIdx) {
    for (let j = 0; j < lines[i].length; j++) {
      if (lines[i][j] === '{') braceCount++;
      else if (lines[i][j] === '}') braceCount--;
    }
    if (braceCount === 0 && i > startIdx) {
      endIdx = i;
      break;
    }
  }
}

console.log('Function at lines:', startIdx+1, 'to', endIdx+1);

if (startIdx !== -1 && endIdx !== -1) {
  const newFunction = [
    'function showOfflineLibraryNotice() {',
    '  const panels = [\'likedListPanel\', \'playlistTracksPanel\', \'songsListPanel\', \'artistsListPanel\', \'albumsListPanel\', \'offlineLibraryListPanel\'];',
    '  for (let i = 0; i < panels.length; i++) {',
    '    const id = panels[i];',
    '    const panel = document.getElementById(id);',
    '    if (panel && panel.children.length > 0) {',
    '      if (!panel.querySelector(\'.offline-notice\')) {',
    '        const notice = document.createElement(\'div\');',
    '        notice.className = \'offline-notice\';',
    '        notice.innerHTML = \'<i data-lucide="info"></i><span>Showing cached metadata. Audio playback requires internet.</span>\';',
    '        panel.insertBefore(notice, panel.firstChild);',
    '        lucide.createIcons();',
    '      }',
    '    }',
    '  }',
    '}'
  ];
  
  lines.splice(startIdx, endIdx - startIdx + 1, ...newFunction);
  
  // Check if there's another duplicate
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('function showOfflineLibraryNotice() {')) count++;
  }
  console.log('Total functions:', count);
  
  const newContent = lines.join('\n');
  fs.writeFileSync('C:/Users/G HEMANTH/OneDrive/Documents/class.html/anti/neuro-music-app/frontend/app.js', newContent);
  console.log('Replaced function');
}