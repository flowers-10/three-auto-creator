# ThreeAuto Creator

基于 Vue 3、Pinia、Three.js 和 [ThreeAuto](https://github.com/flowers-10/three-auto) 的轻量级 3D 场景编辑器。

## 开发

需要 Node.js 20+，统一使用 npm 管理依赖。

```bash
npm ci
npm run dev
npm run check
npm run build
npm run preview
```

开发和预览端口为 `2025`。`dev` / `build` 会先生成独立网页导出所需的 `public/export-runtime.js`。

## 编辑项目

- 新建、切换本机项目；项目文档和导入的二进制资源保存到浏览器 IndexedDB。
- 通过「项目 → 打开项目包」导入 `.threeauto` / `.zip`，或导入贴图已内嵌的 GLB。
- 编辑场景、模型、地面、材质和后期效果；支持选择、变换、分组、撤销和重做。
- 导出可编辑项目包、含资源的独立网页 ZIP，或仅场景 JSON。

## 资源边界

编辑器仓库只保存通用代码。模型、贴图、HDR、Blender 源文件、示例项目和临时预览放在独立资源目录或外部存储中，**不要放进 `src/` 或 `public/`**。

构建已关闭 Vite 对 `public/` 的整目录复制，只允许复制 `three-auto.ico` 和生成的 `export-runtime.js`。这个限制只覆盖 `public/` 复制，不会阻止源码导入资源；同样禁止通过 `import`、`new URL`、`import.meta.glob` 或内联 Base64 把业务模型、贴图塞进源码。

本机原有园区资源与生成工具已迁至同级目录 `../three-auto-creator-resources/`，工具依赖独立安装。当前项目包在该目录下的 `projects/campus-satellite-rebuilt/campus.threeauto`，可使用「打开项目包」导入。浏览器中已有的本机项目仍可继续打开。

用户主动导出的 `.threeauto` 和网页 ZIP 会包含该场景的资源，以便迁移和离线使用；这些导出文件与编辑器自身的发布包分开。

## 目录

```text
src/components/  编辑器界面和画布交互
src/store/       编辑器、资源与项目状态
src/project/     项目格式、本机存储和通用渲染运行时
src/utils/       材质等辅助逻辑
scripts/         编辑器构建工具
public/          图标和生成的网页导出脚本
```

开发与协作约定见 [AGENTS.md](./AGENTS.md)。

## 项目格式与导入限制

`.threeauto` 是标准 ZIP，包含根目录的 `project.json` 和 `assets/` 资源，格式标识为 `three-auto-creator`，当前版本为 `1`。导入时会先校验整个包，再切换当前项目；不支持的版本、损坏的校验和、缺失的引用资源、重复 ID、循环父子关系等会报错。

| 边界 | 当前限制 |
| --- | --- |
| 上传的项目包 | 不超过 512 MiB |
| 解压后总大小 | 不超过 512 MiB |
| ZIP 条目 | 最多 2000 个，含 `project.json` 和目录条目 |
| 单个资源文件 | 不超过 256 MiB |
| `project.json` | 不超过 4 MiB |
| 单独导入的 GLB | 不超过 256 MiB；贴图和缓冲数据必须内嵌 |

项目包内的文件资源使用规范的 `assets/` 相对路径，不接受路径穿越、绝对路径或临时 `blob:` 地址。导入导出校验允许指定类型的内嵌 Base64 数据，但外部 HTTP 资源必须先收进项目包。修改格式或资源字段时，应同步检查 `src/project/archive.ts` 的校验和编辑器、独立网页两端的解析。

## 保存与异常处理

项目文档和二进制资源存放在 IndexedDB，编辑器偏好及部分兼容数据使用 localStorage。数据属于当前浏览器和站点；更换域名、端口、浏览器或清除站点数据后，原项目可能无法在新环境恢复。迁移和重要编辑后请导出项目包备份。

- 格式或校验报错：当前场景尚未替换，按提示检查格式、大小、资源引用和文件完整性。
- 自动保存失败：优先导出项目包备份，再检查浏览器空间、存储权限及其他标签页；不要用清空本机项目库处理一般错误。
- 模型或材质缺失：检查项目包资源是否完整；编辑器不会自动拉取园区数据或替换用户模型、变换和材质。
- 独立网页导出提示缺少脚本：重新执行 `npm run dev` 或 `npm run build` 生成运行脚本。
- 导出的网页通过静态 HTTP 服务打开，例如在解压目录执行 `python3 -m http.server 8080`；浏览器可能限制直接以 `file://` 加载资源。

## 校验与提交范围

本仓库约定：**测试文件、测试专用脚本和测试报告只保留在本地，不提交到 Git**。`.gitignore` 已覆盖测试目录、`*.test.*`、`*.spec.*` 及常见报告目录；已跟踪的测试已取消跟踪，本机文件仍保留。取消跟踪不会删除 Git 历史中的旧版本。

新克隆项目使用 `npm run check` 校验类型，使用 `npm run build` 验证完整构建，不依赖任何本地测试文件。现有本机测试可额外运行：

```bash
node scripts/test-project.mjs
node --test scripts/build.test.mjs
```

这些本地脚本和测试目录不随仓库分发，未配置本地测试时无需运行。运行结果应在提交说明中如实说明，不将未运行的检查写成通过。

提交前检查 `git diff --cached --name-status`，确认只包含通用代码、必要配置和维护文档。`dist/`、生成的 `public/export-runtime.js`、场景资源、临时预览和本机工具记录也不提交；维护者协作规范统一写入 `AGENTS.md`。
