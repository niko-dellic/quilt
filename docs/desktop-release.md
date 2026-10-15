# Quilt desktop demo

The vanilla and React demos packaged with Electron. Includes pane layouts, popout windows, themes, resizing, and workspace JSON. Runs offline without a separate Node.js installation.

## Published download version

Desktop builds are released independently from npm packages. The website uses
`desktop/downloads.json` to point at the latest verified, published desktop release.
Update that manifest only after the desktop workflow publishes all four assets;
verify each download URL first. An npm version bump must not change desktop links.

## Downloads

- **macOS Apple Silicon:** `mac-arm64.dmg`
- **macOS Intel:** `mac-x64.dmg`
- **Windows 64-bit:** `win-x64.exe` (portable app)
- **Ubuntu / Debian 64-bit:** `linux-amd64.deb`

On macOS, open the DMG and drag Quilt Demo into Applications. On Windows, open the EXE. On Ubuntu / Debian, open the DEB with your software installer, then launch Quilt Demo from the applications menu.

These demo builds have no trusted developer certificate. macOS bundles use an ad-hoc signature and are not notarized. macOS or Windows may show an unidentified-developer warning. macOS may require approval in System Settings → Privacy & Security after the first attempt to open the app. Windows may offer More info → Run anyway. Managed devices may prohibit unsigned applications. No signing certificate or notarization is included.

Closing a companion returns its pane. Saved workspaces restore docked. Application state persists across pane moves and popouts within a session; the demo does not save pane data between app launches.

SHA-256 checksums are provided alongside the downloads.
