import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
test('Three benchmark: one/four views and independent effects', async ({ page, browserName }) => {
  test.skip(
    process.env.QUILT_THREE_BENCHMARK !== '1' || browserName !== 'chromium',
    'Opt-in benchmark',
  );
  const results: unknown[] = [];
  for (const objects of [30, 1000])
    for (const count of [1, 4])
      for (const effects of [false, true]) {
        await page.goto(`/vanilla.html?workspace=three${effects ? '&effects' : ''}`);
        await expect
          .poll(() => page.evaluate(() => window.threeDemo?.session?.stats.views))
          .toBe(4);
        await page.evaluate((objects) => {
          const { session } = window.threeDemo;
          const model = session.scene.getObjectByName('model')!;
          const blocks = model.children.filter((object) => object.name === 'Study block');
          for (let i = blocks.length; i < objects; i++) {
            const clone = blocks[i % blocks.length]!.clone();
            clone.scale.setScalar(0.1);
            clone.position.set(
              (i % 10) * 0.3 - 1.5,
              (Math.floor(i / 10) % 10) * 0.3 - 1.5,
              Math.floor(i / 100) * 0.3 - 1.5,
            );
            model.add(clone);
          }
          session.invalidate();
        }, objects);
        if (count === 1)
          await page.evaluate(() => {
            for (const id of ['top', 'front', 'side'])
              document.querySelector<HTMLElement>(`[data-pane-id="${id}"]`)!.hidden = true;
          });
        const metrics = await page.evaluate(async () => {
          const { session } = window.threeDemo;
          const gl = document.querySelector('canvas')!.getContext('webgl2')!;
          const extension = gl.getExtension('EXT_disjoint_timer_query_webgl2');
          const queries: WebGLQuery[] = [];
          const samples: number[] = [];
          for (let i = 0; i < 40; i++) {
            await new Promise(requestAnimationFrame);
            let query: WebGLQuery | null = null;
            if (extension && i >= 10) {
              query = gl.createQuery();
              gl.beginQuery(extension.TIME_ELAPSED_EXT, query!);
            }
            session.render(performance.now());
            if (query) {
              gl.endQuery(extension.TIME_ELAPSED_EXT);
              queries.push(query);
            }
            if (i >= 10) samples.push(session.stats.lastFrameMs);
          }
          const gpu: number[] = [];
          for (let attempt = 0; queries.length && attempt < 60; attempt++) {
            await new Promise(requestAnimationFrame);
            if (gl.getParameter(extension.GPU_DISJOINT_EXT)) break;
            while (queries.length && gl.getQueryParameter(queries[0]!, gl.QUERY_RESULT_AVAILABLE)) {
              const query = queries.shift()!;
              gpu.push(Number(gl.getQueryParameter(query, gl.QUERY_RESULT)) / 1e6);
              gl.deleteQuery(query);
            }
          }
          for (const query of queries) gl.deleteQuery(query);
          samples.sort((a, b) => a - b);
          return {
            cpuMedianMs: samples[Math.floor(samples.length / 2)],
            cpuP95Ms: samples[Math.floor(samples.length * 0.95)],
            gpuMeanMs: gpu.length ? gpu.reduce((a, b) => a + b, 0) / gpu.length : null,
            gpuTiming: gpu.length ? 'EXT_disjoint_timer_query_webgl2' : 'unavailable or disjoint',
            ...session.stats,
          };
        });
        results.push({ objects, visibleViews: count, effects, ...metrics });
      }
  mkdirSync('artifacts', { recursive: true });
  writeFileSync(
    'artifacts/three-benchmark.json',
    JSON.stringify(
      {
        environment:
          'Chromium headless; GPU/driver dependent; CPU measures frame submission, not GPU completion',
        results,
      },
      null,
      2,
    ),
  );
});
