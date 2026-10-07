// ============================================================================
// NEURO MUSIC — CORE JAVASCRIPT ENGINE (Glass UI + Backend + Audio + PWA)
// ============================================================================

/* ==== UTILITIES & HTML ESCAPING ==== */
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  const el = document.createElement('div');
  el.textContent = String(value);
  return el.innerHTML;
}
window.escapeHtml = escapeHtml;

function hashCode(str) {
  str = String(str || '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getGradientForId(id) {
  const h = hashCode(id || 'music');
  return `linear-gradient(135deg, hsl(${h % 360}, 80%, 25%), hsl(${(h + 45) % 360}, 80%, 40%))`;
}

function formatTime(secs) {
  secs = Math.max(0, Math.floor(Number(secs) || 0));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

let _toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    t.classList.remove('show');
  }, 2600);
}
window.showToast = showToast;

/* ==== IN-MEMORY TRACK & PLAYLIST REGISTRY ==== */
const _trackRegistry = new Map();
const _playlistRegistry = new Map();

function registerTrack(track) {
  if (!track) return '';
  const key = String(track.ytId || track.yt_id || track.id || (track.title + '-' + track.artist));
  _trackRegistry.set(key, track);
  return key;
}

function getTrack(trackOrKey) {
  if (!trackOrKey) return null;
  if (typeof trackOrKey === 'object') return trackOrKey;
  return _trackRegistry.get(String(trackOrKey)) || null;
}

function registerPlaylist(pl) {
  if (!pl) return '';
  const key = String(pl.id);
  _playlistRegistry.set(key, pl);
  return key;
}

function getPlaylist(plOrKey) {
  if (!plOrKey) return null;
  if (typeof plOrKey === 'object') return plOrKey;
  return _playlistRegistry.get(String(plOrKey)) || null;
}

/* ==== 1. CURATED MUSIC DATA ==== */
const SONGS = [
  { id: 101, title: "Fade", artist: "Alan Walker", album: "NCS Releases", dur: 260, icon: "music", grad: "linear-gradient(135deg,#093028,#237a57)", ytId: "_F0xihSJ31Y", genre: "Electronic" },
  { id: 102, title: "On & On", artist: "Cartoon ft. Daniel Levi", album: "NCS Top Hits", dur: 208, icon: "headphones", grad: "linear-gradient(135deg,#2d1b69,#11998e)", ytId: "TI9w3sLjrqo", genre: "Electronic" },
  { id: 103, title: "The Spectre", artist: "Alan Walker", album: "NCS Top Hits", dur: 193, icon: "radio", grad: "linear-gradient(135deg,#1f1c2c,#928dab)", ytId: "lNM9HlEK4q4", genre: "Electronic" },
  { id: 104, title: "Heroes Tonight", artist: "Janji ft. Johnning", album: "NCS Top Hits", dur: 208, icon: "flame", grad: "linear-gradient(135deg,#833ab4,#fd1d1d)", ytId: "3nQNiWdeH2Q", genre: "Gaming" },
  { id: 105, title: "Lofi Beats & Chill", artist: "Lofi Girl & Lumosound", album: "Lofi Sessions", dur: 360, icon: "coffee", grad: "linear-gradient(135deg,#1a1a3e,#4a4aaa)", ytId: "kAw9xGI8vgk", genre: "Lofi" },
  { id: 106, title: "Alone", artist: "Marshmello", album: "Joytime", dur: 199, icon: "disc", grad: "linear-gradient(135deg,#20002c,#cbb4d4)", ytId: "OBs1Fb8adGQ", genre: "Electronic" },
  { id: 107, title: "Mortals", artist: "Warriyo ft. Laura Brehm", album: "NCS Top Hits", dur: 228, icon: "zap", grad: "linear-gradient(135deg,#000428,#004e92)", ytId: "BOMFt9OCsT0", genre: "Electronic" },
  { id: 108, title: "Fly Away", artist: "TheFatRat ft. Anjulie", album: "Warrior Songs", dur: 194, icon: "sparkles", grad: "linear-gradient(135deg,#360033,#0b8793)", ytId: "4nivniaycwQ", genre: "Gaming" },
  { id: 109, title: "Monody", artist: "TheFatRat ft. Laura Brehm", album: "Warrior Songs", dur: 290, icon: "sun", grad: "linear-gradient(135deg,#00b4db,#0083b0)", ytId: "E3Vyt0Vs_90", genre: "Gaming" },
  { id: 110, title: "Invincible", artist: "DEAF KEV", album: "NCS Top Hits", dur: 273, icon: "activity", grad: "linear-gradient(135deg,#eb3349,#f45c43)", ytId: "bSdnOdmDtvQ", genre: "Electronic" },
  { id: 111, title: "Beautiful Now", artist: "Zedd ft. Jon Bellion", album: "True Colors", dur: 218, icon: "music", grad: "linear-gradient(135deg,#8f7bff,#d9c9ff)", ytId: "67_ZA1zLlXA", genre: "Electronic" },
  { id: 112, title: "True Colors", artist: "Zedd", album: "True Colors", dur: 228, icon: "star", grad: "linear-gradient(135deg,#54e0c7,#8f7bff)", ytId: "OXfqC_K7hwg", genre: "Electronic" }
];

const ALBUMS = [
  { id: 1, name: "NCS Top Hits", artist: "NoCopyrightSounds", grad: "linear-gradient(135deg,#0f0c29,#302b63,#24243e)", count: 5, songIds: [102, 103, 104, 107, 110] },
  { id: 2, name: "True Colors", artist: "Zedd", grad: "linear-gradient(135deg,#241c58,#140f30)", count: 2, songIds: [111, 112] },
  { id: 3, name: "Warrior Songs", artist: "TheFatRat", grad: "linear-gradient(135deg,#360033,#0b8793)", count: 2, songIds: [108, 109] },
  { id: 4, name: "Chill & Lofi Beats", artist: "Lofi Girl", grad: "linear-gradient(135deg,#093028,#237a57)", count: 1, songIds: [105] }
];

const ARTISTS = [
  { name: "Alan Walker", grad: "linear-gradient(135deg,#093028,#237a57)", query: "Alan Walker" },
  { name: "Marshmello", grad: "linear-gradient(135deg,#8f7bff,#d9c9ff)", query: "Marshmello" },
  { name: "Zedd", grad: "linear-gradient(135deg,#54e0c7,#8f7bff)", query: "Zedd" },
  { name: "TheFatRat", grad: "linear-gradient(135deg,#360033,#0b8793)", query: "TheFatRat" },
  { name: "Lofi Girl", grad: "linear-gradient(135deg,#1a1a3e,#4a4aaa)", query: "Lofi Girl" },
  { name: "Cartoon", grad: "linear-gradient(135deg,#2d1b69,#11998e)", query: "Cartoon" }
];

/* ==== 2. APPLICATION STATE ==== */
function _loadLiked() {
  try {
    const raw = localStorage.getItem('neuro_liked_songs');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [SONGS[0], SONGS[1], SONGS[10]];
}

function _loadPlaylists() {
  try {
    const raw = localStorage.getItem('neuro_pls');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [
    { id: "pl_focus", name: "Late Night Focus", desc: "Ambient & Electronic", tracks: [SONGS[4], SONGS[0], SONGS[1]] },
    { id: "pl_hype", name: "Gym & Energy", desc: "High Energy Beats", tracks: [SONGS[1], SONGS[2], SONGS[3], SONGS[7]] }
  ];
}

const S = {
  cur: null,
  idx: -1,
  queue: [...SONGS],
  playing: false,
  shuffle: false,
  repeat: false,
  mute: false,
  vol: 0.7,
  likedSongs: _loadLiked(),
  pls: _loadPlaylists(),
  activePlaylist: null,
  view: 'home',
  radioQueue: [],
  radioPlaying: false,
  searchDebounceTimer: null,
  progressTimer: null,
  pendingAddSong: null,
  pendingSong: null,
  user: null
};

function isLiked(id) {
  if (!id) return false;
  return S.likedSongs.some(s => s.id === id || (s.ytId && s.ytId === id) || (s.yt_id && s.yt_id === id));
}

/* ==== 3. PERSISTENT BACKGROUND AUDIO KEEP-ALIVE ==== */
const SILENT_AUDIO_WAV = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
let keepAliveEl = null;

function initKeepAliveAudio() {
  keepAliveEl = document.getElementById('keepAliveAudio');
  if (keepAliveEl) {
    keepAliveEl.src = SILENT_AUDIO_WAV;
    keepAliveEl.volume = 0.01;
  }
}

function startKeepAliveAudio() {
  if (keepAliveEl) {
    keepAliveEl.play().catch(() => {});
  }
}

function pauseKeepAliveAudio() {
  if (keepAliveEl) {
    keepAliveEl.pause();
  }
}

/* ==== 4. YOUTUBE IFRAME ENGINE ==== */
let ytPlayer = null;
let ytReady = false;

function loadYTAPI() {
  if (window.YT && window.YT.Player) {
    initYTPlayer();
    return;
  }
  const tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  const firstScriptTag = document.getElementsByTagName('script')[0];
  if (firstScriptTag && firstScriptTag.parentNode) {
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  } else {
    document.head.appendChild(tag);
  }
}

window.onYouTubeIframeAPIReady = function() {
  initYTPlayer();
};

function initYTPlayer() {
  try {
    const origin = window.location.origin;
    const playerVars = {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      fs: 0,
      playsinline: 1,
      enablejsapi: 1,
      rel: 0
    };
    if (origin && origin.startsWith('http')) {
      playerVars.origin = origin;
      playerVars.widget_referrer = origin;
    }

    ytPlayer = new YT.Player('yt-player', {
      height: '180',
      width: '240',
      playerVars: playerVars,
      events: {
        onReady: onYTReady,
        onStateChange: onYTStateChange,
        onError: onYTError
      }
    });
  } catch (err) {
    console.error("YT Player init failed:", err);
  }
}

function onYTReady() {
  ytReady = true;
  console.log("YouTube Player is ready");
  if (ytPlayer) {
    ytPlayer.setVolume(S.vol * 100);
    if (S.pendingSong) {
      const pSong = S.pendingSong;
      S.pendingSong = null;
      playSong(pSong);
    }
  }
}

function onYTStateChange(e) {
  if (e.data === YT.PlayerState.PLAYING) {
    S.playing = true;
    startKeepAliveAudio();
    updatePlayingUI(true);
    startProgress();
  } else if (e.data === YT.PlayerState.PAUSED) {
    S.playing = false;
    pauseKeepAliveAudio();
    updatePlayingUI(false);
    stopProgress();
  } else if (e.data === YT.PlayerState.ENDED) {
    if (S.repeat) {
      if (ytPlayer && ytPlayer.seekTo) {
        ytPlayer.seekTo(0, true);
        ytPlayer.playVideo();
      }
    } else {
      nextTrack();
    }
  }
}

function onYTError(e) {
  console.warn("YT Player error code:", e.data);
  showToast("Audio unavailable for this track, playing next...");
  setTimeout(() => nextTrack(), 1000);
}

/* ==== 5. PLAYBACK CONTROLS ==== */
function getSoundCheckGain(song) {
  const settings = JSON.parse(localStorage.getItem('neuro_settings') || '{}');
  if (!settings.sound_check) return 1.0;
  const dur = song.dur || 180;
  if (dur < 120) return 0.85;
  if (dur > 300) return 1.1;
  return 1.0;
}

function playSong(song, newQueue) {
  if (!song) return;
  const ytId = song.ytId || song.yt_id;
  if (!ytId) return;

  const normalized = {
    ...song,
    ytId: ytId,
    id: song.id || ytId,
    title: song.title || 'Unknown Track',
    artist: song.artist || 'Unknown Artist',
    grad: song.grad || getGradientForId(ytId)
  };

  if (newQueue && newQueue.length) {
    S.queue = [...newQueue];
  }
  S.cur = normalized;
  S.idx = S.queue.findIndex(s => (s.ytId || s.yt_id) === ytId);
  if (S.idx === -1) {
    S.queue.unshift(normalized);
    S.idx = 0;
  }

  S.playing = true;
  startKeepAliveAudio();
  updateMediaSession(normalized);
  renderPlayerDetails();
  renderMiniPlayer();
  renderQueueList();
  highlightActiveRows();
  updatePlayingUI(true);
  saveState();
  logPlayToHistory(normalized);
  document.title = `${normalized.title} — Neuro Music`;

  if (ytPlayer && ytReady && ytPlayer.loadVideoById) {
    try {
      ytPlayer.loadVideoById({
        videoId: ytId,
        startSeconds: 0
      });
      if (S.mute) ytPlayer.mute(); else ytPlayer.unMute();
      const gain = getSoundCheckGain(normalized);
      const effectiveVol = Math.min(1, S.vol * gain);
      ytPlayer.setVolume(effectiveVol * 100);
      ytPlayer.playVideo();
    } catch (e) {
      console.error("Error playing video:", e);
    }
  } else {
    S.pendingSong = normalized;
    loadYTAPI();
    showToast("Starting player...");
  }
}

function togglePlay() {
  if (!S.cur) {
    if (S.queue.length) playSong(S.queue[0]);
    return;
  }
  if (!ytPlayer || !ytReady) {
    playSong(S.cur);
    return;
  }

  const pState = ytPlayer.getPlayerState ? ytPlayer.getPlayerState() : -1;
  if (S.playing || pState === 1) {
    ytPlayer.pauseVideo();
    S.playing = false;
    pauseKeepAliveAudio();
    updatePlayingUI(false);
  } else {
    ytPlayer.playVideo();
    S.playing = true;
    startKeepAliveAudio();
    updatePlayingUI(true);
  }
}

function nextTrack() {
  // Check play next queue first
  if (S.playNextQueue && S.playNextQueue.length > 0) {
    const nextSong = S.playNextQueue.shift();
    renderPlayNextQueue();
    playSong(nextSong);
    return;
  }

  if (!S.queue.length) return;
  if (S.shuffle) {
    S.idx = Math.floor(Math.random() * S.queue.length);
  } else {
    S.idx = (S.idx + 1) % S.queue.length;
  }
  playSong(S.queue[S.idx]);
}

function prevTrack() {
  if (ytPlayer && ytReady && ytPlayer.getCurrentTime && ytPlayer.getCurrentTime() > 3) {
    ytPlayer.seekTo(0, true);
    return;
  }
  if (!S.queue.length) return;
  S.idx = (S.idx - 1 + S.queue.length) % S.queue.length;
  playSong(S.queue[S.idx]);
}

function toggleShuffle() {
  S.shuffle = !S.shuffle;
  const btn = document.getElementById('playerShuffleBtn');
  if (btn) btn.classList.toggle('active', S.shuffle);
  showToast(S.shuffle ? "Shuffle On" : "Shuffle Off");
  saveState();
}

function toggleRepeat() {
  S.repeat = !S.repeat;
  const btn = document.getElementById('playerRepeatBtn');
  if (btn) btn.classList.toggle('active', S.repeat);
  showToast(S.repeat ? "Repeat On" : "Repeat Off");
  saveState();
}

function toggleMute() {
  S.mute = !S.mute;
  if (ytPlayer && ytReady) {
    if (S.mute) ytPlayer.mute(); else ytPlayer.unMute();
  }
  updateVolumeUI();
  saveState();
}

function setVolume(v) {
  S.vol = Math.max(0, Math.min(1, v));
  S.mute = false;
  if (ytPlayer && ytReady) {
    ytPlayer.unMute();
    ytPlayer.setVolume(S.vol * 100);
  }
  updateVolumeUI();
  saveState();
}

function seekTo(fraction) {
  if (!ytPlayer || !ytReady || !ytPlayer.getDuration) return;
  const dur = ytPlayer.getDuration();
  if (dur > 0) {
    const target = dur * Math.max(0, Math.min(1, fraction));
    ytPlayer.seekTo(target, true);
  }
}

/* ==== UI RENDERING FOR PLAYER ==== */
function updatePlayingUI(isPlaying) {
  const mainIco = document.getElementById('playerMainPlayIcon');
  if (mainIco) {
    mainIco.setAttribute('data-lucide', isPlaying ? 'pause' : 'play');
    lucide.createIcons({ nodes: [mainIco] });
  }
  const miniIco = document.getElementById('miniPlayIcon');
  if (miniIco) {
    miniIco.setAttribute('data-lucide', isPlaying ? 'pause' : 'play');
    lucide.createIcons({ nodes: [miniIco] });
  }
  const playerScreen = document.getElementById('playerScreen');
  if (playerScreen) {
    playerScreen.classList.toggle('playing', isPlaying);
  }
  const miniBar = document.getElementById('miniPlayerBar');
  if (miniBar && S.cur) {
    miniBar.classList.remove('hidden');
  }
  highlightActiveRows();
}

function renderPlayerDetails() {
  const s = S.cur;
  if (!s) return;
  const titleEl = document.getElementById('playerTitle');
  const artistEl = document.getElementById('playerArtist');
  if (titleEl) titleEl.textContent = s.title;
  if (artistEl) artistEl.textContent = s.artist;
  
  const artEl = document.getElementById('playerArt');
  if (artEl) {
    if (s.thumbnail) {
      artEl.style.backgroundImage = `url("${s.thumbnail}")`;
      artEl.style.backgroundSize = 'cover';
      artEl.style.backgroundPosition = 'center';
      artEl.innerHTML = '';
    } else {
      artEl.style.backgroundImage = 'none';
      artEl.style.background = s.grad || getGradientForId(s.ytId || s.id);
      artEl.innerHTML = `<i data-lucide="${s.icon || 'music'}"></i>`;
      lucide.createIcons({ nodes: [artEl] });
    }
  }

  const likeBtn = document.getElementById('playerLikeBtn');
  if (likeBtn) {
    likeBtn.classList.toggle('liked', isLiked(s.id || s.ytId));
  }
}

function renderMiniPlayer() {
  const s = S.cur;
  if (!s) return;
  const miniBar = document.getElementById('miniPlayerBar');
  if (miniBar) miniBar.classList.remove('hidden');

  const titleEl = document.getElementById('miniTitle');
  const artistEl = document.getElementById('miniArtist');
  if (titleEl) titleEl.textContent = s.title;
  if (artistEl) artistEl.textContent = s.artist;

  const artEl = document.getElementById('miniArt');
  if (artEl) {
    if (s.thumbnail) {
      artEl.style.backgroundImage = `url("${s.thumbnail}")`;
      artEl.style.backgroundSize = 'cover';
      artEl.style.backgroundPosition = 'center';
      artEl.innerHTML = '';
    } else {
      artEl.style.backgroundImage = 'none';
      artEl.style.background = s.grad || getGradientForId(s.ytId || s.id);
      artEl.innerHTML = `<i data-lucide="${s.icon || 'music'}"></i>`;
      lucide.createIcons({ nodes: [artEl] });
    }
  }
}

function renderQueueList() {
  const el = document.getElementById('playerQueueList');
  if (!el) return;
  el.innerHTML = '';
  const upcoming = S.queue.slice(S.idx + 1, S.idx + 12);
  if (!upcoming.length) {
    el.innerHTML = '<div style="padding:14px;color:var(--text-muted);font-size:13px;text-align:center;">End of queue</div>';
    return;
  }
  upcoming.forEach(song => {
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.id = song.id || song.ytId;
    const coverStyle = song.thumbnail
      ? `background-image:url("${song.thumbnail}");background-size:cover;background-position:center;`
      : `background:${song.grad || getGradientForId(song.ytId || song.id)};`;
    row.innerHTML = `
      <div class="cover" style="${coverStyle}">
        ${song.thumbnail ? '' : `<i data-lucide="${song.icon || 'music'}"></i>`}
      </div>
      <div class="meta">
        <div class="t">${escapeHtml(song.title)}</div>
        <div class="a">${escapeHtml(song.artist)}</div>
      </div>
    `;
    row.onclick = () => playSong(song);
    el.appendChild(row);
  });
  lucide.createIcons();
}

function highlightActiveRows() {
  const curYtId = S.cur?.ytId || S.cur?.yt_id;
  const curId = S.cur?.id;
  document.querySelectorAll('.row, .card, .song-grid-item').forEach(el => {
    const id = el.dataset.id || el.dataset.ytId;
    const isCur = id && (id == curId || id == curYtId);
    el.classList.toggle('playing', Boolean(isCur && S.playing));
    el.classList.toggle('active', Boolean(isCur));
  });
}

function updateVolumeUI() {
  const slider = document.getElementById('playerVolumeSlider');
  if (slider) {
    slider.value = S.mute ? 0 : Math.round(S.vol * 100);
  }
  const icon = document.getElementById('volumeIcon');
  if (icon) {
    const iconName = (S.mute || S.vol === 0) ? 'volume-x' : (S.vol < 0.5 ? 'volume-1' : 'volume-2');
    icon.setAttribute('data-lucide', iconName);
    lucide.createIcons({ nodes: [icon] });
  }
}

function saveState() {
  try {
    const snap = {
      cur: S.cur,
      vol: S.vol,
      shuffle: S.shuffle,
      repeat: S.repeat,
      view: S.view
    };
    localStorage.setItem('neuro_player_state', JSON.stringify(snap));
  } catch (e) {}
}

function restoreState() {
  try {
    const snap = JSON.parse(localStorage.getItem('neuro_player_state') || 'null');
    if (!snap) return;
    if (typeof snap.vol === 'number') S.vol = snap.vol;
    if (typeof snap.shuffle === 'boolean') {
      S.shuffle = snap.shuffle;
      document.getElementById('playerShuffleBtn')?.classList.toggle('active', S.shuffle);
    }
    if (typeof snap.repeat === 'boolean') {
      S.repeat = snap.repeat;
      document.getElementById('playerRepeatBtn')?.classList.toggle('active', S.repeat);
    }
    updateVolumeUI();
    if (snap.cur) {
      S.cur = snap.cur;
      renderPlayerDetails();
      renderMiniPlayer();
    }
  } catch (e) {}
}

function openFullscreenPlayer() {
  document.getElementById('playerScreen')?.classList.add('open');
}

function closeFullscreenPlayer() {
  document.getElementById('playerScreen')?.classList.remove('open');
}

/* ==== 6. PROGRESS TRACKING ==== */
function startProgress() {
  stopProgress();
  S.progressTimer = setInterval(updateProgressUI, 500);
}

function stopProgress() {
  if (S.progressTimer) {
    clearInterval(S.progressTimer);
    S.progressTimer = null;
  }
}

function updateProgressUI() {
  if (!ytPlayer || !ytReady || !ytPlayer.getCurrentTime) return;
  const curTime = ytPlayer.getCurrentTime() || 0;
  const dur = ytPlayer.getDuration() || (S.cur?.dur || 0);
  const pct = dur > 0 ? (curTime / dur) * 100 : 0;

  const fill = document.getElementById('playerScrubberFill');
  if (fill) fill.style.width = pct + '%';

  const miniFill = document.getElementById('miniProgressFill');
  if (miniFill) miniFill.style.width = pct + '%';

  const elapsedEl = document.getElementById('playerElapsed');
  const remEl = document.getElementById('playerRemaining');
  if (elapsedEl) elapsedEl.textContent = formatTime(curTime);
  if (remEl) remEl.textContent = '-' + formatTime(Math.max(0, dur - curTime));
}

/* ==== 7. MEDIA SESSION ==== */
function updateMediaSession(song) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: song.artist,
      album: song.album || "Neuro Music",
      artwork: [
        { src: song.thumbnail || '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: song.thumbnail || '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
      ]
    });

    navigator.mediaSession.setActionHandler('play', () => togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => togglePlay());
    navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
    navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime && ytPlayer && ytPlayer.seekTo) {
        ytPlayer.seekTo(details.seekTime, true);
      }
    });
  } catch (e) {
    console.warn("MediaSession error:", e);
  }
}

/* ==== 8. BACKEND SEARCH INTEGRATION ==== */
function initSearch() {
  const inputs = [
    { input: document.getElementById('searchInput'), clear: document.getElementById('searchClearBtn'), container: document.getElementById('searchResults') },
    { input: document.getElementById('searchInputFull'), clear: document.getElementById('searchClearBtnFull'), container: document.getElementById('searchResultsFull') },
    { input: document.getElementById('newSearchInput'), clear: document.getElementById('newSearchClearBtn'), container: null }
  ];

  inputs.forEach(({ input, clear, container }) => {
    if (!input) return;

    if (clear) {
      clear.addEventListener('click', () => {
        input.value = '';
        clear.classList.remove('visible');
        if (container) {
          renderSearchResults([], container);
          renderRecentSearches(container);
        }
      });
    }

    input.addEventListener('input', () => {
      const q = input.value.trim();
      if (clear) clear.classList.toggle('visible', q.length > 0);

      if (S.searchDebounceTimer) clearTimeout(S.searchDebounceTimer);
      if (!q) {
        if (container) {
          renderSearchResults([], container);
          renderRecentSearches(container);
        }
        return;
      }

      if (container) {
        container.innerHTML = '<div class="search-status">Searching YouTube Music...</div>';
      }

      S.searchDebounceTimer = setTimeout(() => {
        performBackendSearch(q, container);
      }, 300);
    });

    input.addEventListener('focus', () => {
      if (!input.value.trim() && container) {
        renderRecentSearches(container);
      }
    });
  });
}

function getRecentSearches() {
  try {
    const stored = localStorage.getItem('neuro_recent_searches');
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
}

function saveRecentSearch(query) {
  const recent = getRecentSearches();
  const filtered = recent.filter(q => q.toLowerCase() !== query.toLowerCase());
  filtered.unshift(query);
  if (filtered.length > 10) filtered.pop();
  localStorage.setItem('neuro_recent_searches', JSON.stringify(filtered));
}

function clearRecentSearches(targetContainer) {
  localStorage.removeItem('neuro_recent_searches');
  renderRecentSearches(targetContainer);
}

function renderRecentSearches(targetContainer) {
  const container = targetContainer || document.getElementById('searchResults') || document.getElementById('searchResultsFull');
  if (!container) return;
  const recent = getRecentSearches();
  if (!recent.length) return;

  container.innerHTML = `
    <div class="recent-searches-section">
      <div class="recent-searches-header">
        <span>Recent searches</span>
        <button class="clear-recent-btn" onclick="clearRecentSearches()" aria-label="Clear recent searches">
          <i data-lucide="x"></i>
        </button>
      </div>
      <div class="recent-searches-list">
        ${recent.map(q => `
          <button class="recent-search-item" onclick="selectRecentSearch('${escapeHtml(q).replace(/'/g, '&apos;')}')">
            <i data-lucide="clock"></i>
            <span>${escapeHtml(q)}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
  lucide.createIcons();
}

function selectRecentSearch(query) {
  const input = document.getElementById('searchInput') || document.getElementById('searchInputFull');
  if (input) {
    input.value = query;
    document.getElementById('searchClearBtn')?.classList.add('visible');
    document.getElementById('searchClearBtnFull')?.classList.add('visible');
    performBackendSearch(query);
  }
}

async function performBackendSearch(query, targetContainer) {
  const container = targetContainer || document.getElementById('searchResults') || document.getElementById('searchResultsFull');
  if (!container) return;

  container.innerHTML = `
    <div class="search-skeletons">
      ${Array.from({length: 4}, () => `
        <div class="skeleton-row">
          <div class="skeleton-cover"></div>
          <div class="skeleton-text">
            <div class="skeleton-title"></div>
            <div class="skeleton-artist"></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || 'Search failed');
    }
    const data = await res.json();
    renderSearchResults(data.results || [], container);
    if (data.results && data.results.length > 0) {
      saveRecentSearch(query);
    }
  } catch (err) {
    console.error('Backend search error:', err);
    container.innerHTML = `
      <div class="search-error">
        <i data-lucide="alert-triangle"></i>
        <p>Could not search. ${escapeHtml(err.message || 'Check your connection.')}</p>
        <button class="retry-btn" onclick="performBackendSearch('${escapeHtml(query).replace(/'/g, '&apos;')}')">
          <i data-lucide="refresh-cw"></i> Retry
        </button>
      </div>
    `;
    lucide.createIcons();
  }
}

function renderSearchResults(results, targetContainer) {
  const container = targetContainer || document.getElementById('searchResults') || document.getElementById('searchResultsFull');
  if (!container) return;
  container.innerHTML = '';

  if (!results.length) {
    container.innerHTML = `
      <div class="search-empty">
        <i data-lucide="music"></i>
        <p>No results found</p>
        <span>Try a different search term</span>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  results.forEach(song => {
    const key = registerTrack(song);
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.id = song.id || song.ytId;
    row.dataset.ytId = song.ytId;

    const coverStyle = song.thumbnail
      ? `background-image:url("${song.thumbnail}");background-size:cover;background-position:center;`
      : `background:${song.grad || getGradientForId(song.ytId)};`;

    row.innerHTML = `
      <div class="cover" style="${coverStyle}">
        ${song.thumbnail ? '' : '<i data-lucide="music"></i>'}
      </div>
      <div class="meta">
        <div class="t">${escapeHtml(song.title)}</div>
        <div class="a">${escapeHtml(song.artist)} • ${formatTime(song.dur || 0)}</div>
      </div>
      <div class="action-btns">
        <button class="row-action-btn ${isLiked(song.id || song.ytId) ? 'liked' : ''}" title="Like" onclick="event.stopPropagation(); toggleLike('${key}', event)">
          <i data-lucide="heart"></i>
        </button>
        <button class="row-action-btn" title="Add to Playlist" onclick="event.stopPropagation(); openAddToPlaylistModal('${key}', event)">
          <i data-lucide="plus"></i>
        </button>
        <button class="row-action-btn context-menu-btn" title="More options" onclick="event.stopPropagation(); showContextMenu(event, '${key}')">
          <i data-lucide="more-vertical"></i>
        </button>
      </div>
    `;
    row.onclick = () => {
      playSong(song, [song, ...S.queue]);
    };
    container.appendChild(row);
  });

  lucide.createIcons();
}

/* ==== 9. PLAY NEXT QUEUE ==== */
S.playNextQueue = [];

function addToPlayNext(songOrKey) {
  const song = getTrack(songOrKey) || songOrKey;
  if (!song) return;
  S.playNextQueue.unshift(song);
  renderPlayNextQueue();
  showToast('Added to Play Next');
}

function removeFromPlayNext(index) {
  S.playNextQueue.splice(index, 1);
  renderPlayNextQueue();
}

function renderPlayNextQueue() {
  const container = document.getElementById('playNextPanel') || document.getElementById('playNextList');
  if (!container) return;
  if (S.playNextQueue.length === 0) {
    container.innerHTML = '<div style="padding:10px;color:var(--text-muted);font-size:13px;">No tracks in Play Next queue</div>';
    return;
  }
  container.innerHTML = S.playNextQueue.map((song, idx) => `
    <div class="row">
      <div class="cover" style="background:${song.grad || getGradientForId(song.ytId || song.id)}"><i data-lucide="music"></i></div>
      <div class="meta">
        <div class="t">${escapeHtml(song.title)}</div>
        <div class="a">${escapeHtml(song.artist)}</div>
      </div>
      <button class="row-action-btn" onclick="removeFromPlayNext(${idx})"><i data-lucide="x"></i></button>
    </div>
  `).join('');
  lucide.createIcons();
}

/* ==== 10. CONTEXT MENU COMPONENT ==== */
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

  document.addEventListener('click', (e) => {
    if (contextMenu && !contextMenu.contains(e.target)) {
      hideContextMenu();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideContextMenu();
  });

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

function showContextMenu(event, songOrKey) {
  event.preventDefault();
  event.stopPropagation();
  if (!contextMenu) createContextMenu();

  const song = getTrack(songOrKey) || songOrKey;
  contextMenuTarget = song;

  const likeText = contextMenu.querySelector('.like-text');
  if (likeText && song) {
    likeText.textContent = isLiked(song.id || song.ytId) ? 'Unlike' : 'Like';
  }

  const rect = event.target.getBoundingClientRect();
  const menuRect = contextMenu.getBoundingClientRect();
  let left = rect.right + 8;
  let top = rect.top;
  if (left + (menuRect.width || 180) > window.innerWidth) {
    left = rect.left - (menuRect.width || 180) - 8;
  }
  if (top + (menuRect.height || 200) > window.innerHeight) {
    top = window.innerHeight - (menuRect.height || 200) - 8;
  }

  contextMenu.style.left = `${Math.max(8, left)}px`;
  contextMenu.style.top = `${Math.max(8, top)}px`;
  contextMenu.classList.add('open');
}

function hideContextMenu() {
  if (contextMenu) {
    contextMenu.classList.remove('open');
    contextMenuTarget = null;
  }
}

async function handleContextMenuAction(action, song) {
  if (!song) return;
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
    url: window.location.origin + '/?play=' + (song.ytId || song.yt_id)
  };
  if (navigator.share) {
    try { await navigator.share(shareData); } catch (e) {}
  } else {
    navigator.clipboard?.writeText(shareData.url).then(() => showToast('Link copied to clipboard')).catch(() => showToast('Failed to copy link'));
  }
}

function goToArtist(artistName) {
  const searchInput = document.getElementById('searchInput') || document.getElementById('searchInputFull');
  if (searchInput) {
    searchInput.value = artistName;
    document.getElementById('searchClearBtn')?.classList.add('visible');
    document.getElementById('searchClearBtnFull')?.classList.add('visible');
    performBackendSearch(artistName);
    switchView('search');
  }
}

function showPlaylistContextMenu(event, plOrKey) {
  event.preventDefault();
  event.stopPropagation();
  const playlist = getPlaylist(plOrKey) || plOrKey;
  if (!playlist) return;

  const menu = document.createElement('div');
  menu.className = 'context-menu open';
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
  menu.style.left = `${Math.min(window.innerWidth - 160, rect.right + 8)}px`;
  menu.style.top = `${rect.top}px`;

  menu.addEventListener('click', async (e) => {
    const item = e.target.closest('.context-menu-item');
    if (!item) return;
    const action = item.dataset.action;
    if (action === 'rename') {
      const newName = await promptAsync('Rename Playlist', 'New playlist name:', playlist.name);
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

  setTimeout(() => {
    document.addEventListener('click', () => menu.remove(), { once: true });
  }, 10);
  lucide.createIcons();
}

/* ==== 11. PLAYLIST DETAIL & MODALS ==== */
async function openPlaylistDetail(playlistId) {
  try {
    const playlist = await API.getPlaylist(playlistId);
    document.getElementById('playlistViewTitle').textContent = playlist.name;
    document.getElementById('playlistViewSubtext').textContent = `${playlist.track_count || (playlist.tracks ? playlist.tracks.length : 0)} songs`;

    const tracksContainer = document.getElementById('playlistTracksPanel');
    if (!playlist.tracks || playlist.tracks.length === 0) {
      tracksContainer.innerHTML = `
        <div class="empty-state">
          <i data-lucide="music"></i>
          <p>This playlist is empty</p>
          <p class="hint">Add songs from search or context menu</p>
        </div>
      `;
    } else {
      tracksContainer.innerHTML = playlist.tracks.map(track => {
        const key = registerTrack(track);
        return `
          <div class="row" data-track-id="${track.id}" data-yt-id="${track.yt_id || track.ytId}">
            <div class="cover" style="background:${track.grad || getGradientForId(track.yt_id || track.ytId)}">
              <i data-lucide="music"></i>
            </div>
            <div class="meta">
              <div class="t">${escapeHtml(track.title)}</div>
              <div class="a">${escapeHtml(track.artist)} ${track.duration ? '• ' + formatTime(track.duration) : ''}</div>
            </div>
            <div class="action-btns">
              <button class="row-action-btn" onclick="event.stopPropagation(); addToPlayNext('${key}')" title="Play Next">
                <i data-lucide="skip-back"></i>
              </button>
              <button class="row-action-btn context-menu-btn" onclick="event.stopPropagation(); showContextMenu(event, '${key}')" title="More options">
                <i data-lucide="more-vertical"></i>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

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
  if (!playlist || !playlist.tracks || !playlist.tracks.length) return;
  const mapped = playlist.tracks.map(t => ({
    ...t,
    ytId: t.yt_id || t.ytId,
    grad: t.grad || getGradientForId(t.yt_id || t.ytId)
  }));
  playSong(mapped[0], mapped);
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

function openCreatePlaylistModal() {
  const modal = document.getElementById('createPlaylistModal');
  const input = document.getElementById('newPlaylistInput');
  if (!modal || !input) return;
  input.value = '';
  modal.classList.add('open');
  input.focus();
}

async function handleConfirmCreatePlaylist() {
  const modal = document.getElementById('createPlaylistModal');
  const input = document.getElementById('newPlaylistInput');
  const name = input ? input.value.trim() : '';
  if (!name) return;

  try {
    await API.createPlaylist(name);
    showToast('Playlist created');
    if (modal) modal.classList.remove('open');
    loadLibraryData();
  } catch (err) {
    // Guest fallback
    const newPl = { id: 'pl_' + Date.now(), name: name, tracks: [] };
    S.pls.push(newPl);
    localStorage.setItem('neuro_pls', JSON.stringify(S.pls));
    showToast('Playlist created');
    if (modal) modal.classList.remove('open');
    renderLibrary();
  }
}

function openAddToPlaylistModal(songOrKey, event) {
  if (event) event.stopPropagation();
  const song = getTrack(songOrKey) || songOrKey;
  if (!song) return;
  S.pendingAddSong = song;

  const modal = document.getElementById('addToPlaylistModal');
  const choices = document.getElementById('addToPlaylistChoices');
  if (!modal || !choices) return;

  if (!S.pls.length) {
    choices.innerHTML = `
      <div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px;">
        No playlists found.<br>
        <button class="btn-primary" style="margin-top:12px;" onclick="document.getElementById('addToPlaylistModal').classList.remove('open');openCreatePlaylistModal();">+ Create New Playlist</button>
      </div>
    `;
  } else {
    choices.innerHTML = S.pls.map(pl => `
      <div class="row" style="cursor:pointer;" onclick="confirmAddTrackToPlaylist('${pl.id}')">
        <div class="cover" style="background:${pl.grad || 'var(--accent)'};"><i data-lucide="list-music"></i></div>
        <div class="meta">
          <div class="t">${escapeHtml(pl.name)}</div>
          <div class="a">${pl.trackCount || (pl.tracks ? pl.tracks.length : 0)} songs</div>
        </div>
      </div>
    `).join('');
    lucide.createIcons();
  }
  modal.classList.add('open');
}

async function confirmAddTrackToPlaylist(playlistId) {
  const song = S.pendingAddSong;
  const modal = document.getElementById('addToPlaylistModal');
  if (!song) return;

  try {
    await API.addTrackToPlaylist(playlistId, {
      yt_id: song.ytId || song.yt_id,
      title: song.title,
      artist: song.artist,
      album: song.album || '',
      duration: song.dur || song.duration || 0
    });
    showToast('Added to playlist');
    if (modal) modal.classList.remove('open');
    loadLibraryData();
  } catch (err) {
    const localPl = S.pls.find(p => String(p.id) === String(playlistId));
    if (localPl) {
      if (!localPl.tracks) localPl.tracks = [];
      localPl.tracks.push(song);
      localStorage.setItem('neuro_pls', JSON.stringify(S.pls));
      showToast('Added to playlist');
      if (modal) modal.classList.remove('open');
      renderPlaylistsPanel();
    } else {
      showToast('Failed to add track');
    }
  }
}

function openAlbumDetail(albumId) {
  const album = ALBUMS.find(a => a.id == albumId);
  if (album) {
    searchCategory(album.name + ' ' + album.artist);
  }
}

/* ==== 12. LIBRARY CORE ==== */
async function loadLibraryData() {
  try {
    const playlists = await API.getPlaylists();
    if (Array.isArray(playlists)) {
      S.pls = playlists.map(p => ({ ...p, trackCount: p.track_count }));
    }
  } catch (e) {}

  try {
    const likes = await API.getLikes();
    if (Array.isArray(likes)) {
      S.likedSongs = likes.map(l => ({
        id: l.id,
        ytId: l.yt_id,
        title: l.title,
        artist: l.artist,
        album: l.album,
        dur: l.duration,
        grad: getGradientForId(l.yt_id)
      }));
    }
  } catch (e) {}

  renderLibrary();
}

function renderLibrary() {
  updateLikedHeroRow();
  renderPlaylistsPanel();
  renderAlbumsRail();
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
  container.innerHTML = S.pls.map(pl => {
    registerPlaylist(pl);
    return `
      <div class="row" data-playlist-id="${pl.id}" onclick="openPlaylistDetail('${pl.id}')">
        <div class="cover" style="background:${pl.grad || 'linear-gradient(135deg,#5b3df0,#9db4ff)'}">
          <i data-lucide="list-music"></i>
        </div>
        <div class="meta">
          <div class="t">${escapeHtml(pl.name)}</div>
          <div class="a">${pl.trackCount || (pl.tracks ? pl.tracks.length : 0)} songs</div>
        </div>
        <div class="action-btns">
          <button class="row-action-btn context-menu-btn" onclick="event.stopPropagation(); showPlaylistContextMenu(event, '${pl.id}')" title="More options">
            <i data-lucide="more-vertical"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
  lucide.createIcons();
}

function renderSidebarPlaylists() {
  const container = document.getElementById('sidebarPlaylistsList');
  if (!container) return;
  container.innerHTML = S.pls.map(pl => `
    <div class="sidebar-pl-item" data-playlist-id="${pl.id}" onclick="openPlaylistDetail('${pl.id}')">
      <i data-lucide="list-music"></i>
      <span>${escapeHtml(pl.name)}</span>
      <span class="sidebar-badge">${pl.trackCount || (pl.tracks ? pl.tracks.length : 0)}</span>
    </div>
  `).join('');
  lucide.createIcons();
}

function renderAlbumsRail() {
  const container = document.getElementById('albumsRail');
  if (!container) return;
  container.innerHTML = ALBUMS.map(album => `
    <div class="card" onclick="openAlbumDetail(${album.id})" style="--c1:#360033;--c2:#0b8793">
      <div class="art" style="background:${album.grad}">
        <i data-lucide="disc"></i>
      </div>
      <div class="t">${escapeHtml(album.name)}</div>
      <div class="a">${escapeHtml(album.artist)}</div>
    </div>
  `).join('');
  lucide.createIcons();
}

/* ==== 13. VIEW NAVIGATION ==== */
function switchView(viewName) {
  if (!viewName) return;
  const cleanName = viewName.startsWith('view-') ? viewName.replace('view-', '') : viewName;
  const targetId = 'view-' + cleanName;
  const targetEl = document.getElementById(targetId) || document.getElementById(cleanName);

  if (!targetEl) {
    console.warn('View not found:', viewName);
    return;
  }

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  targetEl.classList.add('active');
  S.view = cleanName;

  const sidebarMap = {
    home: 'sidebarHome',
    new: 'sidebarNew',
    radio: 'sidebarRadio',
    library: 'sidebarLibrary',
    search: 'sidebarSearch'
  };
  document.querySelectorAll('.sidebar-nav .sidebar-item').forEach(item => item.classList.remove('active'));
  if (sidebarMap[cleanName] && document.getElementById(sidebarMap[cleanName])) {
    document.getElementById(sidebarMap[cleanName]).classList.add('active');
  }

  document.querySelectorAll('.dock .dock-item').forEach(item => {
    item.classList.remove('active');
    const target = item.getAttribute('data-target');
    if (target === cleanName || (cleanName.startsWith('library') && target === 'library')) {
      item.classList.add('active');
    }
  });

  if (cleanName === 'home') {
    loadHomeData();
  } else if (cleanName === 'new') {
    loadNewView();
  } else if (cleanName === 'library') {
    loadLibraryData();
  } else if (cleanName === 'liked') {
    renderLikedSongsView();
  } else if (cleanName === 'songs') {
    renderLibrarySongsView();
  } else if (cleanName === 'library-artists' || cleanName === 'artists') {
    renderLibraryArtistsView();
  } else if (cleanName === 'library-albums' || cleanName === 'albums') {
    renderLibraryAlbumsView();
  } else if (cleanName === 'offline-library' || cleanName === 'offline') {
    renderOfflineLibraryView();
  } else if (cleanName === 'settings') {
    loadSettings();
  } else if (cleanName === 'account') {
    loadAccountData();
  } else if (cleanName === 'search') {
    const input = document.getElementById('searchInputFull') || document.getElementById('searchInput');
    if (input) input.focus();
  }

  window.scrollTo({ top: 0, behavior: 'instant' });
  lucide.createIcons();
}
window.switchView = switchView;

async function renderLikedSongsView() {
  const container = document.getElementById('likedListPanel');
  const subtext = document.getElementById('likedSubtext');
  if (subtext) {
    subtext.textContent = `${S.likedSongs.length} track${S.likedSongs.length !== 1 ? 's' : ''}`;
  }
  if (!container) return;

  if (S.likedSongs.length === 0) {
    container.innerHTML = `
      <div class="search-empty">
        <i data-lucide="heart"></i>
        <p>No liked songs yet</p>
        <span>Tap the heart icon on any song to save it here</span>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = '';
  S.likedSongs.forEach((song, idx) => {
    const key = registerTrack(song);
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.id = song.id || song.ytId;
    const coverStyle = song.thumbnail
      ? `background-image:url("${song.thumbnail}");background-size:cover;background-position:center;`
      : `background:${song.grad || getGradientForId(song.ytId || song.id)};`;

    row.innerHTML = `
      <div class="cover" style="${coverStyle}">
        ${song.thumbnail ? '' : '<i data-lucide="music"></i>'}
      </div>
      <div class="meta">
        <div class="t">${escapeHtml(song.title)}</div>
        <div class="a">${escapeHtml(song.artist)} • ${formatTime(song.dur || 0)}</div>
      </div>
      <div class="action-btns">
        <button class="row-action-btn liked" title="Unlike" onclick="event.stopPropagation(); toggleLike('${key}')">
          <i data-lucide="heart"></i>
        </button>
        <button class="row-action-btn" title="Add to Playlist" onclick="event.stopPropagation(); openAddToPlaylistModal('${key}', event)">
          <i data-lucide="plus"></i>
        </button>
        <button class="row-action-btn context-menu-btn" title="More options" onclick="event.stopPropagation(); showContextMenu(event, '${key}')">
          <i data-lucide="more-vertical"></i>
        </button>
      </div>
    `;
    row.onclick = () => {
      playSong(song, [...S.likedSongs.slice(idx), ...S.likedSongs.slice(0, idx)]);
    };
    container.appendChild(row);
  });
  lucide.createIcons();
}

/* ==== 14. LIKES & HISTORY ==== */
async function toggleLike(songOrKey, event) {
  if (event) event.stopPropagation();
  const song = getTrack(songOrKey) || songOrKey;
  if (!song) return;

  const songId = song.id || song.ytId || song.yt_id;
  const ytId = song.ytId || song.yt_id;
  const isCurrentlyLiked = isLiked(songId);

  try {
    if (isCurrentlyLiked) {
      if (ytId) {
        try { await API.removeLike(ytId); } catch (e) {}
      }
      S.likedSongs = S.likedSongs.filter(s => (s.id || s.ytId || s.yt_id) !== songId);
      localStorage.setItem('neuro_liked_songs', JSON.stringify(S.likedSongs));
      showToast('Removed from Liked Songs');
    } else {
      if (ytId) {
        try {
          await API.addLike({
            yt_id: ytId,
            title: song.title,
            artist: song.artist,
            album: song.album || '',
            duration: song.dur || 0
          });
        } catch (e) {}
      }
      S.likedSongs.push({
        id: songId,
        ytId: ytId,
        title: song.title,
        artist: song.artist,
        album: song.album,
        dur: song.dur,
        grad: song.grad || getGradientForId(ytId)
      });
      localStorage.setItem('neuro_liked_songs', JSON.stringify(S.likedSongs));
      showToast('Added to Liked Songs');
    }

    updateLikeButtons(songId, !isCurrentlyLiked);
    updateLikedHeroRow();
    if (S.view === 'liked') renderLikedSongsView();
  } catch (err) {
    console.error('Failed to toggle like:', err);
  }
}

function updateLikeButtons(songId, liked) {
  document.querySelectorAll(`[data-yt-id="${songId}"] .row-action-btn[title="Like"], [data-id="${songId}"] .row-action-btn[title="Like"]`).forEach(btn => {
    btn.classList.toggle('liked', liked);
  });
  const playerLikeBtn = document.getElementById('playerLikeBtn');
  if (playerLikeBtn && S.cur && (S.cur.id === songId || S.cur.ytId === songId)) {
    playerLikeBtn.classList.toggle('liked', liked);
  }
}

let historyDebounceTimer = null;
function logPlayToHistory(song) {
  if (!song || !(song.ytId || song.yt_id)) return;
  const settings = JSON.parse(localStorage.getItem('neuro_settings') || '{}');
  if (settings.use_listening_history === false) return;

  if (historyDebounceTimer) clearTimeout(historyDebounceTimer);
  historyDebounceTimer = setTimeout(async () => {
    try {
      await API.addHistory({
        yt_id: song.ytId || song.yt_id,
        title: song.title,
        artist: song.artist
      });
    } catch (err) {}
  }, 2000);
}

/* ==== 15. LYRICS DRAWER ==== */
async function openLyricsDrawer() {
  if (!S.cur) return;
  const drawer = document.getElementById('lyricsScreen');
  const list = document.getElementById('lyricList');
  if (!drawer || !list) return;

  list.innerHTML = '<div class="search-status">Loading lyrics...</div>';
  drawer.classList.add('open');

  try {
    const data = await API.getLyrics(S.cur.title, S.cur.artist);
    if (data.syncedLyrics && data.syncedLyrics.length) {
      renderSyncedLyrics(data.syncedLyrics);
    } else if (data.plainLyrics) {
      list.innerHTML = data.plainLyrics.split('\n').map(line => `<p>${escapeHtml(line)}</p>`).join('');
    } else {
      list.innerHTML = `
        <div class="empty-state">
          <i data-lucide="mic-off"></i>
          <p>No lyrics found for this track</p>
        </div>
      `;
    }
  } catch (err) {
    list.innerHTML = `
      <div class="empty-state">
        <i data-lucide="mic-off"></i>
        <p>No lyrics found</p>
      </div>
    `;
  }
  lucide.createIcons();
}

function closeLyricsDrawer() {
  document.getElementById('lyricsScreen')?.classList.remove('open');
}

function renderSyncedLyrics(lyrics) {
  const list = document.getElementById('lyricList');
  if (!list) return;
  list.innerHTML = lyrics.map((line, index) => `
    <p class="${index === 0 ? 'now' : ''}" data-time="${line.time}">
      ${escapeHtml(line.text)}
    </p>
  `).join('');
}

/* ==== 16. NEW SCREEN ==== */
async function loadNewView() {
  renderNewCategories();
}

function renderNewCategories() {
  const container = document.getElementById('newReleasesPanel');
  if (!container) return;
  const categories = [
    { label: 'HOT PLAYLIST', title: "Today's Top Hits", query: 'today top hits', gradient: 'linear-gradient(135deg, #ff6b6b, #ee5a5a)' },
    { label: 'NEW ALBUM', title: 'Latest Releases', query: 'new album', gradient: 'linear-gradient(135deg, #4ecdc4, #44a08d)' },
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
  const searchInput = document.getElementById('searchInputFull') || document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = query;
    document.getElementById('searchClearBtn')?.classList.add('visible');
    document.getElementById('searchClearBtnFull')?.classList.add('visible');
    performBackendSearch(query);
    switchView('search');
  }
}

/* ==== 17. HOME VIEW ==== */
async function loadHomeData() {
  try {
    const homeData = await API.getHome();
    renderTopPicksRail(homeData);
    renderRecentRail(homeData.recent);
    renderArtistRail(homeData.station?.artists || []);
  } catch (err) {
    renderDefaultHome();
  }
}

function renderTopPicksRail(homeData) {
  const container = document.getElementById('topPicksRail');
  if (!container) return;
  const items = [];

  if (homeData && homeData.station) {
    items.push(`
      <div class="neuro-station-card" onclick="startStation([])">
        <div class="station-icon"><i data-lucide="radio"></i></div>
        <h3>${escapeHtml(homeData.station.label || 'Neuro Station')}</h3>
        <p>${escapeHtml(homeData.station.description || 'Continuous flow tailored for you')}</p>
        <button class="play-pill"><i data-lucide="play"></i><span>Start Station</span></button>
      </div>
    `);
  }

  const tracks = (homeData && homeData.listen_again && homeData.listen_again.length) ? homeData.listen_again : SONGS.slice(0, 6);
  tracks.forEach(track => {
    const key = registerTrack(track);
    items.push(`
      <div class="card" onclick="playHomeTrack('${key}')" style="--c1:#093028;--c2:#237a57">
        <div class="art" style="${track.thumbnail ? `background-image:url('${track.thumbnail}');background-size:cover;background-position:center;` : `background:${track.grad || getGradientForId(track.ytId)};`}">
          ${track.thumbnail ? '' : '<i data-lucide="music"></i>'}
        </div>
        <div class="t">${escapeHtml(track.title)}</div>
        <div class="a">${escapeHtml(track.artist)}</div>
      </div>
    `);
  });

  container.innerHTML = items.join('');
  lucide.createIcons();
}

function renderRecentRail(tracks) {
  const container = document.getElementById('recentRail');
  if (!container) return;
  const list = (tracks && tracks.length) ? tracks : SONGS.slice(3, 9);
  container.innerHTML = list.map(track => {
    const key = registerTrack(track);
    return `
      <div class="card" onclick="playHomeTrack('${key}')" style="--c1:#1f1c2c;--c2:#928dab">
        <div class="art" style="${track.thumbnail ? `background-image:url('${track.thumbnail}');background-size:cover;background-position:center;` : `background:${track.grad || getGradientForId(track.ytId)};`}">
          ${track.thumbnail ? '' : '<i data-lucide="music"></i>'}
        </div>
        <div class="t">${escapeHtml(track.title)}</div>
        <div class="a">${escapeHtml(track.artist)}</div>
      </div>
    `;
  }).join('');
  lucide.createIcons();
}

function renderArtistRail(artists) {
  const container = document.getElementById('artistRail');
  if (!container) return;
  const list = (artists && artists.length) ? artists : ARTISTS.map(a => a.name);
  container.innerHTML = list.slice(0, 8).map(artist => `
    <div class="card" onclick="searchCategory('${escapeHtml(artist).replace(/'/g, "&apos;")}')">
      <div class="art" style="background:${getGradientForId(artist)}">
        <i data-lucide="user"></i>
      </div>
      <div class="t">${escapeHtml(artist)}</div>
      <div class="a">Artist</div>
    </div>
  `).join('');
  lucide.createIcons();
}

function renderDefaultHome() {
  const topPicksContainer = document.getElementById('topPicksRail');
  if (topPicksContainer) {
    const items = [
      `<div class="neuro-station-card" onclick="startStation([])">
        <div class="station-icon"><i data-lucide="radio"></i></div>
        <h3>Neuro Station</h3>
        <p>Discover new music tailored for you</p>
        <button class="play-pill"><i data-lucide="play"></i><span>Start Station</span></button>
      </div>`
    ];
    SONGS.slice(0, 6).forEach(track => {
      const key = registerTrack(track);
      items.push(`
        <div class="card" onclick="playHomeTrack('${key}')" style="--c1:#093028;--c2:#237a57">
          <div class="art" style="background:${track.grad}">
            <i data-lucide="${track.icon || 'music'}"></i>
          </div>
          <div class="t">${escapeHtml(track.title)}</div>
          <div class="a">${escapeHtml(track.artist)}</div>
        </div>
      `);
    });
    topPicksContainer.innerHTML = items.join('');
  }

  renderRecentRail(SONGS.slice(4, 10));
  renderArtistRail(ARTISTS.map(a => a.name));
  lucide.createIcons();
}

function playHomeTrack(trackOrKey) {
  const track = getTrack(trackOrKey) || trackOrKey;
  if (!track) return;
  playSong(track, [track, ...S.queue]);
}

function startStation(artistsArg) {
  showToast('Starting Neuro Station continuous mix...');
  if (SONGS.length) {
    const shuffled = [...SONGS].sort(() => Math.random() - 0.5);
    playSong(shuffled[0], shuffled);
  }
}


// LIBRARY VIEW - Categories & Sub-views
// ============================================================================

const LIBRARY_CATEGORIES = [
  { id: 'liked', icon: 'heart', title: 'Liked Songs', subtitle: 'Your favorite tracks', gradient: 'linear-gradient(135deg, var(--like), #8f7bff)' },
  { id: 'playlists', icon: 'list-music', title: 'Playlists', subtitle: 'Your custom collections', gradient: 'linear-gradient(135deg, #5b3df0, #9db4ff)' },
  { id: 'artists', icon: 'user', title: 'Artists', subtitle: 'Artists in your library', gradient: 'linear-gradient(135deg, #f093fb, #f5576c)' },
  { id: 'albums', icon: 'disc', title: 'Albums', subtitle: 'Albums in your library', gradient: 'linear-gradient(135deg, #4facfe, #00f2fe)' },
  { id: 'songs', icon: 'music', title: 'Songs', subtitle: 'All songs in your library', gradient: 'linear-gradient(135deg, #fa709a, #fee140)' },
  { id: 'offline', icon: 'download', title: 'Offline Library', subtitle: 'Cached for offline playback', gradient: 'linear-gradient(135deg, #a8edea, #fed6e3)' }
];

function renderLibraryCategories() {
  const container = document.getElementById('libraryCategories');
  if (!container) return;

  container.innerHTML = LIBRARY_CATEGORIES.map(cat => `
    <div class="library-category-item" data-category="${cat.id}" onclick="openLibrarySubView('${cat.id}')">
      <div class="cover" style="background:${cat.gradient}">
        <i data-lucide="${cat.icon}"></i>
      </div>
      <div class="meta">
        <div class="t">${escapeHtml(cat.title)}</div>
        <div class="a">${escapeHtml(cat.subtitle)}</div>
      </div>
      <div class="arrow">
        <i data-lucide="chevron-right"></i>
      </div>
    </div>
  `).join('');

  lucide.createIcons();
}

async function openLibrarySubView(category) {
  switch (category) {
    case 'liked':
      switchView('liked');
      await renderLikedSongsView();
      break;
    case 'playlists':
      // Already visible in main library view
      break;
    case 'artists':
      switchView('library-artists');
      await renderLibraryArtistsView();
      break;
    case 'albums':
      switchView('library-albums');
      await renderLibraryAlbumsView();
      break;
    case 'songs':
      switchView('songs');
      await renderLibrarySongsView();
      break;
    case 'offline':
      switchView('offline-library');
      await renderOfflineLibraryView();
      break;
  }
}

// --- Library Songs View ---
async function renderLibrarySongsView() {
  const container = document.getElementById('songsListPanel');
  if (!container) return;

  container.innerHTML = '<div class="search-status">Loading songs...</div>';

  try {
    // Get liked songs + playlist tracks as "library songs"
    const [likes, playlists] = await Promise.all([
      API.getLikes(),
      API.getPlaylists()
    ]);

    // Combine all unique tracks
    const allTracks = new Map();
    
    // Add liked songs
    likes.forEach(track => {
      allTracks.set(track.yt_id, {
        ...track,
        ytId: track.yt_id,
        dur: track.duration,
        grad: `linear-gradient(135deg, hsl(${hashCode(track.yt_id) % 360}, 80%, 25%), hsl(${((hashCode(track.yt_id) + 45) % 360)}, 80%, 40%))`,
        source: 'liked'
      });
    });

    // Add playlist tracks
    for (const pl of playlists) {
      const plDetail = await API.getPlaylist(pl.id);
      plDetail.tracks.forEach(track => {
        if (!allTracks.has(track.yt_id)) {
          allTracks.set(track.yt_id, {
            ...track,
            ytId: track.yt_id,
            dur: track.duration,
            grad: `linear-gradient(135deg, hsl(${hashCode(track.yt_id) % 360}, 80%, 25%), hsl(${((hashCode(track.yt_id) + 45) % 360)}, 80%, 40%))`,
            source: 'playlist'
          });
        }
      });
    }

    const tracks = Array.from(allTracks.values());

    if (tracks.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="music"></i>
          <p>No songs in your library yet</p>
          <p class="hint">Like songs or create playlists to build your library</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    // Apply sort
    const sortSelect = document.getElementById('songsSortSelect');
    const sortBy = sortSelect?.value || 'recent';
    sortTracks(tracks, sortBy);

    container.innerHTML = tracks.map(track => `
      <div class="song-grid-item" onclick="playHomeTrack(${JSON.stringify(track).replace(/"/g, '"')})">
        <div class="cover" style="${track.thumbnail ? 'background-image:url(' + track.thumbnail + '); background-size:cover; background-position:center;' : 'background:' + track.grad}">
          ${track.thumbnail ? '' : '<i data-lucide="music"></i>'}
        </div>
        <div class="meta">
          <div class="t">${escapeHtml(track.title)}</div>
          <div class="a">${escapeHtml(track.artist)}</div>
        </div>
      </div>
    `).join('');

    lucide.createIcons();

    // Set up sort listener
    if (sortSelect) {
      sortSelect.onchange = () => renderLibrarySongsView();
    }
  } catch (err) {
    console.error('Failed to load library songs:', err);
    container.innerHTML = `
      <div class="error-state">
        <i data-lucide="alert-triangle"></i>
        <p>Failed to load songs</p>
        <button class="retry-btn" onclick="renderLibrarySongsView()">
          <i data-lucide="refresh-cw"></i> Retry
        </button>
      </div>
    `;
    lucide.createIcons();
  }
}

// --- Library Artists View ---
async function renderLibraryArtistsView() {
  const container = document.getElementById('libraryArtistsListPanel');
  if (!container) return;

  container.innerHTML = '<div class="search-status">Loading artists...</div>';

  try {
    const [likes, playlists] = await Promise.all([
      API.getLikes(),
      API.getPlaylists()
    ]);

    // Group tracks by artist
    const artistMap = new Map();

    const addArtist = (track) => {
      const key = track.artist.toLowerCase();
      if (!artistMap.has(key)) {
        artistMap.set(key, {
          name: track.artist,
          trackCount: 0,
          grad: `linear-gradient(135deg, hsl(${hashCode(track.yt_id || track.id) % 360}, 80%, 25%), hsl(${((hashCode(track.yt_id || track.id) + 45) % 360)}, 80%, 40%))`,
          ytId: track.yt_id || track.id
        });
      }
      artistMap.get(key).trackCount++;
    };

    likes.forEach(addArtist);
    for (const pl of playlists) {
      const plDetail = await API.getPlaylist(pl.id);
      plDetail.tracks.forEach(addArtist);
    }

    const artists = Array.from(artistMap.values());

    if (artists.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="user"></i>
          <p>No artists in your library yet</p>
          <p class="hint">Like songs or create playlists to build your library</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    // Apply sort
    const sortSelect = document.getElementById('libraryArtistsSortSelect');
    const sortBy = sortSelect?.value || 'recent';
    if (sortBy === 'name') {
      artists.sort((a, b) => a.name.localeCompare(b.name));
    }

    container.innerHTML = artists.map(artist => `
      <div class="artist-grid-item" onclick="searchCategory('${escapeHtml(artist.name).replace(/'/g, "&apos;")}')">
        <div class="art" style="background:${artist.grad}">
          <i data-lucide="user"></i>
        </div>
        <div class="t">${escapeHtml(artist.name)}</div>
        <div class="a">${artist.trackCount} song${artist.trackCount !== 1 ? 's' : ''}</div>
      </div>
    `).join('');

    lucide.createIcons();

    if (sortSelect) {
      sortSelect.onchange = () => renderLibraryArtistsView();
    }
  } catch (err) {
    console.error('Failed to load library artists:', err);
    container.innerHTML = `
      <div class="error-state">
        <i data-lucide="alert-triangle"></i>
        <p>Failed to load artists</p>
        <button class="retry-btn" onclick="renderLibraryArtistsView()">
          <i data-lucide="refresh-cw"></i> Retry
        </button>
      </div>
    `;
    lucide.createIcons();
  }
}

// --- Library Albums View ---
async function renderLibraryAlbumsView() {
  const container = document.getElementById('libraryAlbumsListPanel');
  if (!container) return;

  container.innerHTML = '<div class="search-status">Loading albums...</div>';

  try {
    const [likes, playlists] = await Promise.all([
      API.getLikes(),
      API.getPlaylists()
    ]);

    // Group tracks by album
    const albumMap = new Map();

    const addAlbum = (track) => {
      const albumName = track.album || 'Unknown Album';
      const key = albumName.toLowerCase();
      if (!albumMap.has(key)) {
        albumMap.set(key, {
          name: albumName,
          artist: track.artist,
          trackCount: 0,
          grad: `linear-gradient(135deg, hsl(${hashCode(track.yt_id || track.id) % 360}, 80%, 25%), hsl(${((hashCode(track.yt_id || track.id) + 45) % 360)}, 80%, 40%))`,
          thumbnail: track.thumbnail
        });
      }
      albumMap.get(key).trackCount++;
    };

    likes.forEach(addAlbum);
    for (const pl of playlists) {
      const plDetail = await API.getPlaylist(pl.id);
      plDetail.tracks.forEach(addAlbum);
    }

    const albums = Array.from(albumMap.values());

    if (albums.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="disc"></i>
          <p>No albums in your library yet</p>
          <p class="hint">Like songs or create playlists to build your library</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    // Apply sort
    const sortSelect = document.getElementById('libraryAlbumsSortSelect');
    const sortBy = sortSelect?.value || 'recent';
    if (sortBy === 'title') {
      albums.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'artist') {
      albums.sort((a, b) => a.artist.localeCompare(b.artist));
    }

    container.innerHTML = albums.map(album => `
      <div class="album-grid-item" onclick="searchCategory('${escapeHtml(album.name).replace(/'/g, "&apos;")} ${escapeHtml(album.artist).replace(/'/g, "&apos;")}')">
        <div class="art" style="${album.thumbnail ? 'background-image:url(' + album.thumbnail + '); background-size:cover; background-position:center;' : 'background:' + album.grad}">
          ${album.thumbnail ? '' : '<i data-lucide="disc"></i>'}
        </div>
        <div class="meta">
          <div class="t">${escapeHtml(album.name)}</div>
          <div class="a">${escapeHtml(album.artist)} • ${album.trackCount} song${album.trackCount !== 1 ? 's' : ''}</div>
        </div>
      </div>
    `).join('');

    lucide.createIcons();

    if (sortSelect) {
      sortSelect.onchange = () => renderLibraryAlbumsView();
    }
  } catch (err) {
    console.error('Failed to load library albums:', err);
    container.innerHTML = `
      <div class="error-state">
        <i data-lucide="alert-triangle"></i>
        <p>Failed to load albums</p>
        <button class="retry-btn" onclick="renderLibraryAlbumsView()">
          <i data-lucide="refresh-cw"></i> Retry
        </button>
      </div>
    `;
    lucide.createIcons();
  }
}

// --- Offline Library View ---
async function renderOfflineLibraryView() {
  const container = document.getElementById('offlineLibraryListPanel');
  if (!container) return;

  container.innerHTML = '<div class="search-status">Loading offline library...</div>';

  try {
    // Get cached data from service worker
    const cachedData = await getCachedLibraryData();
    
    if (!cachedData || cachedData.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="download"></i>
          <p>No offline content cached yet</p>
          <p class="hint">Browse your library online to cache content for offline use</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    // Apply sort
    const sortSelect = document.getElementById('offlineLibrarySortSelect');
    const sortBy = sortSelect?.value || 'recent';
    if (sortBy === 'title') {
      cachedData.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'artist') {
      cachedData.sort((a, b) => a.artist.localeCompare(b.artist));
    }

    container.innerHTML = cachedData.map(track => `
      <div class="song-grid-item" onclick="playHomeTrack(${JSON.stringify(track).replace(/"/g, '"')})">
        <div class="cover" style="${track.thumbnail ? 'background-image:url(' + track.thumbnail + '); background-size:cover; background-position:center;' : 'background:' + track.grad}">
          ${track.thumbnail ? '' : '<i data-lucide="music"></i>'}
        </div>
        <div class="meta">
          <div class="t">${escapeHtml(track.title)}</div>
          <div class="a">${escapeHtml(track.artist)}</div>
        </div>
      </div>
    `).join('');

    lucide.createIcons();

    if (sortSelect) {
      sortSelect.onchange = () => renderOfflineLibraryView();
    }
  } catch (err) {
    console.error('Failed to load offline library:', err);
    container.innerHTML = `
      <div class="error-state">
        <i data-lucide="alert-triangle"></i>
        <p>Failed to load offline library</p>
        <button class="retry-btn" onclick="renderOfflineLibraryView()">
          <i data-lucide="refresh-cw"></i> Retry
        </button>
      </div>
    `;
    lucide.createIcons();
  }
}

async function getCachedLibraryData() {
  if (!('caches' in window)) return [];
  
  try {
    const cache = await caches.open('neuro-library-meta');
    const keys = await cache.keys();
    const results = [];
    
    for (const request of keys) {
      try {
        const response = await cache.match(request);
        if (response) {
          const data = await response.json();
          if (data && data.ytId) {
            results.push(data);
          }
        }
      } catch {}
    }
    
    return results;
  } catch {
    return [];
  }
}

function sortTracks(tracks, sortBy) {
  switch (sortBy) {
    case 'title':
      tracks.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'artist':
      tracks.sort((a, b) => a.artist.localeCompare(b.artist));
      break;
    case 'recently-played':
      // Would need history data - fallback to recent
      tracks.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
      break;
    case 'recent':
    default:
      tracks.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
      break;
  }
}

// ============================================================================


// SETTINGS VIEW - ToggleRow Component & Full Settings UI
// ============================================================================

function createToggleRow({ label, subtitle, checked, onChange, disabled = false, id }) {
  const row = document.createElement('div');
  row.className = 'settings-row';
  if (disabled) row.classList.add('disabled');
  
  const switchId = id || `switch-${label.toLowerCase().replace(/\s+/g, '-')}`;
  
  row.innerHTML = `
    <div class="settings-row-info">
      <div class="settings-row-label">${escapeHtml(label)}</div>
      ${subtitle ? `<div class="settings-row-subtitle">${escapeHtml(subtitle)}</div>` : ''}
    </div>
    <label class="toggle-switch" for="${switchId}">
      <input type="checkbox" role="switch" id="${switchId}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} aria-label="${escapeHtml(label)}">
      <span class="toggle-slider"></span>
    </label>
  `;
  
  const input = row.querySelector('input[type="checkbox"]');
  input.addEventListener('change', () => {
    if (!disabled) onChange(input.checked);
  });
  
  // Keyboard support for the switch
  input.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      input.click();
    }
  });
  
  return row;
}

function createSelectRow({ label, subtitle, options, value, onChange, disabled = false, id }) {
  const row = document.createElement('div');
  row.className = 'settings-row';
  if (disabled) row.classList.add('disabled');
  
  const selectId = id || `select-${label.toLowerCase().replace(/\s+/g, '-')}`;
  
  row.innerHTML = `
    <div class="settings-row-info">
      <div class="settings-row-label">${escapeHtml(label)}</div>
      ${subtitle ? `<div class="settings-row-subtitle">${escapeHtml(subtitle)}</div>` : ''}
    </div>
    <select id="${selectId}" class="settings-select" ${disabled ? 'disabled' : ''} aria-label="${escapeHtml(label)}">
      ${options.map(opt => `<option value="${escapeHtml(opt.value)}" ${opt.value === value ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`).join('')}
    </select>
  `;
  
  const select = row.querySelector('select');
  select.addEventListener('change', () => onChange(select.value));
  
  return row;
}

function createButtonRow({ label, subtitle, buttonText, onClick, danger = false, disabled = false }) {
  const row = document.createElement('div');
  row.className = 'settings-row';
  if (disabled) row.classList.add('disabled');
  
  row.innerHTML = `
    <div class="settings-row-info">
      <div class="settings-row-label">${escapeHtml(label)}</div>
      ${subtitle ? `<div class="settings-row-subtitle">${escapeHtml(subtitle)}</div>` : ''}
    </div>
    <button class="btn-secondary ${danger ? 'danger' : ''}" ${disabled ? 'disabled' : ''}>${escapeHtml(buttonText)}</button>
  `;
  
  const btn = row.querySelector('button');
  btn.addEventListener('click', () => {
    if (!disabled) onClick();
  });
  
  return row;
}

function createInfoRow({ label, subtitle, value }) {
  const row = document.createElement('div');
  row.className = 'settings-row info-row';
  
  row.innerHTML = `
    <div class="settings-row-info">
      <div class="settings-row-label">${escapeHtml(label)}</div>
      ${subtitle ? `<div class="settings-row-subtitle">${escapeHtml(subtitle)}</div>` : ''}
    </div>
    <div class="settings-row-value">${escapeHtml(value)}</div>
  `;
  
  return row;
}

function createLinkRow({ label, subtitle, linkText, href, external = true }) {
  const row = document.createElement('div');
  row.className = 'settings-row';
  
  row.innerHTML = `
    <div class="settings-row-info">
      <div class="settings-row-label">${escapeHtml(label)}</div>
      ${subtitle ? `<div class="settings-row-subtitle">${escapeHtml(subtitle)}</div>` : ''}
    </div>
    <a href="${escapeHtml(href)}" class="settings-link" ${external ? 'target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(linkText)}</a>
  `;
  
  return row;
}

async function loadSettings() {
  try {
    const settings = await API.getSettings();
    renderSettings(settings);
  } catch (err) {
    console.error('Failed to load settings:', err);
    // Try localStorage fallback
    const local = localStorage.getItem('neuro_settings');
    if (local) {
      try {
        renderSettings(JSON.parse(local));
      } catch {}
    }
  }
}

function renderSettings(settings) {
  const container = document.getElementById('settingsPanel');
  if (!container) return;
  
  // Store locally for offline access
  localStorage.setItem('neuro_settings', JSON.stringify(settings));
  
  // Apply settings immediately
  applySettings(settings);
  
  // Build the settings UI
  container.innerHTML = '';
  
  // Helper to create section
  const createSection = (title, rows) => {
    const section = document.createElement('div');
    section.className = 'settings-section';
    section.innerHTML = `
      <h3 class="settings-section-title">${escapeHtml(title)}</h3>
      <div class="settings-rows"></div>
    `;
    const rowsContainer = section.querySelector('.settings-rows');
    rows.forEach(r => rowsContainer.appendChild(r));
    return section;
  };
  
  // --- LIBRARY SECTION ---
  const libraryRows = [
    createToggleRow({
      label: 'Add Playlist Songs to Library',
      subtitle: 'Songs added to playlists also appear in your library',
      checked: settings.add_playlist_songs_to_library ?? true,
      onChange: async (val) => {
        await updateSetting('add_playlist_songs_to_library', val);
      }
    }),
    createToggleRow({
      label: 'Add Liked Songs to Library',
      subtitle: 'Liked songs appear in your library automatically',
      checked: settings.add_liked_songs_to_library ?? true,
      onChange: async (val) => {
        await updateSetting('add_liked_songs_to_library', val);
      }
    })
  ];
  
  // --- PLAYBACK SECTION ---
  const playbackRows = [
    createToggleRow({
      label: 'Sound Check (Approximate)',
      subtitle: 'Normalize volume per track (approximate, not true ReplayGain)',
      checked: settings.sound_check ?? false,
      onChange: async (val) => {
        await updateSetting('sound_check', val);
      }
    })
  ];
  
  // --- DATA SECTION ---
  const dataRows = [
    createToggleRow({
      label: 'Data Saver',
      subtitle: 'Load lower-resolution artwork, disable preloading',
      checked: settings.data_saver ?? false,
      onChange: async (val) => {
        await updateSetting('data_saver', val);
        applyDataSaver(val);
      }
    }),
    createToggleRow({
      label: 'Use Listening History',
      subtitle: 'Record plays for recommendations and Recently Played',
      checked: settings.use_listening_history ?? true,
      onChange: async (val) => {
        await updateSetting('use_listening_history', val);
      }
    }),
    createSelectRow({
      label: 'Cache Size Limit',
      subtitle: 'Maximum storage for cached artwork & metadata (enforced by Service Worker)',
      options: [
        { value: '50', label: '50 MB' },
        { value: '100', label: '100 MB' },
        { value: '200', label: '200 MB' },
        { value: '500', label: '500 MB' }
      ],
      value: String(settings.cache_size_mb ?? 100),
      onChange: async (val) => {
        await updateSetting('cache_size_mb', parseInt(val, 10));
      }
    })
  ];
  
  // --- STORAGE SECTION ---
  let storageEstimate = 'Calculating...';
  navigator.storage?.estimate().then(est => {
    storageEstimate = `${(est.usage / 1024 / 1024).toFixed(1)} MB used of ${(est.quota / 1024 / 1024).toFixed(1)} MB`;
    renderStorageEstimate(storageEstimate);
  }).catch(() => {
    storageEstimate = 'Storage API not available';
    renderStorageEstimate(storageEstimate);
  });
  
  function renderStorageEstimate(text) {
    const el = document.getElementById('storageEstimate');
    if (el) el.textContent = text;
  }
  
  const storageRows = [
    createInfoRow({
      label: 'Storage Usage',
      subtitle: 'Estimated space used by cached artwork and metadata',
      value: storageEstimate
    }),
    createButtonRow({
      label: 'Clear Cached Artwork & Metadata',
      subtitle: 'Removes cached images and search data (keeps playlists/likes)',
      buttonText: 'Clear Cache',
      onClick: async () => {
        if (await confirmAsync('Clear all cached artwork and metadata?')) {
          await clearCache();
          showToast('Cache cleared');
          // Refresh estimate
          navigator.storage?.estimate().then(est => {
            renderStorageEstimate(`${(est.usage / 1024 / 1024).toFixed(1)} MB used of ${(est.quota / 1024 / 1024).toFixed(1)} MB`);
          });
        }
      }
    }),
    createButtonRow({
      label: 'Update Images',
      subtitle: 'Refresh cached thumbnails for library items',
      buttonText: 'Update Images',
      onClick: async () => {
        showToast('Checking for updated images...');
        await refreshCachedImages();
        showToast('Images updated');
      }
    })
  ];
  
  // --- DISPLAY SECTION ---
  const displayRows = [
    createSelectRow({
      label: 'Theme',
      subtitle: 'System follows your OS setting',
      options: [
        { value: 'system', label: 'System' },
        { value: 'dark', label: 'Dark' },
        { value: 'light', label: 'Light' }
      ],
      value: settings.theme ?? 'system',
      onChange: async (val) => {
        await updateSetting('theme', val);
        applyTheme(val);
      }
    }),
    createToggleRow({
      label: 'Reduce Motion',
      subtitle: 'Disable animations and transitions (respects OS preference)',
      checked: settings.motion !== false,
      onChange: async (val) => {
        await updateSetting('motion', val);
        applyMotion(val);
      }
    }),
    createToggleRow({
      label: 'Increase Contrast',
      subtitle: 'High contrast mode for better readability (WCAG AA)',
      checked: settings.high_contrast ?? false,
      onChange: async (val) => {
        await updateSetting('high_contrast', val);
        applyHighContrast(val);
      }
    }),
    createSelectRow({
      label: 'Lyrics Font Size',
      subtitle: 'Adjust the text size in the lyrics view',
      options: [
        { value: '12', label: 'Small (12px)' },
        { value: '14', label: 'Medium (14px)' },
        { value: '17', label: 'Large (17px)' },
        { value: '20', label: 'X-Large (20px)' },
        { value: '24', label: 'XX-Large (24px)' }
      ],
      value: String(settings.lyrics_font_size ?? 17),
      onChange: async (val) => {
        await updateSetting('lyrics_font_size', parseInt(val, 10));
        applyLyricsFontSize(parseInt(val, 10));
      }
    }),
    createToggleRow({
      label: 'Auto-scroll Lyrics',
      subtitle: 'Automatically scroll synced lyrics during playback',
      checked: settings.lyrics_auto_scroll ?? true,
      onChange: async (val) => {
        await updateSetting('lyrics_auto_scroll', val);
      }
    })
  ];
  
  // --- ABOUT SECTION ---
  // Get version from health endpoint
  let appVersion = '2.0.0';
  fetch('/health').then(r => r.json()).then(d => { appVersion = d.version || '2.0.0'; renderVersion(appVersion); });
  
  function renderVersion(v) {
    const el = document.getElementById('appVersion');
    if (el) el.textContent = v;
  }
  
  const aboutRows = [
    createInfoRow({
      label: 'Version',
      subtitle: 'Neuro Music Glass UI',
      value: appVersion
    }),
    createLinkRow({
      label: 'Privacy Policy',
      subtitle: 'What data we store and how we use it',
      linkText: 'Read Policy',
      href: '/privacy'
    }),
    createLinkRow({
      label: 'Terms of Service',
      subtitle: 'Your rights and responsibilities',
      linkText: 'Read Terms',
      href: '/terms'
    }),
    createLinkRow({
      label: 'Support',
      subtitle: 'Get help or report issues',
      linkText: 'Contact Support',
      href: 'mailto:support@neuro-music.example.com?subject=Neuro%20Music%20Support'
    }),
    createLinkRow({
      label: 'Provide Feedback',
      subtitle: 'Send us your thoughts and suggestions',
      linkText: 'Send Feedback',
      href: 'mailto:feedback@neuro-music.example.com?subject=Neuro%20Music%20Feedback'
    })
  ];
  
  container.appendChild(createSection('Library', libraryRows));
  container.appendChild(createSection('Playback', playbackRows));
  container.appendChild(createSection('Data', dataRows));
  container.appendChild(createSection('Storage', storageRows));
  container.appendChild(createSection('Display', displayRows));
  container.appendChild(createSection('About', aboutRows));
  
  lucide.createIcons();
}

async function updateSetting(key, value) {
  const current = JSON.parse(localStorage.getItem('neuro_settings') || '{}');
  current[key] = value;
  localStorage.setItem('neuro_settings', JSON.stringify(current));
  
  try {
    await API.updateSettings(current);
  } catch (err) {
    console.warn('Failed to sync setting to server:', err);
  }
}

function applySettings(settings) {
  applyTheme(settings.theme);
  applyMotion(settings.motion !== false);
  applyHighContrast(settings.high_contrast ?? false);
  applyDataSaver(settings.data_saver ?? false);
  applyLyricsFontSize(settings.lyrics_font_size ?? 17);
}

function applyTheme(theme) {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme');
    // Listen for OS changes
    if (!window._mediaQueryListener) {
      window._mediaQueryListener = (e) => {
        const local = JSON.parse(localStorage.getItem('neuro_settings') || '{}');
        if (local.theme === 'system') {
          document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        }
      };
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', window._mediaQueryListener);
    }
    // Set initial based on OS
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
    // Remove listener if exists
    if (window._mediaQueryListener) {
      window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', window._mediaQueryListener);
      window._mediaQueryListener = null;
    }
  }
}

function applyMotion(enabled) {
  if (enabled) {
    document.documentElement.classList.remove('reduce-motion');
  } else {
    document.documentElement.classList.add('reduce-motion');
  }
  // Also respect OS preference
  if (!enabled && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.classList.add('reduce-motion');
  }
}

function applyHighContrast(enabled) {
  if (enabled) {
    document.documentElement.setAttribute('data-contrast', 'high');
  } else {
    document.documentElement.removeAttribute('data-contrast');
  }
}

function applyDataSaver(enabled) {
  document.documentElement.classList.toggle('data-saver', enabled);
}

function applyLyricsFontSize(size) {
  document.documentElement.style.setProperty('--lyrics-font-size', `${size}px`);
}

function openSettingsView() {
  loadSettings();
  switchView('settings');
}

// --- HELPERS ---
async function confirmAsync(message) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-card">
        <h3>Confirm</h3>
        <p>${escapeHtml(message)}</p>
        <div class="modal-actions">
          <button class="btn-secondary" data-action="cancel">Cancel</button>
          <button class="btn-primary danger" data-action="confirm">Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.classList.add('open');
    
    modal.querySelector('[data-action="cancel"]').onclick = () => {
      modal.remove();
      resolve(false);
    };
    modal.querySelector('[data-action="confirm"]').onclick = () => {
      modal.remove();
      resolve(true);
    };
  });
}

async function promptAsync(title, message, defaultValue = '') {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-card">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        <input type="text" class="modal-input" id="promptAsyncInput" value="${escapeHtml(defaultValue)}" />
        <div class="modal-actions">
          <button class="btn-secondary" data-action="cancel">Cancel</button>
          <button class="btn-primary" data-action="confirm">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.classList.add('open');
    
    const input = document.getElementById('promptAsyncInput');
    input.focus();
    input.select();
    
    modal.querySelector('[data-action="cancel"]').onclick = () => {
      modal.remove();
      resolve(null);
    };
    modal.querySelector('[data-action="confirm"]').onclick = () => {
      modal.remove();
      resolve(input.value.trim());
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        modal.querySelector('[data-action="confirm"]').click();
      }
      if (e.key === 'Escape') {
        modal.querySelector('[data-action="cancel"]').click();
      }
    });
  });
}

async function clearCache() {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    for (const name of cacheNames) {
      if (name.includes('neuro') || name.includes('artwork') || name.includes('metadata')) {
        await caches.delete(name);
      }
    }
  }
  // Also clear IndexedDB if used
  if ('indexedDB' in window) {
    // Could add IndexedDB clearing here if needed
  }
}

async function refreshCachedImages() {
  // Re-fetch artwork for visible library items
  const images = document.querySelectorAll('.cover[style*="background-image"]');
  for (const img of images) {
    const style = img.getAttribute('style');
    const match = style.match(/url\("([^"]+)"\)/);
    if (match) {
      const url = match[1];
      try {
        // Fetch with cache-busting
        await fetch(url + '?v=' + Date.now(), { cache: 'reload' });
      } catch {}
    }
  }
}

// Initialize system preference listeners on load
document.addEventListener('DOMContentLoaded', () => {
  // Theme
  const local = JSON.parse(localStorage.getItem('neuro_settings') || '{}');
  applyTheme(local.theme || 'system');
  applyMotion(local.motion !== false);
  applyHighContrast(local.high_contrast ?? false);
  applyDataSaver(local.data_saver ?? false);
  applyLyricsFontSize(local.lyrics_font_size ?? 17);
  
  // Listen for OS theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const local = JSON.parse(localStorage.getItem('neuro_settings') || '{}');
    if (local.theme === 'system') {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    }
  });
  
  // Listen for OS motion preference changes
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
    const local = JSON.parse(localStorage.getItem('neuro_settings') || '{}');
    if (local.motion !== false) {
      document.documentElement.classList.toggle('reduce-motion', e.matches);
    }
  });
});

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
        grad: song.grad || `linear-gradient(135deg, hsl(${hashCode(song.ytId) % 360}, 80%, 25%), hsl(, 80%, 40%))`
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
    // Fetch lyrics from backend (proxies lrclib.net) using API client
    const data = await API.getLyrics(S.cur.title, S.cur.artist);
    
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
  try {
    const data = await API.getNewContent();
    
    // Render hero cards
    renderHeroCards(data.heroCards);
    
    // Render category tiles
    renderCategoryTiles(data.categories);
    
    // Load best new songs via cached search
    if (data.bestNewSongsQuery) {
      loadBestNewSongs(data.bestNewSongsQuery);
    }
  } catch (err) {
    console.error('Failed to load new content:', err);
    // Fallback to static content
    renderNewCategories();
  }
}

function renderHeroCards(heroCards) {
  const container = document.getElementById('newReleasesPanel');
  if (!container) return;
  
  container.innerHTML = heroCards.map(card => `
    <div class="hero-card" style="background:${card.gradient}" onclick="searchCategory('${card.searchQuery}')">
      <span class="hero-tag">${escapeHtml(card.label)}</span>
      <h3>${escapeHtml(card.title)}</h3>
      <p>${escapeHtml(card.tagline)}</p>
    </div>
  `).join('');
  
  lucide.createIcons();
}

function renderCategoryTiles(categories) {
  const container = document.getElementById('newCategoriesPanel');
  if (!container) return;
  
  container.innerHTML = categories.map(cat => `
    <div class="category-tile" style="background:${cat.gradient}" onclick="searchCategory('${cat.query}')">
      <span>${escapeHtml(cat.name)}</span>
    </div>
  `).join('');
  
  lucide.createIcons();
}

async function loadBestNewSongs(query) {
  const container = document.getElementById('bestNewSongsPanel');
  if (!container) return;
  
  container.innerHTML = '<div class="search-status">Loading best new songs...</div>';
  
  try {
    const data = await API.search(query);
    const songs = data.results || [];
    
    if (songs.length === 0) {
      container.innerHTML = '<div class="search-empty">No new songs found</div>';
      return;
    }
    
    container.innerHTML = songs.slice(0, 10).map(song => `
      <div class="row" onclick="playHomeTrack(${JSON.stringify(song).replace(/"/g, '"')})">
        <div class="cover" style="${song.thumbnail ? 'background-image:url(' + song.thumbnail + '); background-size:cover; background-position:center;' : 'background:' + song.grad}">
          ${song.thumbnail ? '' : '<i data-lucide="music"></i>'}
        </div>
        <div class="meta">
          <div class="t">${escapeHtml(song.title)}</div>
          <div class="a">${escapeHtml(song.artist)} ${song.dur ? '• ' + formatTime(song.dur) : ''}</div>
        </div>
        <div class="action-btns">
          <button class="row-action-btn" onclick="event.stopPropagation(); addToPlayNext(${JSON.stringify(song).replace(/"/g, '"')})" title="Play Next">
            <i data-lucide="skip-back"></i>
          </button>
          <button class="row-action-btn context-menu-btn" onclick="event.stopPropagation(); showContextMenu(event, ${JSON.stringify(song).replace(/"/g, '"')})" title="More options">
            <i data-lucide="more-vertical"></i>
          </button>
        </div>
      </div>
    `).join('');
    
    lucide.createIcons();
  } catch (err) {
    console.error('Failed to load best new songs:', err);
    container.innerHTML = '<div class="search-error">Failed to load songs</div>';
  }
}

// Keep old function for backward compatibility
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

// ============================================================================
// PWA FEATURES: Install Prompt, Offline UX, Update Handling
// ============================================================================

let deferredInstallPrompt = null;
let isOffline = false;

// Register SW with update handling
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  
  try {
    const reg = await navigator.serviceWorker.register('service-worker.js');
    console.log('Neuro Music SW registered', reg);
    
    // Handle SW updates
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New version available
          showUpdateToast();
        }
      });
    });
    
    // Check for updates periodically
    setInterval(() => reg.update(), 60 * 60 * 1000); // Every hour
    
  } catch (err) {
    console.log('SW registration failed', err);
  }
}

function showUpdateToast() {
  const toast = document.getElementById('toast');
  if (!toast) return;
  
  toast.innerHTML = `
    New version available! 
    <button class="toast-action" onclick="location.reload()">Refresh</button>
  `;
  toast.classList.add('show');
}

// Install prompt handling
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  showInstallButton();
});

function showInstallButton() {
  // Show install button in settings or as a toast on first visit
  const hasSeenInstall = localStorage.getItem('neuro_install_seen');
  if (!hasSeenInstall) {
    setTimeout(() => {
      showToast('Install Neuro Music for the best experience', 8000, () => {
        promptInstall();
      });
      localStorage.setItem('neuro_install_seen', 'true');
    }, 10000); // Show after 10 seconds
  }
}

async function promptInstall() {
  if (!deferredInstallPrompt) {
    // iOS fallback - show instructions
    showIOSInstallInstructions();
    return;
  }
  
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  console.log(`Install prompt outcome: ${outcome}`);
  deferredInstallPrompt = null;
  
  if (outcome === 'accepted') {
    showToast('Thanks for installing Neuro Music!');
  }
}

function showIOSInstallInstructions() {
  // Show modal with iOS install instructions
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card" style="max-width: 400px;">
      <h3>Install on iOS</h3>
      <p>To install Neuro Music on your iPhone or iPad:</p>
      <ol style="text-align: left; margin: 16px 0; padding-left: 20px; color: var(--text-1); line-height: 1.8;">
        <li>Tap the <strong>Share</strong> button <i data-lucide="share-2" style="width:16px;height:16px;display:inline-block;vertical-align:middle;"></i> at the bottom of Safari</li>
        <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
        <li>Tap <strong>"Add"</strong> in the top right</li>
      </ol>
      <p style="font-size: 12px; color: var(--text-2);">The app will work offline for browsing your library, but audio playback requires an internet connection due to YouTube's terms.</p>
      <div class="modal-actions">
        <button class="btn-primary" onclick="this.closest('.modal-overlay').remove()">Got It</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.classList.add('open');
  lucide.createIcons();
}

// Offline detection
function setupOfflineDetection() {
  const updateOnlineStatus = () => {
    const wasOffline = isOffline;
    isOffline = !navigator.onLine;
    
    if (isOffline && !wasOffline) {
      showOfflineBanner();
    } else if (!isOffline && wasOffline) {
      hideOfflineBanner();
      // Refresh data when coming back online
      if (typeof loadHomeData === 'function') loadHomeData();
    }
  };
  
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  
  // Initial check
  updateOnlineStatus();
}

function showOfflineBanner() {
  // Remove existing banner if any
  hideOfflineBanner();
  
  const banner = document.createElement('div');
  banner.id = 'offlineBanner';
  banner.className = 'offline-banner';
  banner.innerHTML = `
    <i data-lucide="wifi-off"></i>
    <span>You're offline. Library browsing works, but playback needs a connection.</span>
    <button class="offline-dismiss" aria-label="Dismiss"><i data-lucide="x"></i></button>
  `;
  document.body.appendChild(banner);
  lucide.createIcons();
  
  banner.querySelector('.offline-dismiss').onclick = () => hideOfflineBanner();
  
  // Show offline library view if in library
  if (S.view === 'library' || S.view === 'liked' || S.view === 'playlist') {
    showOfflineLibraryNotice();
  }
}

function hideOfflineBanner() {
  const banner = document.getElementById('offlineBanner');
  if (banner) banner.remove();
}

function showOfflineLibraryNotice() {
  const panels = ['likedListPanel', 'playlistTracksPanel', 'songsListPanel', 'artistsListPanel', 'albumsListPanel', 'offlineLibraryListPanel'];
  panels.forEach(id => {
    const panel = document.getElementById(id);
    if (panel && panel.children.length > 0) {
      // Check if already has notice
      if (!panel.querySelector('.offline-notice')) {
        const notice = document.createElement('div');
        notice.className = 'offline-notice';
        notice.innerHTML = `
          <i data-lucide="info"></i>
          <span>Showing cached metadata. Audio playback requires internet.</span>
        `;
        panel.insertBefore(notice, panel.firstChild);
        lucide.createIcons();
      }
    }
  });
}

// Static Pages (Privacy, Terms, Support)
async function showStaticPage(page) {
  const pages = {
    privacy: {
      title: 'Privacy Policy',
      lastUpdated: '2024-01-15',
      content: `
        <section>
          <h2>Data We Store</h2>
          <p>Neuro Music stores the following data to provide its features:</p>
          <ul>
            <li><strong>Account:</strong> Email, display name, hashed password, country (optional), avatar (optional, only if storage is configured).</li>
            <li><strong>Playlists:</strong> Playlist names, descriptions, and ordered track lists (YouTube video IDs, titles, artists, albums, durations).</li>
            <li><strong>Liked Songs:</strong> YouTube video IDs, titles, artists, albums, durations, and timestamps.</li>
            <li><strong>Play History:</strong> YouTube video IDs, titles, artists, and timestamps (only if "Use Listening History" is enabled in Settings).</li>
            <li><strong>Settings:</strong> All preferences from the Settings screen (theme, motion, contrast, data saver, cache size, etc.).</li>
            <li><strong>Sessions:</strong> Device info, IP, and timestamps for active login sessions.</li>
            <li><strong>Search Cache:</strong> Cached YouTube search results (query, video IDs, titles, artists, thumbnails) for 24 hours to reduce API calls.</li>
          </ul>
        </section>
        <section>
          <h2>How We Use Your Data</h2>
          <ul>
            <li>Authentication and account security (JWT tokens, session management, password reset).</li>
            <li>Syncing your library, playlists, likes, and settings across devices.</li>
            <li>Generating personalized recommendations (Neuro Station, Listen Again) from your play history.</li>
            <li>Caching search results to improve performance and reduce YouTube API quota usage.</li>
          </ul>
        </section>
        <section>
          <h2>Data Sharing</h2>
          <p>We do <strong>not</strong> sell your data. Data is only shared with:</p>
          <ul>
            <li><strong>YouTube/Google:</strong> Video playback requests go directly to YouTube's servers via the IFrame Player API. We do not proxy audio.</li>
            <li><strong>lrclib.net:</strong> Lyrics requests are proxied through our backend to avoid CORS issues; only track title and artist are sent.</li>
            <li><strong>Email (optional):</strong> If SMTP is configured, password reset emails are sent via your provider.</li>
            <li><strong>Storage (optional):</strong> If configured (R2/S3/local), avatar uploads go to your storage bucket.</li>
          </ul>
        </section>
        <section>
          <h2>Your Rights</h2>
          <ul>
            <li><strong>Export:</strong> Use "Export My Data" in Account → Privacy to download all your data as JSON.</li>
            <li><strong>Delete:</strong> Use "Delete Account" in Account → Privacy to permanently remove all your data.</li>
            <li><strong>History Control:</strong> Disable "Use Listening History" in Settings → Data to stop recording plays.</li>
            <li><strong>Sessions:</strong> Revoke individual sessions or sign out of all devices in Account → Apps with Access.</li>
          </ul>
        </section>
        <section>
          <h2>Retention</h2>
          <ul>
            <li>Account data: Until you delete your account.</li>
            <li>Play history: Last 1,000 events per user (older events are automatically pruned).</li>
            <li>Search cache: 24 hours.</li>
            <li>Sessions: 30 days of inactivity, then auto-expired.</li>
          </ul>
        </section>
        <section>
          <h2>Cookies & Local Storage</h2>
          <ul>
            <li><code>auth_token</code> (HttpOnly, Secure, SameSite=Lax): JWT session cookie.</li>
            <li><code>neuro_settings</code> (localStorage): Cached settings for offline use.</li>
            <li><code>neuro_liked_songs</code>, <code>neuro_pls</code> (localStorage): Legacy offline fallbacks (migrated to server on login).</li>
            <li>Service Worker caches: App shell, artwork thumbnails, and search metadata.</li>
          </ul>
        </section>
        <section>
          <h2>Contact</h2>
          <p>Questions? Email <a href="mailto:privacy@neuro-music.example.com">privacy@neuro-music.example.com</a></p>
        </section>
      `
    },
    terms: {
      title: 'Terms of Service',
      lastUpdated: '2024-01-15',
      content: `
        <section>
          <h2>Acceptance</h2>
          <p>By using Neuro Music, you agree to these Terms. If you disagree, please do not use the app.</p>
        </section>
        <section>
          <h2>Service Description</h2>
          <p>Neuro Music is a web-based music player that uses the <strong>YouTube IFrame Player API</strong> to stream music videos from YouTube. We do not host, download, or distribute any audio or video content.</p>
        </section>
        <section>
          <h2>YouTube Terms</h2>
          <p>Your use of YouTube content via this app is subject to <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener">YouTube's Terms of Service</a> and <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google's Privacy Policy</a>. You must comply with them.</p>
          <p>Specifically:</p>
          <ul>
            <li>No downloading, recording, or extracting audio/video.</li>
            <li>No background playback that hides the YouTube player (we keep the IFrame player visible/accessible).</li>
            <li>No modifying, filtering, or altering the YouTube player experience.</li>
          </ul>
        </section>
        <section>
          <h2>Account</h2>
          <ul>
            <li>You must provide a valid email and secure password.</li>
            <li>You are responsible for your account security and all activity under your account.</li>
            <li>One account per person; no sharing credentials.</li>
          </ul>
        </section>
        <section>
          <h2>Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Reverse engineer, decompile, or attempt to extract source code.</li>
            <li>Automate access (scraping, bots) beyond normal interactive use.</li>
            <li>Use the app for any illegal or unauthorized purpose.</li>
            <li>Interfere with the app's operation or other users' experience.</li>
          </ul>
        </section>
        <section>
          <h2>Disclaimer</h2>
          <p>The service is provided "as is" without warranties of any kind. We do not guarantee uninterrupted, error-free, or secure access. YouTube content availability is outside our control.</p>
        </section>
        <section>
          <h2>Limitation of Liability</h2>
          <p>To the maximum extent permitted by law, we are not liable for any indirect, incidental, special, or consequential damages, including data loss or lost profits.</p>
        </section>
        <section>
          <h2>Changes</h2>
          <p>We may update these Terms. Continued use after changes constitutes acceptance.</p>
        </section>
        <section>
          <h2>Contact</h2>
          <p>Questions? Email <a href="mailto:legal@neuro-music.example.com">legal@neuro-music.example.com</a></p>
        </section>
      `
    },
    support: {
      title: 'Support',
      lastUpdated: '2024-01-15',
      content: `
        <section>
          <h2>Getting Help</h2>
          <p>For issues, questions, or feature requests:</p>
          <ul>
            <li>Email: <a href="mailto:support@neuro-music.example.com">support@neuro-music.example.com</a></li>
            <li>GitHub Issues: <a href="https://github.com/your-repo/neuro-music/issues" target="_blank" rel="noopener">Report a bug</a></li>
          </ul>
        </section>
        <section>
          <h2>Common Issues</h2>
          <h3>Playback won't start</h3>
          <p>Some videos have embedding disabled by the uploader. The app will automatically skip to the next track.</p>
          <h3>Search returns no results</h3>
          <p>Check your internet connection. The app uses the YouTube Data API v3 which requires a valid API key.</p>
          <h3>Offline mode</h3>
          <p>You can browse cached library metadata offline, but audio playback requires an internet connection due to YouTube's terms.</p>
          <h3>Theme not syncing</h3>
          <p>Settings sync on login. If using multiple devices, sign out and back in to force a sync.</p>
        </section>
        <section>
          <h2>Features</h2>
          <ul>
            <li>YouTube IFrame playback (no audio extraction)</li>
            <li>Playlists, Liked Songs, Play History</li>
            <li>Search via YouTube Data API v3 (cached 24h)</li>
            <li>Lyrics via lrclib.net (cached 24h)</li>
            <li>PWA: installable, offline library browsing</li>
            <li>Glassmorphism UI with high contrast, reduced motion, data saver</li>
          </ul>
        </section>
        <section>
          <h2>System Requirements</h2>
          <ul>
            <li>Modern browser with ES2020+, Service Workers, Cache API</li>
            <li>Internet connection for playback and search</li>
            <li>JavaScript enabled</li>
          </ul>
        </section>
      `
    }
  };
  
  const pageData = pages[page];
  if (!pageData) return;
  
  // Create a full-screen view for the static page
  const container = document.getElementById('appStage');
  if (!container) return;
  
  const view = document.createElement('main');
  view.className = 'view static-page-view';
  view.id = `view-${page}`;
  view.innerHTML = `
    <div class="subview-header">
      <button class="subview-back-btn" onclick="switchView('settings')" aria-label="Back to Settings">
        <i data-lucide="arrow-left"></i>
      </button>
      <div class="subview-title-group">
        <h2>${pageData.title}</h2>
        <p class="last-updated">Last updated: ${pageData.lastUpdated}</p>
      </div>
    </div>
    <div class="static-page">
      ${pageData.content}
    </div>
  `;
  
  container.appendChild(view);
  lucide.createIcons();
  switchView(page);
  
  // Store reference for cleanup
  view._staticPage = page;
}

// Handle static page links in settings
document.addEventListener('click', (e) => {
  const link = e.target.closest('.settings-link');
  if (link) {
    const href = link.getAttribute('href');
    if (href?.startsWith('/')) {
      e.preventDefault();
      const page = href.replace('/', '');
      if (['privacy', 'terms', 'support'].includes(page)) {
        showStaticPage(page);
      }
    }
  }
});

// Clear user caches on logout
async function clearUserCaches() {
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k.startsWith('neuro-')).map(k => caches.delete(k))
    );
  }
  // Notify SW to clear its caches too
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage('clearUserCaches');
  }
  localStorage.removeItem('neuro_settings');
}

// ============================================================================


// ACCOUNT VIEW - Full Implementation
// ============================================================================

// ISO Country List (abbreviated - in production use a full list)
const COUNTRIES = [
  { code: '', name: 'Auto-detect' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'IN', name: 'India' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'PL', name: 'Poland' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'IE', name: 'Ireland' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'SG', name: 'Singapore' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'TW', name: 'Taiwan' }
];

async function loadAccountData() {
  try {
    const response = await fetch('/api/auth/me', { credentials: 'include' });
    if (!response.ok) throw new Error('Not authenticated');
    const userData = await response.json();
    
    renderAccountProfile(userData);
    await loadSessions();
    setupAccountEventListeners();
    populateCountrySelect(userData.country);
    
    // Check if storage is configured for avatar upload
    checkStorageConfig();
  } catch (err) {
    console.error('Failed to load account:', err);
    showToast('Failed to load account data');
  }
}

function renderAccountProfile(user) {
  const avatar = document.getElementById('accountAvatar');
  const avatarInitial = document.getElementById('accountAvatarInitial');
  const nameEl = document.getElementById('accountName');
  const emailEl = document.getElementById('accountEmail');
  const largeAvatar = document.getElementById('avatarPreviewLarge');
  const largeAvatarInitial = document.getElementById('avatarPreviewLargeInitial');

  const initial = user.display_name?.charAt(0).toUpperCase() || 'U';

  if (avatar) {
    if (user.avatar_url) {
      avatar.innerHTML = `<img src="${escapeHtml(user.avatar_url)}" alt="${escapeHtml(user.display_name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    } else {
      avatar.textContent = initial;
    }
  }
  if (avatarInitial) avatarInitial.textContent = initial;
  if (nameEl) nameEl.textContent = user.display_name || 'User';
  if (emailEl) emailEl.textContent = user.email || '';
  if (largeAvatar) {
    if (user.avatar_url) {
      largeAvatar.innerHTML = `<img src="${escapeHtml(user.avatar_url)}" alt="${escapeHtml(user.display_name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    } else {
      largeAvatar.textContent = initial;
    }
  }
  if (largeAvatarInitial) largeAvatarInitial.textContent = initial;
}

function populateCountrySelect(currentCountry) {
  const select = document.getElementById('countrySelect');
  if (!select) return;

  select.innerHTML = COUNTRIES.map(c => 
    `<option value="${c.code}" ${c.code === currentCountry ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
  ).join('');

  select.onchange = async () => {
    try {
      await API.updateSettings({ country: select.value || undefined });
      showToast('Country updated');
    } catch (err) {
      showToast('Failed to update country');
    }
  };
}

async function checkStorageConfig() {
  try {
    const response = await fetch('/api/auth/me', { credentials: 'include' });
    // Storage config check would need an endpoint or we can check via a settings endpoint
    // For now, we'll try to detect by attempting upload or check a config endpoint
    // If no storage provider, hide the upload section
    const avatarSection = document.getElementById('avatarUploadSection');
    if (avatarSection) {
      // We'll show it and let the backend return 501 if not configured
      avatarSection.style.display = 'block';
    }
  } catch (err) {
    console.warn('Could not check storage config');
  }
}

function setupAccountEventListeners() {
  // Edit name
  const editNameBtn = document.getElementById('accountEditNameBtn');
  if (editNameBtn) {
    editNameBtn.onclick = openEditNameModal;
  }

  // Avatar upload
  const avatarTrigger = document.getElementById('avatarFileTrigger');
  const avatarInput = document.getElementById('avatarFileInput');
  if (avatarTrigger && avatarInput) {
    avatarTrigger.onclick = () => avatarInput.click();
    avatarInput.onchange = handleAvatarUpload;
  }

  // Sign out
  const signOutBtn = document.getElementById('signOutBtn');
  if (signOutBtn) {
    signOutBtn.onclick = () => handleSignOut(false);
  }

  // Sign out all other devices
  const signOutAllBtn = document.getElementById('signOutAllBtn');
  if (signOutAllBtn) {
    signOutAllBtn.onclick = () => handleSignOut(true);
  }

  // Change password
  const changePasswordBtn = document.getElementById('changePasswordBtn');
  if (changePasswordBtn) {
    changePasswordBtn.onclick = openChangePasswordModal;
  }

  // Export data
  const exportDataBtn = document.getElementById('exportDataBtn');
  if (exportDataBtn) {
    exportDataBtn.onclick = handleExportData;
  }

  // Delete account
  const deleteAccountBtn = document.getElementById('deleteAccountBtn');
  if (deleteAccountBtn) {
    deleteAccountBtn.onclick = openDeleteAccountModal;
  }
}

async function loadSessions() {
  const container = document.getElementById('sessionsList');
  if (!container) return;

  try {
    const response = await fetch('/api/auth/sessions', { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to load sessions');
    const sessions = await response.json();

    const currentToken = getCookie('auth_token');
    let currentSessionId = null;
    if (currentToken) {
      const payload = parseJwt(currentToken);
      currentSessionId = payload?.sid;
    }

    if (sessions.length === 0) {
      container.innerHTML = '<div class="search-status">No active sessions</div>';
      return;
    }

    container.innerHTML = sessions.map(session => {
      const isCurrent = session.id === currentSessionId;
      const deviceName = parseUserAgent(session.device) || 'Unknown Device';
      const created = new Date(session.created_at).toLocaleDateString();
      const lastUsed = new Date(session.last_used_at).toLocaleString();

      return `
        <div class="session-item${isCurrent ? ' current' : ''}">
          <div>
            <div class="session-device">${escapeHtml(deviceName)}${isCurrent ? ' <span class="badge current-badge">Current</span>' : ''}</div>
            <div class="session-info">Created ${created} • Last used ${lastUsed}</div>
          </div>
          <div class="session-actions">
            ${!isCurrent ? `
              <button class="icon-btn" onclick="revokeSession('${session.id}')" aria-label="Sign out of this device" title="Sign out">
                <i data-lucide="log-out"></i>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();
  } catch (err) {
    console.error('Failed to load sessions:', err);
    container.innerHTML = '<div class="search-status">Failed to load sessions</div>';
  }
}

function parseUserAgent(ua) {
  if (!ua) return null;
  if (ua.includes('iPhone')) return 'iPhone';
  if (ua.includes('iPad')) return 'iPad';
  if (ua.includes('Mac')) return 'Mac';
  if (ua.includes('Windows')) return 'Windows PC';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('Linux')) return 'Linux';
  return ua.length > 40 ? ua.substring(0, 40) + '...' : ua;
}

async function revokeSession(sessionId) {
  const confirmed = await confirmAsync('Sign out of this device?');
  if (!confirmed) return;

  try {
    await fetch(`/api/auth/sessions/${sessionId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    showToast('Session revoked');
    loadSessions();
  } catch (err) {
    console.error('Failed to revoke session:', err);
    showToast('Failed to revoke session');
  }
}

async function handleSignOut(allDevices = false) {
  const confirmed = await confirmAsync(allDevices ? 'Sign out of all other devices?' : 'Sign out?');
  if (!confirmed) return;

  try {
    if (allDevices) {
      await fetch('/api/auth/sessions/revoke-all', {
        method: 'POST',
        credentials: 'include'
      });
      showToast('Signed out of all other devices');
    } else {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      showToast('Signed out');
      // Redirect to login
      setTimeout(() => {
        window.location.href = '/login';
      }, 1000);
    }
    loadSessions();
  } catch (err) {
    console.error('Failed to sign out:', err);
    showToast('Failed to sign out');
  }
}

function openEditNameModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card">
      <h3>Edit Display Name</h3>
      <input type="text" class="modal-input" id="editNameInput" placeholder="Display Name" maxlength="40" value="${escapeHtml(document.getElementById('accountName')?.textContent || '')}" />
      <div class="modal-actions">
        <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn-primary" onclick="saveDisplayName(this)">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.classList.add('open');
  document.getElementById('editNameInput')?.focus();
}

async function saveDisplayName(btn) {
  const input = document.getElementById('editNameInput');
  const name = input?.value?.trim();
  if (!name) return;

  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    await API.updateSettings({ display_name: name });
    showToast('Name updated');
    btn.closest('.modal-overlay').remove();
    // Refresh profile
    const response = await fetch('/api/auth/me', { credentials: 'include' });
    const userData = await response.json();
    renderAccountProfile(userData);
  } catch (err) {
    console.error('Failed to update name:', err);
    showToast('Failed to update name');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save';
  }
}

async function handleAvatarUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Validate file type
  const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    showToast('Only PNG, JPEG, and WebP images are allowed');
    e.target.value = '';
    return;
  }

  // Validate file size (2MB)
  if (file.size > 2 * 1024 * 1024) {
    showToast('File size must be less than 2 MB');
    e.target.value = '';
    return;
  }

  const triggerBtn = document.getElementById('avatarFileTrigger');
  const hint = document.getElementById('avatarFileHint');
  const originalText = triggerBtn.innerHTML;
  
  triggerBtn.disabled = true;
  triggerBtn.innerHTML = '<i data-lucide="loader" style="animation:spin 1s linear infinite;"></i> Uploading...';
  if (hint) hint.textContent = '';

  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/auth/upload-avatar', {
      method: 'POST',
      credentials: 'include',
      body: formData
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Upload failed');
    }

    const data = await response.json();
    showToast('Avatar updated');
    
    // Update avatar previews
    const avatars = document.querySelectorAll('#accountAvatar, #avatarPreviewLarge, #sidebarAvatar');
    avatars.forEach(avatar => {
      avatar.innerHTML = `<img src="${escapeHtml(data.avatar_url)}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    });

  } catch (err) {
    console.error('Avatar upload failed:', err);
    if (err.message?.includes('501') || err.message?.includes('not configured')) {
      showToast('Avatar upload not configured on server');
      // Hide the upload section
      const section = document.getElementById('avatarUploadSection');
      if (section) section.style.display = 'none';
    } else if (err.message?.includes('413') || err.message?.includes('size')) {
      showToast('File too large (max 2 MB)');
    } else if (err.message?.includes('400') || err.message?.includes('type')) {
      showToast('Invalid file type. Use PNG, JPEG, or WebP.');
    } else {
      showToast('Upload failed: ' + err.message);
    }
  } finally {
    triggerBtn.disabled = false;
    triggerBtn.innerHTML = originalText;
    if (hint) hint.textContent = 'PNG, JPEG, WebP • Max 2MB';
    e.target.value = '';
    lucide.createIcons();
  }
}

function openChangePasswordModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card" style="max-width: 420px;">
      <h3>Change Password</h3>
      <div class="form-group">
        <label for="currentPasswordInput">Current Password</label>
        <div class="input-wrapper">
          <i data-lucide="lock" class="input-icon"></i>
          <input type="password" class="form-input" id="currentPasswordInput" placeholder="••••••••" autocomplete="current-password" required />
          <button type="button" class="toggle-password" data-target="currentPasswordInput" aria-label="Toggle password visibility">
            <i data-lucide="eye"></i>
          </button>
        </div>
      </div>
      <div class="form-group">
        <label for="newPasswordInput">New Password</label>
        <div class="input-wrapper">
          <i data-lucide="lock" class="input-icon"></i>
          <input type="password" class="form-input" id="newPasswordInput" placeholder="••••••••" autocomplete="new-password" required minlength="8" />
          <button type="button" class="toggle-password" data-target="newPasswordInput" aria-label="Toggle password visibility">
            <i data-lucide="eye"></i>
          </button>
        </div>
        <p class="form-hint">At least 8 characters with a letter and number</p>
      </div>
      <div class="form-group">
        <label for="confirmNewPasswordInput">Confirm New Password</label>
        <div class="input-wrapper">
          <i data-lucide="lock" class="input-icon"></i>
          <input type="password" class="form-input" id="confirmNewPasswordInput" placeholder="••••••••" autocomplete="new-password" required />
          <button type="button" class="toggle-password" data-target="confirmNewPasswordInput" aria-label="Toggle password visibility">
            <i data-lucide="eye"></i>
          </button>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn-primary" onclick="changePassword(this)">Change Password</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.classList.add('open');
  
  // Setup toggle password buttons
  modal.querySelectorAll('.toggle-password').forEach(btn => {
    btn.onclick = () => {
      const target = document.getElementById(btn.dataset.target);
      if (target) {
        target.type = target.type === 'password' ? 'text' : 'password';
        btn.innerHTML = target.type === 'password' ? '<i data-lucide="eye"></i>' : '<i data-lucide="eye-off"></i>';
        lucide.createIcons();
      }
    };
  });
  
  lucide.createIcons();
}

async function changePassword(btn) {
  const current = document.getElementById('currentPasswordInput')?.value;
  const newPass = document.getElementById('newPasswordInput')?.value;
  const confirm = document.getElementById('confirmNewPasswordInput')?.value;

  if (!current || !newPass || !confirm) {
    showToast('Please fill all fields');
    return;
  }

  if (newPass !== confirm) {
    showToast('Passwords do not match');
    return;
  }

  if (newPass.length < 8 || !/[a-zA-Z]/.test(newPass) || !/[0-9]/.test(newPass)) {
    showToast('Password must be at least 8 characters with a letter and number');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Changing...';

  try {
    await fetch('/api/auth/change-password', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: current, new_password: newPass })
    });
    showToast('Password changed. Please log in again.');
    btn.closest('.modal-overlay').remove();
    // Logout
    setTimeout(() => window.location.href = '/login', 1500);
  } catch (err) {
    console.error('Failed to change password:', err);
    showToast('Failed to change password: ' + (err.message || 'Check current password'));
  } finally {
    btn.disabled = false;
    btn.textContent = 'Change Password';
  }
}

async function handleExportData() {
  const btn = document.getElementById('exportDataBtn');
  const originalHTML = btn.innerHTML;
  
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader" style="animation:spin 1s linear infinite;"></i> Preparing...';
  lucide.createIcons();

  try {
    const response = await fetch('/api/auth/export-data', { credentials: 'include' });
    if (!response.ok) throw new Error('Export failed');
    
    const data = await response.json();
    
    // Create download
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neuro-music-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('Data exported successfully');
  } catch (err) {
    console.error('Export failed:', err);
    showToast('Export failed: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHTML;
    lucide.createIcons();
  }
}

function openDeleteAccountModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card" style="max-width: 400px;">
      <h3 style="color: var(--like);">Delete Account</h3>
      <p style="color: var(--text-1); margin-bottom: 16px;">This will permanently delete your account and all associated data. This action cannot be undone.</p>
      <div class="form-group">
        <label for="deleteAccountPasswordInput">Enter your password to confirm</label>
        <div class="input-wrapper">
          <i data-lucide="lock" class="input-icon"></i>
          <input type="password" class="form-input" id="deleteAccountPasswordInput" placeholder="••••••••" autocomplete="current-password" required />
          <button type="button" class="toggle-password" data-target="deleteAccountPasswordInput" aria-label="Toggle password visibility">
            <i data-lucide="eye"></i>
          </button>
        </div>
      </div>
      <p class="form-hint" style="color: var(--like);">This will delete all playlists, liked songs, history, and sessions.</p>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn-primary" style="background: var(--like);" onclick="deleteAccount(this)">Delete Account</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.classList.add('open');
  
  // Setup toggle password
  const toggleBtn = modal.querySelector('.toggle-password');
  if (toggleBtn) {
    toggleBtn.onclick = () => {
      const target = document.getElementById(toggleBtn.dataset.target);
      if (target) {
        target.type = target.type === 'password' ? 'text' : 'password';
        toggleBtn.innerHTML = target.type === 'password' ? '<i data-lucide="eye"></i>' : '<i data-lucide="eye-off"></i>';
        lucide.createIcons();
      }
    };
  }
  
  lucide.createIcons();
}

async function deleteAccount(btn) {
  const password = document.getElementById('deleteAccountPasswordInput')?.value;
  if (!password) {
    showToast('Please enter your password');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Deleting...';

  try {
    await fetch('/api/auth/delete-account', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    
    showToast('Account deleted');
    btn.closest('.modal-overlay').remove();
    
    // Clear local caches and redirect
    await clearUserCaches();
    window.location.href = '/login';
  } catch (err) {
    console.error('Failed to delete account:', err);
    showToast('Failed to delete account: ' + (err.message || 'Check password'));
  } finally {
    btn.disabled = false;
    btn.textContent = 'Delete Account';
  }
}

// Helper: Get cookie
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// Helper: Parse JWT (without verification, just for reading)
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

// ============================================================================



/* ==== 18. INITIALIZATION & CONTROLS BINDING ==== */
async function checkAuthUser() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) {
      const user = await res.json();
      S.user = user;
      renderAccountProfile(user);
      loadLibraryData();
    } else {
      const nameEl = document.getElementById('sidebarName');
      if (nameEl) nameEl.textContent = 'Guest';
    }
  } catch (e) {
    const nameEl = document.getElementById('sidebarName');
    if (nameEl) nameEl.textContent = 'Guest';
  }
}

function initPlayerControls() {
  // Main Play/Pause
  document.getElementById('playerPlayPauseBtn')?.addEventListener('click', togglePlay);
  document.getElementById('miniPlayPauseBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlay();
  });

  // Track skipping
  document.getElementById('playerPrevBtn')?.addEventListener('click', prevTrack);
  document.getElementById('playerNextBtn')?.addEventListener('click', nextTrack);
  document.getElementById('miniNextBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    nextTrack();
  });

  // Shuffle, Repeat, Mute
  document.getElementById('playerShuffleBtn')?.addEventListener('click', toggleShuffle);
  document.getElementById('playerRepeatBtn')?.addEventListener('click', toggleRepeat);
  document.getElementById('playerMuteBtn')?.addEventListener('click', toggleMute);

  // Volume slider
  const volSlider = document.getElementById('playerVolumeSlider');
  if (volSlider) {
    volSlider.addEventListener('input', (e) => {
      setVolume(Number(e.target.value) / 100);
    });
  }

  // Scrubber bar seeking
  const scrubber = document.getElementById('playerScrubberBar');
  if (scrubber) {
    scrubber.addEventListener('click', (e) => {
      const rect = scrubber.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      seekTo(fraction);
    });
  }

  // Like button in player
  document.getElementById('playerLikeBtn')?.addEventListener('click', () => {
    if (S.cur) toggleLike(S.cur);
  });

  // Expand / Collapse Fullscreen Player
  document.getElementById('miniPlayerBar')?.addEventListener('click', openFullscreenPlayer);
  document.getElementById('collapsePlayerBtn')?.addEventListener('click', closeFullscreenPlayer);

  // Lyrics drawer
  document.getElementById('openLyricsBtn')?.addEventListener('click', openLyricsDrawer);
  document.getElementById('closeLyricsBtn')?.addEventListener('click', closeLyricsDrawer);

  // Featured play & Radio play
  document.getElementById('featuredPlayBtn')?.addEventListener('click', () => {
    if (SONGS.length) playSong(SONGS[0], [...SONGS]);
  });
  document.getElementById('radioPlayBtn')?.addEventListener('click', () => startStation([]));

  // Liked songs actions
  document.getElementById('playAllLikedBtn')?.addEventListener('click', () => {
    if (S.likedSongs.length) playSong(S.likedSongs[0], [...S.likedSongs]);
    else showToast('No liked songs');
  });
  document.getElementById('shuffleLikedBtn')?.addEventListener('click', () => {
    if (S.likedSongs.length) {
      const shuffled = [...S.likedSongs].sort(() => Math.random() - 0.5);
      playSong(shuffled[0], shuffled);
    } else showToast('No liked songs');
  });

  // Playlist modals
  document.getElementById('createPlaylistBtn')?.addEventListener('click', openCreatePlaylistModal);
  document.getElementById('sidebarCreatePlBtn')?.addEventListener('click', openCreatePlaylistModal);
  document.getElementById('confirmCreatePlaylistBtn')?.addEventListener('click', handleConfirmCreatePlaylist);
  document.getElementById('cancelCreatePlaylistBtn')?.addEventListener('click', () => {
    document.getElementById('createPlaylistModal')?.classList.remove('open');
  });
  document.getElementById('cancelAddToPlaylistBtn')?.addEventListener('click', () => {
    document.getElementById('addToPlaylistModal')?.classList.remove('open');
  });

  // Hero row navigation in library
  document.getElementById('likedHeroRow')?.addEventListener('click', () => switchView('liked'));
  document.getElementById('likedBackBtn')?.addEventListener('click', () => switchView('library'));
  document.getElementById('playlistBackBtn')?.addEventListener('click', () => switchView('library'));
  document.getElementById('accountBackBtn')?.addEventListener('click', () => switchView('home'));

  // Theme button
  document.getElementById('sidebarThemeBtn')?.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = cur === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });

  // User chip in sidebar
  document.getElementById('sidebarUserChip')?.addEventListener('click', () => {
    if (S.user) {
      switchView('account');
    } else {
      window.location.href = '/login';
    }
  });

  // Dock items
  document.querySelectorAll('.dock .dock-item').forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-target');
      if (target) switchView(target);
    });
  });

  // Sidebar nav items
  const navMap = {
    sidebarHome: 'home',
    sidebarNew: 'new',
    sidebarRadio: 'radio',
    sidebarLibrary: 'library',
    sidebarSearch: 'search'
  };
  Object.entries(navMap).forEach(([id, target]) => {
    document.getElementById(id)?.addEventListener('click', () => switchView(target));
  });

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if (e.code === 'ArrowRight' && e.altKey) {
      nextTrack();
    } else if (e.code === 'ArrowLeft' && e.altKey) {
      prevTrack();
    } else if (e.code === 'KeyS' && e.ctrlKey) {
      e.preventDefault();
      toggleShuffle();
    } else if (e.code === 'KeyR' && e.ctrlKey) {
      e.preventDefault();
      toggleRepeat();
    } else if (e.code === 'Escape') {
      closeFullscreenPlayer();
      closeLyricsDrawer();
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initKeepAliveAudio();
  initPlayerControls();
  initSearch();
  createContextMenu();
  renderPlayNextQueue();
  restoreState();
  renderLibraryCategories();

  // Setup subview sorts
  const songSort = document.getElementById('songsSortSelect');
  if (songSort) songSort.onchange = () => renderLibrarySongsView();
  const artistSort = document.getElementById('libraryArtistsSortSelect');
  if (artistSort) artistSort.onchange = () => renderLibraryArtistsView();
  const albumSort = document.getElementById('libraryAlbumsSortSelect');
  if (albumSort) albumSort.onchange = () => renderLibraryAlbumsView();
  const offlineSort = document.getElementById('offlineLibrarySortSelect');
  if (offlineSort) offlineSort.onchange = () => renderOfflineLibraryView();

  const backButtons = ['songsBackBtn', 'libraryArtistsBackBtn', 'libraryAlbumsBackBtn', 'offlineLibraryBackBtn', 'artistsBackBtn', 'albumsBackBtn', 'offlineBackBtn'];
  backButtons.forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => switchView('library'));
  });

  checkAuthUser();
  loadHomeData();
  registerServiceWorker();
  setupOfflineDetection();
  lucide.createIcons();
});
