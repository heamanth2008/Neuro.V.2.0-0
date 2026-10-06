/* ============================================================================
   NEW MODULES: Library, Home, Settings, Account, Context Menu, Lyrics, Play Next
   ============================================================================ */

// ============================================================================
// PLAY NEXT QUEUE
// ============================================================================
S.playNextQueue = [];

function addToPlayNext(song) {
  S.playNextQueue.unshift(song);
  renderPlayNextQueue();
  showToast('Added to Play Next');
}

function removeFromPlayNext(index) {
  S.playNextQueue.splice(index, 1);
  renderPlayNextQueue();
}

function clearPlayNext() {
  S.playNextQueue = [];
  renderPlayNextQueue();
}

function renderPlayNextQueue() {
  const container = document.getElementById('playNextQueueList');
  if (!container) return;
  
  if (S.playNextQueue.length === 0) {
    container.innerHTML = '<div class="empty-state"><i data-lucide="list-music"></i><p>Play Next queue is empty</p></div>';
    lucide.createIcons();
    return;
  }
  
  container.innerHTML = S.playNextQueue.map((song, index) => `
    <div class="queue-item" data-index="${index}">
      <div class="queue-number">${index + 1}</div>
      <div class="cover" style="background:${song.grad}"><i data-lucide="music"></i></div>
      <div class="meta">
        <div class="t">${escapeHtml(song.title)}</div>
        <div class="a">${escapeHtml(song.artist)}</div>
      </div>
      <button class="queue-remove" onclick="removeFromPlayNext(${index})" aria-label="Remove from Play Next">
        <i data-lucide="x"></i>
      </button>
    </div>
  `).join('');
  
  lucide.createIcons();
}

// ============================================================================
// CONTEXT MENU COMPONENT
// ============================================================================
let contextMenu = null;
let contextMenuTarget = null;

function createContextMenu() {
  if (contextMenu) return contextMenu;
  
  contextMenu = document.createElement('div');
  contextMenu.className = 'context-menu';
  contextMenu.setAttribute('role', 'menu');
  contextMenu.innerHTML = `
    <div class="context-menu-items">
      <button class="context-menu-item" role="menuitem" data-action="play-next">
        <i data-lucide="skip-back"></i>
        <span>Play Next</span>
      </button>
      <button class="context-menu-item" role="menuitem" data-action="add-to-playlist">
        <i data-lucide="plus"></i>
        <span>Add to Playlist</span>
      </button>
      <button class="context-menu-item" role="menuitem" data-action="toggle-like">
        <i data-lucide="heart"></i>
        <span class="like-text">Like</span>
      </button>
      <button class="context-menu-item" role="menuitem" data-action="share">
        <i data-lucide="share-2"></i>
        <span>Share</span>
      </button>
      <button class="context-menu-item" role="menuitem" data-action="go-to-artist">
        <i data-lucide="user"></i>
        <span>Go to Artist</span>
      </button>
    </div>
  `;
  
  document.body.appendChild(contextMenu);
  
  // Close on outside click
  document.addEventListener('click', (e) => {
    if (contextMenu && !contextMenu.contains(e.target)) {
      hideContextMenu();
    }
  });
  
  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideContextMenu();
    }
  });
  
  // Handle menu item clicks
  contextMenu.addEventListener('click', (e) => {
    const item = e.target.closest('.context-menu-item');
    if (!item) return;
    
    const action = item.dataset.action;
    if (contextMenuTarget && action) {
      handleContextMenuAction(action, contextMenuTarget);
    }
    hideContextMenu();
  });
  
  lucide.createIcons();
  return contextMenu;
}

function showContextMenu(event, song) {
  event.preventDefault();
  event.stopPropagation();
  
  if (!contextMenu) createContextMenu();
  
  contextMenuTarget = song;
  
  // Update like text
  const likeBtn = contextMenu.querySelector('[data-action="toggle-like"] .like-text');
  if (likeBtn) {
    likeBtn.textContent = isLiked(song.id) ? 'Unlike' : 'Like';
  }
  
  // Position menu
  const rect = event.target.getBoundingClientRect();
  const menuRect = contextMenu.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  let left = rect.right + 8;
  let top = rect.top;
  
  // Adjust if would go off screen
  if (left + menuRect.width > viewportWidth) {
    left = rect.left - menuRect.width - 8;
  }
  if (top + menuRect.height > viewportHeight) {
    top = viewportHeight - menuRect.height - 8;
  }
  
  contextMenu.style.left = `${left}px`;
  contextMenu.style.top = `${top}px`;
  contextMenu.classList.add('open');
  
  // Focus first item for keyboard navigation
  const firstItem = contextMenu.querySelector('.context-menu-item');
  if (firstItem) firstItem.focus();
}

function hideContextMenu() {
  if (contextMenu) {
    contextMenu.classList.remove('open');
    contextMenuTarget = null;
  }
}

async function handleContextMenuAction(action, song) {
  switch (action) {
    case 'play-next':
      addToPlayNext(song);
      break;
    case 'add-to-playlist':
      openAddToPlaylistModal(song);
      break;
    case 'toggle-like':
      await toggleLike(song);
      break;
    case 'share':
      await shareSong(song);
      break;
    case 'go-to-artist':
      goToArtist(song.artist);
      break;
  }
}

async function shareSong(song) {
  const shareData = {
    title: song.title,
    text: `${song.title} by ${song.artist}`,
    url: window.location.origin + '/?play=' + song.ytId
  };
  
  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch (e) {
      if (e.name !== 'AbortError') {
        fallbackShare(shareData);
      }
    }
  } else {
    fallbackShare(shareData);
  }
}

function fallbackShare(data) {
  navigator.clipboard.writeText(data.url).then(() => {
    showToast('Link copied to clipboard');
  }).catch(() => {
    showToast('Failed to copy link');
  });
}

function goToArtist(artistName) {
  // Search for artist
  const searchInput = document.getElementById('searchInput') || document.getElementById('searchInputFull');
  if (searchInput) {
    searchInput.value = artistName;
    document.getElementById('searchClearBtn')?.classList.add('visible');
    performBackendSearch(artistName);
    switchView('search');
  }
}

// ============================================================================
// LIBRARY VIEW
// ============================================================================
async function loadLibraryData() {
  try {
    // Load playlists from backend
    const playlists = await API.getPlaylists();
    S.pls = playlists.map(p => ({
      id: p.id,
      name: p.name,
      desc: p.description,
      tracks: [],
      trackCount: p.track_count
    }));
    
    // Load liked songs from backend
    const likes = await API.getLikes();
    S.likedSongs = likes.map(l => ({
      id: l.id,
      ytId: l.yt_id,
      title: l.title,
      artist: l.artist,
      album: l.album,
      dur: l.duration,
      grad: `linear-gradient(135deg, hsl(${hashCode(l.yt_id) % 360}, 80%, 25%), hsl(${hashCode(l.yt_id) + 45) % 360}, 80%, 40%))`
    }));
    
    renderLibrary();
  } catch (err) {
    console.error('Failed to load library:', err);
    showToast('Failed to load library');
  }
}

function renderLibrary() {
  // Render Liked Songs hero row
  updateLikedHeroRow();
  
  // Render playlists
  renderPlaylistsPanel();
  
  // Render albums rail (from curated data for now)
  renderAlbumsRail();
  
  // Render sidebar playlists
  renderSidebarPlaylists();
}

function updateLikedHeroRow() {
  const countEl = document.getElementById('likedCountBadge');
  if (countEl) {
    countEl.textContent = `${S.likedSongs.length} song${S.likedSongs.length !== 1 ? 's' : ''}`;
  }
}

function renderPlaylistsPanel() {
  const container = document.getElementById('playlistsPanel');
  if (!container) return;
  
  if (S.pls.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="music"></i>
        <p>No playlists yet</p>
        <button class="btn-primary" onclick="openCreatePlaylistModal()">
          <i data-lucide="plus"></i> Create Playlist
        </button>
      </div>
    `;
    lucide.createIcons();
    return;
  }
  
  container.innerHTML = S.pls.map(pl => `
    <div class="row" data-playlist-id="${pl.id}">
      <div class="cover" style="background:${pl.grad || 'linear-gradient(135deg,#5b3df0,#9db4ff)'}">
        <i data-lucide="list-music"></i>
      </div>
      <div class="meta">
        <div class="t">${escapeHtml(pl.name)}</div>
        <div class="a">${pl.trackCount || 0} songs</div>
      </div>
      <div class="action-btns">
        <button class="row-action-btn" onclick="event.stopPropagation(); openPlaylistDetail(${pl.id})" title="Open Playlist">
          <i data-lucide="chevron-right"></i>
        </button>
        <button class="row-action-btn context-menu-btn" onclick="event.stopPropagation(); showPlaylistContextMenu(event, ${JSON.stringify(pl).replace(/"/g, '"')})" title="More options">
          <i data-lucide="more-vertical"></i>
        </button>
      </div>
    </div>
  `).join('');
  
  lucide.createIcons();
}

function renderSidebarPlaylists() {
  const container = document.getElementById('sidebarPlaylistsList');
  if (!container) return;
  
  container.innerHTML = S.pls.map(pl => `
    <div class="sidebar-pl-item" data-playlist-id="${pl.id}" onclick="openPlaylistDetail(${pl.id})">
      <i data-lucide="list-music"></i>
      <span>${escapeHtml(pl.name)}</span>
      <span class="sidebar-badge">${pl.trackCount || 0}</span>
    </div>
  `).join('');
}

function renderAlbumsRail() {
  const container = document.getElementById('albumsRail');
  if (!container) return;
  
  container.innerHTML = ALBUMS.map(album => `
    <div class="card" onclick="openAlbumDetail(${album.id})" style="--c1:${album.grad.split(',')[0].replace('linear-gradient(135deg, ', '')}; --c2:${album.grad.split(',')[1].replace(')', '')}">
      <div class="art" style="background:${album.grad}">
        <i data-lucide="disc"></i>
      </div>
      <div class="t">${escapeHtml(album.name)}</div>
      <div class="a">${escapeHtml(album.artist)}</div>
    </div>
  `).join('');
  
  lucide.createIcons();
}

// ============================================================================
// PLAYLIST DETAIL VIEW
// ============================================================================
async function openPlaylistDetail(playlistId) {
  try {
    const playlist = await API.getPlaylist(playlistId);
    
    document.getElementById('playlistViewTitle').textContent = playlist.name;
    document.getElementById('playlistViewSubtext').textContent = `${playlist.track_count} songs`;
    
    const tracksContainer = document.getElementById('playlistTracksPanel');
    if (playlist.tracks.length === 0) {
      tracksContainer.innerHTML = `
        <div class="empty-state">
          <i data-lucide="music"></i>
          <p>This playlist is empty</p>
          <p class="hint">Add songs from search or context menu</p>
        </div>
      `;
    } else {
      tracksContainer.innerHTML = playlist.tracks.map((track, index) => `
        <div class="row" data-track-id="${track.id}" data-yt-id="${track.yt_id}">
          <div class="cover" style="background:linear-gradient(135deg, hsl(${hashCode(track.yt_id) % 360}, 80%, 25%), hsl(${hashCode(track.yt_id) + 45) % 360}, 80%, 40%))">
            <i data-lucide="music"></i>
          </div>
          <div class="meta">
            <div class="t">${escapeHtml(track.title)}</div>
            <div class="a">${escapeHtml(track.artist)} ${track.duration ? '• ' + formatTime(track.duration) : ''}</div>
          </div>
          <div class="action-btns">
            <button class="row-action-btn" onclick="event.stopPropagation(); addToPlayNext(${JSON.stringify(track).replace(/"/g, '"')})" title="Play Next">
              <i data-lucide="skip-back"></i>
            </button>
            <button class="row-action-btn context-menu-btn" onclick="event.stopPropagation(); showContextMenu(event, ${JSON.stringify(track).replace(/"/g, '"')})" title="More options">
              <i data-lucide="more-vertical"></i>
            </button>
          </div>
        </div>
      `).join('');
    }
    
    // Set up playlist action buttons
    document.getElementById('playPlaylistBtn').onclick = () => playPlaylist(playlist);
    document.getElementById('deletePlaylistBtn').onclick = () => confirmDeletePlaylist(playlist.id);
    
    switchView('playlist');
    lucide.createIcons();
  } catch (err) {
    console.error('Failed to load playlist:', err);
    showToast('Failed to load playlist');
  }
}

function playPlaylist(playlist) {
  if (!playlist.tracks.length) return;
  const firstTrack = {
    ...playlist.tracks[0],
    ytId: playlist.tracks[0].yt_id,
    grad: `linear-gradient(135deg, hsl(${hashCode(playlist.tracks[0].yt_id) % 360}, 80%, 25%), hsl(${hashCode(playlist.tracks[0].yt_id) + 45) % 360}, 80%, 40%))`
  };
  playSong(firstTrack, playlist.tracks.map(t => ({
    ...t,
    ytId: t.yt_id,
    grad: `linear-gradient(135deg, hsl(${hashCode(t.yt_id) % 360}, 80%, 25%), hsl(${hashCode(t.yt_id) + 45) % 360}, 80%, 40%))`
  })));
}

async function confirmDeletePlaylist(playlistId) {
  openConfirmModal('Delete Playlist', 'Are you sure you want to delete this playlist? This cannot be undone.', async () => {
    try {
      await API.deletePlaylist(playlistId);
      showToast('Playlist deleted');
      loadLibraryData();
      switchView('library');
    } catch (err) {
      showToast('Failed to delete playlist');
    }
  });
}

// ============================================================================
// CREATE PLAYLIST MODAL
// ============================================================================
function openCreatePlaylistModal() {
  const modal = document.getElementById('createPlaylistModal');
  const input = document.getElementById('newPlaylistInput');
  input.value = '';
  modal.classList.add('open');
  input.focus();
  
  // Set up handlers
  document.getElementById('confirmCreatePlaylistBtn').onclick = async () => {
    const name = input.value.trim();
    if (!name) return;
    
    try {
      await API.createPlaylist(name);
      showToast('Playlist created');
      modal.classList.remove('open');
      loadLibraryData();
    } catch (err) {
      showToast('Failed to create playlist');
    }
  };
  
  document.getElementById('cancelCreatePlaylistBtn').onclick = () => {
    modal.classList.remove('open');
  };
}

function showPlaylistContextMenu(event, playlist) {
  event.preventDefault();
  event.stopPropagation();
  
  // Create a simple context menu for playlist
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.innerHTML = `
    <div class="context-menu-items">
      <button class="context-menu-item" data-action="rename">
        <i data-lucide="edit"></i>
        <span>Rename</span>
      </button>
      <button class="context-menu-item" data-action="delete" style="color: var(--like);">
        <i data-lucide="trash-2"></i>
        <span>Delete</span>
      </button>
    </div>
  `;
  document.body.appendChild(menu);
  
  const rect = event.target.getBoundingClientRect();
  menu.style.left = `${rect.right + 8}px`;
  menu.style.top = `${rect.top}px`;
  menu.classList.add('open');
  
  menu.addEventListener('click', async (e) => {
    const item = e.target.closest('.context-menu-item');
    if (!item) return;
    
    const action = item.dataset.action;
    if (action === 'rename') {
      const newName = prompt('New playlist name:', playlist.name);
      if (newName && newName.trim() !== playlist.name) {
        try {
          await API.updatePlaylist(playlist.id, newName.trim());
          showToast('Playlist renamed');
          loadLibraryData();
        } catch (err) {
          showToast('Failed to rename playlist');
        }
      }
    } else if (action === 'delete') {
      await confirmDeletePlaylist(playlist.id);
    }
    menu.remove();
  });
  
  document.addEventListener('click', function closeMenu(e) {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  }, { once: true });
  
  lucide.createIcons();
}

// ============================================================================
// HOME VIEW
// ============================================================================
async function loadHomeData() {
  try {
    const homeData = await API.getHome();
    
    renderListenAgain(homeData.listen_again);
    renderStation(homeData.station);
    renderRecentRail(homeData.recent);
  } catch (err) {
    console.error('Failed to load home:', err);
    // Fallback to curated data
    renderListenAgain([]);
    renderStation({ label: 'Neuro Station', description: 'Discover new music', artists: [] });
    renderRecentRail([]);
  }
}

function renderListenAgain(tracks) {
  const container = document.getElementById('listenAgainRail') || document.getElementById('recentRail');
  if (!container) return;
  
  if (tracks.length === 0) {
    container.innerHTML = '<div class="search-status">Play some music to see recommendations</div>';
    return;
  }
  
  container.innerHTML = tracks.map(track => `
    <div class="card" onclick="playHomeTrack(${JSON.stringify(track).replace(/"/g, '"')})" style="--c1:${track.grad.split(',')[0].replace('linear-gradient(135deg, ', '')}; --c2:${track.grad.split(',')[1].replace(')', '')}">
      <div class="art" style="background-image:url('${track.thumbnail}'); background-size:cover; background-position:center;">
        ${track.thumbnail ? '' : '<i data-lucide="music"></i>'}
      </div>
      <div class="t">${escapeHtml(track.title)}</div>
      <div class="a">${escapeHtml(track.artist)}</div>
    </div>
  `).join('');
  
  lucide.createIcons();
}

function renderStation(station) {
  const container = document.getElementById('radioStation') || document.getElementById('stationCard');
  if (!container) return;
  
  container.innerHTML = `
    <div class="radio-art" style="background:linear-gradient(135deg, var(--glow), var(--accent))">
      <i data-lucide="radio"></i>
    </div>
    <div class="radio-info">
      <h3>${escapeHtml(station.label)}</h3>
      <p>${escapeHtml(station.description)}</p>
    </div>
    <button class="play-pill" onclick="startStation('${escapeHtml(JSON.stringify(station.artists).replace(/"/g, '"'))}')">
      <i data-lucide="play"></i>
      <span>Start Station</span>
    </button>
  `;
  lucide.createIcons();
}

function renderRecentRail(tracks) {
  const container = document.getElementById('recentRail');
  if (!container) return;
  
  if (tracks.length === 0) {
    container.innerHTML = '<div class="search-status">Recently played tracks will appear here</div>';
    return;
  }
  
  container.innerHTML = tracks.map(track => `
    <div class="card" onclick="playHomeTrack(${JSON.stringify(track).replace(/"/g, '"')})" style="--c1:${track.grad.split(',')[0].replace('linear-gradient(135deg, ', '')}; --c2:${track.grad.split(',')[1].replace(')', '')}">
      <div class="art" style="background-image:url('${track.thumbnail}'); background-size:cover; background-position:center;">
        ${track.thumbnail ? '' : '<i data-lucide="music"></i>'}
      </div>
      <div class="t">${escapeHtml(track.title)}</div>
      <div class="a">${escapeHtml(track.artist)}</div>
    </div>
  `).join('');
  
  lucide.createIcons();
}

function playHomeTrack(track) {
  const song = {
    ...track,
    ytId: track.ytId,
    grad: track.grad
  };
  playSong(song, [song]);
}

function startStation(artistsJson) {
  // For now, just play a curated mix
  const artists = JSON.parse(artistsJson);
  showToast(`Starting station based on ${artists.slice(0, 3).join(', ')}...`);
  // Could implement radio queue here
}

// ============================================================================
// SETTINGS VIEW
// ============================================================================
async function loadSettings() {
  try {
    const settings = await API.getSettings();
    renderSettings(settings);
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

function renderSettings(settings) {
  // This will be called when settings view is opened
  // The settings are synced to localStorage for offline access
  localStorage.setItem('neuro_settings', JSON.stringify(settings));
  
  // Apply settings immediately
  applySettings(settings);
}

function applySettings(settings) {
  // Theme
  document.documentElement.setAttribute('data-theme', settings.theme);
  
  // Motion
  if (settings.motion) {
    document.documentElement.classList.remove('reduce-motion');
  } else {
    document.documentElement.classList.add('reduce-motion');
  }
  
  // High contrast
  if (settings.high_contrast) {
    document.documentElement.setAttribute('data-contrast', 'high');
  } else {
    document.documentElement.removeAttribute('data-contrast');
  }
  
  // Data saver
  // This would affect image loading quality
  
  // Sound check (approximate)
  // Applied per-track in playSong
}

function openSettingsView() {
  loadSettings();
  switchView('settings');
}

// ============================================================================
// ACCOUNT VIEW
// ============================================================================
async function loadAccountData() {
  try {
    const user = await API.getSettings(); // This gets current user via /api/auth/me
    // Actually need to call /api/auth/me
    const response = await fetch('/api/auth/me', { credentials: 'include' });
    const userData = await response.json();
    
    renderAccountProfile(userData);
    loadSessions();
  } catch (err) {
    console.error('Failed to load account:', err);
  }
}

function renderAccountProfile(user) {
  // Update profile header
  const avatar = document.getElementById('sidebarAvatar') || document.getElementById('accountAvatar');
  const nameEl = document.getElementById('sidebarName') || document.getElementById('accountName');
  const emailEl = document.getElementById('accountEmail');
  
  if (avatar) avatar.textContent = user.display_name.charAt(0).toUpperCase();
  if (nameEl) nameEl.textContent = user.display_name;
  if (emailEl) emailEl.textContent = user.email;
}

async function loadSessions() {
  // This would need a new endpoint /api/sessions
  // For now, show current session only
  const container = document.getElementById('sessionsList');
  if (!container) return;
  
  container.innerHTML = `
    <div class="session-item current">
      <div class="session-device">Current Device</div>
      <div class="session-info">Active now</div>
      <span class="badge current-badge">Current</span>
    </div>
  `;
}

// ============================================================================
// LIKES INTEGRATION
// ============================================================================
async function toggleLike(song) {
  const songId = song.id || song.ytId;
  const isCurrentlyLiked = isLiked(songId);
  
  try {
    if (isCurrentlyLiked) {
      await API.removeLike(song.ytId);
      S.likedSongs = S.likedSongs.filter(s => (s.id || s.ytId) !== songId);
      showToast('Removed from Liked Songs');
    } else {
      await API.addLike({
        yt_id: song.ytId,
        title: song.title,
        artist: song.artist,
        album: song.album,
        duration: song.dur
      });
      S.likedSongs.push({
        id: song.id || song.ytId,
        ytId: song.ytId,
        title: song.title,
        artist: song.artist,
        album: song.album,
        dur: song.dur,
        grad: song.grad || `linear-gradient(135deg, hsl(${hashCode(song.ytId) % 360}, 80%, 25%), hsl(${hashCode(song.ytId) + 45) % 360}, 80%, 40%))`
      });
      showToast('Added to Liked Songs');
    }
    
    // Update UI
    updateLikeButtons(songId, !isCurrentlyLiked);
    updateLikedHeroRow();
    
    // If in liked view, reload
    if (S.view === 'liked') {
      renderLikedSongsView();
    }
  } catch (err) {
    console.error('Failed to toggle like:', err);
    showToast('Failed to update like');
  }
}

function updateLikeButtons(songId, liked) {
  document.querySelectorAll(`[data-yt-id="${songId}"] .row-action-btn.liked, [data-id="${songId}"] .row-action-btn.liked`).forEach(btn => {
    btn.classList.toggle('liked', liked);
  });
  
  // Player like button
  const playerLikeBtn = document.getElementById('playerLikeBtn');
  if (playerLikeBtn && S.cur && (S.cur.id === songId || S.cur.ytId === songId)) {
    playerLikeBtn.classList.toggle('liked', liked);
  }
}

// ============================================================================
// HISTORY INTEGRATION (Debounced)
// ============================================================================
let historyDebounceTimer = null;

function logPlayToHistory(song) {
  if (!song || !song.ytId) return;
  
  // Check if history is enabled in settings
  const settings = JSON.parse(localStorage.getItem('neuro_settings') || '{}');
  if (settings.use_listening_history === false) return;
  
  // Debounce
  if (historyDebounceTimer) clearTimeout(historyDebounceTimer);
  historyDebounceTimer = setTimeout(async () => {
    try {
      await API.addHistory({
        yt_id: song.ytId,
        title: song.title,
        artist: song.artist
      });
    } catch (err) {
      // Silently fail - history is fire-and-forget
      console.warn('Failed to log play history:', err);
    }
  }, 2000); // 2 second debounce
}

// ============================================================================
// LYRICS DRAWER
// ============================================================================
async function openLyricsDrawer() {
  if (!S.cur) return;
  
  const drawer = document.getElementById('lyricsScreen');
  const list = document.getElementById('lyricList');
  
  // Show loading state
  list.innerHTML = '<div class="search-status">Loading lyrics...</div>';
  drawer.classList.add('open');
  
  try {
    // Fetch lyrics from backend (proxies lrclib.net)
    const response = await fetch(`/api/lyrics?title=${encodeURIComponent(S.cur.title)}&artist=${encodeURIComponent(S.cur.artist)}`, {
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (data.syncedLyrics) {
      // Render synced lyrics
      renderSyncedLyrics(data.syncedLyrics);
    } else if (data.plainLyrics) {
      // Render plain lyrics
      list.innerHTML = data.plainLyrics.split('\n').map(line => 
        `<p>${escapeHtml(line)}</p>`
      ).join('');
    } else {
      list.innerHTML = `
        <div class="empty-state">
          <i data-lucide="mic-off"></i>
          <p>No lyrics found</p>
        </div>
      `;
    }
  } catch (err) {
    console.error('Failed to load lyrics:', err);
    list.innerHTML = `
      <div class="empty-state">
        <i data-lucide="alert-triangle"></i>
        <p>Failed to load lyrics</p>
      </div>
    `;
  }
  
  lucide.createIcons();
}

function renderSyncedLyrics(lyrics) {
  const list = document.getElementById('lyricList');
  // lyrics format: [{time: 12.5, text: "Line 1"}, ...]
  list.innerHTML = lyrics.map((line, index) => `
    <p class="${index === 0 ? 'now' : ''}" data-time="${line.time}">
      ${escapeHtml(line.text)}
    </p>
  `).join('');
  
  // Auto-scroll would be implemented here
}

// ============================================================================
// NEW VIEW
// ============================================================================
async function loadNewView() {
  // Fetch editorial data from /api/new (to be implemented)
  // For now, show curated categories
  renderNewCategories();
}

function renderNewCategories() {
  const container = document.getElementById('newReleasesPanel');
  if (!container) return;
  
  const categories = [
    { label: 'HOT PLAYLIST', title: 'Today\'s Top Hits', query: 'today top hits', gradient: 'linear-gradient(135deg, #ff6b6b, #ee5a5a)' },
    { label: 'NEW ALBUM', title: 'Latest Releases', query: 'new album 2024', gradient: 'linear-gradient(135deg, #4ecdc4, #44a08d)' },
    { label: 'HOT PLAYLIST', title: 'Viral on YouTube', query: 'viral songs', gradient: 'linear-gradient(135deg, #a8edea, #fed6e3)' },
    { label: 'NEW ALBUM', title: 'Emerging Artists', query: 'emerging artists', gradient: 'linear-gradient(135deg, #ff9a9e, #fecfef)' }
  ];
  
  container.innerHTML = categories.map(cat => `
    <div class="hero-card" style="background:${cat.gradient}" onclick="searchCategory('${cat.query}')">
      <span class="hero-tag">${cat.label}</span>
      <h3>${escapeHtml(cat.title)}</h3>
      <p>Tap to explore</p>
    </div>
  `).join('');
  
  lucide.createIcons();
}

function searchCategory(query) {
  const searchInput = document.getElementById('newSearchInput') || document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = query;
    document.getElementById('newSearchClearBtn')?.classList.add('visible');
    performBackendSearch(query);
    switchView('search');
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function openConfirmModal(title, message, onConfirm) {
  // Reuse existing modal or create a simple one
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn-primary" onclick="this.closest('.modal-overlay').remove(); ${onConfirm.toString().replace(/^.*?\{|\}$/g, '')}">Confirm</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.classList.add('open');
}

// Initialize new features when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize context menu
  createContextMenu();
  
  // Initialize play next queue rendering
  renderPlayNextQueue();
  
  // Load library data when library view is shown
  document.getElementById('sidebarLibrary')?.addEventListener('click', loadLibraryData);
  document.getElementById('dockLibrary')?.addEventListener('click', loadLibraryData);
  
  // Load home data when home view is shown
  document.getElementById('sidebarHome')?.addEventListener('click', loadHomeData);
  document.getElementById('dockHome')?.addEventListener('click', loadHomeData);
  
  // Load settings when settings view is shown
  document.getElementById('sidebarSettings')?.addEventListener('click', loadSettings);
  
  // Load account when account view is shown
  document.getElementById('sidebarAccount')?.addEventListener('click', loadAccountData);
  
  // Load new view when new view is shown
  document.getElementById('sidebarNew')?.addEventListener('click', loadNewView);
});