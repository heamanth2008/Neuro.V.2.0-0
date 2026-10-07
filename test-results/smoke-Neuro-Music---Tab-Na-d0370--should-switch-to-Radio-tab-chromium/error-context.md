# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Neuro Music - Tab Navigation >> should switch to Radio tab
- Location: tests\smoke.spec.ts:163:9

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('[data-target="radio"]')

```

# Page snapshot

```yaml
- main [ref=e2]:
  - generic [ref=e3]:
    - heading "Neuro Music" [level=1] [ref=e11]
    - tablist [ref=e12]:
      - tab "Sign In" [ref=e13] [cursor=pointer]
      - tab "Register" [selected] [ref=e18] [cursor=pointer]
    - generic [ref=e23]:
      - generic [ref=e24]:
        - generic [ref=e25]: Display Name
        - textbox "Display Name" [ref=e27]:
          - /placeholder: Your name
          - text: Test User
      - generic [ref=e28]:
        - generic [ref=e29]: Email
        - textbox "Email" [ref=e31]:
          - /placeholder: you@example.com
          - text: test1791344571448@example.com
      - generic [ref=e32]:
        - generic [ref=e33]: Password
        - generic [ref=e34]:
          - textbox "Password" [ref=e35]:
            - /placeholder: ••••••••
            - text: TestPass123
          - button "Toggle password visibility" [ref=e36] [cursor=pointer]
        - paragraph [ref=e40]: At least 8 characters with a letter and number
      - generic [ref=e41]:
        - generic [ref=e42]: Confirm Password
        - generic [ref=e43]:
          - textbox "Confirm Password" [invalid] [ref=e44]:
            - /placeholder: ••••••••
          - button "Toggle password visibility" [ref=e45] [cursor=pointer]
        - paragraph [ref=e49]: Please confirm your password
      - button "Create Account" [active] [ref=e50] [cursor=pointer]
    - paragraph [ref=e53]:
      - text: By continuing, you agree to our
      - link "Terms of Service" [ref=e54] [cursor=pointer]:
        - /url: "#"
      - text: and
      - link "Privacy Policy" [ref=e55] [cursor=pointer]:
        - /url: "#"
      - text: .
```

# Test source

```ts
  65  |     // Register first
  66  |     await page.goto('/login');
  67  |     await page.click('#tab-register');
  68  |     const email = `test${Date.now()}@example.com`;
  69  |     const password = 'TestPass123';
  70  |     await page.fill('#register-email', email);
  71  |     await page.fill('#register-password', password);
  72  |     await page.fill('#register-name', 'Test User');
  73  |     await page.click('#form-register button[type="submit"]');
  74  |     await page.waitForURL(/\//);
  75  |   });
  76  | 
  77  |   test('should search for songs', async ({ page }) => {
  78  |     // Open search panel
  79  |     await page.click('#searchInput');
  80  |     await page.fill('#searchInput', 'Imagine Dragons');
  81  |     await page.waitForTimeout(500); // debounce
  82  | 
  83  |     // Check results appear
  84  |     await expect(page.locator('.search-results .row')).toHaveCountGreaterThan(0, { timeout: 10000 });
  85  |   });
  86  | 
  87  |   test('should play a song from search results', async ({ page }) => {
  88  |     await page.click('#searchInput');
  89  |     await page.fill('#searchInput', 'Imagine Dragons');
  90  |     await page.waitForTimeout(500);
  91  | 
  92  |     // Click first result
  93  |     await page.locator('.search-results .row').first().click();
  94  | 
  95  |     // Check player shows track
  96  |     await expect(page.locator('#playerTitle')).not.toBeEmpty({ timeout: 10000 });
  97  |     await expect(page.locator('#playerArtist')).not.toBeEmpty();
  98  |   });
  99  | 
  100 |   test('should like and unlike a song', async ({ page }) => {
  101 |     await page.click('#searchInput');
  102 |     await page.fill('#searchInput', 'Imagine Dragons');
  103 |     await page.waitForTimeout(500);
  104 | 
  105 |     // Click like button on first result
  106 |     const likeBtn = page.locator('.search-results .row .row-action-btn[title="Like"]').first();
  107 |     await likeBtn.click();
  108 | 
  109 |     // Check it's liked
  110 |     await expect(likeBtn).toHaveClass(/liked/);
  111 | 
  112 |     // Unlike
  113 |     await likeBtn.click();
  114 |     await expect(likeBtn).not.toHaveClass(/liked/);
  115 |   });
  116 | 
  117 |   test('should add song to playlist', async ({ page }) => {
  118 |     // Create a playlist first
  119 |     await page.click('[data-target="library"]');
  120 |     await page.click('#createPlaylistBtn');
  121 |     await page.fill('#newPlaylistInput', 'Test Playlist');
  122 |     await page.click('#confirmCreatePlaylistBtn');
  123 | 
  124 |     // Search and add to playlist
  125 |     await page.click('[data-target="home"]');
  126 |     await page.click('#searchInput');
  127 |     await page.fill('#searchInput', 'Imagine Dragons');
  128 |     await page.waitForTimeout(500);
  129 | 
  130 |     await page.locator('.search-results .row .row-action-btn[title="Add to Playlist"]').first().click();
  131 |     await page.click('.modal-overlay.open .row:has-text("Test Playlist")');
  132 |     await page.click('#cancelAddToPlaylistBtn');
  133 | 
  134 |     // Verify in playlist
  135 |     await page.click('[data-target="library"]');
  136 |     await page.click('[data-playlist-id]:has-text("Test Playlist")');
  137 |     await expect(page.locator('#playlistTracksPanel .row')).toHaveCountGreaterThan(0);
  138 |   });
  139 | });
  140 | 
  141 | test.describe('Neuro Music - Tab Navigation', () => {
  142 |   test.beforeEach(async ({ page }) => {
  143 |     await page.goto('/login');
  144 |     await page.click('#tab-register');
  145 |     const email = `test${Date.now()}@example.com`;
  146 |     const password = 'TestPass123';
  147 |     await page.fill('#register-email', email);
  148 |     await page.fill('#register-password', password);
  149 |     await page.fill('#register-name', 'Test User');
  150 |     await page.click('#form-register button[type="submit"]');
  151 |     await page.waitForURL(/\//);
  152 |   });
  153 | 
  154 |   const tabs = [
  155 |     { target: 'home', label: 'Home', viewId: 'view-home' },
  156 |     { target: 'new', label: 'New', viewId: 'view-new' },
  157 |     { target: 'radio', label: 'Radio', viewId: 'view-radio' },
  158 |     { target: 'library', label: 'Library', viewId: 'view-library' },
  159 |     { target: 'search', label: 'Search', viewId: 'view-search' },
  160 |   ];
  161 | 
  162 |   for (const tab of tabs) {
  163 |     test(`should switch to ${tab.label} tab`, async ({ page }) => {
  164 |       // Click dock item
> 165 |       await page.click(`[data-target="${tab.target}"]`);
      |                  ^ Error: page.click: Test timeout of 60000ms exceeded.
  166 | 
  167 |       // Check view is active
  168 |       await expect(page.locator(`#${tab.viewId}`)).toHaveClass(/active/);
  169 |     });
  170 |   }
  171 | 
  172 |   test('should navigate library sub-views', async ({ page }) => {
  173 |     await page.click('[data-target="library"]');
  174 | 
  175 |     // Click Liked Songs hero
  176 |     await page.click('#likedHeroRow');
  177 |     await expect(page.locator('#view-liked')).toHaveClass(/active/);
  178 | 
  179 |     // Go back
  180 |     await page.click('#likedBackBtn');
  181 |     await expect(page.locator('#view-library')).toHaveClass(/active/);
  182 |   });
  183 | });
  184 | 
  185 | test.describe('Neuro Music - Settings', () => {
  186 |   test.beforeEach(async ({ page }) => {
  187 |     await page.goto('/login');
  188 |     await page.click('#tab-register');
  189 |     const email = `test${Date.now()}@example.com`;
  190 |     const password = 'TestPass123';
  191 |     await page.fill('#register-email', email);
  192 |     await page.fill('#register-password', password);
  193 |     await page.fill('#register-name', 'Test User');
  194 |     await page.click('#form-register button[type="submit"]');
  195 |     await page.waitForURL(/\//);
  196 |   });
  197 | 
  198 |   test('should toggle theme', async ({ page }) => {
  199 |     await page.click('[data-target="settings"]');
  200 |     await page.waitForSelector('#settingsPanel');
  201 | 
  202 |     // Find theme toggle
  203 |     const themeToggle = page.locator('select[id*="theme"], button[id*="theme"], [data-setting="theme"]');
  204 |     if (await themeToggle.count() > 0) {
  205 |       await themeToggle.click();
  206 |     }
  207 | 
  208 |     // Check theme attribute changes
  209 |     const html = page.locator('html');
  210 |     await expect(html).toHaveAttribute('data-theme', /dark|light/);
  211 |   });
  212 | 
  213 |   test('should toggle motion reduction', async ({ page }) => {
  214 |     await page.click('[data-target="settings"]');
  215 |     await page.waitForSelector('#settingsPanel');
  216 | 
  217 |     const motionToggle = page.locator('input[type="checkbox"][id*="motion"], [data-setting="motion"]');
  218 |     if (await motionToggle.count() > 0) {
  219 |       await motionToggle.click();
  220 |       await expect(page.locator('html')).toHaveClass(/reduce-motion/);
  221 |     }
  222 |   });
  223 | });
  224 | 
  225 | test.describe('Neuro Music - Account', () => {
  226 |   test.beforeEach(async ({ page }) => {
  227 |     await page.goto('/login');
  228 |     await page.click('#tab-register');
  229 |     const email = `test${Date.now()}@example.com`;
  230 |     const password = 'TestPass123';
  231 |     await page.fill('#register-email', email);
  232 |     await page.fill('#register-password', password);
  233 |     await page.fill('#register-name', 'Test User');
  234 |     await page.click('#form-register button[type="submit"]');
  235 |     await page.waitForURL(/\//);
  236 |   });
  237 | 
  238 |   test('should show account profile', async ({ page }) => {
  239 |     await page.click('[data-target="account"]');
  240 |     await expect(page.locator('#accountName')).toContainText('Test User');
  241 |     await expect(page.locator('#accountEmail')).toContainText('@example.com');
  242 |   });
  243 | 
  244 |   test('should export data', async ({ page }) => {
  245 |     await page.click('[data-target="account"]');
  246 |     await page.click('#exportDataBtn');
  247 | 
  248 |     // Should trigger download
  249 |     const downloadPromise = page.waitForEvent('download');
  250 |     await downloadPromise;
  251 |   });
  252 | 
  253 |   test('should change password', async ({ page }) => {
  254 |     await page.click('[data-target="account"]');
  255 |     await page.click('#changePasswordBtn');
  256 | 
  257 |     await page.fill('#currentPasswordInput', 'TestPass123');
  258 |     await page.fill('#newPasswordInput', 'NewPass456');
  259 |     await page.fill('#confirmNewPasswordInput', 'NewPass456');
  260 |     await page.click('#confirmChangePasswordBtn');
  261 | 
  262 |     // Should redirect to login
  263 |     await expect(page).toHaveURL('/login');
  264 |   });
  265 | 
```