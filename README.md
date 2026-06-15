# Silicon Valley AI Digest

> 每日硅谷 AI 新闻中文精选归档 · A daily Chinese-language digest of Silicon Valley AI news.

**🔗 在线访问 / Live site: [eric-pk.github.io/SV-AI-Digest](https://eric-pk.github.io/SV-AI-Digest/)**

每天自动汇总一手英文 AI 信源，翻译为中文摘要并归档成可检索的静态站点。截至最新一期已收录 **53 期 / 2,000+ 条**。

---

## ✨ 功能 Features

- **📅 按日归档** —— 每期一页，点开即看当天全文
- **🔍 全文搜索** —— 支持限定信源（`source:openai`）、HN 分数阈值（`min:200`）、多关键词与关系
- **★ 收藏** —— 本地（localStorage）标记感兴趣的条目，独立查看
- **🔗 永久链接** —— 每个条目可复制 `#锚点` 直链分享
- 纯静态、无后端、无追踪，自带 HTTPS

## 📰 信源 Sources

OpenAI · Anthropic · Google DeepMind · Google AI · HuggingFace Blog ·
arXiv (cs.CL/LG/AI) · HuggingFace Daily Papers · Hacker News ·
smol.ai · Simon Willison · Import AI · Latent Space · Every ·
TLDR AI · VentureBeat · TechCrunch · X / Twitter · GitHub Trending

每条摘要均保留原文标题与来源链接，点击可跳转一手出处。

## 🗂️ 结构 Structure

```
.
├── index.html          # 归档首页 + 全文搜索 + 收藏
├── posts/              # 每日一页（YYYY-MM-DD.html）
└── assets/
    ├── style.css
    ├── app.js          # 搜索 / 收藏 / 永久链接交互
    ├── search_index.js
    └── search_index.json
```

## 🛠️ 本地预览 Local preview

纯静态，任意静态服务器即可：

```bash
python3 -m http.server 8000
# 然后访问 http://localhost:8000
```

## 📄 关于内容 About the content

本站为公开 AI 新闻的二次聚合与中文化整理，所有条目均链接回原始出处，版权归各原作者 / 机构所有。摘要由自动化流程生成，仅供个人学习与信息追踪之用，不代表任何机构立场。

---

*Built for tracking the fast-moving world of AI, one day at a time.*
