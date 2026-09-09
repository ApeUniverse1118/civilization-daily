# 全球文明进程重大事件日报 · Civilization Daily

一个长期记录人类文明发展轨迹的数字档案馆，以**未来历史学家的视角**，筛出可能改写人类轨迹的重大事件。

纯静态网站（HTML5 + CSS3 + Vanilla JavaScript），零依赖、零构建，可直接部署到 **GitHub Pages** 公网访问。

## 网站定位

- 名称：全球文明进程重大事件日报
- 定位：数字文明档案馆
- 目标用户：历史爱好者、学生、研究者、AI 知识探索者、关注全球文明趋势的人

## 功能说明

- **日报归档**：按日期归档全部日报，保留「今日文明观察 → 分区事件 → 评分矩阵 → 自检清单」的完整结构
- **统一体验**：全站统一 Header / 导航 / Footer / 字体 / 版式 / SEO Meta
- **相关阅读**：每期日报底部提供「上一天 / 下一天」与跨期「相关文明事件」
- **分类浏览**：政治与文明秩序、科技与人工智能、科学生命与地球、思想社会与文化 4 大分类
- **响应式**：适配 PC / 平板 / 手机
- **SEO**：每页独立 title / description / keywords / Open Graph 标签；含 sitemap.xml 与 robots.txt

## 目录结构

```
civilization-daily/
├── index.html                 # 网站首页（Hero / 最新日报 / 历史时间轴 / 分类入口）
├── archive.html               # 日报档案（全部期次列表）
├── daily/                     # 日报归档页 /daily/YYYY-MM-DD.html
│   ├── 2026-08-11.html
│   ├── 2026-08-12.html
│   └── ...
├── categories/                # 文明分类页
│   ├── science.html
│   ├── politics.html
│   ├── culture.html
│   └── technology.html
├── assets/
│   ├── css/style.css          # 全站设计系统
│   ├── js/main.js             # 导航 / 返回顶部 / 高亮
│   └── images/og-cover.png    # Open Graph 分享封面
├── sitemap.xml
├── robots.txt
├── README.md
└── .gitignore
```

## 本地预览

无需安装任何依赖，直接用浏览器打开 `index.html` 即可（所有资源均为相对路径）。

推荐用本地静态服务器预览（可选）：

```bash
# Python 3
python -m http.server 8000
# 然后访问 http://localhost:8000
```

## GitHub Pages 部署步骤

1. 在 GitHub 新建仓库（Repository），仓库名建议为 **`civilization-daily`**（如使用其他仓库名，需全站替换资源前缀 `/civilization-daily/`，见下文“自定义”）
2. 将本项目全部文件上传到仓库 `main` 分支根目录
3. 进入仓库 **Settings → Pages**
4. **Source（构建来源）** 选择 **Deploy from a branch**
5. **Branch** 选择 **`main`**，目录选择 **`/ (root)`**
6. 点击 **Save**，等待 1–2 分钟
7. 访问 `https://<你的用户名>.github.io/civilization-daily/`

> 也可通过 GitHub Actions（`peaceiris/actions-gh-pages` 等）自动发布到 `gh-pages` 分支，步骤同上。

## 如何新增一期日报

1. 将新日报 HTML 放入 `daily/`，文件名为 `YYYY-MM-DD.html`
2. 在 `index.html` 的「历史时间轴」与 `archive.html` 中补充条目
3. 更新 `sitemap.xml` 增加对应 `<url>`
4. 如涉及新主题，可将事件归入现有 4 个分类，或参考 `build/` 下的生成脚本重新生成

## 自定义

- **仓库名非 `civilization-daily`**：全局替换所有 HTML 中 `/civilization-daily/` 前缀（og:url、og:image、canonical 等）为你的仓库名
- **robots.txt**：将 `Sitemap` 行中的 `username` 替换为你的 GitHub 用户名
- **站点配色**：编辑 `assets/css/style.css` 顶部 `:root` 变量即可整体换肤

## 内容声明

本网站内容由「全球文明进程观察站」自动化智能体基于公开权威信息生成，所有事件均标注一手来源；评分系观察者基于公开信息的独立判断，仅供文明观察与研究参考，不构成任何投资、政策或法律建议。
