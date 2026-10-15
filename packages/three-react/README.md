# quilt-three-react

React Three Fiber bindings for Quilt shared-scene workspaces. Uses the same
renderer, controls, and lifecycle infrastructure as `quilt-three`.

## Install

```sh
npm install quilt-three-react
```

Modern npm installs Quilt dependencies, React 19, React DOM 19, R3F 9,
Three.js r186, and their required TypeScript declarations automatically.
Compatible existing peers are reused. React 18 applications must upgrade to
React 19 before using this package; ordinary `quilt-react` still supports React 18.

```tsx
import { ThreeSessionProvider, SharedScene, ThreeView } from 'quilt-three-react';
```

Keep one `ThreeSessionProvider` and one persistent `SharedScene` outside the pane
views. Render `ThreeView` in each pane with its own camera and pane context.
Scene data remains application-owned across docking and companion transitions.

See the [integration guide](https://github.com/niko-dellic/quilt/tree/main/packages/three)
for complete React and vanilla examples, ownership, controls, WebGPU, and pipelines.

The former `quilt-three/react` entry has been removed. Change imports to
`quilt-three-react` and install this package. Vanilla applications only need
`npm install quilt-three` and do not install React or R3F.
