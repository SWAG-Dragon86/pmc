# PMC · 宝可梦冠军计算器 1.4.0

[English](README.md) · [GitLab 主站](https://pmc-babb04.gitlab.io/) · [GitHub 备用站](https://swag-dragon86.github.io/pmc/)

PMC 帮助《宝可梦冠军》玩家比较伤害、耐久与竞技配置。提供公开静态网页版和本地构建的 Android 离线版（暂无已核实的公开 APK 下载地址），支持简体中文、繁体中文、英语、日语、韩语。使用 React、Vite 和冠军专用社区引擎，没有账号或业务后端。

当前数据包适用 **Champions 1.2.0、M-C（M-6）**，规则有效期为 2026-09-09 02:00 UTC 至 2026-12-02 01:59 UTC；与软件版本 1.4.0 不同。包含 350 个形态、509 个关联招式、216 个特性名称及 166 个可携带道具。这不代表全部机制已经游戏实测。

## 功能

- 单打、双打集火、四席位可点击招式预览；防守方 B 默认不行动，可选择招式参与。
- 冠军能力点总和 66、单项 32；性格、特性、道具、血量、状态、阶段、天气与场地配置。
- 我的队伍、配置库、场景、本机保存、完整 JSON 备份与冲突预览。
- 公开阵容联网更新，打开或返回应用时检查，停留时每 5 分钟检查，可手动立即检查。时间按设备本地时区显示；没有新队伍时不会伪造更新。
- 一至两张游戏整队截图本地 OCR，预览确认后导入。识别依赖语言、清晰度和布局，不能保证每张成功。
- 整队横图、单只竖图、伤害长图及嵌入式 PMC 二维码。导入后按接收端语言显示，37 款精灵球主题。
- 临时配置锁、搜索别名、浅色/深色主题、自定义背景与文字、PWA 缓存。Android 使用系统文件选择器。

![伤害计算界面](docs/screenshots/calculator.png)

![真实队伍图导出](docs/screenshots/team.png)

图片来自实际界面与导出，未重绘。队伍图来自本轮修复前的 1.4.0 审查样例。

## 本地运行

使用 Node.js 24、pnpm 11.25.0：

```sh
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm build
pnpm preview
```

开发服务只监听本机。部署 **dist/**。构建从 npm 依赖准备本地 OCR 资源，不需要提交 `public/ocr/` 缓存。公开队伍更新与游戏数据更新为独立维护任务，见 [英文说明](README.md) 和 [贡献指南](CONTRIBUTING.md)。

## Android 构建

使用 Windows 构建脚本及 JDK/Android 工具：

```powershell
./scripts/setup-android.ps1
node scripts/build-android.mjs --unsigned
python scripts/verify-android.py output/android-unsigned/build-info.json
```

输出在 `output/android-unsigned/`，未签名，仅供构建验证，不能作为安装包发布。正式命令 `node scripts/build-android.mjs` 会使用或创建私有签名；维护现有应用必须先恢复原密钥，不能重新生成。包名保持 `cn.pmc.calculator`，最低 Android 8.0。本轮不签署正式包。当前没有已核实的公开 APK 下载入口，本地存在 APK 不等于已发布 GitHub Release。

## 限制与保存

首次打开需主动开启社区试算。回合从配置的入场条件开始，只计算当前回合，默认按入场首回合；当前界面没有上一回合/在场回合输入。引擎对显式 `activeMoveActions > 0` 的场景拒绝击掌奇袭；旧场景没有该字段时沿用入场语义。概率畏缩沿用已有“启用附加效果”条件，不表示所有追加效果必定发生，也不是实机胜率。

抛下狠话完整换人、复杂连续攻击及部分连锁尚未支持，保留限制提示。52,500 项能力值公式核对不是游戏实机测试，509 个入口扫描也不等于穷尽招式规则。详见 [机制说明](docs/MECHANICS-REGRESSIONS.md)。

配置保存在当前网址/浏览器或 APK 本机，背景存在 IndexedDB，无云同步。切换设备或网址前先完整导出；清除数据、卸载会丢失本机记录。带二维码图可读取嵌入配置，但不能代替全部记录的 JSON 备份。

## 许可与反馈

维护者已确认自有代码使用 **GPL-3.0-or-later**。MIT 引擎、Showdown、GPL 中文词条和各 npm 包保留各自许可，见 [LICENSE](LICENSE)、[第三方声明](THIRD_PARTY_NOTICES.md) 和 [授权范围](docs/LICENSING.md)。已替换全部 350 个形态图（198 个全身像素图、79 个头像、73 个重绘图标）、18 种属性图标、37 款精灵球及 Logo / 图标系列，并逐项保留 SpriteCollab、The Artificial、James Watkins / partywhale、Cobblemon Assets 的署名与各自许可。The Artificial 的 CC-BY 声明未指定版本，保留原文，不擅自标为 CC-BY-4.0。自有代码仍为 GPL-3.0-or-later，图片的非商业条件不限制 GPL 代码。原先 77 个形态缺口已补齐；两种南瓜怪人按维护者确认共用物种头像，仍保留独立形态与计算。默认背景已由维护者确认自制，保持原图，其独立再使用许可尚未另行选择。8 张截图已重新生成并附加素材署名；已按维护者要求删除授权未确认的“奇异球”，现保留 37 款精灵球主题；本次源代码历史已移除旧图片，保留代码历史；平台缓存和外部克隆不能保证收回，也不能宣称已取得官方角色／商标授权。见 [图片署名](docs/ASSET_CREDITS.md) 和 [未解决清单](docs/ASSET_RIGHTS_REMAINING.md)。

本项目没有宝可梦官方背书。固定数据提交见 `src/data/sources.json`，形态图片来源见 `src/data/sprites.json`。请通过 [Issues](https://github.com/SWAG-Dragon86/pmc/issues) 反馈计算错误，并附版本、场景和可信依据，隐去隐私信息。
