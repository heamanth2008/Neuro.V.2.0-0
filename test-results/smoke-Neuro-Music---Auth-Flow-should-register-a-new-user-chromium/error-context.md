# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Neuro Music - Auth Flow >> should register a new user
- Location: tests\smoke.spec.ts:9:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Home')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('text=Home') with timeout 10000ms
  - waiting for locator('text=Home')

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
    - text: test1791344504769@example.com
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
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Neuro Music - Auth Flow', () => {
  4   |   test.beforeEach(async ({ page }) => {
  5   |     await page.goto('/login');
  6   |     await page.waitForLoadState('networkidle');
  7   |   });
  8   | 
  9   |   test('should register a new user', async ({ page }) => {
  10  |     const email = `test${Date.now()}@example.com`;
  11  |     const password = 'TestPass123';
  12  |     const displayName = 'Test User';
  13  | 
  14  |     // Fill registration form - need to click register tab first
  15  |     await page.click('#tab-register');
  16  |     await page.fill('#register-email', email);
  17  |     await page.fill('#register-password', password);
  18  |     await page.fill('#register-name', displayName);
  19  | 
  20  |     // Submit - target the register form's submit button specifically
  21  |     await page.click('#form-register button[type="submit"]');
  22  | 
  23  |     // Should redirect to home
  24  |     await expect(page).toHaveURL(/\//);
> 25  |     await expect(page.locator('text=Home')).toBeVisible({ timeout: 10000 });
      |                                             ^ Error: expect(locator).toBeVisible() failed
  26  |   });
  27  | 
  28  |   test('should login with existing credentials', async ({ page }) => {
  29  |     // First register
  30  |     const email = `test${Date.now()}@example.com`;
  31  |     const password = 'TestPass123';
  32  |     const displayName = 'Test User';
  33  | 
  34  |     await page.click('#tab-register');
  35  |     await page.fill('#register-email', email);
  36  |     await page.fill('#register-password', password);
  37  |     await page.fill('#register-name', displayName);
  38  |     await page.click('#form-register button[type="submit"]');
  39  |     await expect(page).toHaveURL(/\//);
  40  | 
  41  |     // Logout
  42  |     await page.click('[data-target="account"]');
  43  |     await page.click('text=Sign Out');
  44  | 
  45  |     // Login again
  46  |     await page.waitForURL('/login');
  47  |     await page.fill('#login-email', email);
  48  |     await page.fill('#login-password', password);
  49  |     await page.click('#form-login button[type="submit"]');
  50  | 
  51  |     await expect(page).toHaveURL(/\//);
  52  |   });
  53  | 
  54  |   test('should show error for wrong password', async ({ page }) => {
  55  |     await page.fill('#login-email', 'test@example.com');
  56  |     await page.fill('#login-password', 'WrongPass123');
  57  |     await page.click('#form-login button[type="submit"]');
  58  | 
  59  |     await expect(page.locator('[role="alert"]')).toContainText(/invalid/i);
  60  |   });
  61  | });
  62  | 
  63  | test.describe('Neuro Music - Search & Playback', () => {
  64  |   test.beforeEach(async ({ page }) => {
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
```