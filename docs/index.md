# Getting started

Quilt gives your application movable panes, split regions, tab groups, and
same-origin companion windows. You provide the content inside each pane.

## Choose an integration

| Application                                 | Install                     | Next step                                           |
| ------------------------------------------- | --------------------------- | --------------------------------------------------- |
| JavaScript or TypeScript with DOM rendering | `npm install quilt-vanilla` | [Vanilla quickstart](quickstart-vanilla.md)         |
| React                                       | `npm install quilt-react`   | [React quickstart](quickstart-react.md)             |
| Custom renderer or model tooling            | `npm install quilt-core`    | [Core reference](api-reference/quilt-core/index.md) |

Adapters install their Quilt dependencies automatically. Existing React applications
share their React and React DOM installation through peer dependencies (18.3 or 19).
Import the adapter CSS once and give the workspace container an explicit height.
Use an ESM bundler with CSS support; the [starters](examples.md) use Vite.

## Learn the essentials

1. [Create a workspace](quickstart-vanilla.md) or [mount React panes](quickstart-react.md).
2. Learn how [workspaces, panes, and groups](concepts.md) fit together.
3. [Register pane types](integration.md#plain-pane-types-and-handles) to let users add content.
4. [Style the chrome](theming.md) and export a theme from the demo.
5. [Save and restore a workspace](integration.md#workspace-json) using your own storage.

See [compatibility](compatibility.md) before choosing a desktop host. Electron
examples are tested; native Tauri integration and dedicated Vue bindings are not included.
