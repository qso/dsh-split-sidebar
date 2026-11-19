# DSH Dockline

A compact file workbench for DeepSeek Harness. Browse a folder beside its preview, switch open files from the bottom bar, and seek through large local media without waiting for a complete download. Tested with DSH Desktop 0.2.2-rc.5 on macOS.

## 安装与使用

在 DSH 插件管理器中通过 GitHub 安装 `github:qso/dsh-dockline#v0.1.0`，启用后重启 DSH。也可克隆本仓库，运行 `npm ci --ignore-scripts`，然后安装为本地插件。可搭配 [DSH Afterburn](https://github.com/qso/dsh-afterburn) 加快会话切换与首次展开目录。

- 在会话底部点击「文件树」，选中文件后，同一个侧栏同时显示文件树和预览。面板至少 400 像素宽时自动并排。窄屏保留宿主导航方式。分隔线可拖动。
- 「已打开文件」列出当前会话的文件标签。选择文件会跳到原标签。「终端」返回当前会话已开的终端，首次点击时创建。底部菜单与 DSH 自带底部面板共存。
- 图片沿用 DSH 的缩放控件，文本、PDF、表格和办公文档沿用宿主支持的预览。音视频使用系统 WebView 的解码器，默认仅预读媒体信息。浏览器可以按需请求文件末尾或任意片段。
- 部分 MKV、AVI、MOV 或特殊编码依赖本机解码器。点击「在本机播放器打开」会优先选择系统为该文件列出的 IINA，其次使用默认程序。IINA 是独立应用，可自行安装。也可以选择本地媒体文件在侧栏播放，浏览器直接使用所选文件。
- Dockline 参考了 [DSH Better Sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) 的工作区布局思路。实现复用 DSH 文件树、标签与终端。可以单独安装。

## 配置

底部「侧栏设置」可随时切换双列、终端入口和媒体预读。这些偏好保存在当前浏览器。插件配置决定初始值和宿主行为。

| 选项 | 默认值 | 用途 |
| --- | --- | --- |
| `showDock` | true | 显示会话底部菜单 |
| `autoSplit` | true | 宽面板默认打开并排导航，可在菜单覆盖 |
| `nativePlayer` | true | 显示本机播放器入口 |
| `streaming` | true | 开启经 DSH 鉴权的媒体分段传输 |
| `chunkKiB` | 256 | 每次向宿主读取的上限，16–1024 KiB，同时遵守 DSH 的更低上限 |

## Playback and privacy

Only DSH's authenticated owner can open a streaming preview. Dockline resolves the session through the host's workspace lookup, reads with the host filesystem policy and issues a short-lived random playback ticket. Seeking uses HTTP byte ranges. Each chunk checks the source version. A changed file can be reopened with the host reload button. Up to 32 tickets are retained in memory. Idle tickets expire after 15 minutes. Media responses are marked private and no-store. The plugin has no external service or analytics.

Browser codec support varies. If streaming is disabled, the host's full-file preview limit applies to inline playback through its standard media route. Large images, PDFs and office files use the host's limits. Disabling Dockline and restarting restores the original sidebar.

## Development

Use Node.js 22.19 or later. Run `npm ci --ignore-scripts`, `npm test`, and `npm pack --dry-run`. The tests exercise ranges, seeking, ticket checks and invalidation using synthetic media. MIT licensed.
