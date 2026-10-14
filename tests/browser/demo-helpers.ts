import type { Page } from '@playwright/test';

/** Tab and join tests explicitly opt out of the default canvas dedication. */
export async function allowCanvasTabs(page: Page) {
  await page.locator('[data-node-id="scene-group"] [data-corner="tl"]').click({ button: 'right' });
  await page.getByRole('button', { name: 'Unpin tab', exact: true }).click();
}
