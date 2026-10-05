import { expect, test } from '@playwright/test';
import type {} from './harness.js';

async function setup(page: import('@playwright/test').Page) {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() => {
    const pane = document.querySelector<HTMLElement>('[data-pane-id="a"]')!;
    const filler = document.createElement('div');
    filler.style.cssText = 'width:1800px;height:1800px';
    pane.append(filler);
    pane.scrollTop = 120;
    pane.scrollLeft = 80;
    (window as any).originalViewport = pane;
    (window as any).originalChild = pane.firstChild;
    window.harness.mounted.updateOptions({ scrollbars: { hideDelay: 50, revealOn: 'pointer' } });
  });
}

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  for (const placement of ['overlay', 'gutter'] as const) {
    test(`${placement}, ${reducedMotion}: idle hiding animates through intermediate opacity values`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion });
      await setup(page);
      await page.evaluate((placement) => {
        window.harness.mounted.updateOptions({
          scrollbars: { placement, visibility: 'always', hideDelay: 100 },
        });
      }, placement);
      const samples = await page.locator('[data-pane-id="a"]').evaluate(async (pane) => {
        const host = pane.parentElement!;
        const bar = host.querySelector<HTMLElement>('.os-scrollbar-vertical')!;
        await new Promise((resolve) => setTimeout(resolve, 350));
        window.harness.mounted.updateOptions({
          scrollbars: {
            placement: host.dataset.quiltScrollbars as 'overlay' | 'gutter',
            hideDelay: 100,
          },
        });
        const values: number[] = [];
        const start = performance.now();
        while (performance.now() - start < 600) {
          values.push(Number(getComputedStyle(bar).opacity));
          await new Promise(requestAnimationFrame);
        }
        return values;
      });
      expect(samples[0]).toBe(1);
      expect(samples.filter((opacity) => opacity > 0 && opacity < 1).length).toBeGreaterThan(3);
      expect(samples.at(-1)).toBe(0);
    });
  }
}

test('preserves native viewport, offsets and children across live toggles', async ({ page }) => {
  await setup(page);
  const host = page.locator('.layouts-pane-host').first();
  await expect(host.locator(':scope > .os-scrollbar')).toHaveCount(2);
  await expect(host).toHaveAttribute('data-scrollbars-visible', 'false');
  await page.evaluate(() => {
    const pane = document.querySelector<HTMLElement>('[data-pane-id="a"]')!;
    if (
      pane !== (window as any).originalViewport ||
      pane.firstChild !== (window as any).originalChild
    )
      throw Error('Viewport or application child changed');
  });
  for (const placement of ['gutter', 'overlay'] as const) {
    await page.evaluate(
      (placement) =>
        window.harness.mounted.updateOptions({
          scrollbars: { visibility: 'always', placement },
        }),
      placement,
    );
    await expect(host).toHaveAttribute('data-scrollbars-visible', 'true');
    expect(
      await page.locator('[data-pane-id="a"]').evaluate((e) => [e.scrollTop, e.scrollLeft]),
    ).toEqual([120, 80]);
  }
  await page.evaluate(() => window.harness.mounted.updateOptions({ scrollbars: undefined }));
  await expect(host.locator('.os-scrollbar')).toHaveCount(0);
  expect(
    await page.locator('[data-pane-id="a"]').evaluate((e) => [e.scrollTop, e.scrollLeft]),
  ).toEqual([120, 80]);
  expect(await page.evaluate(() => window.harness.stats)).toMatchObject({
    mounts: 2,
    disposals: 0,
    errors: [],
  });
});

test('companion gets controls and live settings without remounting', async ({ page }) => {
  await setup(page);
  const popupPromise = page.waitForEvent('popup');
  await page.locator('#open').click();
  const popup = await popupPromise;
  await expect(popup.locator('.layouts-pane-host > .os-scrollbar')).toHaveCount(2);
  await page.evaluate(() =>
    window.harness.mounted.updateOptions({
      scrollbars: { visibility: 'always', placement: 'gutter' },
    }),
  );
  await expect(popup.locator('.layouts-pane-host')).toHaveAttribute(
    'data-quilt-scrollbars',
    'gutter',
  );
  await page.evaluate(() => window.harness.mounted.updateOptions({ scrollbars: undefined }));
  await expect(popup.locator('.os-scrollbar')).toHaveCount(0);
  expect(await page.evaluate(() => window.harness.stats.errors)).toEqual([]);
});

test('gutter reserves space while faded and preserves application padding', async ({ page }) => {
  await setup(page);
  const pane = page.locator('[data-pane-id="a"]');
  await pane.evaluate((e: HTMLElement) => {
    e.style.padding = '12px';
  });
  await page.evaluate(() =>
    window.harness.mounted.updateOptions({ scrollbars: { placement: 'gutter', hideDelay: 30 } }),
  );
  const dimensions = () =>
    pane.evaluate((e) => [
      e.parentElement!.clientWidth - e.getBoundingClientRect().width,
      e.parentElement!.clientHeight - e.getBoundingClientRect().height,
      getComputedStyle(e).paddingTop,
    ]);
  await expect.poll(dimensions).toEqual([6, 6, '12px']);
  await expect(pane.locator('..')).toHaveAttribute('data-scrollbars-visible', 'false');
  expect(await dimensions()).toEqual([6, 6, '12px']);
  await page.evaluate(() => window.harness.mounted.updateOptions({ scrollbars: {} }));
  await expect.poll(dimensions).toEqual([0, 0, '12px']);
  await pane.evaluate((e) => e.replaceChildren());
  await page.evaluate(() =>
    window.harness.mounted.updateOptions({ scrollbars: { placement: 'gutter' } }),
  );
  await expect.poll(dimensions).toEqual([0, 0, '12px']);
});

test('React props toggle controls without replacing content or React state', async ({ page }) => {
  await page.goto('/tests/browser/react-tab-bar.html');
  const input = page.getByRole('textbox', { name: 'Retained state' });
  await input.fill('retained');
  await input.evaluate((element) => ((window as any).originalInput = element));
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Toggle scrollbars' }).click();
    await expect(page.locator('.os-scrollbar')).toHaveCount(2);
    await expect(input).toHaveValue('retained');
    expect(await input.evaluate((element) => element === (window as any).originalInput)).toBe(true);
    await page.getByRole('button', { name: 'Toggle scrollbars' }).click();
    await expect(page.locator('.os-scrollbar')).toHaveCount(0);
  }
  await page.getByLabel('Mounts').click();
  await expect(page.getByLabel('Mounts')).toHaveText('1');
});

test('presets, validation and unrelated options preserve configuration atomically', async ({
  page,
}) => {
  await setup(page);
  expect(
    await page.evaluate(() => {
      const workspace = window.harness.mounted;
      const preset = workspace.exportWorkspace();
      const events: string[][] = [];
      const off = workspace.on('change', (event) => events.push([...event.changes]));
      let rejected = false;
      try {
        workspace.updateOptions({ theme: { accent: 'red' }, scrollbars: { hideDelay: -1 } });
      } catch {
        rejected = true;
      }
      const unchanged = JSON.stringify(workspace.exportWorkspace()) === JSON.stringify(preset);
      workspace.updateOptions({ scrollbars: undefined });
      workspace.loadWorkspace(preset);
      workspace.updateOptions({ theme: { accent: 'blue' } });
      const restored = workspace.exportWorkspace().scrollbars;
      const { scrollbars: _, ...oldPreset } = preset;
      workspace.loadWorkspace(oldPreset);
      off();
      return {
        rejected,
        unchanged,
        restored,
        native: workspace.exportWorkspace().scrollbars === undefined,
        events,
      };
    }),
  ).toMatchObject({
    rejected: true,
    unchanged: true,
    restored: { hideDelay: 50, revealOn: 'pointer' },
    native: true,
    events: expect.arrayContaining([['scrollbars']]),
  });
  await expect(page.locator('.os-scrollbar')).toHaveCount(0);
});

test('scroll and pointer reveal controls; keyboard focus keeps them visible; accessibility preferences work', async ({
  page,
}) => {
  await setup(page);
  const pane = page.locator('[data-pane-id="a"]');
  const host = pane.locator('..');
  await expect(host).toHaveAttribute('data-scrollbars-visible', 'false');
  await pane.evaluate((e) => (e.scrollTop += 20));
  await expect(host).toHaveAttribute('data-scrollbars-visible', 'true');
  await expect(host).toHaveAttribute('data-scrollbars-visible', 'false');
  await pane.dispatchEvent('pointermove');
  await expect(host).toHaveAttribute('data-scrollbars-visible', 'true');
  await pane.focus();
  await page.keyboard.press('Tab');
  await expect(pane.locator('input')).toBeFocused();
  await page.waitForTimeout(100);
  await expect(host).toHaveAttribute('data-scrollbars-visible', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(host.locator('.os-scrollbar').first()).toHaveCSS('transition-duration', '0.3s');
  await page.emulateMedia({ forcedColors: 'active' });
  await expect(host.locator('.os-scrollbar')).toHaveCount(0);
  await page.emulateMedia({ forcedColors: 'none' });
  await expect(host.locator('.os-scrollbar')).toHaveCount(2);
});

for (const framework of ['vanilla', 'react']) {
  test(`${framework}: demo controls apply and save workspace preferences`, async ({ page }) => {
    await page.goto(`/${framework}.html`);
    await page.getByRole('tab', { name: 'Theming', exact: true }).click();
    await page.getByText('Scrollbars', { exact: true }).click();
    await page.getByLabel('Scrollbar visibility').selectOption('auto-hide');
    await page.getByLabel('Scrollbar placement').selectOption('gutter');
    const theming = page.locator('.demo-theming');
    await expect(theming).toHaveAttribute('data-overlayscrollbars-viewport', /./);
    await expect(theming.locator('..')).toHaveAttribute('data-quilt-scrollbars', 'gutter');
    await page.getByRole('button', { name: 'Layout JSON', exact: true }).click();
    const json = JSON.parse(await page.getByRole('textbox', { name: 'Layout JSON' }).inputValue());
    expect(json.scrollbars).toEqual({
      visibility: 'auto-hide',
      placement: 'gutter',
      hideDelay: 500,
      revealOn: 'scroll',
    });
  });
}

test('nested registration follows preferences and cleans up idempotently', async ({ page }) => {
  await page.goto('/tests/browser/harness.html');
  const result = await page.evaluate(() => {
    const container = document.createElement('div');
    container.style.cssText = 'width:500px;height:400px';
    document.body.append(container);
    let unregister = () => {};
    let viewport!: HTMLElement;
    let child!: HTMLElement;
    const workspace = new window.harness.Workspace({
      container,
      initialLayout: window.harness.mounted.exportLayout(),
      scrollbars: {},
      renderers: {
        test: (context) => {
          const host = context.document.createElement('div');
          host.style.cssText = 'width:150px;height:100px';
          const content = context.document.createElement('div');
          content.style.cssText = 'width:100%;height:100%;overflow:auto';
          const filler = context.document.createElement('div');
          filler.style.cssText = 'width:1000px;height:1000px';
          content.append(filler);
          host.append(content);
          context.element.append(host);
          const remove = context.registerScrollArea({ host, viewport: content });
          if (context.pane.id === 'a') {
            unregister = remove;
            viewport = content;
            child = filler;
          }
        },
      },
    });
    const count = container.querySelectorAll('.os-scrollbar').length;
    viewport.scrollTop = 40;
    workspace.updateOptions({ scrollbars: { placement: 'gutter' } });
    const preserved = viewport.firstChild === child && viewport.scrollTop === 40;
    unregister();
    unregister();
    const unregistered = viewport.parentElement!.querySelectorAll('.os-scrollbar').length;
    workspace.updateOptions({ scrollbars: {} });
    const stillUnregistered = viewport.parentElement!.querySelectorAll('.os-scrollbar').length;
    workspace.dispose();
    workspace.dispose();
    return {
      count,
      preserved,
      unregistered,
      stillUnregistered,
      remaining: container.childElementCount,
    };
  });
  expect(result).toEqual({
    count: 8,
    preserved: true,
    unregistered: 0,
    stillUnregistered: 0,
    remaining: 0,
  });
});

test('thumb drag, keyboard scrolling and RTL keep native scroll behavior', async ({ page }) => {
  await setup(page);
  const pane = page.locator('[data-pane-id="a"]');
  await page.evaluate(() =>
    window.harness.mounted.updateOptions({ scrollbars: { visibility: 'always' } }),
  );
  const thumb = pane.locator('..').locator('.os-scrollbar-vertical .os-scrollbar-handle');
  const box = (await thumb.boundingBox())!;
  const before = await pane.evaluate((e) => e.scrollTop);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 40, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => pane.evaluate((e) => e.scrollTop)).toBeGreaterThan(before);
  await pane.focus();
  await pane.press('Home');
  await expect.poll(() => pane.evaluate((e) => e.scrollTop)).toBe(0);
  await pane.press('PageDown');
  await expect.poll(() => pane.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
  await pane.locator('..').evaluate((e) => e.setAttribute('dir', 'rtl'));
  await page.evaluate(() =>
    window.harness.mounted.updateOptions({ scrollbars: { visibility: 'always' } }),
  );
  await expect(pane.locator('..').locator('.os-scrollbar-vertical')).toHaveClass(
    /os-scrollbar-rtl/,
  );
  await page.evaluate(() =>
    window.harness.mounted.updateOptions({ scrollbars: { placement: 'gutter' } }),
  );
  await expect
    .poll(() =>
      pane.evaluate((e) =>
        Math.round(e.getBoundingClientRect().left - e.parentElement!.getBoundingClientRect().left),
      ),
    )
    .toBe(6);
});

test('failed popout preserves enhanced source and disposal removes all controls', async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(() => window.harness.fail());
  await page.locator('#open').click();
  await expect
    .poll(() => page.evaluate(() => window.harness.stats.errors.length))
    .toBeGreaterThan(0);
  const pane = page.locator('[data-pane-id="a"]');
  expect(await pane.evaluate((e) => e === (window as any).originalViewport)).toBe(true);
  expect(await pane.evaluate((e) => e.scrollTop)).toBe(120);
  await expect(pane.locator('..').locator('.os-scrollbar')).toHaveCount(2);
  await page.evaluate(() => window.harness.dispose());
  await expect(page.locator('.os-scrollbar')).toHaveCount(0);
  expect(await page.evaluate(() => window.harness.stats.live)).toBe(0);
});

test.describe('touch scrolling', () => {
  test.use({ hasTouch: true });
  test('native swipe scrolls the enhanced viewport', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Native touch injection requires Chromium CDP.');
    await setup(page);
    const pane = page.locator('[data-pane-id="a"]');
    const box = (await pane.boundingBox())!;
    const cdp = await context.newCDPSession(page);
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    const before = await pane.evaluate((e) => e.scrollTop);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y, id: 1 }],
    });
    for (let distance = 20; distance <= 120; distance += 20)
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: y - distance, id: 1 }],
      });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => pane.evaluate((e) => e.scrollTop)).toBeGreaterThan(before);
    await cdp.detach();
  });
});

test('invisible thumbs do not intercept content pointer events', async ({ page }) => {
  await setup(page);
  const host = page.locator('[data-pane-id="a"]').locator('..');
  await expect(host).toHaveAttribute('data-scrollbars-visible', 'false');
  const thumb = host.locator('.os-scrollbar-vertical .os-scrollbar-handle');
  await expect(thumb).toHaveCSS('pointer-events', 'none');
  await expect(host.locator('.os-scrollbar-vertical')).toHaveCSS('opacity', '0');
  await host.dispatchEvent('pointermove');
  await expect(thumb).toHaveCSS('pointer-events', 'auto');
});

test('settings changed during pending companion readiness apply before commit', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() => {
    const layout = window.harness.mounted.exportLayout();
    window.harness.dispose();
    const workspace = new window.harness.Workspace({
      container: document.querySelector('#host')!,
      initialLayout: layout,
      scrollbars: {},
      renderers: {
        test: (context) => {
          const filler = context.document.createElement('div');
          filler.style.cssText = 'width:1500px;height:1500px';
          context.element.append(filler);
          if (context.location === 'popout')
            return {
              ready: new Promise<void>((resolve) => ((window as any).releaseCompanion = resolve)),
              dispose() {},
            };
        },
      },
    });
    (window as any).pendingWorkspace = workspace;
    const button = document.createElement('button');
    button.textContent = 'Open pending companion';
    button.onclick = () => void workspace.popout('a');
    document.body.append(button);
  });
  const opened = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Open pending companion' }).click();
  const popup = await opened;
  await expect(popup.locator('.os-scrollbar')).toHaveCount(2);
  await page.evaluate(() => {
    (window as any).pendingWorkspace.updateOptions({
      scrollbars: { placement: 'gutter', visibility: 'always' },
    });
    (window as any).releaseCompanion();
  });
  await expect(popup.locator('.layouts-pane-host')).toHaveAttribute(
    'data-quilt-scrollbars',
    'gutter',
  );
  await expect(popup.locator('.layouts-pane-host')).toHaveAttribute(
    'data-scrollbars-visible',
    'true',
  );
  const thumb = popup.locator('.os-scrollbar-vertical .os-scrollbar-handle');
  const box = (await thumb.boundingBox())!;
  await popup.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await popup.mouse.down();
  await popup.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 40, { steps: 5 });
  await popup.mouse.up();
  await expect
    .poll(() => popup.locator('[data-pane-id="a"]').evaluate((e) => e.scrollTop))
    .toBeGreaterThan(0);
  await page.evaluate(() => (window as any).pendingWorkspace.returnPane('a'));
  await expect.poll(() => popup.isClosed()).toBe(true);
  await page.evaluate(() => (window as any).pendingWorkspace.dispose());
});

test('mouse focus fades without blur; keyboard focus reveals until the next pointer interaction', async ({
  page,
}) => {
  await setup(page);
  const pane = page.locator('[data-pane-id="a"]');
  const host = pane.locator('..');
  const input = pane.locator('input');
  await input.click();
  await expect(input).toBeFocused();
  await expect(host.locator('.os-scrollbar-vertical')).toHaveCSS('opacity', '0');
  await expect(input).toBeFocused();
  await expect(host.locator('.os-scrollbar-handle').first()).toHaveCSS('pointer-events', 'none');
  await input.press('ArrowLeft');
  await page.waitForTimeout(120);
  await expect(host).toHaveAttribute('data-scrollbars-visible', 'true');
  await input.click();
  await expect(host.locator('.os-scrollbar-vertical')).toHaveCSS('opacity', '0');
  await expect(input).toBeFocused();
});

for (const framework of ['vanilla', 'react']) {
  test(`${framework}: demo idle delay applies live, fades with mouse-focused dropdowns, and restores from JSON`, async ({
    page,
  }) => {
    await page.goto(`/${framework}.html`);
    await page.getByRole('tab', { name: 'Theming', exact: true }).click();
    await page.getByText('Scrollbars', { exact: true }).click();
    const reveal = page.getByLabel('Scrollbar reveal on');
    await expect(reveal).toHaveValue('scroll');
    const delay = page.getByLabel('Scrollbar idle delay (ms)');
    await expect(delay).toHaveValue('500');
    const visibility = page.getByLabel('Scrollbar visibility');
    const placement = page.getByLabel('Scrollbar placement');
    await expect(visibility).toHaveValue('auto-hide');
    await expect(placement).toHaveValue('overlay');
    await visibility.selectOption('auto-hide');
    await expect(delay).toHaveValue('500');
    await expect(reveal).toHaveValue('scroll');
    await reveal.selectOption('scroll');
    await delay.fill('180');
    await placement.click();
    await placement.press('Escape');
    await placement.selectOption('gutter');
    await placement.dispatchEvent('pointerdown');
    const host = page.locator('.demo-theming').locator('..');
    await expect(placement).toBeFocused();
    await expect(host.locator(':scope > .os-scrollbar-vertical')).toHaveCSS('opacity', '0');
    await expect(placement).toBeFocused();
    await visibility.selectOption('always');
    await expect(delay).toBeDisabled();
    await expect(delay).toHaveValue('180');
    await visibility.selectOption('auto-hide');
    await expect(delay).toHaveValue('180');
    await delay.fill('-1');
    await delay.press('Tab');
    expect(await delay.evaluate((el) => (el as HTMLInputElement).validity.valid)).toBe(false);
    await delay.fill('180');
    await delay.press('Tab');
    await page.getByRole('button', { name: 'Layout JSON', exact: true }).click();
    const editor = page.getByRole('textbox', { name: 'Layout JSON' });
    const saved = JSON.parse(await editor.inputValue());
    expect(saved.scrollbars.hideDelay).toBe(180);
    expect(saved.scrollbars.revealOn).toBe('scroll');
    saved.scrollbars.hideDelay = 450;
    await editor.fill(JSON.stringify(saved));
    await page.getByRole('button', { name: 'Load layout', exact: true }).click();
    await expect(delay).toHaveValue('450');
    await expect(reveal).toHaveValue('scroll');
  });
}

test('scroll intent ignores ordinary pointer and editing activity but reveals at boundaries', async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(() =>
    window.harness.mounted.updateOptions({ scrollbars: { revealOn: 'scroll', hideDelay: 80 } }),
  );
  const pane = page.locator('[data-pane-id="a"]');
  const host = pane.locator('..');
  const bar = host.locator('.os-scrollbar-vertical');
  await pane.evaluate((el) => {
    el.scrollTop = 0;
    el.scrollLeft = 0;
  });
  await expect(bar).toHaveCSS('opacity', '0');
  await pane.dispatchEvent('pointerenter');
  await pane.dispatchEvent('pointermove');
  await pane.locator('input').click();
  await expect(bar).toHaveCSS('opacity', '0');
  await expect(host).toHaveAttribute('data-scrollbars-visible', 'false');
  await pane.locator('input').press('ArrowLeft');
  await expect(host).toHaveAttribute('data-scrollbars-visible', 'false');
  await pane.locator('input').press('a');
  await expect(host).toHaveAttribute('data-scrollbars-visible', 'false');
  await pane.evaluate((el) => {
    el.scrollTop = 0;
    el.scrollLeft = 0;
  });
  await pane.dispatchEvent('pointerdown');
  await expect(bar).toHaveCSS('opacity', '0');
  await pane.dispatchEvent('wheel', { deltaY: -50 });
  await expect(host).toHaveAttribute('data-scrollbars-visible', 'true');
  expect(await pane.evaluate((el) => el.scrollTop)).toBe(0);
  await expect(bar).toHaveCSS('opacity', '0');
  await pane.evaluate((el) => el.dispatchEvent(new Event('touchmove', { bubbles: true })));
  await expect(host).toHaveAttribute('data-scrollbars-visible', 'true');
  await expect(bar).toHaveCSS('opacity', '0');
  await pane.focus();
  await page.keyboard.press('Home');
  await expect(host).toHaveAttribute('data-scrollbars-visible', 'true');
  await page.waitForTimeout(150);
  await expect(host).toHaveAttribute('data-scrollbars-visible', 'true');
  await pane.dispatchEvent('pointerdown');
  await expect(bar).toHaveCSS('opacity', '0');
  await page.evaluate(() =>
    window.harness.mounted.updateOptions({ scrollbars: { hideDelay: 80, revealOn: 'pointer' } }),
  );
  await expect(bar).toHaveCSS('opacity', '0');
  await pane.dispatchEvent('pointermove');
  await expect(host).toHaveAttribute('data-scrollbars-visible', 'true');
});
