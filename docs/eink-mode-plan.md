# 纯黑白墨水屏模式实施计划

本文档定义 Weather Dashboard 的纯黑白墨水屏模式。目标是在黑白墨水屏设备上保留现有高密度天气分析能力，而不是提供摘要版、卡片版或 compact 版界面。

## 1. 目标与约束

### 1.1 核心目标

- 新增 `?display=eink` 显示模式。
- 保留现有 Dashboard 的布局、泳道顺序、泳道高度、时间粒度和横向滚动方式。
- 保留温度、湿度、集合预报、云层高度、降水、CAPE、风、气压、AQI、能见度和 AOD 等全部信息。
- 仅使用黑色、白色、线型、轮廓、点阵和纹理表达原先由颜色承载的语义。
- 不强行二值化纯装饰性、低精度的环境色层；其底层数据和精确的文字/数字入口必须保留。
- 降低无意义的连续重绘，适应墨水屏刷新慢、容易残影的特点。
- 普通 light/dark 模式的外观、交互、截图和测试不得发生回归。

### 1.2 明确不做

- 墨水屏模式不自动开启 `compact=1`。
- 墨水屏模式不自动开启 `timeCompact=3/6`。
- 不裁剪时间线，不缩减预报天数，不隐藏低优先级泳道。
- 不把页面改成大卡片或“当前天气 + 几小时预报”的摘要屏。
- 不使用全局 `filter: grayscale()` 作为最终实现。
- 不依赖半透明黑色在面板上产生稳定灰阶。
- 墨水屏模式不渲染 `WeatherAmbientBackground`；该例外只移除环境色光斑，不删除 `weatherCodeMembers` 数据、天气图标或 ensemble 概率 tooltip。
- 不在第一版尝试通过网页控制设备的全刷、局刷波形；这通常需要设备系统或专用浏览器接口。

### 1.3 “纯黑白”的定义

应用主动绘制的背景、线条、填充、图标和纹理只使用：

```text
#000000
#ffffff
transparent（仅叠加在已知的纯白背景上）
```

不使用中间灰色、彩色、半透明黑色或混色。浏览器对字体和 SVG 边缘的抗锯齿可能产生少量中间像素；第一版不强制对整个页面做二值阈值滤镜，以免损伤细线和小字。最终设备若使用 1-bit framebuffer，应由设备显示管线完成最终量化。

## 2. 用户入口与模式行为

### 2.1 URL 参数

第一版使用稳定、可收藏的 URL 参数：

```text
?display=eink
```

它可以与现有参数组合：

```text
?route=Shanghai:2026-09-01&display=eink
?route=Shanghai:2026-09-01&display=eink&timeCompact=3
?route=Shanghai:2026-09-01&display=eink&compact=1
?route=Shanghai:2026-09-01&display=eink&immersive=true
```

这些组合仍然允许用户主动选择，但 `display=eink` 本身不得改变 compact、timeCompact 或 immersive 状态。

`immersive=true` 是独立的显示选项，用于隐藏浮动工具按钮；设置面板提供相同开关。未设置时，E-ink 模式仍显示正常工具入口。

### 2.2 与主题的关系

墨水屏模式是 display mode，不是第四种 theme：

- `theme=light/dark/auto` 仍按现有逻辑保存。
- `display=eink` 激活时，墨水屏渲染配置覆盖 light/dark 的可视颜色。
- 设置面板提供“墨水屏模式”开关，与 `display=eink` 参数保持同步。
- 离开墨水屏模式后，恢复用户之前的 theme，不修改其 localStorage 设置。
- 墨水屏模式下主题切换按钮可以保留，但应提示“墨水屏模式固定为黑白”；第一版也可以直接禁用该按钮，不能让它造成无意义的 Canvas 重画。

### 2.3 DOM 标记

模式生效时设置：

```html
<html data-display="eink"></html>
```

普通模式使用：

```html
<html data-display="color"></html>
```

CSS 使用 `:root[data-display='eink']` 覆盖变量和组件样式。Canvas 组件通过 React render profile 获取同一状态，避免分别读取 URL 或复制判断逻辑。

## 3. 总体架构

### 3.1 新增文件

建议新增：

```text
src/hooks/useDisplayMode.ts
src/hooks/renderProfileContext.ts
src/hooks/useRenderProfile.ts
src/hooks/RenderProfileProvider.tsx
src/services/monoPatterns.ts
src/services/monoScales.ts
src/eink.css
```

职责：

- `useDisplayMode.ts`
  - 解析 `display` 参数。
  - 输出 `'color' | 'eink'`。
  - 同步 `document.documentElement.dataset.display`。
  - 模式在运行时变化时派发 `weather-render-profile-change` 事件。
- `RenderProfileProvider.tsx`
  - 向 Canvas 和 DOM 混合组件提供统一的 `displayMode` / `isEink`。
  - 避免给每层组件手动透传 `einkMode`。
- `monoPatterns.ts`
  - 创建 Canvas 纯黑白点阵、斜线、交叉线和实心纹理。
  - CanvasPattern 与 context 绑定，使用 `WeakMap<CanvasRenderingContext2D, ...>` 缓存。
- `monoScales.ts`
  - 把连续值和天气类别映射为稳定的纹理等级和黑白样式。
  - 不改变组件已经存在的点、须线、柱、箭头等几何语义。
  - 所有阈值是纯函数，方便单元测试。
- `eink.css`
  - 二值主题变量、CSS 纹理、控件和弹窗样式。
  - 去除动画、阴影、模糊和 hover 过渡。

### 3.2 接入位置

在 `Dashboard` 顶层读取 display mode，并在现有组件树外包一层 provider：

```text
Dashboard
└── RenderProfileProvider
    ├── DashboardLegend
    └── DashboardLanes
        └── 现有全部 lane
```

不创建简化版 `EInkDashboard`，不复制 DashboardLaneStack。普通模式和墨水屏模式必须使用同一份数据、同一套布局和同一组组件。

### 3.3 Canvas 重绘

现有 `useCanvas` 已监听 `weather-theme-change`。将其扩展为同时监听：

```text
weather-render-profile-change
```

要求：

- URL 模式切换后所有 Canvas 仅重画一次。
- resize、pageshow、context restored 的行为保持不变。
- Canvas draw callback 的依赖中加入 render profile，不能依靠读取旧闭包状态。
- 截图导出使用与当前页面一致的 render profile。

## 4. 统一黑白视觉语法

### 4.1 保留现有几何语义

墨水屏模式首先保留现有组件的图形语言，只替换颜色、透明度和填充方式。不能为了建立一套表面统一的黑白规范，把现有圆点改成菱形、给风险等级额外增加三角形，或把柱状图改成折线图。

代码中已经存在的主要几何语义如下：

| 现有视觉元素       | 当前语义                            | 墨水屏处理                                       |
| ------------------ | ----------------------------------- | ------------------------------------------------ |
| 温度竖柱           | 确定性温度                          | 保留柱形和高度，只替换彩色填充                   |
| 同心圆小点         | 露点                                | 保留同心圆/圆点结构，改成黑色轮廓与中心点        |
| 温度柱侧向三角缺口 | 体感温度                            | 保留现有位置和方向，不把三角形复用于通用告警     |
| I-beam 须线        | 温度集合 P10–P90 范围               | 保留须线；P25–P75 继续使用更粗的中段             |
| 宽而淡的成员轨迹   | 云量 ensemble members               | 保留成员轨迹的几何路径，以稀疏黑白纹理替代透明度 |
| 2px 实线           | 主云量、主气压等确定性曲线          | 保留实线和原有线宽层级                           |
| 圆点               | 阵风高于主风的位置                  | 保留圆点，只把 danger 色换成黑色                 |
| 窄柱               | 主风、主降水、AOD 等确定性值        | 保留柱高与柱宽，通过轮廓或纹理替换颜色           |
| 宽背景柱/带        | ensemble 风、ensemble 降水等分布    | 保留覆盖范围，通过低密度点阵替换 alpha           |
| 箭头               | 风向                                | 保留箭头形状、角度和位置                         |
| 虚线               | BLH、降水强度参考线、网格和当前时间 | 保留各组件现有 dash 节奏；只在冲突时做局部调整   |
| 天气 SVG 图形      | 晴、云、雾、雨、雪、雷暴            | 保留现有 Lucide 图形，统一改为黑色描边           |

新增纹理只用于替代现有的色相、颜色深浅或半透明面积编码。只有当某项信息目前完全依赖颜色、且数字和既有形状都无法表达时，才允许增加新的辅助符号；新增前必须先记录当前表达方式，并在视觉评审中单独确认。

### 4.2 基础纹理

纹理 tile 建议使用 8×8 或 12×12 CSS 像素，并与时间列边界对齐：

| Pattern ID   | 图案          | 用途                                         |
| ------------ | ------------- | -------------------------------------------- |
| `empty`      | 纯白          | 无数据、零值、晴朗、低风险                   |
| `dots-1`     | 极稀疏点阵    | 低强度、低概率                               |
| `dots-2`     | 稀疏点阵      | 中低强度                                     |
| `dots-3`     | 密集点阵      | 中高强度                                     |
| `diagonal-1` | 稀疏 45° 斜线 | 夜间、毛毛雨、轻微警示                       |
| `diagonal-2` | 密集 45° 斜线 | 降雨、高值                                   |
| `horizontal` | 水平短线      | 雾、低能见度                                 |
| `crosshatch` | 双向交叉线    | 冻雨、很高风险                               |
| `solid`      | 纯黑          | 只用于窄条、标记和危险标签，不用于大面积背景 |

纹理密度表达强度，纹理形状表达类别。两者不能混为一套随机映射。

### 4.3 墨水覆盖率

- 普通数据区域黑色覆盖率建议低于 25%。
- 密集纹理区域建议低于 45%。
- 大面积纯黑仅用于非常窄的警示条或小标签。
- 相邻时间列使用同一纹理时仍保留列边界，避免连成无法辨认的黑块。
- 字号低于 9px 时不使用复杂纹理作为文字背景。

### 4.4 CSS 基础覆盖

`eink.css` 至少覆盖：

- 页面、timeline、legend、modal、drawer、input：白底黑字。
- lane border、day boundary、city boundary：按层级使用不同粗细的黑线。
- control：白底黑框，无圆形半透明悬浮背景。
- tooltip：白底、2px 黑框、黑字。
- text stroke：只允许白色描边保护文字。
- 禁用 `box-shadow`、`text-shadow`、`backdrop-filter`、`transition`、`animation`。
- 禁用 smooth scroll；需要程序滚动时使用 instant/auto。
- hover 可以保留轮廓变化，但不能出现淡入淡出或大面积反色。

## 5. 逐组件改造计划

### 5.1 DashboardBackground

保留全部时间网格和夜间区间：

- 日间为纯白。
- 夜间使用 `diagonal-1`，不使用半透明灰底。
- 普通小时网格使用稀疏短虚线或 1px 细线。
- 0 点、日期边界、城市边界使用更粗实线。
- 检查纹理不要穿过文字造成识别困难；必要时由文字本身提供白底保护。

### 5.2 WeatherAmbientBackground

墨水屏模式不渲染该层，不尝试把彩色 radial gradient 转换成点阵背景。

理由：

- 该层是覆盖 WeatherIcon、UV、ThermoHygro 区域的低透明度环境色光斑，没有独立坐标轴或标签。
- 类别主要依赖色相识别；改成多种黑白纹理会同时与夜间底纹、UV 分级、温度柱和小号文字竞争。
- 光斑的柔和边缘依赖 alpha gradient，强行二值化容易产生噪声、摩尔纹和大面积刷新。
- `weatherCodeMembers` 的候选天气、名称和概率已经由 WeatherIconLane 的 ensemble tooltip 精确显示。

实现要求：

- 在 DashboardLaneStack 中根据 render profile 条件渲染：color 模式保持现状，eink 模式不挂载 `WeatherAmbientBackground`。
- 不删除 `WeatherAmbientBackground.tsx`，不影响 light/dark 模式。
- 不修改或丢弃 `weatherCodeMembers`。
- 保留 WeatherIconLane 的点击/hover tooltip，使候选天气及概率仍然可查询。
- 墨水屏 tooltip 中每项使用相同的纯黑前景，不再用 `opacity` 表达概率强弱；概率继续由明确的百分比数字表达。
- 如果设备实测后确实需要常显 ensemble weather distribution，应另行设计带标签的独立 lane，不能重新把纹理塞回多个数据层的背景。

### 5.3 LocationLane 与 TimeAxis

- 保留地点、日期、小时、月相、日出日落全部信息和交互。
- 城市边界使用 2px 黑线。
- 日期表头保持白底，当前日期可使用黑色下划线而非背景色。
- 日出、日落、月出、月落使用不同图形和线型，不依赖橙色/蓝色。
- 可点击太阳事件继续打开太阳方向云况抽屉。

### 5.4 TwilightLane

- 墨水屏下不再渲染连续渐变，也不切换多种阶段纹理；只保留两态：太阳高度 `>= 0°` 为空白，`< 0°` 为每个连续夜间区间的一整段均匀稀疏点阵阴影。
- 日出和日落的精确时刻继续由 TimeAxis 的白底黑框事件标签表达，昼夜大区间继续由 DashboardBackground 的夜间带表达。
- 太阳高度数据仍保留给太阳方向云况抽屉和其他计算，不因简化视觉而丢弃。

### 5.5 WeatherIconLane

- 保留现有天气 run 合并、ensemble tooltip、白天/夜间图标和交互。
- 所有 Lucide 图标改为 `currentColor`，墨水屏下统一纯黑。
- 雨、冻雨、雪、雷暴继续依靠不同图标形状区分。
- 夜间图标继续使用 Moon/CloudMoon 等不同轮廓，不使用颜色区分。
- tooltip 在墨水屏模式下使用纯白背景、2px 黑框。
- tooltip 内候选天气的概率继续显示百分比；移除基于 probability 的透明度变化，避免重新引入灰阶编码。

### 5.6 UVLane

- UV 数字、标签间隔和 lane 高度保持不变。
- 不使用等级背景纹理；每个显示值使用白底黑色 1px 描边的圆角矩形，等级差异由数字本身表达。
- 数字始终可见，不允许颜色或纹理成为唯一信息来源。

### 5.7 ThermoHygroLane 与 TemperatureTextLane

非 compact 模式重点改造：

- 确定性温度继续使用现有竖柱，不改成折线；以柱高表达温度，以点阵密度替代连续色谱。
- 体感温度继续使用温度柱左侧的三角缺口及顶部小号数值。三角所在高度和数值已经表达偏冷/偏热，不新增通用上下三角。
- 露点继续使用现有同心圆小点，改成黑色外轮廓、白色隔离环和黑色中心点。
- 集合温度继续使用现有 I-beam：细线表示 P10–P90，粗中段表示 P25–P75；不改画为多条成员线。
- 湿度仍以底部百分比文字表达；若后续为湿度增加面积编码，应沿用当前 lane 几何并单独评审，不能在本次改造中擅自增加新的湿度柱。
- hover 命中区域、tooltip 数值、标签和缺失值行为保持不变。
- 温暖/寒冷体感原有红蓝色被移除后，依靠三角缺口的纵向位置、主温度和体感温度两个数值判断；如设备测试表明仍不清楚，再评估空心/实心差异，不先引入新形状。

compact 分支仍支持墨水屏，但不作为 `display=eink` 的默认行为。

### 5.8 CloudEnsembleLane

- 主云量：2px 实线。
- ensemble mean/median：长虚线。
- ensemble members：稀疏点线。
- 若成员数量过多导致黑色覆盖率超标，优先降低点线 duty cycle，不删除成员。
- 刻度、极值和缺失字段保持现有逻辑。

### 5.9 CloudAndRainLane

这是墨水屏模式的核心组件：

- 云层高度、pressure level、边界层高度、降水柱、分钟降水入口全部保留。
- 云量继续通过填充密度表达：
  - 0–10%：空白。
  - 10–30%：`dots-1`。
  - 30–60%：`dots-2`。
  - 60–85%：`dots-3`。
  - 85–100%：密集点阵，但不使用整块纯黑。
- 高、中、低云仍由纵向高度位置表达，不为其分配互相冲突的纹理。
- 降水柱统一使用纯黑实心窄柱，保持强度和高度最直观；雨、雪、冻雨和雷暴类型继续由 WeatherIconLane 的不同图标及天气详情表达。
- 降水柱高度、数值标签和概率线保持现有比例。
- BLH 使用长虚线，与云量主线明显区分。
- sounding hit layer 和抽屉交互保持可用。

### 5.10 PrecipitationProbLane

- 概率数字和百分号全部保留。
- 概率等级使用纹理密度或字重表达，不依赖蓝色深浅。
- compact 分支的降水柱同样使用纯黑实心柱。
- 分钟降水展开后的图表使用纯黑柱和不同顶部标记区分雨雪类型。
- 分钟时间刻度保持可读，取消文字阴影，改用白底描边。

### 5.11 CapeLane

- CAPE 数字、阈值和 lane 高度保持不变。
- 墨水屏下保持白底，不给连续单元格添加纹理或整格边框，避免高 CAPE 时形成抢眼的黑框带。
- 风险继续由明确数值表达，不额外增加当前组件不存在的警告图形。

### 5.12 WindLane

- 主风柱使用黑色实心窄柱。
- ensemble 风成员使用空心轮廓或稀疏点阵柱。
- 风向箭头、蒲福级数字全部保留。
- 阵风提示保留当前圆点形状，只把 danger 色替换为黑色；必要时增加白色外环以免与背景柱粘连。
- 强风阈值继续使用现有的数字加粗和风向箭头，不新增三角标记；若纯黑状态下层级不足，优先调整字重和轮廓。
- compact 分支继续支持，但不自动启用。

### 5.13 PressureLane

- 主气压曲线使用 2px 实线。
- 集合成员使用 1px 稀疏点线。
- 网格和范围标签使用短虚线。
- 不使用半透明叠加；成员很多时通过 dash pattern 降低覆盖率。

### 5.14 AirQualityLane

- AQI 和能见度数字、标签间隔、两个子行全部保留。
- AQI 分级使用从空白到交叉线的纹理密度。
- 能见度使用水平短线密度，强调其与 AQI 不同的语义。
- 危险 AQI 可使用小面积黑底白字，但不得整条 lane 反色。

### 5.15 AerosolLane

- AOD 数字、柱高和 lane 高度保持不变。
- 移除连续蓝—棕颜色插值。
- AOD 数值映射到稳定的 5 档点阵密度。
- 背景纹理和柱形不能同时过密；建议背景使用低密度点阵，柱形使用轮廓 + 更高密度点阵。
- Canvas 文本改为黑字白描边。

### 5.16 CurrentTimeIndicator

- 改成 1px 黑色虚线和白底黑框标签；竖线从时间轴表头下方开始，避免穿过小时文字。
- 普通模式继续每 30 秒更新。
- 墨水屏模式默认每 5 分钟更新一次，并在 focus/pageshow 时校准。
- 时间线本身是小时尺度，5 分钟更新不会损失可判断的时间精度，同时能显著减少面板刷新。

### 5.17 SoundingDrawer 与 SunDirectionCloudDrawer

- 功能、数据和交互全部保留。
- 弹层使用纯白背景、2px 黑边，无 backdrop blur、无阴影。
- Skew-T 温度/露点不能依赖红绿颜色：温度用实线，露点用长虚线。
- 云廓线、太阳光路、地面和视线使用不同线型和纹理。
- 自动滚动和拖动功能保留，但取消 smooth 动画。

### 5.18 RouteEditor、工具栏与截图模式

- 所有按钮使用白底、黑边、黑图标。
- hover/focus 使用加粗边框，不使用阴影或缩放动画。
- RouteEditor、BYOK 设置和表单能力保持不变。
- 截图选择框使用粗实线边框，未选区域使用稀疏交叉纹理。
- 导出的 PNG 必须与当前墨水屏渲染一致。
- OG image 和 README 默认截图继续使用 color 模式，不受影响。

## 6. 数据刷新与墨水屏稳定性

### 6.1 当前问题

现有 Dashboard 数据主要在组件挂载或路线变化时获取；天气缓存 TTL 不等于自动刷新。作为常驻墙屏，需要补充定时刷新能力。

### 6.2 计划

- 为 `useDashboardData` 增加显式 `refresh()`，复用现有 route 解析、流式加载和错误处理。
- 新增墙屏自动刷新策略，默认每 30 分钟检查一次。
- 页面 hidden 时不刷新；重新 visible 或 pageshow 时检查数据年龄。
- 刷新时保留旧数据，成功后一次性替换，避免先清空整个面板触发两次大面积刷新。
- 刷新失败时保留旧数据，并显示小型静态状态文字。
- 记录 `lastUpdatedAt`，在工具菜单或地点行中显示，不新增大面积动态区域。
- 分钟降水只有用户主动展开时才保持其原有分钟级状态更新。

### 6.3 不做网页模拟全刷

不通过整页黑白反转、闪屏或 CSS animation 模拟“清残影”。这类操作会造成额外闪烁，且不能替代设备驱动的全刷 waveform。设备侧如提供专用 API，后续可单独集成。

## 7. 实施阶段

### Phase 0：基线与样例

- 固定 `fixtures/default.json` 作为第一张墨水屏视觉样例。
- 保存普通 light/dark 当前截图，作为非回归基线。
- 选取至少三个高风险场景：强降雨/雷暴、低能见度高 AQI、集合不确定性较高。
- 确认目标设备分辨率和 DPR；在未知设备情况下先覆盖 800×480、1440×900、1872×1404。

完成条件：可以稳定生成同一 fixture 的普通模式截图，并有明确的墨水屏视觉对照输入。

### Phase 1：模式基础设施

- 实现 `useDisplayMode` 和 RenderProfileProvider。
- 设置 `data-display`。
- 新增 `eink.css` 基础二值变量。
- `useCanvas` 监听 render profile change。
- 保证 `display=eink` 不改变 compact/timeCompact。
- 添加模式解析、dataset 同步和 URL 组合测试。

完成条件：页面整体成为白底黑字，所有 lane 仍存在，普通模式无视觉变化。

### Phase 2：统一纹理和核心 Canvas

- 实现 `monoPatterns.ts`、`monoScales.ts` 和单元测试。
- 在 eink render profile 下跳过 WeatherAmbientBackground，并验证 color 模式仍正常渲染。
- 改造 ThermoHygroLane。
- 改造 CloudEnsembleLane 和 CloudAndRainLane。
- 改造 WindLane 和 PressureLane。

完成条件：核心气象图不再依赖颜色和 alpha，主线/成员/不确定范围层级清楚。

### Phase 3：其余泳道和时间背景

- 改造 DashboardBackground、TwilightLane、WeatherIconLane。
- 改造 UV、PrecipitationProb、CAPE、AQI、Visibility、AOD。
- 补充纹理强度和阈值映射测试。

完成条件：所有主 Dashboard lane 都具有明确的黑白编码，没有只靠色相才能识别的信息。

### Phase 4：交互、抽屉和截图

- 改造 tooltip、RouteEditor、工具栏和截图选择层。
- 改造 SoundingDrawer 和 SunDirectionCloudDrawer。
- 验证点击、键盘、拖动、分钟降水和截图导出。
- 禁用墨水屏模式下的动画、阴影、blur 和 smooth scroll。

完成条件：现有交互路径全部可用，导出 PNG 与页面黑白渲染一致。

### Phase 5：常驻墙屏刷新

- 增加 `refresh()`、`lastUpdatedAt` 和定时刷新。
- 墨水屏模式下限制 CurrentTimeIndicator 更新频率。
- 页面 hidden/visible、离线和刷新失败场景测试。

完成条件：页面可以长期常驻，不需要人工刷新，失败时不会清空已有天气信息。

### Phase 6：视觉调校与设备验证

- 在目标设备上检查纹理摩尔纹、字体、细线、残影和刷新耗时。
- 调整 pattern tile、线宽和黑色覆盖率。
- 记录设备浏览器、DPR、缩放比例和推荐 URL。
- 如设备提供局刷 API，再评估独立适配层。

完成条件：目标设备上主要数值可读、纹理可区分、长时间运行稳定。

## 8. 测试计划

### 8.1 单元测试

- `display` 参数解析：缺失、`eink`、未知值。
- display 与 compact/timeCompact 参数互不修改。
- 连续数值到纹理等级的全部边界值。
- AQI、visibility、AOD 分级，以及 CAPE 数值、UV 徽标在全部等级下保持清晰可见。
- Canvas pattern cache 不能跨 context 复用无效 CanvasPattern。
- 黑白样式配置不得改变现有柱、圆点、须线、箭头和侧向缺口的语义。

### 8.2 组件测试

- `display=eink` 时根节点具有正确 dataset。
- 非 compact 墨水屏仍渲染 ThermoHygro、CloudEnsemble、CloudAndRain、CAPE、Pressure 等完整泳道。
- 墨水屏模式不挂载 WeatherAmbientBackground，但 WeatherIconLane 的 ensemble tooltip 仍显示候选天气名称和明确概率。
- 天气图标不再携带彩色 inline style。
- UV/CAPE/AQI 数字仍然存在，纹理不是唯一信息源。
- 墨水屏模式下 spinner、transition 和 smooth scroll 不生效。
- 退出墨水屏模式后恢复原主题行为。

### 8.3 Canvas 绘制测试

优先测试提取后的纯绘图决策，少做脆弱的 context 调用快照：

- 主线、ensemble 轨迹或 ensemble 须线保持各组件现有几何形式，并选择正确的黑白样式。
- 云量和 AOD 选择正确 pattern ID。
- 墨水屏降水柱保持纯黑实心，类型信息仍可通过天气图标和详情查询。
- 阵风仍使用圆点，墨水屏模式只改变其颜色和必要的隔离轮廓。
- 墨水屏 draw path 不设置带 alpha 的 fillStyle/strokeStyle。

### 8.4 浏览器与视觉测试

建议新增矩阵：

| Case               | URL                                            | Viewport  |
| ------------------ | ---------------------------------------------- | --------- |
| E-ink full         | `/?fixture=default&display=eink`               | 1440×900  |
| E-ink 800×480      | `/?fixture=default&display=eink`               | 800×480   |
| E-ink portrait     | `/?fixture=default&display=eink`               | 1404×1872 |
| E-ink user compact | `/?fixture=default&display=eink&compact=1`     | 800×480   |
| E-ink time compact | `/?fixture=default&display=eink&timeCompact=3` | 1440×900  |
| E-ink sounding     | 固定 fixture + 打开 sounding                   | 1440×900  |
| E-ink sun view     | 固定 fixture + 打开 sun drawer                 | 1440×900  |
| E-ink capture      | 固定 capture range                             | 1920×1080 |

视觉检查重点：

- lane 数量和高度与普通 full 模式一致。
- 纹理之间可区分，但不压过数字与曲线。
- ensemble 成员存在且不会糊成黑块。
- 日期、城市和当前时间边界清楚。
- 没有大面积意外纯黑。
- 普通 light/dark 快照无变化。

如后续需要自动检查颜色，可对截图做像素直方图分析。字体抗锯齿像素应与业务图形填充区别处理，不能简单要求 PNG 只出现两个 RGB 值。

### 8.5 长期运行测试

- fake timer 验证 30 分钟刷新。
- hidden 状态不触发网络刷新。
- visible/pageshow 后只补一次刷新。
- 刷新失败继续显示旧数据。
- 连续运行时不重复注册 timer、事件监听或 CanvasPattern cache。

## 9. 风险与对策

### 9.1 集合成员变成黑团

风险：纯黑成员线叠加后比彩色半透明线更容易遮挡主线。

对策：使用稀疏点线、较低 duty cycle、稳定的成员错位 dash offset；保留全部成员，但控制同时落在同一像素上的概率。

### 9.2 纹理摩尔纹

风险：细密斜线与面板像素/DPR 干涉。

对策：在目标设备上测试 8×8、10×10、12×12 tile；优先使用轴对齐点阵和 45° 粗线，避免 1 设备像素高频条纹。

### 9.3 纹理遮住小字

风险：当前页面存在 8–10px 标签。

对策：文字下方使用紧凑纯白底或 2px 白色描边；文字区域附近降低 pattern 密度。

### 9.4 黑色覆盖过高导致残影

风险：高云量、夜间、高 AQI 连续出现时形成大片黑区。

对策：最高等级优先使用交叉纹理而非 solid；大面积背景不超过约 45% 黑像素覆盖率。

### 9.5 普通主题回归

风险：Canvas 分支和共享 CSS 改动影响 light/dark。

对策：所有墨水屏样式必须带 `[data-display='eink']`；Canvas 原有 color 分支保持默认；保留既有截图并加入普通模式视觉 smoke。

### 9.6 浏览器并非严格 1-bit

风险：字体抗锯齿、缩放和设备合成产生灰色像素。

对策：应用语义层严格只使用黑白；设备端负责最终 1-bit 量化。只有目标设备确认需要时，才增加可选的最终阈值化渲染流程。

## 10. Definition of Done

墨水屏模式完成必须同时满足：

- `?display=eink` 可独立启用，并可与 route、compact、timeCompact 等参数组合。
- 仅启用 `display=eink` 时，compactMode 和 timeStepHours 与原 URL 保持一致。
- 非 compact 墨水屏页面渲染与普通 full 模式相同的全部泳道。
- 所有原先依赖颜色的关键语义都有数字、既有形状、线型或纹理替代；UV 使用数字 + 描边，不铺等级背景。
- WeatherAmbientBackground 是唯一明确移除的环境色层；其 `weatherCodeMembers` 数据及 WeatherIconLane 概率 tooltip 保持可用。
- 应用主动绘制的墨水屏背景、线条、填充和图标不使用彩色或半透明灰阶。
- ensemble 主线、成员和不确定范围均可识别。
- 雨、雪、冻雨、雷暴在纯黑白下可区分。
- 日间、夜间和各曙暮光阶段可区分。
- UV、CAPE、AQI、能见度和 AOD 的数值与等级信息完整保留。
- Sounding、太阳方向云况、分钟降水、路线编辑和截图导出仍可使用。
- 墨水屏模式无动画、无阴影、无 backdrop blur、无 smooth scroll。
- 常驻模式能够定时刷新，失败时保留旧数据。
- `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` 全部通过。
- 新增固定 fixture 的墨水屏视觉截图，并确认普通 light/dark 截图无非预期变化。
- 在至少一个实际目标设备或等效 1-bit 模拟环境中完成可读性和残影检查。

## 11. 建议首个开发切片

第一批提交控制在可评审范围内：

1. 增加 `display=eink`、RenderProfileProvider 和根节点 dataset。
2. 增加基础 `eink.css`，完成白底黑字、边框、控件和动画禁用。
3. 实现共享 Canvas pattern 工具和阈值单元测试。
4. 改造 DashboardBackground、WeatherIconLane、TwilightLane，并在墨水屏模式跳过 WeatherAmbientBackground。
5. 改造 ThermoHygroLane、CloudAndRainLane、WindLane 三个代表性 Canvas。
6. 生成 `fixtures/default.json` 的 1440×900 墨水屏截图供视觉评审。

这个切片可以同时验证 DOM、SVG、CSS gradient 和 Canvas 四类渲染路径。视觉语言确认后，再批量迁移其余泳道，可减少返工。
