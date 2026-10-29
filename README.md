# ThreeAuto Creator

基于 Vue 3、Pinia、Three.js 和 [ThreeAuto](https://github.com/flowers-10/three-auto) 的轻量级 3D 场景编辑器。

## 开发

需要 Node.js 20+，统一使用 npm 管理依赖。

```bash
npm ci
npm run dev
npm test
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

构建已关闭 Vite 对 `public/` 的整目录复制，只允许输出 `three-auto.ico` 和生成的 `export-runtime.js`。场景资源通过用户导入进入浏览器项目库；构建测试会验证意外放入 `public/` 的模型、贴图和项目包不会进入 `dist/`。

本机原有园区资源与生成工具已迁至同级目录 `../three-auto-creator-resources/`，工具依赖独立安装。当前项目包在该目录下的 `projects/campus-satellite-rebuilt/campus.threeauto`，可使用「打开项目包」导入。浏览器中已有的本机项目仍可继续打开。

用户主动导出的 `.threeauto` 和网页 ZIP 会包含该场景的资源，以便迁移和离线使用；这些导出文件与编辑器自身的发布包分开。

## 目录

```text
src/components/  编辑器界面和画布交互
src/store/       编辑器、资源与项目状态
src/project/     项目格式、本机存储和通用渲染运行时
src/utils/       材质等辅助逻辑
scripts/         编辑器构建和测试工具
tests/           通用编辑器测试
public/          图标和生成的网页导出脚本
```
