// The gang's day chart (animation proposal): axe in the flat and the 3D view at phone and desktop
// width, the 3D toggle by keyboard (a toggle button: steady name, aria-pressed), the text
// equivalent, and no transition with reduced motion.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

function axePath() {
  try {
    return require.resolve('axe-core/axe.min.js');
  } catch {
    return null;
  }
}

async function audit(page, AXE, label) {
  if (!(await page.evaluate(() => 'axe' in window))) await page.evaluate(`${readFileSync(AXE, 'utf8')}\n;0`);
  const found = await page.evaluate(async (tags) => {
    const r = await window.axe.run('[data-testid=gang-day]', { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] });
    return r.violations.flatMap((v) => v.nodes.map((n) => `${v.impact} ${v.id}: ${n.target.join(' ')}`));
  }, TAGS);
  return found.map((f) => `${label}: ${f}`);
}

export async function check({ open }) {
  const AXE = axePath();
  const bad = [];
  for (const width of [390, 1280]) {
    const { page } = await open('/', { width, height: 844 });
    const day = page.locator('[data-testid=gang-day]');
    await day.waitFor();
    const chart = day.locator('[role=img]');
    assert.equal(await chart.getAttribute('aria-label'),
      "When the gang is awake: Einstein is awake 7:00 to 10:00; Magnus is awake 8:00 to 11:00; Mochi is awake 9:00 to 12:00");
    assert.equal(await day.locator('i.on').count(), 9, 'three awake hours each');
    const toggle = page.getByRole('button', { name: '3D view' });
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
    assert.equal(await toggle.getAttribute('aria-controls'), await chart.getAttribute('id'));
    if (AXE) bad.push(...(await audit(page, AXE, `flat@${width}`)));
    await toggle.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('[data-testid=gang-day]').classList.contains('is-3d'));
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => document.activeElement?.textContent.trim()), '3D view', 'focus stays on the toggle');
    await page.waitForTimeout(1200);
    if (AXE) bad.push(...(await audit(page, AXE, `3d@${width}`)));
    await page.keyboard.press('Space');
    await page.waitForFunction(() => !document.querySelector('[data-testid=gang-day]').classList.contains('is-3d'));
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
    await page.close();
  }
  {
    const { page } = await open('/', { width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('[data-testid=gang-day]').waitFor();
    const t = await page.evaluate(() => getComputedStyle(document.querySelector('.gang-day-grid')).transitionDuration);
    assert.equal(t, '0s', 'no tilt animation with reduced motion');
    const anim = await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid=stream-list] > li')).animationName);
    assert.equal(anim, 'none', 'cards do not rise with reduced motion');
    await page.close();
  }
  assert.deepEqual(bad, [], 'no axe violations in the chart, flat or 3D');
  console.log(`gangday: ok${AXE ? '' : ' (axe-core not installed: axe part skipped)'}`);
}
