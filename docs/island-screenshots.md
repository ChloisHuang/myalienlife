# 星岛截图程序

仅截图指定编号的岛，不批量重拍其他岛，不覆盖 README 的现有图片。

```sh
# 查看当前存档的编号、内部 ID 和名称
npm run screenshot:island -- --list

# 只拍第 2 座岛的正反面
npm run screenshot:island -- --island 2

# 只拍背面，改变居民随机摆位
npm run screenshot:island -- --island 2 --side back --seed 42
```

编号从 1 开始，按当前存档的已发现岛屿顺序排列。必须显式指定编号；不存在的编号直接报错，不创建或解锁新岛。

## 截图规则

- 与 README 图片相同的 1920 × 1080 全场景范围，沿用游戏默认正交镜头，无 HUD、无二次裁切。
- 读取 `.data/orbit-life.json` 的一次快照，保留所有物品的位置、朝向、植物状态及建设进度。
- 固定正午 12:00、孢子风天气；独立动画时钟让居民、孢子和 UFO 有动作，但不推进日历、生产或建设。
- 每张图临时停靠一艘三级「方舟 UFO」，居民使用存档中的在世角色，随机安排空地行走及可用设施互动。
- 同一存档与随机种子可重现摆位；居民太多、空间不足时明确报错，不移动物品腾地方。
- 所有摆拍改动只发生在内存副本。独立临时 Vite 服务不加载存档 API，浏览器禁止访问 `/api/`，退出时自动关闭，不占用现有游戏端口。

## 输出

默认目录为 `artifacts/island-screenshots/`：

- `island-02-front.png`
- `island-02-back.png`
- `island-02.json`：输入快照 SHA-256、岛名、种子、画幅、建设进度和居民动作记录。

可用 `--save <路径>` 指定另一份相同格式的存档，`--output <目录>` 指定输出目录。默认浏览器为本项目使用的 Edge；也支持 `--browser chrome` 或 `--browser chromium`，相应浏览器需已安装。

脚本会检查 JavaScript/着色器错误、实际画布尺寸及像素内容。它不会发布 VPS，也不会改动第一座岛或 README 中的截图。
