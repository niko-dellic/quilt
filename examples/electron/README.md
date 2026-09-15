# Quilt Electron starter

A source example using Quilt 0.2.2 and Electron, with a notes pane, themes,
workspace JSON, and close confirmation.

For a runnable application containing the web demos, use the
[desktop downloads](https://quilt-layouts.vercel.app/electron.html).

## Run

Install Node.js 24 and open a terminal in a copy of this directory:

```sh
npm install
npm start
```

The first command installs Quilt and Electron from npm. The second checks
TypeScript, builds the interface, and opens a native Electron window.

Edit the note, pop it out, and close the companion to return it. Try switching
the theme, saving and loading workspace JSON, and the optional close confirmation.
Note text remains application-owned; it is not part of workspace JSON.

## Files

- `main.cjs`: Electron host and companion window policy.
- `main.ts`: Quilt setup, note renderer, and workspace actions.
- `style.css`: Application styles and custom theme variable.

Run `npm run dev` for browser development or `npm start` for desktop behavior.
The starter targets the same DOM renderer as the browser packages.

See [host compatibility](../../docs/compatibility.md) and
[integration documentation](../../docs/integration.md).
