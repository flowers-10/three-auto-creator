# ThreeAuto Creator 🚀

一个基于 **[ThreeAuto](https://github.com/flowers-10/three-auto)** 核心库构建的现代化“无代码” 3D 场景编辑器。

## 🌟 项目简介

ThreeAuto Creator 旨在提供一个直观、高效的图形化界面，让开发者和设计师无需编写复杂代码即可构建、配置和预览 Three.js 场景。本项目深度集成了 `three-auto` 库，充分发挥其自动化配置和高性能渲染的优势。

### 核心库关联
本项目由 **[ThreeAuto](https://github.com/flowers-10/three-auto)** 提供动力支持：
- 📖 **核心库文档**: [ThreeAuto Documentation](https://flowers-10.github.io/three-auto/)
- 🔗 **核心库源码**: [flowers-10/three-auto](https://github.com/flowers-10/three-auto)

## ✨ 功能特性

- **可视化编辑**: 支持场景参数（阴影、相机、雾气、后处理）的实时双向绑定调节。
- **现代化 UI 库**: 包含自定义封装的 `Slider`、`Switch`、`Select`、`ColorPicker` 等高颜值 UI 组件。
- **资源管理**: 支持 `Material`、`Color`、`Image`、`Media` 等资源的本地化存储与复用。
- **交互式拾色器**: 支持 Hex 值与透明度（Alpha）的直接编辑及预览。
- **持久化存储**: 自动将编辑器状态保存至 `localStorage`，确保工作进度永不丢失。
- **响应式布局**: 适配多种屏幕尺寸，提供专业的侧边栏属性面板。

## 🛠️ 技术栈

- **框架**: Vue 3 (Composition API)
- **状态管理**: Pinia
- **3D 引擎**: [ThreeAuto](https://github.com/flowers-10/three-auto) (基于 Three.js)
- **构建工具**: Vite
- **脚本**: TypeScript

## 🚀 快速开始

### 安装依赖
```bash
npm install
# 或
yarn install
```

### 本地开发
```bash
npm run dev
```

### 构建项目
```bash
npm run build
```

## 🌐 开启 GitHub 预览 (GitHub Pages)

要将本项目部署到 GitHub Pages 并开启预览，请参考以下步骤：

1. **配置 base 路径**: 
   已在 `vite.config.ts` 中设置 `base: './'`，这确保了构建后的资源路径在 GitHub Pages 下能被正确访问。
2. **构建项目**:
   运行 `npm run build` 生成 `dist` 文件夹。
3. **部署方式 (推荐使用 GitHub Actions)**:
   - 在 GitHub 项目设置中，进入 **Settings > Pages**。
   - 在 **Build and deployment > Source** 中选择 **GitHub Actions**。
   - GitHub 会提供一个静态站点的模板，或者你可以直接使用现成的 Vite 部署 Action。
4. **手动部署**:
   你也可以使用 `gh-pages` 工具进行快速部署：
   ```bash
   npm install -g gh-pages
   gh-pages -d dist
   ```

## 📄 开源协议

本项目遵循 MIT 协议。

***
*Created with ❤️ by [Trae IDE](https://www.trae.ai/)*
