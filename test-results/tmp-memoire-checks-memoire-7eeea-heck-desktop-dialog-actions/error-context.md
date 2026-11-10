# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tmp-memoire-checks.spec.js >> memoire functional checks >> check desktop dialog actions
- Location: tmp-memoire-checks.spec.js:6:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/Mon profil d'orientation/i)
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText(/Mon profil d'orientation/i) with timeout 15000ms
  - waiting for getByText(/Mon profil d'orientation/i)

```

```yaml
- banner:
  - heading "OriensCI" [level=1]
  - paragraph: Chatbot d'orientation académique & professionnelle
  - text: 0 métiers · 0 filières
  - button "Nouvelle conversation"
  - button "IA ON"
  - button "Changer de thème"
- main:
  - complementary:
    - text: Actions rapides
    - button "Créer mon profil"
    - button "Passer le test RIASEC"
    - button "Mes recommandations"
    - button "Ma personnalité"
    - button "Comparer les filières"
    - button "Glossaire RIASEC"
    - button "Historique"
    - button "Liste des filières"
    - button "Liste des métiers"
    - button "Conseiller humain"
  - paragraph: Chargement d'OriensCI…
  - textbox "Discutez naturellement avec l'IA (posez vos questions, l'IA vous guide)" [disabled]
  - button "Envoyer" [disabled]
  - paragraph: OriensCI est un prototype de recherche. Pour un conseil officiel, contactez un conseiller humain.
- contentinfo: "OriensCI — Prototype de recherche · Modèle RIASEC de Holland Contexte : Côte d'Ivoire · Terminale → Licence © 2026"
- region "Notifications alt+T"
```

# Test source

```ts
  1  | const { test, expect } = require('@playwright/test');
  2  | 
  3  | const base = 'http://127.0.0.1:3000';
  4  | 
  5  | test.describe('memoire functional checks', () => {
  6  |   test('check desktop dialog actions', async ({ page }) => {
  7  |     await page.goto(base, { waitUntil: 'networkidle' });
  8  |     await expect(page.getByRole('heading', { name: /OriensCI/i })).toBeVisible();
  9  |     await page.getByRole('button', { name: /Créer mon profil/i }).click();
> 10 |     await expect(page.getByText(/Mon profil d'orientation/i)).toBeVisible({ timeout: 15000 });
     |                                                               ^ Error: expect(locator).toBeVisible() failed
  11 |     await page.getByRole('button', { name: /Annuler/i }).click();
  12 |     await expect(page.getByText(/Mon profil d'orientation/i)).not.toBeVisible();
  13 |     await page.getByRole('button', { name: /Passer le test RIASEC/i }).click();
  14 |     await expect(page.getByText(/Test RIASEC/i)).toBeVisible({ timeout: 15000 });
  15 |     await page.keyboard.press('Escape');
  16 |     await expect(page.getByText(/Test RIASEC/i)).not.toBeVisible();
  17 |     await page.getByRole('button', { name: /Historique/i }).click();
  18 |     await expect(page.getByText(/Historique/i)).toBeVisible({ timeout: 15000 });
  19 |     await page.keyboard.press('Escape');
  20 |     console.log('DESKTOP_DIALOG_CHECKS_OK');
  21 |   });
  22 | 
  23 |   test('check mobile rendering', async ({ page }) => {
  24 |     await page.setViewportSize({ width: 390, height: 844 });
  25 |     await page.goto(base, { waitUntil: 'networkidle' });
  26 |     await expect(page.getByRole('heading', { name: /OriensCI/i })).toBeVisible();
  27 |     await expect(page.getByRole('button', { name: /Créer mon profil/i })).toBeVisible();
  28 |     console.log('MOBILE_RENDER_CHECK_OK');
  29 |   });
  30 | });
  31 | 
```