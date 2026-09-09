# GitLab Pages 发布进度

记录日期：2026-09-08。

- 目标仓库：https://gitlab.com/yuanhaoyang86/pmc
- 仓库 ID：86200441；可见性：public；默认分支：main。
- 发布提交：237b4587734f65f0135dade52c766783b8d1ccff。
- Git push 已成功，远端 main 已回读确认等于上述提交。
- 发布副本：output/pages-publish；保留远端 Initial commit 历史，没有强制推送。
- 62 项现有 Node 测试再次通过；未修改业务逻辑、页面或样式。
- 流水线：https://gitlab.com/yuanhaoyang86/pmc/-/pipelines/2827903687
- 状态：failed；任务数量：0；yaml_errors：null。
- 公开流水线 JSON 的 failure_reason：The pipeline failed due to the user not being verified.
- 结论：代码已上传，GitLab 账号验证阻止 CI 启动。网站尚未完成 Pages 发布，未确认 Pages 公网地址。
- 下一步：用户在 https://gitlab.com/-/identity_verification 完成平台要求的账号验证，不购买付费套餐或构建额度；然后创建新的流水线并验证构建、发布、HTTPS 和网页运行。
- GitHub 备用站和 EU.org 绑定尚未执行。

验证接口：GitLab public project API、pipelines API、jobs API、流水线 .json 页面。只读取所需公开状态，未获取或输出本机 Git 凭据。

## 账号验证后的重试

- 用户完成账号验证后，推送空提交 d314b6d6af5d962b36c07f2ac0eab7fbc0694441，未修改任何网站文件。
- 新流水线：https://gitlab.com/yuanhaoyang86/pmc/-/pipelines/2827914735
- 流水线状态：success，duration：33 秒；deploy-pages 任务 16356014739 状态 success。
- 未认证请求 https://yuanhaoyang86.gitlab.io/pmc/ 返回 302，Location 指向 projects.gitlab.io/auth，最终进入 GitLab 登录。因此还不能认定网站已对公众开放。
- 已通过用户先前授权的 Git 凭据尝试读取本项目设置。API 返回 insufficient_scope，现有推送授权不含 read_api/api。凭据只在进程内使用，未输出、未写入文件；未扩大授权。
- 下一步：用户在 GitLab 项目 Settings → General → Visibility, project features, permissions，将 Pages 从 Only project members 改为 Everyone with access（公开项目），保存后再次检查匿名访问。
- GitHub 备用站和 EU.org 绑定仍未完成；尚未通过线上浏览器功能检查。

## Pages 已对公众开放

记录日期：2026-09-08。

- GLab 官方网页授权完成，凭据保存在操作系统凭据管理器；未写入网站源码或输出到聊天。
- 项目 yuanhaoyang86/pmc 的 pages_access_level 从 private 改为 enabled；项目 visibility 仍为 public。回读确认成功。
- GitLab Pages API 返回实际网址：https://pmc-babb04.gitlab.io
- force_https：true；is_unique_domain_enabled：true；pages_primary_domain：null。
- 匿名访问 https://yuanhaoyang86.gitlab.io/pmc/ 返回 308，重定向到 https://pmc-babb04.gitlab.io/，不再转到登录认证。
- 匿名访问最终网址返回 HTTP 200，标题为“PMC · 宝可梦冠军计算器”。
- 首页引用的 JS、CSS、32/180 图标和 manifest 均经匿名 HTTPS 请求验证为 200。
- 本次仅修改平台 Pages 访问权限，未修改网站源码、UI 或业务逻辑。
- 线上浏览器逐项交互及真实大陆多网络访问仍未验证；GitHub 备用站、EU.org 域名尚未上线。
- 权限回读证据：output/pages-audit/pages-public-access.json。
