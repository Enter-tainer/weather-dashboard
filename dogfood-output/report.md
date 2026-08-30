# Dogfood Report: Weather Dashboard — E-ink Mode

| Field       | Value                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------- |
| **Date**    | 2026-08-30                                                                                        |
| **App URL** | `http://localhost:5174/?fixture=default&display=eink`                                             |
| **Session** | `weather-eink`                                                                                    |
| **Scope**   | 纯黑白墨水屏模式、800×480/1280×720 视口、真实日期路线、tooltip、Skew-T、截图渲染和普通 light 回归 |

## Summary

本轮 dogfood 共记录 5 个视觉/交互问题，均已在本地实现中修复并复测。

| Severity  | Count |
| --------- | ----- |
| Critical  | 0     |
| High      | 0     |
| Medium    | 3     |
| Low       | 2     |
| **Total** | **5** |

## Findings

### ISSUE-001: 小视口下固定工具按钮遮挡时间轴（已修复）

| Field           | Value                                                 |
| --------------- | ----------------------------------------------------- |
| **Severity**    | medium                                                |
| **Category**    | visual / responsive                                   |
| **URL**         | `http://localhost:5174/?fixture=default&display=eink` |
| **Repro Video** | N/A                                                   |
| **Status**      | Fixed                                                 |

800×480 下原有固定工具按钮横排在右上角，会遮挡城市名和时间轴。墨水屏模式现在隐藏常驻悬浮工具，URL 参数和普通 color 模式不受影响。

证据：

- 修复前：[eink-800x480.png](screenshots/eink-800x480.png)
- 修复后：[eink-800-finalish.png](screenshots/eink-800-finalish.png)

### ISSUE-002: 云量点阵与高度网格虚线混淆（已修复）

| Field           | Value                                                 |
| --------------- | ----------------------------------------------------- |
| **Severity**    | medium                                                |
| **Category**    | visual / readability                                  |
| **URL**         | `http://localhost:5174/?fixture=default&display=eink` |
| **Repro Video** | N/A                                                   |
| **Status**      | Fixed                                                 |

纯黑白下云量点阵和云层高度虚线都呈现为黑色短点。墨水屏模式将 CloudAndRainLane 的高度网格改为连续细实线，边界线保留粗线，云量点阵继续表达填充强度。

证据：[eink-revised.png](screenshots/eink-revised.png)、[eink-header-validated.png](screenshots/eink-header-validated.png)

### ISSUE-003: CAPE、AQI、能见度和 AOD 文字可读性不足（已修复）

| Field           | Value                                                          |
| --------------- | -------------------------------------------------------------- |
| **Severity**    | medium                                                         |
| **Category**    | visual / readability                                           |
| **URL**         | `http://localhost:5174/?route=Beijing:2026-08-30&display=eink` |
| **Repro Video** | N/A                                                            |
| **Status**      | Fixed                                                          |

底部指标原先使用纹理铺底或过小字号，导致文字与纹理粘连。现在恢复跨泳道网格可见性，移除文字底部纹理，AQI/能见度字号提高，AOD Canvas 标签提高到 8px。

证据：[eink-lower.png](screenshots/eink-lower.png)、[eink-bottom-fonts-cape.png](screenshots/eink-bottom-fonts-cape.png)

### ISSUE-004: 日出日落标签、UV 标签缺少稳定白底保护（已修复）

| Field           | Value                                                 |
| --------------- | ----------------------------------------------------- |
| **Severity**    | low                                                   |
| **Category**    | visual / readability                                  |
| **URL**         | `http://localhost:5174/?fixture=default&display=eink` |
| **Repro Video** | N/A                                                   |
| **Status**      | Fixed                                                 |

太阳事件和 UV 数字在黑白图层上容易与竖线、背景纹理混在一起。现在使用白底黑边的 3px 圆角矩形；小时数字使用白色文字描边保护，保留后方框线连续性。

证据：[eink-initial.png](screenshots/eink-initial.png)、[eink-header-current.png](screenshots/eink-header-current.png)

### ISSUE-005: 曙暮光纹理在小时间段边界处不连续（已修复）

| Field           | Value                                                 |
| --------------- | ----------------------------------------------------- |
| **Severity**    | low                                                   |
| **Category**    | visual                                                |
| **URL**         | `http://localhost:5174/?fixture=default&display=eink` |
| **Repro Video** | N/A                                                   |
| **Status**      | Fixed                                                 |

墨水屏模式不再渲染多级曙暮渐变，只按太阳高度使用白天空白/夜间点阵两态，并把相邻 15 分钟片段合并为一个连续夜间区间。

证据：[eink-twilight-uniform.png](screenshots/eink-twilight-uniform.png)、[eink-continuous-night-dots.png](screenshots/eink-continuous-night-dots.png)、[eink-dots-twilight.png](screenshots/eink-dots-twilight.png)

## Functional Checks

- `display=eink` 生效，`compact` 和 `timeCompact` 默认状态不被隐式修改。
- 非 compact 模式仍渲染 15 条完整 lane。
- `WeatherAmbientBackground` 在 eink 下不挂载，普通 color 模式仍挂载。
- Weather tooltip 显示候选天气名称和概率，背景为白色。
- 真实日期路线的 CurrentTimeIndicator 实际位置为 y=74px，避开时间轴表头。
- Skew-T 抽屉可以打开，Canvas 存在，黑白表面样式生效。
- capture URL 可生成完整墨水屏渲染，`data-capture-ready=true`。
- 普通 light 模式仍显示 ambient layer，15 条 lane 保持不变。
- 控制台未发现应用异常或未处理错误。
