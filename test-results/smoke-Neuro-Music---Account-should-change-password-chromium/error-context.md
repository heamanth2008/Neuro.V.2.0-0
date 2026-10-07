# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Neuro Music - Account >> should change password
- Location: tests\smoke.spec.ts:253:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('[data-target="account"]')

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
          - text: test1791344638746@example.com
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
  165 |       await page.click(`[data-target="${tab.target}"]`);
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
> 254 |     await page.click('[data-target="account"]');
      |                ^ Error: page.click: Test timeout of 60000ms exceeded.
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
  266 |   test('should sign out', async ({ page }) => {
  267 |     await page.click('[data-target="account"]');
  268 |     await page.click('#signOutBtn');
  269 | 
  270 |     await expect(page).toHaveURL('/login');
  271 |   });
  272 | });
  273 | 
  274 | test.describe('Neuro Music - Mobile Responsive', () => {
  275 |   test('should show dock on mobile', async ({ page }) => {
  276 |     await page.setViewportSize({ width: 375, height: 667 });
  277 |     await page.goto('/login');
  278 |     await page.click('#tab-register');
  279 |     const email = `test${Date.now()}@example.com`;
  280 |     const password = 'TestPass123';
  281 |     await page.fill('#register-email', email);
  282 |     await page.fill('#register-password', password);
  283 |     await page.fill('#register-name', 'Test User');
  284 |     await page.click('#form-register button[type="submit"]');
  285 |     await page.waitForURL(/\//);
  286 | 
  287 |     await expect(page.locator('.dock')).toBeVisible();
  288 |     await expect(page.locator('.dock-item')).toHaveCount(5);
  289 |   });
  290 | 
  291 |   test('should show mini-player on mobile when playing', async ({ page }) => {
  292 |     await page.setViewportSize({ width: 375, height: 667 });
  293 |     await page.goto('/login');
  294 |     await page.click('#tab-register');
  295 |     const email = `test${Date.now()}@example.com`;
  296 |     const password = 'TestPass123';
  297 |     await page.fill('#register-email', email);
  298 |     await page.fill('#register-password', password);
  299 |     await page.fill('#register-name', 'Test User');
  300 |     await page.click('#form-register button[type="submit"]');
  301 |     await page.waitForURL(/\//);
  302 | 
  303 |     await page.click('#searchInput');
  304 |     await page.fill('#searchInput', 'Imagine Dragons');
  305 |     await page.waitForTimeout(500);
  306 |     await page.locator('.search-results .row').first().click();
  307 | 
  308 |     await expect(page.locator('.mini-player-bar')).toBeVisible();
  309 |   });
  310 | });
```