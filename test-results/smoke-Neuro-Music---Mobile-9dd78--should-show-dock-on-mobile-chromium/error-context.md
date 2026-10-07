# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Neuro Music - Mobile Responsive >> should show dock on mobile
- Location: tests\smoke.spec.ts:275:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.dock')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('.dock') with timeout 10000ms
  - waiting for locator('.dock')

```

```yaml
- main:
  - heading "Neuro Music" [level=1]
  - tablist:
    - tab "Sign In"
    - tab "Register" [selected]
  - text: Display Name
  - textbox "Display Name":
    - /placeholder: Your name
    - text: Test User
  - text: Email
  - textbox "Email":
    - /placeholder: you@example.com
    - text: test1791344652215@example.com
  - text: Password
  - textbox "Password":
    - /placeholder: ••••••••
    - text: TestPass123
  - button "Toggle password visibility"
  - paragraph: At least 8 characters with a letter and number
  - text: Confirm Password
  - textbox "Confirm Password" [invalid]:
    - /placeholder: ••••••••
  - button "Toggle password visibility"
  - paragraph: Please confirm your password
  - button "Create Account"
  - paragraph:
    - text: By continuing, you agree to our
    - link "Terms of Service":
      - /url: "#"
    - text: and
    - link "Privacy Policy":
      - /url: "#"
    - text: .
```

# Test source

```ts
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
> 287 |     await expect(page.locator('.dock')).toBeVisible();
      |                                         ^ Error: expect(locator).toBeVisible() failed
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