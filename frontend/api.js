/**
 * Neuro Music API Client
 * Handles all backend API calls for user data
 */
const API = {
  baseUrl: '/api',

  async request(endpoint, options = {}) {
    const url = this.baseUrl + endpoint;
    const config = {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, config);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(data.detail || 'Request failed');
      error.status = response.status;
      error.detail = data.detail;
      throw error;
    }

    return data;
  },

  // ============================================================================
  // PLAYLISTS
  // ============================================================================

  async getPlaylists() {
    return this.request('/playlists');
  },

  async createPlaylist(name, description = '') {
    return this.request('/playlists', {
      method: 'POST',
      body: { name, description }
    });
  },

  async getPlaylist(playlistId) {
    return this.request(`/playlists/${playlistId}`);
  },

  async updatePlaylist(playlistId, name, description = '') {
    return this.request(`/playlists/${playlistId}`, {
      method: 'PUT',
      body: { name, description }
    });
  },

  async deletePlaylist(playlistId) {
    return this.request(`/playlists/${playlistId}`, {
      method: 'DELETE'
    });
  },

  async addTrackToPlaylist(playlistId, track) {
    return this.request(`/playlists/${playlistId}/tracks`, {
      method: 'POST',
      body: track
    });
  },

  async removeTrackFromPlaylist(playlistId, trackId) {
    return this.request(`/playlists/${playlistId}/tracks/${trackId}`, {
      method: 'DELETE'
    });
  },

  async reorderPlaylistTracks(playlistId, trackIds) {
    return this.request(`/playlists/${playlistId}/tracks/reorder`, {
      method: 'PUT',
      body: { track_ids: trackIds }
    });
  },

  // ============================================================================
  // LIKES
  // ============================================================================

  async getLikes(sort = 'recent') {
    return this.request(`/likes?sort=${encodeURIComponent(sort)}`);
  },

  async addLike(track) {
    return this.request('/likes', {
      method: 'POST',
      body: track
    });
  },

  async removeLike(ytId) {
    return this.request(`/likes/${encodeURIComponent(ytId)}`, {
      method: 'DELETE'
    });
  },

  // ============================================================================
  // HISTORY
  // ============================================================================

  async addHistory(track) {
    return this.request('/history', {
      method: 'POST',
      body: track
    });
  },

  async getRecentHistory(limit = 50) {
    return this.request(`/history/recent?limit=${limit}`);
  },

  async getTopArtists(limit = 20) {
    return this.request(`/history/top-artists?limit=${limit}`);
  },

  // ============================================================================
  // SETTINGS
  // ============================================================================

  async getSettings() {
    return this.request('/settings');
  },

  async updateSettings(settings) {
    return this.request('/settings', {
      method: 'PUT',
      body: settings
    });
  },

  // ============================================================================
  // HOME
  // ============================================================================

  async getHome() {
    return this.request('/home');
  },

  // ============================================================================
  // SEARCH (existing)
  // ============================================================================

  async search(q) {
    return this.request(`/search?q=${encodeURIComponent(q)}`);
  },

  // ============================================================================
  // LYRICS
  // ============================================================================

  async getLyrics(title, artist) {
    return this.request(`/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`);
  },

  // ============================================================================
  // NEW SCREEN
  // ============================================================================

  async getNewContent() {
    return this.request('/new');
  }
};

// Export for use in other modules
window.API = API;