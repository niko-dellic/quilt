import { test } from '@playwright/test';

test('Adaptive frame timing', async ({ page }) => {
  test.skip(!process.env.QUILT_ADAPTIVE_BENCHMARK, 'Opt-in timing benchmark');
  await page.setViewportSize({ width: 1500, height: 1100 });
  await page.goto('/vanilla.html?workspace=adaptive');
  await page.waitForTimeout(500);
  const result = await page.evaluate(async () => {
    const deltas: number[] = [];
    let last = performance.now(),
      frame = 0,
      bodyResizes = 0;
    const observer = new ResizeObserver((entries) => (bodyResizes += entries.length));
    document
      .querySelectorAll('.adaptive-pinned > .layouts-body')
      .forEach((el) => observer.observe(el));
    const tick = (time: number) => {
      deltas.push(time - last);
      last = time;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    for (let col = 1; col <= 8; col++) {
      const pane = document.querySelector<HTMLElement>(`[data-node-id="group-adaptive-3-${col}"]`)!;
      const r = pane.getBoundingClientRect();
      pane.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          pointerType: 'mouse',
          clientX: r.x + r.width / 2,
          clientY: r.y + r.height / 2,
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    cancelAnimationFrame(frame);
    observer.disconnect();
    const samples = deltas.slice(1).sort((a, b) => a - b);
    return {
      frames: samples.length,
      p95: samples[Math.floor(samples.length * 0.95)],
      max: Math.max(...samples),
      over34ms: samples.filter((n) => n > 34).length,
      bodyResizes,
    };
  });
  console.log('Adaptive timing', JSON.stringify(result));
});
