import { test, expect } from '@playwright/test';

test.describe('Neuro Music - Auth Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
  });

  test('should register a new user', async ({ page }) => {
    const email = `test${Date.now()}@example.com`;
    const password = 'TestPass123';
    const displayName = 'Test User';

    // Fill registration form - need to click register tab first
    await page.click('#tab-register');
    await page.fill('#register-email', email);
    await page.fill('#register-password', password);
    await page.fill('#register-name', displayName);

    // Submit - target the register form's submit button specifically
    await page.click('#form-register button[type="submit"]');

    // Should redirect to home
    await expect(page).toHaveURL(/\//);
    await expect(page.locator('text=Home')).toBeVisible({ timeout: 10000 });
  });

  test('should login with existing credentials', async ({ page }) => {
    // First register
    const email = `test${Date.now()}@example.com`;
    const password = 'TestPass123';
    const displayName = 'Test User';

    await page.click('#tab-register');
    await page.fill('#register-email', email);
    await page.fill('#register-password', password);
    await page.fill('#register-name', displayName);
    await page.click('#form-register button[type="submit"]');
    await expect(page).toHaveURL(/\//);

    // Logout
    await page.click('[data-target="account"]');
    await page.click('text=Sign Out');

    // Login again
    await page.waitForURL('/login');
    await page.fill('#login-email', email);
    await page.fill('#login-password', password);
    await page.click('#form-login button[type="submit"]');

    await expect(page).toHaveURL(/\//);
  });

  test('should show error for wrong password', async ({ page }) => {
    await page.fill('#login-email', 'test@example.com');
    await page.fill('#login-password', 'WrongPass123');
    await page.click('#form-login button[type="submit"]');

    await expect(page.locator('[role="alert"]')).toContainText(/invalid/i);
  });
});

test.describe('Neuro Music - Search & Playback', () => {
  test.beforeEach(async ({ page }) => {
    // Register first
    await page.goto('/login');
    await page.click('#tab-register');
    const email = `test${Date.now()}@example.com`;
    const password = 'TestPass123';
    await page.fill('#register-email', email);
    await page.fill('#register-password', password);
    await page.fill('#register-name', 'Test User');
    await page.click('#form-register button[type="submit"]');
    await page.waitForURL(/\//);
  });

  test('should search for songs', async ({ page }) => {
    // Open search panel
    await page.click('#searchInput');
    await page.fill('#searchInput', 'Imagine Dragons');
    await page.waitForTimeout(500); // debounce

    // Check results appear
    await expect(page.locator('.search-results .row')).toHaveCountGreaterThan(0, { timeout: 10000 });
  });

  test('should play a song from search results', async ({ page }) => {
    await page.click('#searchInput');
    await page.fill('#searchInput', 'Imagine Dragons');
    await page.waitForTimeout(500);

    // Click first result
    await page.locator('.search-results .row').first().click();

    // Check player shows track
    await expect(page.locator('#playerTitle')).not.toBeEmpty({ timeout: 10000 });
    await expect(page.locator('#playerArtist')).not.toBeEmpty();
  });

  test('should like and unlike a song', async ({ page }) => {
    await page.click('#searchInput');
    await page.fill('#searchInput', 'Imagine Dragons');
    await page.waitForTimeout(500);

    // Click like button on first result
    const likeBtn = page.locator('.search-results .row .row-action-btn[title="Like"]').first();
    await likeBtn.click();

    // Check it's liked
    await expect(likeBtn).toHaveClass(/liked/);

    // Unlike
    await likeBtn.click();
    await expect(likeBtn).not.toHaveClass(/liked/);
  });

  test('should add song to playlist', async ({ page }) => {
    // Create a playlist first
    await page.click('[data-target="library"]');
    await page.click('#createPlaylistBtn');
    await page.fill('#newPlaylistInput', 'Test Playlist');
    await page.click('#confirmCreatePlaylistBtn');

    // Search and add to playlist
    await page.click('[data-target="home"]');
    await page.click('#searchInput');
    await page.fill('#searchInput', 'Imagine Dragons');
    await page.waitForTimeout(500);

    await page.locator('.search-results .row .row-action-btn[title="Add to Playlist"]').first().click();
    await page.click('.modal-overlay.open .row:has-text("Test Playlist")');
    await page.click('#cancelAddToPlaylistBtn');

    // Verify in playlist
    await page.click('[data-target="library"]');
    await page.click('[data-playlist-id]:has-text("Test Playlist")');
    await expect(page.locator('#playlistTracksPanel .row')).toHaveCountGreaterThan(0);
  });
});

test.describe('Neuro Music - Tab Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.click('#tab-register');
    const email = `test${Date.now()}@example.com`;
    const password = 'TestPass123';
    await page.fill('#register-email', email);
    await page.fill('#register-password', password);
    await page.fill('#register-name', 'Test User');
    await page.click('#form-register button[type="submit"]');
    await page.waitForURL(/\//);
  });

  const tabs = [
    { target: 'home', label: 'Home', viewId: 'view-home' },
    { target: 'new', label: 'New', viewId: 'view-new' },
    { target: 'radio', label: 'Radio', viewId: 'view-radio' },
    { target: 'library', label: 'Library', viewId: 'view-library' },
    { target: 'search', label: 'Search', viewId: 'view-search' },
  ];

  for (const tab of tabs) {
    test(`should switch to ${tab.label} tab`, async ({ page }) => {
      // Click dock item
      await page.click(`[data-target="${tab.target}"]`);

      // Check view is active
      await expect(page.locator(`#${tab.viewId}`)).toHaveClass(/active/);
    });
  }

  test('should navigate library sub-views', async ({ page }) => {
    await page.click('[data-target="library"]');

    // Click Liked Songs hero
    await page.click('#likedHeroRow');
    await expect(page.locator('#view-liked')).toHaveClass(/active/);

    // Go back
    await page.click('#likedBackBtn');
    await expect(page.locator('#view-library')).toHaveClass(/active/);
  });
});

test.describe('Neuro Music - Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.click('#tab-register');
    const email = `test${Date.now()}@example.com`;
    const password = 'TestPass123';
    await page.fill('#register-email', email);
    await page.fill('#register-password', password);
    await page.fill('#register-name', 'Test User');
    await page.click('#form-register button[type="submit"]');
    await page.waitForURL(/\//);
  });

  test('should toggle theme', async ({ page }) => {
    await page.click('[data-target="settings"]');
    await page.waitForSelector('#settingsPanel');

    // Find theme toggle
    const themeToggle = page.locator('select[id*="theme"], button[id*="theme"], [data-setting="theme"]');
    if (await themeToggle.count() > 0) {
      await themeToggle.click();
    }

    // Check theme attribute changes
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', /dark|light/);
  });

  test('should toggle motion reduction', async ({ page }) => {
    await page.click('[data-target="settings"]');
    await page.waitForSelector('#settingsPanel');

    const motionToggle = page.locator('input[type="checkbox"][id*="motion"], [data-setting="motion"]');
    if (await motionToggle.count() > 0) {
      await motionToggle.click();
      await expect(page.locator('html')).toHaveClass(/reduce-motion/);
    }
  });
});

test.describe('Neuro Music - Account', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.click('#tab-register');
    const email = `test${Date.now()}@example.com`;
    const password = 'TestPass123';
    await page.fill('#register-email', email);
    await page.fill('#register-password', password);
    await page.fill('#register-name', 'Test User');
    await page.click('#form-register button[type="submit"]');
    await page.waitForURL(/\//);
  });

  test('should show account profile', async ({ page }) => {
    await page.click('[data-target="account"]');
    await expect(page.locator('#accountName')).toContainText('Test User');
    await expect(page.locator('#accountEmail')).toContainText('@example.com');
  });

  test('should export data', async ({ page }) => {
    await page.click('[data-target="account"]');
    await page.click('#exportDataBtn');

    // Should trigger download
    const downloadPromise = page.waitForEvent('download');
    await downloadPromise;
  });

  test('should change password', async ({ page }) => {
    await page.click('[data-target="account"]');
    await page.click('#changePasswordBtn');

    await page.fill('#currentPasswordInput', 'TestPass123');
    await page.fill('#newPasswordInput', 'NewPass456');
    await page.fill('#confirmNewPasswordInput', 'NewPass456');
    await page.click('#confirmChangePasswordBtn');

    // Should redirect to login
    await expect(page).toHaveURL('/login');
  });

  test('should sign out', async ({ page }) => {
    await page.click('[data-target="account"]');
    await page.click('#signOutBtn');

    await expect(page).toHaveURL('/login');
  });
});

test.describe('Neuro Music - Mobile Responsive', () => {
  test('should show dock on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/login');
    await page.click('#tab-register');
    const email = `test${Date.now()}@example.com`;
    const password = 'TestPass123';
    await page.fill('#register-email', email);
    await page.fill('#register-password', password);
    await page.fill('#register-name', 'Test User');
    await page.click('#form-register button[type="submit"]');
    await page.waitForURL(/\//);

    await expect(page.locator('.dock')).toBeVisible();
    await expect(page.locator('.dock-item')).toHaveCount(5);
  });

  test('should show mini-player on mobile when playing', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/login');
    await page.click('#tab-register');
    const email = `test${Date.now()}@example.com`;
    const password = 'TestPass123';
    await page.fill('#register-email', email);
    await page.fill('#register-password', password);
    await page.fill('#register-name', 'Test User');
    await page.click('#form-register button[type="submit"]');
    await page.waitForURL(/\//);

    await page.click('#searchInput');
    await page.fill('#searchInput', 'Imagine Dragons');
    await page.waitForTimeout(500);
    await page.locator('.search-results .row').first().click();

    await expect(page.locator('.mini-player-bar')).toBeVisible();
  });
});