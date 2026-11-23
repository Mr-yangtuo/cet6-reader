# 六级随身读

适合手机阅读的静态 PDF 书架，仅收录 2026 年 6 月、2025 年 12 月各三套六级试卷及配套解析，共 12 个 PDF，无听力文件。

- `docs/原题/`：6 份试卷。
- `docs/答案/`：6 份答案解析。
- 手机默认适合宽度，整份 PDF 上下连续滚动，支持放大/缩小、下载、一键切换同套原题与答案。
- 页面按需渲染，远离阅读位置的画布会释放，减少手机内存占用。
- 每份文件的阅读页码与页内位置保存在当前浏览器的 localStorage，无需登录；兼容之前保存的页码。
- PDF.js、字体、CMap 和 WASM 随站点分发，不依赖运行时 CDN。
- 目录是静态的；新增文件后需同步维护 `docs/catalog.json`，不提供在线上传或云端修改。

## 本地预览

运行 `python -m http.server 8765 --directory docs`，打开 http://localhost:8765 。

## 维护

`npm ci --ignore-scripts` 后执行 `npm run vendor` 可重建 PDF.js 资源。`python scripts/download.py` 下载已锁定源版本的 PDF，并生成带页数、来源和 SHA-256 的目录清单。

GitHub Pages 发布目录：`main` 分支 `/docs`。

## 资料来源

PDF 保留原文件，来自 [0609x/CET46-Resources](https://github.com/0609x/CET46-Resources)，固定版本 `0739f9810cc5884c4b0f7d2804343725296f1e94`。各文件来源链接及校验值见 `docs/catalog.json`。

试题、文章及第三方答案解析的权利归相应权利人所有，本项目不将这些资料声明为原创或重新授予开源许可。来源项目的[权利说明](https://github.com/0609x/CET46-Resources/blob/main/RIGHTS.md)同样应当注意。

PDF.js 使用 Apache-2.0 许可证，副本在 `docs/vendor/pdfjs/LICENSE`，字体等附带声明随对应资源保留。
