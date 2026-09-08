# PMC 免费 Pages 部署与切换指南

本次适配日期：2026-09-07。项目目录保持原样；未初始化 Git、创建远端仓库、上传代码或绑定域名。以下 YOUR_NAMESPACE、YOUR_USERNAME、YOUR_PROJECT、YOUR_DOMAIN.eu.org 都需要替换，不能原样提交到平台设置。

## 1. 原项目检查

| 项目 | 检查结果 |
| --- | --- |
| 技术栈 | React 19、Vite 7、JavaScript/JSX、CSS；pnpm 锁定依赖；@smogon/calc、lucide-react、pinyin-pro |
| 页面 | 伤害计算、公开阵容、配置库、已存场景、设置，共五个导航入口 |
| 后端 | 无业务后端。scripts/serve.mjs 是本地静态预览服务，不需要上传运行 |
| 数据库 | 无远程数据库。localStorage 保存配置/场景，IndexedDB 保存自定义背景 |
| 第三方 API | 日常计算不调用远程 API；维护脚本会获取第三方资料，正常构建不运行这些脚本 |
| 静态平台限制 | 现有网页功能均适合静态托管。Android 原生桥仅供 APK，网页已有 Blob 下载分支；Pages 不负责生成 APK |
| 开发 | pnpm dev（等价 npm run dev） |
| 构建 | pnpm run build（等价 npm run build），执行 vite build 和 scripts/build-sw.mjs |
| 测试/预览 | pnpm test / pnpm preview |
| 部署目录 | dist/。源码 public/ 是构建输入，不能直接把它当成完整网站发布 |
| 路由 | React 状态切换页面，不使用 BrowserRouter、history.pushState 或路径路由；刷新保留原有回到初始视图的行为 |

原结构：src/ 保存界面、计算核心、Worker、数据和本地存储代码；public/ 保存精灵图、背景、图标、PWA manifest 和许可证；scripts/、tests/、android/、vendor/、docs/ 保留原用途。

资源检查：Vite 原来已经设置 base: "./"。入口 /src/main.jsx 和 CSS 中 /backgrounds/... 由 Vite 构建转换，实际产物引用为相对路径。精灵图使用 BASE_URL，logo/favicon/manifest 使用相对路径，Worker 由 Vite 打包，JSON 数据通过模块内置，Service Worker 的缓存路径与 scope 兼容子目录。没有写死 GitLab/GitHub 站点地址、canonical、Open Graph URL 或跳转目的站。

没有添加通用 404.html：当前没有可刷新的 history 子路由，复制首页到未知深路径会让相对资源路径出错。访问 /任意不存在的路径 返回 404 是正常行为；使用平台展示的正式入口，项目路径保留结尾斜杠。

## 2. 文件变更

新增：

- .gitlab-ci.yml：Node 24 + pnpm 11.19.0，冻结锁文件安装、测试、构建；仅在临时 CI 工作区把原 public 改名保留，再把 dist 移为 public 发布。Pages 不自动过期。
- .github/workflows/deploy.yml：同样版本、锁文件和构建命令；仅使用 GitHub 官方 Actions；发布 dist。
- docs/免费Pages部署指南.md：本说明。

修改：

- pnpm-workspace.yaml：把 esbuild 的许可占位字符串改为 true，允许安装必要的构建工具。
- .gitignore：增加 pnpm 缓存、环境文件、私钥/证书容器、Android 签名文件及本机配置排除项；保留原规则。

未修改：src/、public/、android/、vendor/、原 scripts/、tests/，以及 package.json、pnpm-lock.yaml、vite.config.js、index.html。444 个原文件通过前后 SHA-256 校验。没有删除页面、按钮、选项、异常处理、样式、资源或业务逻辑。全新依赖构建与原 dist 的 335 个文件逐一哈希相同。

output/pages-audit/ 保存本次检查脚本和结果；output/pages-clean/ 是隔离安装/构建副本。它们受 output/ 忽略规则保护，不上传。没有删除其他已有文件。

## 3. 0 元方案及边界

使用 GitLab.com Free 和 GitHub Free 的公开仓库、默认托管 Runner、免费 Pages HTTPS；不购买域名、服务器、付费 Runner 或构建额度。GitLab 免费计算额度耗尽后等待额度恢复，或暂用 GitHub，不购买额外分钟。不要启用付费服务。免费服务仍有使用限额、风控及平台条款，不能承诺永久不限量。

GitLab 新账号能否直接使用共享 Runner、是否需要身份验证，以该账号后台为准。尚未登录验证。GitHub Free 的 Pages 使用公开仓库；源代码及内置资料会公开。参考：[GitLab Pages](https://docs.gitlab.com/user/project/pages/)、[GitLab 计算额度](https://docs.gitlab.com/ci/pipelines/compute_minutes/)、[GitHub Pages 工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

EU.org 官网提供免费域名申请，但不保证本次申请获批或审批时间。域名获批前，两边默认 HTTPS 地址可以先用。[EU.org 官网](https://nic.eu.org/)

## 4. GitLab 主站部署

1. 登录 GitLab.com → New project → Create blank project。选择 Free，创建公开项目；不要勾选初始化 README，默认分支使用 main。
2. 在本机项目目录执行下面的命令。当前目录尚无 .git，因此第一次需要 init。仓库地址从 GitLab 项目页 Code → Clone with HTTPS 复制，不要把 Token 填进地址。

```powershell
git init -b main
git add .
git status --short
git diff --cached --stat
# 确认暂存列表没有 output、node_modules、.env、签名文件或其他私人资料后执行：
git commit -m "Add free GitLab and GitHub Pages deployment"
git remote add gitlab https://gitlab.com/YOUR_NAMESPACE/YOUR_PROJECT.git
git push -u gitlab main
```

3. Build → Pipelines 查看 deploy-pages 任务。流水线会自动安装、跑 62 项测试并构建；失败时打开任务日志。
4. Deploy → Pages 查看实际网站地址。GitLab 可能分配带项目标识的唯一域名，以此页面显示值为准，不猜测 username.gitlab.io 是否就是最终地址。
5. Settings → General → Visibility, project features, permissions 检查 Pages 访问权限，允许公众访问；不要开启必须登录的访问控制。
6. 以后推送默认分支自动部署。GitLab 的 YAML 使用 CI_DEFAULT_BRANCH，不依赖固定分支名称。可在 Build → Pipeline editor → Validate 验证平台完整语义。

默认 Pages 地址自带 HTTPS。自定义域名证书设置见第 6 节。

## 5. GitHub 备用部署

1. GitHub → New repository → Public；使用 Free，创建空仓库，不添加 README。
2. 仓库 → Settings → Pages → Build and deployment → Source 选择 GitHub Actions。
3. 在同一份本机仓库执行：

```powershell
git remote add github https://github.com/YOUR_USERNAME/YOUR_PROJECT.git
git push github main
```

4. Actions → Deploy GitHub Pages 查看执行状态；Settings → Pages 查看访问地址。
5. 工作流接受 main/master 的 push，但只发布仓库默认分支。若使用其他分支名称，同时调整工作流 branches 和仓库默认分支；也可通过 Actions → Run workflow 手动执行默认分支。
6. 以后每次改动提交一次，再推送两边，保持版本一致：

```powershell
git add .
git diff --cached --stat
git commit -m "Update PMC"
git push gitlab main
git push github main
```

两个远端不会自动同步彼此的提交。此方案不需要镜像 Token，也不引入收费同步服务。两边必须部署同一提交；不要只更新主站而让备用站长期停留在旧版本。

本机安装建议 Node 24 + pnpm 11.19.0，运行 pnpm install --frozen-lockfile。已有 pnpm-lock.yaml，不新增 package-lock.json。普通安装了 npm 的电脑可先运行 npm install --global pnpm@11.19.0。

## 6. EU.org 绑定和 DNS

域名成功申请后，先选择支持 EU.org 域名的免费权威 DNS 托管，按 DNS 商分配的 NS 在 EU.org 后台完成委派。这里只要求免费 DNS，不需要购买 CDN；不要填写未经平台分配的 NS。若服务要求付费，停止该服务的流程，先使用默认 Pages 地址。

GitLab：Deploy → Pages → New domain，填写实际域名，例如 YOUR_DOMAIN.eu.org（不带 https:// 或路径）。按页面提示配置 DNS 和验证 TXT，点击验证；开启 Let's Encrypt 自动证书。证书生效后启用 Force HTTPS。为保留 GitLab 默认域名独立访问，避免设置把全部请求重定向到自定义域名的 Primary domain。

GitHub：头像 → Settings → Pages → Add a domain，先按提示添加验证 TXT；然后仓库 Settings → Pages → Custom domain 填同一实际域名。证书签发完成后勾选 Enforce HTTPS。DNS 尚未指向 GitHub 时，检查/证书签发可能不能完成，需安排首次切换演练。

本方案采用 GitHub Actions 部署，GitHub 官方说明 CNAME 文件不需要且会被忽略；GitLab 也在平台后台绑定。因此没有生成会错误启用占位域名的 public/CNAME，域名不写入网站源码。[GitHub 自定义域名](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)

| 记录 | 用途 | 实际填写位置与取值 |
| --- | --- | --- |
| NS | 指定谁托管 DNS | 免费 DNS 商分配；在 EU.org 后台设置 |
| A | 域名指向 IPv4 | 主站用 GitLab Pages 域名设置提示/官方文档值；切备用时用 GitHub 官方 Pages 地址表的全部 A 值 |
| AAAA | 指向 IPv6，可选 | 与当前主站保持一致；切换时同步更换或删除旧值，避免部分用户仍访问旧平台 |
| CNAME | 子域名指向平台主机名 | GitLab 按 Pages 域名设置提示；GitHub 指向 YOUR_USERNAME.github.io，不含协议、斜杠或仓库名 |
| TXT | 验证域名所有权 | GitLab 的 _gitlab-pages-verification-code 和 GitHub 的 _github-pages-challenge-用户名 对应记录名/值都复制各自后台显示内容；保留两边验证记录 |
| ALIAS/ANAME/扁平化 | DNS 商支持时用于根域名指向主机名 | 先确认 DNS 商支持及免费；平台目标值同对应 Pages 主机名 |

YOUR_DOMAIN.eu.org 对你的 DNS 区域是根域（@），不能因为域名有多个点就直接给 @ 添加普通 CNAME；根域优先按平台官方说明设置 A，或用 DNS 商支持的 ALIAS/扁平化。www.YOUR_DOMAIN.eu.org 才是子域名，通常可使用普通 CNAME；若需要 www，也要在托管平台按要求添加。

本次没有真实账号域名，故不填真实 DNS 数值。查询：[GitLab 域名与 DNS](https://docs.gitlab.com/user/project/pages/custom_domains_ssl_tls_certification/)、[GitHub DNS 地址表](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site#dns-records-for-your-custom-domain)、[GitHub TXT 验证](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)。

## 7. 切换主站的实际条件

代码已兼容两边默认地址、自定义域名及项目子目录。DNS 切换不需要改 base、资源地址、API 或重新构建。

但“长期备用后只改 DNS，并立即保持 HTTPS 可用”不能由项目代码保证：GitHub 首次证书签发和平台自动续期可能依赖域名当前指向，DNS 长期指向 GitLab 时，备用证书可能尚未签发或已经过期。双平台证书应事先演练并在切换前检查；必要时还要在后台完成证书签发/域名检查。免费 Pages 本身不提供跨平台无缝热备保证。[GitLab 自动证书要求](https://docs.gitlab.com/user/project/pages/custom_domains_ssl_tls_certification/lets_encrypt_integration/)

实际切换：

1. 确认两边最新流水线成功、发布同一提交，备用站计算正常。
2. 确认 GitHub 已绑定实际域名、TXT 仍有效，并检查该域名的 HTTPS 证书。若证书未就绪，安排维护窗口，不承诺零中断。
3. 提前降低 DNS TTL，例如 DNS 商允许时设为 300 秒，并等旧 TTL 过期。
4. 把 @ 的 A/AAAA 或 ALIAS 从 GitLab 换成 GitHub；若使用 www 的 CNAME，也一起修改。不要混合两家 A 记录作为随机分流。保留双方验证 TXT 和 NS。
5. 等待传播，用不同网络检查 HTTPS、计算、导出和离线更新。需要回滚时恢复保存的 GitLab DNS 值，并确认主站证书有效。

GitHub 绑定自定义域名后，默认 github.io 地址可能重定向到该域名，因此无法同时保证同一仓库的默认地址永远是独立备用入口。要保留独立入口，可另建不绑定域名的免费公开 Pages 站并发布相同源代码；这不是本次自动创建的第三个站点。暂时不绑定 GitHub 自定义域名可以保留直接备用地址，但首次切换就需要后台绑定操作。

同一个 HTTPS 自定义域名切换 DNS，浏览器 origin 不变，本地配置通常仍可用；直接从 gitlab.io 切到 github.io 或第一次换成自定义域名，属于不同 origin，本地记录和自定义背景不会自动迁移。切换前使用现有 JSON 导出/导入，背景按原功能重新选择。不会增加收费数据库来同步。

## 8. 大陆访问及安全

没有加载 Google Fonts、Google Analytics、reCAPTCHA、YouTube、Google Maps、jsDelivr、unpkg、cdnjs 的运行资源。字体使用系统字体；React、图标库、计算库通过构建内置。315 张精灵图及背景、Logo 已在本地，不需要重新下载或替换视觉资源。

仍保留的外部链接包括 GitHub、Google Sheets、X、pokepast.es、munchstats.com、Limitless VGC、RK9、Champions Companion、宝可梦公告来源及 QQ 邀请链接；点击来源/完整配招/讨论群时才访问，不影响已内置的计算和公开阵容。来源网站可能在大陆不可达，不能据此保证外链可用。

维护脚本依赖 GitHub API/raw、Pokémon Showdown、GameWith、Google Sheets 等，属于资料更新流程；CI 仅安装、测试、构建，不自动拉取这些资料。npm registry、GitHub Actions 和 GitLab Runner 仅影响构建端。首次网页访问仍依赖境外 Pages 主机，国内运营商/地区/时段可能出现不稳定。免费域名不会改变主机线路，也不保证解封；PWA 必须先成功加载并缓存，不能解决首次打不开。

无需设置任何业务环境变量或密钥：GitLab Settings → CI/CD → Variables 留空；GitHub Settings → Secrets and variables → Actions 不需添加 Secret。GitHub 用平台临时 GITHUB_TOKEN/OIDC，GitLab 使用本项目 CI 授权。不要设置 VITE_PMC_ANDROID=true（仅 APK 打包使用）；VITE_ 变量会进入前端，不能存密钥。

已在临时 Git 仓库实际验证 .env、output、pnpm 缓存、node_modules、dist 和签名文件均会被忽略。本次对源文件执行常见密钥模式扫描，未发现 API 私钥、GitLab/GitHub Token 或 npm 认证 Token；这不是全面历史泄密审计，因为当前没有 Git 历史。QQ 邀请链接自带公开分享参数，是既有按钮功能，不是 CI 密钥，按原样保留。output/ 中的历史部署工具、授权配置、APK 与工具缓存不应提交，已由既有忽略规则排除。不要使用 git add -f 强制添加。

## 9. 验证结果与边界

- 安装：成功。隔离空 node_modules 的副本使用 pnpm 11.19.0 和 --frozen-lockfile 安装，25 个依赖包完成；复用本机包存储，不等同于全部重新从网络下载。
- 测试：成功。现有 62 项 Node 测试全部通过，含计算规则、配置导入校验、场景、公开阵容、资源完整性、网页/Android 导出分支。
- 构建：成功。Vite 完成 1619 模块构建；335 个最终文件，含 Service Worker。存在原有 1500 kB 分块体积提示，未改 UI 或拆分业务来消除提示。
- 静态检查：成功。两份 CI YAML 和 pnpm-workspace.yaml 均经 YAML 解析器实际解析；444 个原源文件哈希未变，隔离构建产物与原 dist 完全一致。
- 页面资源：成功。Chromium 在严格静态服务器对 / 和 /pmc/ 各检查 335 个文件，均 HTTP 200；五个页面在 1440×900、390×844、844×390 均可切换且无水平溢出；Worker 计算、两种 PNG 导出、PWA 子目录 scope、离线刷新重新启用试算均通过；无页面脚本错误、无失败响应、无外部运行资源请求。
- GitLab Pages 配置：本地 YAML 解析成功，按官方语法静态核对；该项仅完成静态检查，尚未实际验证平台流水线、Runner 权限和公网发布。
- GitHub Pages 配置：本地 YAML 解析成功，官方 Actions/权限/产物路径静态核对；该项仅完成静态检查，尚未实际验证平台流水线和公网发布。
- HTTPS、EU.org DNS、真实大陆网络：未实际测试，需仓库部署及域名获批后验证。
- 视觉/交互边界：原界面文件逐字节保留；验证了上列交互及响应式尺寸，没有声称逐个人工点击所有组合或完成逐像素视觉审查。

环境及内部修正记录：安装首次受沙箱联网限制，获准后完成；构建首次受 Windows 父目录读取限制，在允许的执行环境完成；旧根目录 pnpm 依赖状态检查要求重装，未强制清空用户 node_modules，改用隔离副本。离线检查初稿误以为刷新后仍启用社区试算，依据现有 useState(false) 修正检查步骤，未修改产品行为。

证据：output/pages-audit/static-results.json、output/pages-audit/browser-results.json。本次网页/业务内部修改 0 次；部署配置按官方 Action 版本核对修订 1 次，测试步骤修正 1 次。所有结论仅对应本次本机检查，不代表已上线。

