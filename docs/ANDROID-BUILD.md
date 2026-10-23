# Android 构建说明（当前 1.4.0）

当前包名 `cn.pmc.calculator`，versionCode 8，最低 Android 8.0，需近期 Android System WebView。现有本机正式 APK 保留原签名；本轮仅生成未签名验证产物，没有更新正式安装包。

```powershell
pnpm install --frozen-lockfile
./scripts/setup-android.ps1
node scripts/build-android.mjs --unsigned
python scripts/verify-android.py output/android-unsigned/build-info.json
```

`--unsigned` 输出到 `output/android-unsigned/`，不会读取或创建正式签名文件，也不能直接安装。脚本会准备 OCR worker、四种含 WASM 的 JS 和五语模型，校验器强制检查全部 11 项、350 张精灵图及打包字节。

正式构建命令仍为 `node scripts/build-android.mjs`；它会访问或创建私有签名。维护现有用户时必须先恢复原签名目录，不能生成替代密钥。正式签名与发布需维护者另行授权，不属于本轮执行。

网页版与 APK 本机记录独立。升级前完整导出，沿用包名与原签名覆盖安装，不先卸载；卸载或清除数据会丢失记录。背景不包含在完整 JSON 备份中。公开队伍联网更新在网页/APK 都可用；规则与应用代码更新仍需构建和发布新版本。

旧版安装与维护资料保留为 [历史说明](安卓版安装与维护.md)，其中 1.1.0 和旧构建步骤不代表当前版本。当前源码构建测试成功不等于真机安装验证；本轮未安装运行新 APK。
