const fs = require('fs');
let content = fs.readFileSync('C:/Users/G HEMANTH/OneDrive/Documents/class.html/anti/neuro-music-app/frontend/app.js', 'utf8');
const lines = content.split('\n');

// Find the showOfflineLibraryNotice function and replace it
let startIdx = -1;
let endIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('function showOfflineLibraryNotice() {')) {
    startIdx = i;
  }
  if (startIdx !== -1 && i > startIdx && lines[i].trim() === '}' && lines[i+1] && lines[i+1].trim().startsWith('// Static Pages')) {
    endIdx = i;
    break;
  }
}

console.log('Function found at lines:', startIdx+1, 'to', endIdx+1);

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
const newContent = lines.join('\n');
fs.writeFileSync('C:/Users/G HEMANTH/OneDrive/Documents/class.html/anti/neuro-music-app/frontend/app.js', newContent);
console.log('Rewrote showOfflineLibraryNotice function');