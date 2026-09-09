# PMC · 宝可梦冠军计算器

当前版本：0.1.0，本地可运行的社区数据预览版。此版本还不是全量游戏数据核验完成的正式计算器。

## 打开

公开网址：[PMC 宝可梦冠军计算器](https://pmc-cn.vercel.app)。手机和电脑均可使用，电脑无需保持开机。项目部署在用户的 Vercel Hobby 账户中，没有购买服务器或域名。原网址 `pmc-five-psi.vercel.app` 保留，但建议统一使用新网址。

旧本机地址中的配置不会自动迁移到新网址。请先在旧页面导出备份，再到公开网址导入。

双击项目目录中的 `启动PMC.cmd`，浏览器打开本机地址 `http://127.0.0.1:4173/`。保留启动窗口即可继续使用，关闭窗口会停止本机预览服务。

本次开发会话已启动预览服务，也可以直接打开上述地址。`127.0.0.1` 只代表当前电脑，不是公众网址，手机不能用它访问这台电脑。

已完成 HTTPS 静态托管发布；平台返回生产部署 READY，正式域名已绑定。真机访问与安装效果仍需用户确认，免费服务的长期政策不能由本项目保证。后续更新方式见 `docs/公网发布记录.md`。

## 这一版能做什么

- 单打、双打集火、配置库中多个配置独立比较。
- 冠军专用能力点与伤害引擎，中文、全拼、拼音首字母搜索。
- 普通与 Mega 形态分别选择；对应道具与招式池校验。
- 天气、场地、墙、支援条件、开局血量、状态、能力阶段。
- 自动计算、手动选招、推荐招式不覆盖手动选择。
- 本地配置库、允许重名、编辑更新原配置或新建副本。
- 完整场景快照、关闭后恢复未保存现场。
- 配置与场景 JSON 批量导入导出；冲突先预览，再确认。
- 固定精灵球背景、本机换图、浅色/深色/系统主题。
- 横屏与竖屏背景可分别选择，预览比例为 16:9 和 9:16；按屏幕方向自动切换。只设置一张时共用，两张都清除后恢复默认。旧版背景保留在横屏槽。
- 可行动席位固定启用行动，不再提供关闭开关；旧场景也按此规则计算。对方 B 仍为原有被动席位，参与范围与队友条件。
- 最终结果、手机底栏和导出图片显示选中目标的回合末所剩血量；单招列表仍显示伤害。详情保留行动后与回合末血量。
- 设置 → 首页文字：自定义内容、18–64 px 字号和颜色，自动保存在本机，可恢复默认。
- 页面底部蓝色“讨论频道”链接到用户提供的 QQ 群“卡比兽侠的小屋”。
- 手机底部结果栏、带计算条件的 PNG 结果图片。
- PWA 离线资源缓存、发现更新后提醒；确认后下载新资源并切换。

首次打开默认关闭社区试算。点击“启用社区试算”后才显示数字；重新打开仍需要启用，避免把预览结果误认成正式结论。

## 重要限制

| 范围 | 当前状态 |
| --- | --- |
| 当前游戏版本与排位规则 | 适用于《宝可梦冠军》1.2.0、M-C（M-6）；规则有效期为 2026-09-09 02:00 UTC 至 2026-12-02 01:59 UTC |
| 当前目录 | 350 个可配置形态、509 个关联招式、166 个可携带道具。M-B 名单继续有效，M-C 新增 24 种宝可梦和 6 种超级进化，并展开性别、地区及影响特性的外观形态 |
| 单招伤害 | 使用 Smogon 冠军专用模式（generation 0），没有用第九世代模式替代 |
| 动态范围招式 | 广域战力暂不输出单招结果，避免动态目标适配不完整时误算 |
| 回合计算 | 只计算用户设定的当前一回合，到回合末结算为止；不继承上一回合状态，也不模拟下一回合触发。已实现有限事件集和精确分支枚举，不是完整的游戏对战模拟器 |
| 复杂连续攻击、替身、变身、换人、部分引招与特性连锁 | 双光束已按两击顺序结算；其余复杂连续攻击尚未完整实现，部分已识别组合会阻止完整回合结果 |
| 开局特性 | 已自动结算天气特性、威吓、甘露之蜜、隐形岩、撒菱和黏黏网；不模拟换入换出 |
| 回合末效果 | 已覆盖部分天气、场地、状态和回复，尚未覆盖完整规则；剧毒按首回合处理 |
| 结果概率 | 只在当前支持的事件范围内枚举；不代表已通过游戏实测的击倒概率 |
| 分支过多 | 超过内部精确展开上限时停止并提示，不用抽样数替代 |
| 形态图片 | 350 张本地 PNG 已补齐；公开分发许可仍待确认 |
| 中文词条 | 道具、特性和宝可梦形态均有中文显示名；英文原名保留为搜索别名。部分词条由社区资料补充，不冒充官方完整文本包 |
| 真机兼容性 | 已做 Chromium 桌面/手机尺寸测试；未在真实 iPhone、安卓手机安装验证 |
| 对外发布 | GitLab Pages 公开版已部署；APK 为离线安装包。素材和商标权仍归各权利人 |

原始需求保留在 `PMC需求确认清单.md`。以上限制是尚未完成的工作，不代表删除原要求。

## 保存和备份

配置与场景存于当前浏览器的本地存储，自定义背景存于 IndexedDB。没有账号，也没有云同步。

使用“完整导出”备份到文件，再到另一台设备导入。导入不会清空现有记录。同一标识内容不同会让用户选择覆盖或保留双方；相同内容跳过。失效的游戏配置保留原记录，参与计算前需修正。

注意：不同浏览器、不同网址和不同端口属于不同存储空间。清理浏览器数据或卸载可能导致丢失。PNG 结果图供查看，不能代替可编辑的 JSON 备份。

## 开发与测试

运行环境：Node.js 22.12 或更高版本。项目包含 pnpm 锁文件。

```powershell
npm install
npm run dev
npm test
npm run build
npm run preview
```

此电脑的构建命令也可直接使用现有依赖，避免依赖系统 npm：

```powershell
node --test tests/core.test.mjs tests/revision.test.mjs
node node_modules/vite/bin/vite.js build
node scripts/build-sw.mjs
node scripts/serve.mjs
```

浏览器 QA 脚本使用此电脑的 Codex 内置 Playwright 与已安装 Chromium，可通过 `PMC_BROWSER_PATH` 指定其他 Chromium 可执行文件。测试使用隔离浏览器，不修改用户浏览器中的记录。

```powershell
node scripts/browser-qa.mjs
node scripts/update-qa.mjs
node scripts/revision-qa.mjs
node scripts/remaining-background-qa.mjs
node scripts/glass-logo-qa.mjs
```

## 数据维护

- `src/data/sources.json` 固定本次取数的上游提交。
- `scripts/prepare-data.mjs` 从固定提交生成候选目录和冠军计算代码，不运行用户导入文件中的代码。
- `src/data/roster-audit.json` 保留 M-B 的 235 项基线；`src/data/mc-manifest.json` 保存 M-C 的版本、日期、新增配置项和道具清单。
- `src/data/regulation-m-c.json` 与 `src/data/champions-dex-mc*.json` 保存 2026-09-09 维护结束后的规则、数值与招式快照；`src/data/resource-supplement.json` 保存中文补充与图片来源。
- `scripts/prepare-sprites.mjs` 缓存对应形态小图。
- `src/vendor/calc.mjs` 是从保留的上游源码生成的 ESM 包；构建时加入 CommonJS 兼容变量，没有改动冠军公式。
- `vendor/` 保留上游源码和许可，方便核对。请勿把修改提交号当作已经完成游戏验证。
- 日后发布数据更新，需要维护者核实改动、重新构建、执行测试，再更新静态托管内容。

## 来源与许可

- [Smogon damage-calc](https://github.com/smogon/damage-calc)：MIT，固定提交见来源清单。
- [Pokémon Showdown 冠军分支](https://github.com/smogon/pokemon-showdown/tree/master/data/mods/champions)：MIT。
- [中文词条来源](https://github.com/professorsidon/VGC-Damage-Calculator-Chinese)：所读取的翻译目录包含 GPL-3.0 许可，原文件保存在 `vendor/chinese/script_res/translate/LICENSE`。公开分发前需确定符合该许可的源码提供方式；未擅自为用户的新项目确定整体开源许可。
- [M-C 官方公告](https://champions-news.pokemon-home.com/en/page/816.html)：用于确认规则版本、有效时间和新增范围；[Serebii M-C 规则页](https://www.serebii.net/pokemonchampions/rankedbattle/regulationm-c.shtml)及[Champions 图鉴](https://www.serebii.net/pokedex-champions/)用于逐项抓取维护后的名单、数值、特性、招式和道具。
- [GameWith 中文道具资料](https://gamewith.ai/pokemon-champions/zh-hans/items)及[宝可梦资料](https://gamewith.ai/pokemon-champions/zh-hans/pokemon)：补充名称和缺失形态图片的对应关系，不作为全量官方数据声明。
- 宝可梦小图来自 Pokémon Showdown 静态资源及 GameWith 图片资源；新增图片逐项来源记录在 `src/data/sprites.json`。角色图像及名称相关权利不因代码使用 MIT 而转移。
- 默认背景由用户提供，保留原图；其公开分发许可尚未核实。
- 洛托姆 Logo 由用户提供，原图保存在 `public/rotom-logo.webp`。`node scripts/make-icons.mjs` 导出浏览器、Apple 主屏幕和 PWA 图标，只转换尺寸和图标底色，不重绘角色；公开分发许可尚未核实。

本项目未获宝可梦官方背书，不属于官方产品。
