# 发音小乐园

面向小学生的音标和例词学习网页。原生 HTML / CSS / JavaScript，无运行依赖、无账号、无数据库、无外部字体或 CDN。支持 GitHub Pages 项目子目录。

## 当前完成情况

- 44 个传统英式教学音标，元音 20 个、辅音 24 个；每个音标 3 个可点读例词、中文释义、相关字母着色。
- 分组、搜索、点击播放逻辑、单段播放、成功播放后记录已听音标。
- 手机布局、主屏幕图标、使用说明、离线页面、音频批量保存与失败重试。
- **实际录音已完整接入**：44 段音标 + 109 段去重单词 = 153 段，共 2,384,333 字节（约 2.4 MB），全部本地播放，无在线朗读依赖。
- 音标体系是音标入门，不包含连读、弱读等音变课程。`/ʊə/` 使用传统教学分类；`/ʒ/` 等音标的例词稍难。
- 完成音频完整性、逐文件解码、HTTP 读取及离线逻辑自动检查；包含移动 Safari 使用的音频字节范围请求。浏览器预览工具受当前环境限制，尚未完成目视验证、逐条听检和 Android / iPhone 真机验收。

## 本机预览

在项目文件夹运行：

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

电脑浏览器打开 `http://127.0.0.1:4173/`。不要直接双击 HTML 文件，模块和离线缓存需要 HTTP 服务。

手机正式使用请部署到 HTTPS 网站。手机通过局域网 HTTP 地址访问电脑时，一般不能注册离线服务；电脑 localhost 是浏览器允许的开发例外。

## 已接入的本地素材

主要素材来源为用户提供的 `phonetic_symbol_web-main`：

- `phonetic_words.json`：原始音标与例词表，包含的录音标识已与真实单词分开。
- `words-voice/`：181 个源音频，与单独提供的 `words-voice` 目录逐字节相同。
- `english-ipa-main/public/audio/`：通过 SHA-256 校准音标对应关系，避免 `/j/` 和 `/dʒ/` 等文件名混淆。
- 原项目还包含 48 段视频（约 15.9 MB）；当前离线点读包使用音频，保持首次保存体积小。
- 保留 MIT 许可及署名：`THIRD_PARTY_NOTICES.txt`；页面有“音频来源”入口。

抽查源文件确认其 `.mp3` 扩展名下实际是 AAC。已将选用录音统一转为真正的 MP3：44.1 kHz、单声道、96 kbps。转换不修改原目录，也不使用合成或假音频。

重新导入（需要系统 FFmpeg，或已安装的 imageio-ffmpeg；可用 `--ffmpeg` 指定路径）：

```powershell
python tools/import_local_audio.py
```

默认读取同级 `phonetic_symbol_web-main` 和 `english-ipa-main`；可用 `--upstream`、`--reference`、`--voices` 指定位置。

`audio/lesson-mapping.json` 保存每个音标的原始课程编号、原例词和当前例词；为优先使用简单且有录音的词，部分例词经过替换。`audio/required-clips.csv` 保存单词与实际录音文件的对应关系；`audio/manifest.json` 还保存源文件与输出文件的 SHA-256。

## 将来补充其他音频（可选）

现有点读版本已不需要另外寻找音频。若以后使用 Anki 卡组，可按下面流程处理。

1. 提供具体 Anki 卡组/资源仓库链接，核对音频来源和许可。AnkiDroid 程序的 GPL 许可不自动覆盖第三方卡组或词典音频。
2. 获取 `.apkg`，选择包含媒体；若使用以下提取工具，请在 Anki 桌面端导出时同时开启兼容旧版本选项。
3. 将音频先提取到网页文件夹之外：

```powershell
python tools/extract_anki_audio.py D:/materials/english.apkg --output D:/materials/english-review
```

工具输出音频、`inventory.csv` 和 `notes.csv`，方便对应单词和录音。不会自动发布或安装未核对素材。现代压缩格式如不兼容，工具会提示重新导出；不直接解压所有文件，避免卡组文件名造成路径问题。

4. 人工听检口音、完整性、清晰度，去掉提示语和多余静音。优先选 MP3，以兼容不同手机。
5. 将选定文件放入 `audio/files/`，在 `audio/manifest.json` 中加入映射和来源。例如：

```json
{
  "version": "2",
  "accent": "British English",
  "sources": [
    {
      "id": "reviewed-source",
      "name": "实际来源名称",
      "url": "实际来源网址",
      "license": "实际许可或取得的使用授权"
    }
  ],
  "clips": {
    "phoneme-ae": {"path": "audio/files/phoneme-ae.mp3", "sourceId": "reviewed-source"},
    "word-cat": {"path": "audio/files/word-cat.mp3", "sourceId": "reviewed-source"}
  }
}
```

每个不同单词只保存一段音频，多个音标卡片复用。当前使用 **44 段音标 + 109 段单词 = 153 段录音**，详见 `audio/required-clips.csv`；完整所需 ID 也由 `content.js` 的 `clipIds` 导出。增加或替换音频时递增 manifest 的 `version`；音频请求带版本，防止使用旧录音。来源要求署名时还需补充可见的署名页面/链接。

校验映射、文件和来源：

```powershell
python tools/check_audio.py
python tools/check_audio.py --require-complete
```

前者检查已接入的映射，后者要求每段所需录音都齐全。两种检查在当前版本均应通过。

## GitHub Pages 免费发布

1. 将本目录的内容放到一个 GitHub 仓库的根目录；免费方案可选公开仓库。
2. 仓库 Settings → Pages → Build and deployment → Deploy from a branch。
3. 选择实际使用的分支，以及 `/ (root)`，保存。
4. 发布完成后访问 GitHub 显示的 HTTPS 地址。无需构建命令，`.nojekyll` 已提供。

若将整个 `happy-phonics` 文件夹放在一个更大的仓库里，建议调整部署目录或使用 Actions 上传本文件夹；最简单的是让本项目直接成为仓库根目录。

**发布前不要将未获准公开分发的音频和整个 Anki 卡组提交到公开仓库。** 仅能家庭使用的素材不等同于可以公开发布。

### 可选：GitHub Actions 自动检查与发布

项目也参考上游准备了 `.github/workflows/pages.yml`。仓库 Settings → Pages → Source 选择 **GitHub Actions**，推送到 `main` 或手动触发后会先检查音频完整性，再发布页面、图标、录音和署名。打包采用明确的文件列表，不把开发工具或参考项目整个目录传到站点。当前只生成了配置，尚未创建远程仓库或发布网站。

## 离线机制和版本更新

- Service Worker 在首次成功联网时缓存页面、代码、图标和音频清单；全部文件缓存成功才完成安装。
- 音频要点击“保存到本机”批量保存。支持最多三路下载、单文件超时、断点重试；失败和部分接入不会显示为“全部已保存”。
- 点播会优先读取已保存音频，缺少的音频联网播放。点播本身不等同于完成全部离线保存。
- 下载过程中请保持页面开启。清理浏览器数据或系统回收存储后需要重新保存；PWA 无法承诺永久保留。
- 改动页面、样式、代码、内容或图标时，递增 `sw.js` 中 `VERSION`，并同步 HTML、模块导入及离线文件表中的 `?v=` 版本；测试会检查这些地址一致。新版本安装完成后刷新页面。音频变更同时更新音频清单版本。
- 只清理本项目自己的旧页面缓存，不触碰同一网站其他项目的缓存或已下载音频。
- 图标为项目自绘，页面代码不依赖第三方 CDN；录音及例词数据的来源说明随页面离线保存。

## 托管选择

| 选择 | 成本与适用情形 | 国内网络 |
| --- | --- | --- |
| GitHub Pages | 公共仓库的免费首版，发布简单 | 不承诺大陆各地/运营商稳定访问，需实测 |
| Cloudflare Pages | 可用免费方案，可作备选入口 | 免费全球网络不等于中国大陆节点加速 |
| 阿里云 OSS / 腾讯云 COS 等国内对象存储 + HTTPS 自定义域名 | 域名、存储、请求和流量按实际计费，注意最低费用及 CDN 附加费用 | 采用国内地域/节点，按服务商要求完成备案等配置，更适合长期稳定访问 |

第一阶段建议使用 GitHub Pages，并让家人用移动、联通、电信/Wi-Fi 实际打开测试。首次下载完成后优先离线使用。若初次访问不稳定，再迁移到国内托管；代码和素材结构无需重做。

不建议把 Cloudflare 免费版视为国内稳定性保障。其 China Network 是独立的企业订阅服务。

## 验证

```powershell
npm ci --ignore-scripts
node --test tests/*.test.js
python -m unittest discover -s tests -p "test_*.py"
python tools/check_audio.py
```
