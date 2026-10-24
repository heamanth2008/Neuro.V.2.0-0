const fs = require('fs');
let content = fs.readFileSync('C:/Users/G HEMANTH/OneDrive/Documents/class.html/anti/neuro-music-app/frontend/app.js', 'utf8');
const lines = content.split('\n');

// Find ALL occurrences of showOfflineLibraryNotice
let indices = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('function showOfflineLibraryNotice() {')) {
    indices.push(i);
  }
}

console.log('All occurrences at lines:', indices.map(i => i+1));

// Target the LAST occurrence (the one near line 4900)
if (indices.length >= 2) {
  const targetIdx = indices[indices.length - 1];
  console.log('Targeting occurrence at line:', targetIdx+1);
  
  // Find the end of this function
  let braceCount = 0;
  let endIdx = -1;
  for (let i = targetIdx; i < lines.length; i++) {
    for (let j = 0; j < lines[i].length; j++) {
      if (lines[i][j] === '{') braceCount++;
      else if (lines[i][j] === '}') braceCount--;
    }
    if (braceCount === 0 && i > targetIdx) {
      endIdx = i;
      break;
    }
  }
  
  console.log('Function at lines:', targetIdx+1, 'to', endIdx+1);
  
  if (endIdx !== -1) {
    const newFunction = [
      'function showOfflineLibraryNotice() {',
      '  const panels = [\'likedListPanel\', \'playlistTracksPanel\', \'songsListPanel\', \'artistsListPanel\', \'albumsListPanel\', \'offlineLibraryListPanel\'];',
      '  for (let i = 0; i < panels.length; i++) {',
      '    const id = panels[i];',
      '    const panel = document.getElementById(id);',
      '    if (panel && panel.children.length > 0) {',
      '      if (!panel.querySelector(\'.offline-notice\')) {',
      '        const notice = document.createElement(\'div\');',
      '      notice.className = \'offline-notice\';',
      '      notice.innerHTML = \'<i data-lucide="info"></i><span>Showing cached metadata. Audio playback requires internet.</span>\';',
      '      panel.insertBefore(notice, panel.firstChild);',
      '      lucide.createIcons();',
      '    }',
    '    }',
    '  }',
    '}'
    ];
    
    lines.splice(targetIdx, endIdx - targetIdx + 1, ...newFunction);
    
    const newContent = lines.join('\n');
    fs.writeFileSync('C:/Users/G HEMANTH/OneDrive/Documents/class.html/anti/neuro-music-app/frontend/app.js', newContent);
    console.log('Replaced LAST occurrence');
  }
}