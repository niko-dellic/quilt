import { test, expect } from '@playwright/test';
import type { WorkspaceHandle } from 'quilt-vanilla';
declare global {
  interface Window {
    adaptiveTestMount?: Element | null;
    adaptiveMotionCommits?: number;
    adaptiveDragRebuilds?: number;
    stopAdaptiveDragObservation?: () => void;
  }
}
for (const framework of ['vanilla', 'react']) {
  test(`${framework}: Adaptive hover, settings, restoration and workspace retention`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.goto(`/${framework}.html?workspace=adaptive`);
    await page.getByLabel('Transition duration (ms)').fill('220');
    await page.getByLabel('Transition duration (ms)').press('Tab');
    const pane = page.locator('[data-node-id="group-adaptive-4-4"]');
    await expect(page.locator('.layouts-empty')).toHaveCount(60);
    await expect(page.locator('.adaptive-pinned')).toHaveCount(60);
    await expect(page.locator('.adaptive-pinned > .layouts-header:visible')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Adaptive', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.mouse.move(0, 0);
    await page.waitForTimeout(250);
    const initial = (await pane.boundingBox())!;
    await pane.locator('.layouts-empty').evaluate((el) => {
      window.adaptiveTestMount = el;
    });
    await page.mouse.move(initial.x + initial.width / 2, initial.y + initial.height / 2);
    await expect
      .poll(async () => {
        const box = (await pane.boundingBox())!;
        return box.width * box.height;
      })
      .toBeGreaterThan(initial.width * initial.height * 1.3);
    await expect
      .poll(async () => (await pane.boundingBox())!.width)
      .toBeGreaterThan(initial.width * 1.3);
    await expect
      .poll(async () => (await pane.boundingBox())!.height)
      .toBeGreaterThan(initial.height * 1.3);
    await expect(pane.getByRole('button', { name: 'Choose a tab', exact: true })).toBeVisible();
    await expect(pane.getByRole('tab')).toHaveCount(0);
    await page.waitForTimeout(300);
    const settled = await pane.boundingBox();
    await page.waitForTimeout(250);
    expect(await pane.boundingBox()).toEqual(settled);
    expect(
      await pane.locator('.layouts-empty').evaluate((el) => el === window.adaptiveTestMount),
    ).toBe(true);
    await page.mouse.move(0, 0);
    await expect.poll(async () => (await pane.boundingBox())!.width).toBeCloseTo(initial.width, 0);
    const falloff = page.getByRole('combobox', { name: 'Falloff', exact: true });
    const strength = page.getByRole('slider', { name: 'Strength', exact: true });
    await expect(
      page.locator('.demo-view-controls').getByRole('slider', { name: 'Strength' }),
    ).toBeVisible();
    const inverted = page.getByRole('checkbox', { name: 'Inverted', exact: true });
    await expect(inverted).not.toBeChecked();
    await falloff.selectOption('quadratic');
    await falloff.selectOption('bezier');
    await inverted.check();
    await strength.fill('0');
    await expect(strength).toHaveAttribute('aria-valuetext', '0%');
    await page.mouse.move(initial.x + initial.width / 2, initial.y + initial.height / 2);
    await page.waitForTimeout(250);
    expect((await pane.boundingBox())!.width).toBeCloseTo(initial.width, 0);
    await page.getByRole('button', { name: 'Default', exact: true }).click();
    await expect(page.locator('.adaptive-pinned')).toHaveCount(0);
    await page.getByRole('button', { name: 'Adaptive', exact: true }).click();
    await expect(page.locator('.layouts-empty')).toHaveCount(60);
    await expect(falloff).toHaveValue('bezier');
    await expect(inverted).toBeChecked();
    await expect(strength).toHaveValue('0');
    await page.getByRole('button', { name: 'Reset Adaptive', exact: true }).click();
    await expect(falloff).toHaveValue('bezier');
    await expect(inverted).not.toBeChecked();
    await expect(strength).toHaveValue('65');
    await expect(page.locator('.layouts-empty')).toHaveCount(60);
    expect(errors).toEqual([]);
  });
  test(`${framework}: Adaptive follows structural edits, maximize and popout`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/${framework}.html?workspace=adaptive`);
    await page.getByLabel('Transition duration (ms)').fill('220');
    await page.getByLabel('Transition duration (ms)').press('Tab');
    await page.getByRole('combobox', { name: 'Motion', exact: true }).selectOption('system');
    await expect(page.locator('.layouts-empty')).toHaveCount(60);
    await page.evaluate(() => {
      const workspace = (window as unknown as { threeDemo: { workspace: WorkspaceHandle } })
        .threeDemo.workspace;
      workspace.splitGroup('group-adaptive-4-4', 'vertical', {
        id: 'added',
        type: 'notes',
        title: 'Added',
        size: { minWidth: 32, minHeight: 32 },
      });
    });
    await expect(page.locator('.layouts-empty')).toHaveCount(60);
    const added = page.locator('[data-pane-id="added"]');
    const before = (await added.boundingBox())!;
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
    await expect
      .poll(async () => {
        const box = (await added.boundingBox())!;
        return box.width * box.height;
      })
      .toBeGreaterThan(before.width * before.height * 1.15);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      const w = (window as unknown as { threeDemo: { workspace: WorkspaceHandle } }).threeDemo
        .workspace;
      w.movePane('added', 'group-adaptive-4-5');
      w.joinGroups('group-adaptive-0-0', 'group-adaptive-0-1');
      w.resize('adaptive-row-1', 0.65);
      w.maximize('group-adaptive-4-5');
    });
    await page.evaluate(() =>
      (
        window as unknown as { threeDemo: { workspace: WorkspaceHandle } }
      ).threeDemo.workspace.maximize(null),
    );
    await page.evaluate(async () => {
      await (
        window as unknown as { threeDemo: { workspace: WorkspaceHandle } }
      ).threeDemo.workspace.closePane('added');
    });
    await expect(page.locator('.layouts-empty')).toHaveCount(60);
    await page.evaluate(() => {
      const w = (window as unknown as { threeDemo: { workspace: WorkspaceHandle } }).threeDemo
        .workspace;
      w.insertPane(
        {
          id: 'popout-note',
          type: 'notes',
          title: 'Popout note',
          size: { minWidth: 32, minHeight: 32 },
        },
        'group-adaptive-5-5',
      );
    });
    // The public popout API is invoked in a browser user gesture.
    const trigger = page.getByRole('button', { name: 'Adaptive', exact: true });
    await trigger.evaluate((el) =>
      el.addEventListener(
        'click',
        () => {
          void (
            window as unknown as { threeDemo: { workspace: WorkspaceHandle } }
          ).threeDemo.workspace.popout('popout-note');
        },
        { once: true },
      ),
    );
    const popupPromise = page.waitForEvent('popup');
    await trigger.click();
    const popup = await popupPromise;
    await expect(popup.locator('[data-pane-id="popout-note"]')).toBeVisible();
    await popup.close();
    await expect(page.locator('[data-pane-id="popout-note"]')).toBeVisible();
    await expect(page.locator('.layouts-empty')).toHaveCount(59);
    const pane = page.locator('[data-node-id="group-adaptive-3-6"]');
    const resting = (await pane.boundingBox())!;
    await page.mouse.move(resting.x + resting.width / 2, resting.y + resting.height / 2);
    await expect
      .poll(async () => {
        const box = (await pane.boundingBox())!;
        return box.width * box.height;
      })
      .toBeGreaterThan(resting.width * resting.height * 1.15);
    expect(errors).toEqual([]);
  });
  test(`${framework}: Adaptive keyboard focus, compact viewport and toolbar settings`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 600, height: 850 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/${framework}.html?workspace=adaptive`);
    await page.getByLabel('Transition duration (ms)').fill('220');
    await page.getByLabel('Transition duration (ms)').press('Tab');
    await page.getByRole('combobox', { name: 'Motion', exact: true }).selectOption('system');
    await expect(page.locator('.layouts-empty')).toHaveCount(60);
    await expect(page.locator('.adaptive-settings')).toHaveCount(0);
    await expect(page.getByRole('spinbutton', { name: 'Rows', exact: true })).toHaveValue('6');
    await expect(page.getByRole('spinbutton', { name: 'Columns', exact: true })).toHaveValue('10');
    await page.getByRole('spinbutton', { name: 'Rows', exact: true }).fill('4');
    await page.getByRole('spinbutton', { name: 'Columns', exact: true }).fill('4');
    await page.getByRole('button', { name: 'Apply grid', exact: true }).click();
    await expect(page.locator('.layouts-empty')).toHaveCount(16);
    // Include neighboring centers in this sparse grid to exercise keyboard expansion.
    await page.getByRole('slider', { name: 'Falloff radius', exact: true }).fill('35');
    await page.mouse.move(0, 0);
    await page.waitForTimeout(100);
    const pane = page.locator('[data-node-id="group-adaptive-2-2"]');
    const before = (await pane.boundingBox())!;
    await pane.locator('.layouts-empty').focus();
    await expect
      .poll(async () => (await pane.boundingBox())!.width)
      .toBeGreaterThan(before.width * 1.1);
    await expect
      .poll(async () => (await pane.boundingBox())!.height)
      .toBeGreaterThan(before.height * 1.1);
    const strength = page.getByRole('slider', { name: 'Strength', exact: true });
    await strength.focus();
    await page.keyboard.press('ArrowRight');
    await expect(strength).toHaveValue('66');
    await expect(strength).toHaveAttribute('aria-valuetext', '66%');
    await expect(page.locator('.demo-range').filter({ has: strength })).toContainText(
      'Strength: 66%',
    );
    await expect.poll(async () => (await pane.boundingBox())!.width).toBeCloseTo(before.width, 0);
    await expect(page.getByRole('dialog', { name: 'Adaptive settings' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Default', exact: true }).click();
    await expect(page.locator('.layouts-empty')).toHaveCount(0);
    await expect(page.locator('.adaptive-settings')).toHaveCount(0);
    await page.getByRole('button', { name: 'Adaptive', exact: true }).click();
    await expect(page.locator('.layouts-empty')).toHaveCount(16);
    await expect(page.getByRole('spinbutton', { name: 'Rows', exact: true })).toHaveValue('4');
    await expect(page.getByRole('spinbutton', { name: 'Columns', exact: true })).toHaveValue('4');
    await page.getByRole('button', { name: 'Reset Adaptive', exact: true }).click();
    await expect(page.locator('.layouts-empty')).toHaveCount(60);
    await expect(page.getByRole('spinbutton', { name: 'Rows', exact: true })).toHaveValue('6');
    await expect(page.getByRole('spinbutton', { name: 'Columns', exact: true })).toHaveValue('10');
    const empty = page.locator('[data-node-id="group-adaptive-2-2"]');
    await empty.getByRole('button', { name: 'Choose a tab', exact: true }).click();
    const search = page.getByRole('combobox', { name: 'Search tabs' });
    await search.fill('Notes');
    await search.press('Enter');
    await expect(empty.locator('.layouts-header')).toBeHidden();
    await expect(empty.locator('[data-pane-id]')).toBeVisible();
    await expect(empty.locator('.layouts-empty')).toHaveCount(0);
    await expect(page.locator('.layouts-empty')).toHaveCount(59);
  });
  test(`${framework}: Adaptive motion can follow or override the system preference`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.goto(`/${framework}.html?workspace=adaptive`);
    await page.getByLabel('Transition duration (ms)').fill('220');
    await page.getByLabel('Transition duration (ms)').press('Tab');
    const motion = page.getByRole('combobox', { name: 'Motion', exact: true });
    const pane = page.locator('[data-node-id="group-adaptive-3-4"]');
    await expect(motion).toHaveValue('animated');
    await motion.selectOption('system');
    await page.mouse.move(0, 0);
    const before = (await pane.boundingBox())!;
    await pane.locator('.layouts-empty').focus();
    await expect
      .poll(async () => (await pane.boundingBox())!.width)
      .toBeGreaterThan(before.width * 1.2);
    expect(await pane.evaluate((el) => el.getAnimations().length)).toBe(0);
    await page.getByRole('button', { name: 'Default', exact: true }).click();
    await page.getByRole('button', { name: 'Adaptive', exact: true }).click();
    await expect(motion).toHaveValue('system');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await motion.focus();
    await motion.selectOption('instant');
    await page.mouse.move(0, 0);
    await pane.locator('.layouts-empty').focus();
    await expect
      .poll(async () => (await pane.boundingBox())!.width)
      .toBeGreaterThan(before.width * 1.2);
    expect(await pane.evaluate((el) => el.getAnimations().length)).toBe(0);
    await page.getByRole('button', { name: 'Reset Adaptive', exact: true }).click();
    await expect(motion).toHaveValue('animated');
  });
  test(`${framework}: Adaptive keeps animation inside the outer boundary`, async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.goto(`/${framework}.html?workspace=adaptive`);
    await page.getByLabel('Transition duration (ms)').fill('220');
    await page.getByLabel('Transition duration (ms)').press('Tab');
    await expect(page.getByRole('combobox', { name: 'Falloff', exact: true })).toHaveValue(
      'bezier',
    );
    await page.getByRole('slider', { name: 'Strength', exact: true }).fill('100');
    await page.mouse.move(0, 0);
    await page.waitForTimeout(350);
    for (const id of ['group-adaptive-0-0', 'group-adaptive-5-9', 'group-adaptive-3-4']) {
      const pane = page.locator(`[data-node-id="${id}"]`);
      const box = (await pane.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      const samples = await page.evaluate(async () => {
        const stage = document.querySelector<HTMLElement>('#workspace .layouts-stage')!;
        const samples: number[][] = [];
        for (let i = 0; i < 24; i++) {
          await new Promise(requestAnimationFrame);
          samples.push([
            stage.scrollWidth - stage.clientWidth,
            stage.scrollHeight - stage.clientHeight,
          ]);
        }
        return samples;
      });
      for (const [x, y] of samples) {
        expect(x).toBeLessThanOrEqual(1);
        expect(y).toBeLessThanOrEqual(1);
      }
    }
    await page.mouse.move(0, 0);
    await page.waitForTimeout(350);
    await expect(page.locator('.adaptive-motion-running')).toHaveCount(0);
    await expect(page.locator('.adaptive-border-root')).toHaveCount(1);
  });
  test(`${framework}: Adaptive leaves edges stable and does not jump at commit or click`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.goto(`/${framework}.html?workspace=adaptive`);
    await page.getByLabel('Transition duration (ms)').fill('220');
    await page.getByLabel('Transition duration (ms)').press('Tab');
    await page.getByRole('slider', { name: 'Strength', exact: true }).fill('100');
    await page.getByRole('checkbox', { name: 'Inverted', exact: true }).check();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(350);
    await page.evaluate(() => {
      const w = (window as unknown as { threeDemo: { workspace: WorkspaceHandle } }).threeDemo
        .workspace;
      w.insertPane(
        {
          id: 'click-note',
          type: 'notes',
          title: 'Click note',
          size: { minWidth: 180, minHeight: 150 },
        },
        'group-adaptive-3-4',
      );
    });
    await page.waitForTimeout(350);
    const pane = page.locator('[data-node-id="group-adaptive-3-4"]');
    const resting = (await pane.boundingBox())!;
    await page.mouse.move(resting.x + 6, resting.y + resting.height / 2);
    await page.waitForTimeout(300);
    expect(await pane.boundingBox()).toEqual(resting);
    await page.mouse.move(resting.x + resting.width / 2, resting.y + resting.height / 2);
    await expect.poll(() => pane.evaluate((el) => el.getAnimations().length)).toBeGreaterThan(0);
    // Compare the exact visual endpoint against the settled renderer geometry.
    const endpoint = await page.evaluate(() => {
      for (const animation of document.getAnimations()) {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        if (
          target instanceof HTMLElement &&
          target.matches('.layouts-node, .layouts-divider, .layouts-body')
        )
          animation.finish();
      }
      return [...document.querySelectorAll<HTMLElement>('.adaptive-pinned')].map((el) => {
        const b = el.getBoundingClientRect();
        return [b.x, b.y, b.width, b.height];
      });
    });
    await page.waitForTimeout(350);
    const geometry = () =>
      page.locator('.adaptive-pinned').evaluateAll((els) =>
        els.map((el) => {
          const b = el.getBoundingClientRect();
          return [b.x, b.y, b.width, b.height];
        }),
      );
    const settled = await geometry();
    settled.forEach((box, i) =>
      box.forEach((value, axis) => expect(Math.abs(value - endpoint[i]![axis]!)).toBeLessThan(1)),
    );
    const expanded = (await pane.boundingBox())!;
    await page.mouse.move(expanded.x + expanded.width / 2, expanded.y + expanded.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(350);
    const clicked = await geometry();
    clicked.forEach((box, i) =>
      box.forEach((value, axis) => expect(Math.abs(value - settled[i]![axis]!)).toBeLessThan(1)),
    );
    // Approaching the neighboring pane through its edge must not steal focus.
    const neighbor = page.locator('[data-node-id="group-adaptive-3-5"]');
    const edge = (await neighbor.boundingBox())!;
    await page.mouse.move(edge.x + 6, edge.y + edge.height / 2);
    await page.waitForTimeout(300);
    expect(await pane.boundingBox()).toEqual(expanded);
    const divider = page.locator('[data-node-id="adaptive-row-3"] > .layouts-divider');
    const handle = (await divider.boundingBox())!;
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.evaluate(() => {
      const observer = new MutationObserver((records) => {
        window.adaptiveDragRebuilds = (window.adaptiveDragRebuilds ?? 0) + records.length;
      });
      window.adaptiveDragRebuilds = 0;
      document
        .querySelectorAll('.adaptive-pinned')
        .forEach((el) => observer.observe(el, { attributes: true, attributeFilter: ['class'] }));
      window.stopAdaptiveDragObservation = () => observer.disconnect();
    });
    await page.mouse.move(handle.x + handle.width / 2 + 20, handle.y + handle.height / 2, {
      steps: 4,
    });
    expect(await page.evaluate(() => window.adaptiveDragRebuilds)).toBe(0);
    await page.evaluate(() => window.stopAdaptiveDragObservation?.());
    await page.mouse.up();
    const dragged = await geometry();
    expect(dragged).not.toEqual(clicked);
    await page.waitForTimeout(350);
    expect(await geometry()).toEqual(dragged);
  });
  test(`${framework}: Adaptive radius controls and cursor guide persist and clean up`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.goto(`/${framework}.html?workspace=adaptive`);
    const radius = page.getByRole('slider', { name: 'Falloff radius', exact: true });
    const toggle = page.getByRole('checkbox', { name: 'Show radius', exact: true });
    await expect(radius).toHaveValue('15');
    await expect(toggle).not.toBeChecked();
    await page.getByLabel('Motion', { exact: true }).selectOption('instant');
    await radius.fill('20');
    await toggle.check();
    const pane = page.locator('[data-node-id="group-adaptive-3-4"]');
    await pane.hover();
    await page.waitForTimeout(100);
    const overlay = page.locator('.adaptive-radius-overlay');
    const circle = page.locator('.adaptive-radius-circle');
    await expect(overlay).toBeVisible();
    const grid = (await overlay.boundingBox())!;
    const diameter = Math.hypot(grid.width, grid.height) * 0.4;
    expect((await circle.boundingBox())!.width).toBeCloseTo(diameter, 0);
    const box = (await pane.boundingBox())!;
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    const first = (await circle.boundingBox())!;
    expect(first.x + first.width / 2).toBeCloseTo(x, 0);
    expect(first.y + first.height / 2).toBeCloseTo(y, 0);
    const before = await pane.boundingBox();
    await page.mouse.move(x + 5, y + 5);
    await page.waitForTimeout(100);
    expect((await circle.boundingBox())!.x - first.x).toBeCloseTo(5, 0);
    expect(await pane.boundingBox()).toEqual(before);
    expect(await overlay.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
    await page.mouse.move(0, 0);
    await expect(overlay).toBeHidden();
    await page.getByRole('button', { name: 'Default', exact: true }).click();
    await expect(overlay).toHaveCount(0);
    await page.getByRole('button', { name: 'Adaptive', exact: true }).click();
    await expect(radius).toHaveValue('20');
    await expect(toggle).toBeChecked();
    await radius.fill('5');
    await page.mouse.move(0, 0);
    await page.waitForTimeout(100);
    const smallRadiusRest = await pane.boundingBox();
    await pane.hover();
    await page.waitForTimeout(100);
    expect(await pane.boundingBox()).toEqual(smallRadiusRest);
    await radius.fill('100');
    await pane.hover();
    await page.waitForTimeout(100);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(overlay).toBeVisible();
    await page.getByRole('button', { name: 'Reset Adaptive', exact: true }).click();
    await expect(radius).toHaveValue('15');
    await expect(toggle).not.toBeChecked();
    await expect(overlay).toBeHidden();
  });
  test(`${framework}: Adaptive preserves row space around a manually fixed divider`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.goto(`/${framework}.html?workspace=adaptive`);
    await page.getByLabel('Motion', { exact: true }).selectOption('instant');
    await page.mouse.move(0, 0);
    await page.waitForTimeout(100);
    const handle = (await page
      .locator('[data-node-id="adaptive-rows-a"] > .layouts-divider')
      .boundingBox())!;
    const x = handle.x + handle.width * 0.37,
      y = handle.y + handle.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 25, { steps: 5 });
    await page.mouse.up();
    await page.getByLabel('Strength', { exact: true }).fill('100');
    for (const falloff of ['linear', 'bezier', 'quadratic']) {
      await page.getByLabel('Falloff', { exact: true }).selectOption(falloff);
      for (const inverted of [false, true]) {
        await page.getByLabel('Inverted', { exact: true }).setChecked(inverted);
        for (const row of [2, 3, 1, 4, 0, 5]) {
          await page.locator(`[data-node-id="group-adaptive-${row}-4"]`).hover();
          await page.waitForTimeout(50);
          const sizes = await page.locator('.adaptive-pinned').evaluateAll((els) =>
            els.map((el) => {
              const r = el.getBoundingClientRect();
              return [r.width, r.height];
            }),
          );
          for (const [width, height] of sizes) {
            expect(width).toBeGreaterThanOrEqual(23.8);
            expect(height).toBeGreaterThanOrEqual(23.8);
          }
        }
      }
    }
  });
  test(`${framework}: Adaptive suppresses tiny shared-edge movements between cells`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.goto(`/${framework}.html?workspace=adaptive`);
    await page.getByLabel('Motion', { exact: true }).selectOption('instant');
    await page.mouse.move(0, 0);
    const edges = () =>
      page.locator('.layouts-divider').evaluateAll((elements) =>
        elements.map((el) => {
          const r = el.getBoundingClientRect();
          return r.width < r.height ? r.x + r.width / 2 : r.y + r.height / 2;
        }),
      );
    await page.waitForTimeout(100);
    const resting = await edges();
    await page.locator('[data-node-id="group-adaptive-3-4"]').hover();
    await page.waitForTimeout(100);
    let previous = await edges();
    for (const column of [5, 4, 6, 5]) {
      await page.locator(`[data-node-id="group-adaptive-3-${column}"]`).hover();
      await page.waitForTimeout(100);
      const next = await edges();
      const changes = next.map((value, i) => Math.abs(value - previous[i]!));
      expect(changes.filter((delta) => delta > 0.15 && delta < 1.8)).toEqual([]);
      expect(changes.some((delta) => delta > 2)).toBe(true);
      previous = next;
    }
    await page.mouse.move(0, 0);
    await page.waitForTimeout(100);
    expect(await edges()).toEqual(resting);
  });
  test(`${framework}: Adaptive keeps the released hover and snapped edges aligned`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.goto(`/${framework}.html?workspace=adaptive`);
    await page.getByLabel('Motion', { exact: true }).selectOption('instant');
    await page.mouse.move(0, 0);
    const pane = page.locator('[data-node-id="group-adaptive-3-4"]');
    const geometry = () =>
      page.locator('.adaptive-pinned').evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return [r.x, r.y, r.width, r.height];
        }),
      );
    const center = async (id: string) => {
      const box = (await page.locator(`[data-node-id="${id}"] > .layouts-divider`).boundingBox())!;
      return { x: box.x + box.width / 2, y: box.y + box.height * 0.37 };
    };
    await pane.hover();
    await page.waitForTimeout(100);
    const expanded = (await pane.boundingBox())!;
    const handle = await center('adaptive-row-3-a');
    const target = await center('adaptive-row-2-a');
    await page.mouse.move(handle.x, handle.y);
    await page.mouse.down();
    await page.mouse.move(target.x, handle.y, { steps: 8 });
    const dragged = await geometry();
    await page.mouse.up();
    await page.waitForTimeout(100);
    (await geometry()).forEach((box, i) =>
      box.forEach((value, axis) => expect(Math.abs(value - dragged[i]![axis]!)).toBeLessThan(0.1)),
    );
    expect((await pane.boundingBox())!.height).toBeCloseTo(expanded.height, 1);
    const aligned = async () => {
      expect(
        Math.abs((await center('adaptive-row-3-a')).x - (await center('adaptive-row-2-a')).x),
      ).toBeLessThan(1);
    };
    await aligned();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(100);
    await aligned();
    expect((await pane.boundingBox())!.height).toBeLessThan(expanded.height);
    await pane.hover();
    await page.waitForTimeout(100);
    await aligned();
    await page.locator('[data-node-id="group-adaptive-2-4"]').hover();
    await page.waitForTimeout(100);
    await aligned();
    await page.getByRole('button', { name: 'Default', exact: true }).click();
    await page.getByRole('button', { name: 'Adaptive', exact: true }).click();
    await pane.hover();
    await page.waitForTimeout(100);
    await aligned();
    // A new grid deliberately discards manual boundaries, including reused IDs.
    await page.getByRole('button', { name: 'Apply grid', exact: true }).click();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(100);
    const resetEdge = await center('adaptive-row-3-a');
    await pane.hover();
    await page.waitForTimeout(100);
    expect(Math.abs((await center('adaptive-row-3-a')).x - resetEdge.x)).toBeGreaterThan(1);
  });
  test(`${framework}: Adaptive reflows content without scaling and centers its empty hint`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.goto(`/${framework}.html?workspace=adaptive`);
    await page.getByLabel('Transition duration (ms)').fill('220');
    await page.getByLabel('Transition duration (ms)').press('Tab');
    await page.mouse.move(0, 0);
    await page.waitForTimeout(350);
    await page.evaluate(() => {
      const w = (window as unknown as { threeDemo: { workspace: WorkspaceHandle } }).threeDemo
        .workspace;
      w.insertPane(
        {
          id: 'activity-motion',
          type: 'activity',
          title: 'Activity',
          size: { minWidth: 180, minHeight: 140 },
        },
        'group-adaptive-3-4',
      );
    });
    const activity = page.locator('[data-pane-id="activity-motion"]');
    const heading = activity.getByRole('heading', { name: 'Activity', exact: true });
    const textWidth = () =>
      heading.evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return range.getBoundingClientRect().width;
      });
    const naturalWidth = await textWidth();
    const pane = page.locator('[data-node-id="group-adaptive-3-4"]');
    const box = (await pane.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(() => pane.evaluate((el) => el.getAnimations().length)).toBeGreaterThan(0);
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        if (
          target instanceof HTMLElement &&
          target.matches('.layouts-node, .layouts-divider, .layouts-body')
        ) {
          animation.pause();
          animation.currentTime = 80;
        }
      }
    });
    expect(await textWidth()).toBeCloseTo(naturalWidth, 1);
    const scale = await pane.evaluate((el) => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      const body = new DOMMatrixReadOnly(
        getComputedStyle(el.querySelector('.layouts-body')!).transform,
      );
      return [matrix.a * body.a, matrix.d * body.d];
    });
    scale.forEach((value) => expect(value).toBeCloseTo(1, 3));
    await page.evaluate(() => {
      for (const animation of document.getAnimations())
        if (animation.playState === 'paused') animation.play();
    });
    await page.waitForTimeout(350);
    const empty = page.locator('[data-node-id="group-adaptive-2-2"] .layouts-empty');
    await empty.focus();
    await expect
      .poll(() => empty.evaluate((el) => el.closest('.layouts-group')!.getAnimations().length))
      .toBeGreaterThan(0);
    const centers = await empty.evaluate(async (el) => {
      const samples: number[][] = [];
      for (let i = 0; i < 8; i++) {
        await new Promise(requestAnimationFrame);
        const box = el.getBoundingClientRect();
        const hint = el.querySelector('.adaptive-empty-hint')!.getBoundingClientRect();
        samples.push([
          Math.abs(hint.x + hint.width / 2 - (box.x + box.width / 2)),
          Math.abs(hint.y + hint.height / 2 - (box.y + box.height / 2)),
        ]);
      }
      return samples;
    });
    centers.forEach(([x, y]) => {
      expect(x).toBeLessThan(1);
      expect(y).toBeLessThan(1);
    });
  });
  test(`${framework}: Adaptive duration controls motion without resizing region chrome each frame`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.goto(`/${framework}.html?workspace=adaptive`);
    const duration = page.getByRole('spinbutton', { name: 'Transition duration (ms)' });
    await expect(duration).toHaveValue('550');
    await duration.fill('800');
    await duration.press('Tab');
    await page.mouse.move(0, 0);
    await page.waitForTimeout(900);
    const pane = page.locator('[data-node-id="group-adaptive-3-4"]');
    const box = (await pane.boundingBox())!;
    await pane.evaluate((el) => {
      const target = el as HTMLElement & { resizeCount: number; resizeObserver: ResizeObserver };
      target.resizeCount = 0;
      target.resizeObserver = new ResizeObserver(
        (entries) => (target.resizeCount += entries.length),
      );
      target.resizeObserver.observe(target);
      target.resizeObserver.observe(target.querySelector('.layouts-body')!);
    });
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect
      .poll(() => pane.evaluate((el) => el.getAnimations()[0]?.effect?.getTiming().duration))
      .toBe(800);
    await page.waitForTimeout(1000);
    const resizes = await pane.evaluate((el) => {
      const target = el as HTMLElement & { resizeCount: number; resizeObserver: ResizeObserver };
      target.resizeObserver.disconnect();
      return target.resizeCount;
    });
    expect(resizes).toBeLessThanOrEqual(4);
    await duration.fill('0');
    await duration.press('Tab');
    await page.mouse.move(0, 0);
    await page.waitForTimeout(100);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(100);
    expect(await pane.evaluate((el) => el.getAnimations().length)).toBe(0);
    await page.getByRole('button', { name: 'Default', exact: true }).click();
    await page.getByRole('button', { name: 'Adaptive', exact: true }).click();
    await expect(duration).toHaveValue('0');
    await page.getByRole('button', { name: 'Reset Adaptive', exact: true }).click();
    await expect(duration).toHaveValue('550');
  });
  test(`${framework}: Adaptive duration Enter preserves edits and divider clicks restore borders`, async ({
    page,
  }) => {
    await page.goto(`/${framework}.html?workspace=adaptive`);
    await page.getByLabel('Transition duration (ms)').fill('220');
    await page.getByLabel('Transition duration (ms)').press('Tab');
    await page.getByRole('combobox', { name: 'Motion', exact: true }).selectOption('instant');
    await page.evaluate(() => {
      const workspace = (window as unknown as { threeDemo: { workspace: WorkspaceHandle } })
        .threeDemo.workspace;
      workspace.insertPane(
        { id: 'keep-notes', type: 'notes', title: 'Keep notes' },
        'group-adaptive-3-4',
      );
    });
    const duration = page.getByRole('spinbutton', { name: 'Transition duration (ms)' });
    await duration.fill('555');
    await duration.press('Enter');
    await expect(duration).toHaveValue('555');
    await expect(page.locator('[data-pane-id="keep-notes"]')).toHaveCount(1);
    const divider = page.locator('[data-node-id="adaptive-row-3"] > .layouts-divider');
    await divider.click({ force: true });
    await expect(page.locator('.adaptive-motion-borders')).toHaveCount(1);
    await page.getByRole('button', { name: 'Default', exact: true }).click();
    await expect(
      page.locator(
        '.adaptive-border-owner, .adaptive-border-root, .adaptive-motion-borders, .adaptive-motion-content, .adaptive-moving-hint',
      ),
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'Adaptive', exact: true }).click();
    await expect(page.locator('.adaptive-motion-borders')).toHaveCount(1);
    await expect(page.locator('[data-pane-id="keep-notes"]')).toHaveCount(1);
  });
  test(`${framework}: Adaptive border thickness stays fixed throughout motion`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.goto(`/${framework}.html?workspace=adaptive`);
    await page.getByLabel('Transition duration (ms)').fill('220');
    await page.getByLabel('Transition duration (ms)').press('Tab');
    const duration = page.getByRole('spinbutton', { name: 'Transition duration (ms)' });
    await duration.fill('1000');
    await duration.press('Tab');
    await page.mouse.move(0, 0);
    await page.waitForTimeout(1100);
    const pane = page.locator('[data-node-id="group-adaptive-3-4"]');
    const box = (await pane.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('.adaptive-motion-borders')).toHaveCount(1);
    const frames = await page.evaluate(async () => {
      await new Promise(requestAnimationFrame);
      const animations = document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().easing === 'cubic-bezier(0.22, 1, 0.36, 1)');
      animations.forEach((a) => a.pause());
      const samples = [];
      for (const time of [0, 100, 350, 700, 999]) {
        animations.forEach((a) => (a.currentTime = time));
        const overlay = document.querySelector('.adaptive-motion-borders')!;
        const css = getComputedStyle(overlay, '::after');
        samples.push({
          border: [
            css.borderTopWidth,
            css.borderRightWidth,
            css.borderBottomWidth,
            css.borderLeftWidth,
          ],
          transform: css.transform,
          thickness: [...overlay.children].map((el) => {
            const r = el.getBoundingClientRect();
            return Math.min(r.width, r.height);
          }),
          pixelErrors: [...overlay.children].flatMap((el) => {
            const r = el.getBoundingClientRect();
            return [r.left, r.top, r.right, r.bottom].map((value) =>
              Math.abs(value * devicePixelRatio - Math.round(value * devicePixelRatio)),
            );
          }),
          nativeHidden: [
            ...document.querySelectorAll('.layouts-group.adaptive-border-owner'),
          ].every((el) => getComputedStyle(el, '::before').visibility === 'hidden'),
        });
      }
      animations.forEach((a) => a.finish());
      return samples;
    });
    for (const frame of frames) {
      expect(frame.border).toEqual(['1px', '1px', '1px', '1px']);
      expect(frame.transform).toBe('none');
      expect(frame.nativeHidden).toBe(true);
      frame.thickness.forEach((value) => expect(value).toBeCloseTo(1, 3));
      frame.pixelErrors.forEach((value) => expect(value).toBeLessThan(0.04));
    }
    await expect(page.locator('.adaptive-motion-borders')).toHaveCount(1);
    const snap = await page
      .locator('.adaptive-motion-edge')
      .first()
      .evaluate((el) => {
        const edge = el as HTMLElement;
        const original = edge.style.getPropertyValue('--adaptive-edge-x');
        const pixel = Math.round(parseFloat(original) * devicePixelRatio);
        const positions = [0.1, 0.4, 0.6].map((delta) => {
          edge.style.setProperty('--adaptive-edge-x', `${(pixel + delta) / devicePixelRatio}px`);
          return edge.getBoundingClientRect().left;
        });
        edge.style.setProperty('--adaptive-edge-x', original);
        return { positions, step: 1 / devicePixelRatio };
      });
    expect(snap.positions[0]).toBe(snap.positions[1]);
    expect(snap.positions[2]! - snap.positions[1]!).toBeCloseTo(snap.step, 2);
    await page.getByRole('button', { name: 'Default', exact: true }).click();
    await expect(page.locator('.adaptive-motion-edge')).toHaveCount(0);
  });
  test(`${framework}: Adaptive uses native Bezier motion without frame-by-frame commits`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/${framework}.html?workspace=adaptive`);
    await page.getByLabel('Transition duration (ms)').fill('220');
    await page.getByLabel('Transition duration (ms)').press('Tab');
    await expect(page.locator('.layouts-empty')).toHaveCount(60);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(350);
    await page.evaluate(() => {
      window.adaptiveMotionCommits = 0;
      const workspace = (window as unknown as { threeDemo: { workspace: WorkspaceHandle } })
        .threeDemo.workspace;
      workspace.on('change', (event) => {
        if (event.action === 'resize') window.adaptiveMotionCommits!++;
      });
    });
    const pane = page.locator('[data-node-id="group-adaptive-3-4"]');
    await expect(page.getByRole('combobox', { name: 'Motion', exact: true })).toHaveValue(
      'animated',
    );
    const start = (await pane.boundingBox())!;
    const expansion = pane.evaluate(async (el) => {
      const samples: { width: number; easings: (string | undefined)[] }[] = [];
      for (let i = 0; i < 30; i++) {
        await new Promise(requestAnimationFrame);
        samples.push({
          width: el.getBoundingClientRect().width,
          easings: el.getAnimations().map((a) => a.effect?.getTiming().easing),
        });
      }
      return samples;
    });
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    const expandedFrames = await expansion;
    expect(
      expandedFrames.some((frame) => frame.easings.includes('cubic-bezier(0.22, 1, 0.36, 1)')),
    ).toBe(true);
    expect(expandedFrames.some((frame) => frame.width > start.width * 1.2)).toBe(true);
    await expect.poll(() => page.evaluate(() => window.adaptiveMotionCommits)).toBe(1);
    await expect.poll(() => pane.evaluate((el) => el.getAnimations().length)).toBe(0);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.adaptiveMotionCommits)).toBe(1);
    const expanded = (await pane.boundingBox())!;
    const contraction = pane.evaluate(async (el) => {
      const widths: number[] = [];
      for (let i = 0; i < 30; i++) {
        await new Promise(requestAnimationFrame);
        widths.push(el.getBoundingClientRect().width);
      }
      return widths;
    });
    await page.mouse.move(0, 0);
    const widths = await contraction;
    expect(widths.some((width) => width > start.width + 0.5 && width < expanded.width - 0.5)).toBe(
      true,
    );
    await expect.poll(async () => (await pane.boundingBox())!.width).toBeCloseTo(start.width, 0);
    await expect.poll(() => page.evaluate(() => window.adaptiveMotionCommits)).toBe(2);
    await page.evaluate(() => {
      window.adaptiveMotionCommits = 0;
    });
    for (let column = 1; column <= 5; column++) {
      const target = page.locator(`[data-node-id="group-adaptive-1-${column}"]`);
      const targetBox = (await target.boundingBox())!;
      await target.dispatchEvent('pointermove', {
        pointerType: 'mouse',
        clientX: targetBox.x + targetBox.width / 2,
        clientY: targetBox.y + targetBox.height / 2,
      });
      await page.waitForTimeout(20);
    }
    const retargetCommits = await page.evaluate(() => window.adaptiveMotionCommits!);
    expect(retargetCommits).toBeGreaterThan(0);
    expect(retargetCommits).toBeLessThanOrEqual(5);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.adaptiveMotionCommits)).toBe(retargetCommits);
    // Interrupt a running hover with a real click: the native empty-region picker
    // must use the visible geometry, and no preview may keep running behind it.
    const other = page.locator('[data-node-id="group-adaptive-2-2"]');
    const box = (await other.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.getByRole('combobox', { name: 'Search tabs' })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document
              .getAnimations()
              .filter(
                (animation) =>
                  (animation.effect as KeyframeEffect | null)?.target instanceof HTMLElement &&
                  ((animation.effect as KeyframeEffect).target as HTMLElement).matches(
                    '.layouts-node, .layouts-divider',
                  ),
              ).length,
        ),
      )
      .toBe(0);
    await page.keyboard.press('Escape');
  });
}
