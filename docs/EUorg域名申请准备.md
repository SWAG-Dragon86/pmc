# PMC EU.org 域名申请准备

日期：2026-09-08。状态：仅完成申请前检查，未创建账号，未提交域名申请，未绑定或更改现有网站 DNS。

## 名称

建议申请：pmccalc.eu.org。
此前首选 pmc.eu.org 为三字符名称，官方政策说明通常保留，仅可按个案特殊审批；不能当作普通可申请名称。pmccalc 为七字符，避开此长度限制，但仍需注册系统审核并确认可用。

本机 NS 查询 pmc.eu.org 和 pmccalc.eu.org 均返回 DNS 名称不存在。DNS 无记录不证明未注册，也不能证明申请会获批。

## 已准备的用途说明

PMC is a free, browser-based Chinese-language damage calculator for Pokémon Champions. It includes battle calculations, locally saved configurations, public team snapshots, and offline use. The requested domain will provide a short, consistent address for the website currently hosted at https://pmc-babb04.gitlab.io/.

这段说明仅为草稿，不声称官方宝可梦项目或非营利组织身份。

## 待完成步骤

1. 用户创建或登录本人 EU.org 联系账号，填写真实联系资料并完成邮箱验证。不要在聊天提供密码或验证码。官方注册表明确提醒不用 Gmail。
2. 创建免费权威 DNS 托管账号并添加拟申请域名。候选为 Hurricane Electric Free DNS；实际是否接受域名、区域是否建立成功需在后台验证。
3. 从 DNS 托管后台取得实际 NS，确认服务器已为该区域提供权威服务，再填写 EU.org 域名申请。未分配前不编造 NS 或验证值。
4. 提交申请并保存申请编号、确认页及时间；等待人工审批，不将提交等同于获批。
5. 域名获批后，使用既有 GitLab CLI 授权为 PMC 添加自定义域名，从平台获取 TXT/A 等实际记录，完成 DNS 和证书验证。沿用现有 Pages 网站，不改 UI 或核心代码。

## 申请所需本人资料

官方注册表包含 Name、E-mail、Address、Country、Phone、Fax、密码确认及 Private 选项。哪些字段必填以网页验证为准。用户应在官网填写联系信息；可按本人意愿选择 Private，避免公开 Whois 展示。没有替用户填写虚构姓名、地址或联系方式。

## 当前阻塞

- 没有 EU.org 账号/已验证联系人的信息。
- 未建立 DNS 区域，尚无已验证 NS。
- 当前 Codex 浏览器连接仍失败，不能接管 Edge 登录态。未通过脚本模拟登录、创建账号或提交表单。

## 官方来源

- 注册入口：https://nic.eu.org/arf/en/contact/create/
- 登录入口：https://nic.eu.org/arf/
- 名称限制：https://nic.eu.org/top-policy.html
- 申请流程：https://nic.eu.org/register.html
- 免费 DNS：https://dns.he.net/

原 PMC 网站仍使用 https://pmc-babb04.gitlab.io/，本次未改动其服务状态。
