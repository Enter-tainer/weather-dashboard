# Testing Strategy

本文档说明 Weather Dashboard 的测试分层、覆盖重点和落地顺序。目标不是追求形式上的高覆盖率，而是把最容易回归、最影响用户判断天气的路径稳定下来。

## Current State

项目已经具备测试基础：

- 单元/组件测试工具：Vitest、jsdom、Testing Library。
- 浏览器自动化依赖：Playwright，目前主要用于截图生成脚本。
- CI 已执行：`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`。
- 已有测试集中在 `src/services/api.test.ts`、`src/services/timeAggregation.test.ts`、`src/services/timelineCapture.test.ts`、`src/hooks/*.test.tsx` 和 `src/components/SoundingDrawer.test.tsx`。

主要缺口：

- 大部分纯函数服务还没有直接测试，例如 `urlParser`、`cache`、`weatherMetrics`、`sounding`、`timelineLayout`。
- 大多数 UI 控件和 lane 组件缺少行为测试，例如 `RouteEditor`、模式切换按钮、`DashboardLanes` 的空态/加载态/截图态、AQI/风/降水等 lane 的缺失值处理。
- 没有 Playwright E2E 覆盖完整用户路径。
- 没有基于固定 fixture 的视觉回归，Canvas 渲染和布局回归主要靠人工看图。
- 没有明确的测试数据策略，容易在测试里重复构造大型、不稳定、难读的数据。

## Test Pyramid

### 1. Static Checks

继续把静态检查作为第一道门：

- `pnpm lint`：代码风格、React Hooks 规则、明显错误。
- `pnpm typecheck`：类型契约，尤其是 `WeatherPoint`、`WeatherTimeline`、API 响应处理。
- `pnpm build`：Vite/React 打包、资源引用、生产模式编译。

这些检查应该在 PR 上必跑。它们快、稳定，能挡住很多低级回归。

### 2. Pure Unit Tests

优先覆盖纯数据逻辑，因为它们决定图表是否表达了正确天气含义。

推荐范围：

- `src/services/timeAggregation.ts`：跨城市、跨日期、缺失值、极值、事件坐标重映射。
- `src/services/timelineCapture.ts`：选择区间、拖拽吸附、截图标签、文件名、事件裁剪。
- `src/services/weatherMetrics.ts`：温度/气压范围、ensemble 成员、Beaufort 边界值。
- `src/services/urlParser.ts`：城市、坐标、自定义显示名、同日期多城市切换、无参数时地理定位降级。
- `src/services/cache.ts`：TTL 过期、坏缓存清理、localStorage 写入失败、429 retry/backoff、并发队列。
- `src/services/sounding.ts`：露点、探空层级、缺失/异常压力层。
- `src/services/themeColors.ts`、`src/services/timelineLayout.ts`：边界值和默认值。

原则：

- 用小型 builder 构造数据，避免在单元测试中直接依赖大型 fixture。
- 对边界值写表格测试，例如 AQI 分级、Beaufort 分级、`timeCompact=3/6`。
- 用 fake timers 测缓存过期和 retry backoff。
- 不在 PR 单元测试里访问真实 Open-Meteo/Nominatim 网络。

### 3. Service Integration Tests

这层验证多个服务组合后的业务行为，网络仍然用 mock。

推荐场景：

- `fetchCityDataForDate` 在 forecast 失败时使用 ensemble，并保持缺失字段为 `null`。
- forecast、ensemble、AQI 三个响应长度不一致时不崩溃。
- 远期日期选择 ensemble 模型，近期日期选择更精细模型。
- 经纬度路线触发 reverse geocode，城市路线触发 geocoding search。
- `assembleTimeline` 按路线顺序拼接多城市数据，并保留 sun/moon/night 元数据。

这类测试应关注输入输出契约，不断言内部调用细节，除非调用细节本身就是业务规则，例如 URL 参数必须包含某些 Open-Meteo 字段。

### 4. Hook Tests

Hooks 连接 URL 状态、异步数据和用户操作，需要用 Testing Library 的 probe component 覆盖。

推荐范围：

- `useSearchParam`：pushState、popstate、helper 更新。
- `useCompactMode` / `useTimeCompactMode`：URL 参数和 toggle 行为。
- `useThemeMode`：系统主题、用户选择、localStorage。
- `useDashboardData`：普通路线、switchable route、流式加载、切换城市、错误/空数据。
- `useSoundingSelection`：URL hydrate、选择、步进、清空。
- `useCanvas` / `canvasCapture`：canvas ref 生命周期、capture context 分支。

Hooks 测试应该以“组件能观察到的状态”为断言对象，少测 React 内部实现。

### 5. Component Tests

组件测试用于验证 DOM 行为、可访问名称、空态和关键条件渲染。Canvas 细节不要在 jsdom 里做像素断言。

推荐范围：

- 控件：`ThemeToggle`、`CompactToggle`、`TimeCompactToggle`、`MobileToolMenu`。
- 路线编辑：`RouteEditor` 打开/关闭、输入城市/坐标、保存到 URL、无效输入提示。
- 主面板：`Dashboard` 进入/退出截图模式、导出失败状态、按钮禁用状态。
- lane stack：空数据、加载中、ensemble fallback notice、compact/timeCompact 条件渲染。
- 信息 lane：`AirQualityLane`、`PrecipitationProbLane`、`WindLane` 等对 `null`、边界值、标签显示的处理。
- 探空：`SoundingDrawer` 已有较完整测试，后续保持新增交互必须有回归测试。

建议只断言用户可观察结果，例如按钮名称、状态文字、角色、class 是否代表状态。不要断言无意义的 DOM 层级。

### 6. Canvas Rendering Tests

Canvas lane 不适合在 jsdom 中做截图，但仍可测试关键绘图决策：

- 把颜色分级、坐标换算、标签选择、路径点计算提取为纯函数后单测。
- 对少量复杂 Canvas 组件 mock `CanvasRenderingContext2D`，断言关键 draw command 被调用，例如温度曲线点数、降水柱数量、风向旋转角。
- 像素级正确性放到 Playwright 视觉回归。

原则是少 mock Canvas，多测试绘图前的可复用计算。

### 7. Browser E2E Tests

用 Playwright 覆盖完整用户路径。E2E 应基于 `?fixture=default` 或专用 fixture，避免真实网络。

建议目录：

```text
tests/e2e/
  dashboard.spec.ts
  route-editor.spec.ts
  capture.spec.ts
```

建议首批场景：

- 打开 `/?fixture=default`，等待 dashboard 出现，关键 lane 和工具按钮可见。
- 切换浅色/深色主题、compact、`timeCompact=3/6`，URL 和 UI 状态同步。
- 打开路线编辑器，输入多城市路线，保存后 dashboard 开始加载或渲染 fixture/mock 结果。
- 同日期多城市路线出现城市切换按钮，点击后 active city 变化。
- 点击云层探空区域打开 drawer，Esc 和关闭按钮都能关闭。
- 进入截图模式，拖动选择区间，取消和导出按钮状态正确。
- 移动端 viewport 下工具菜单可用，按钮文字/图标不重叠。

E2E 只覆盖关键路径，不追求覆盖每个分支。

### 8. Visual Regression

这个项目是高密度 Canvas + CSS 信息图，视觉回归很重要。建议使用 Playwright screenshot snapshots，全部基于固定 fixture。

建议快照矩阵：

| Case           | URL                                          | Viewport  |
| -------------- | -------------------------------------------- | --------- |
| Desktop dark   | `/?fixture=default&theme=dark`               | 1440x900  |
| Desktop light  | `/?fixture=default&theme=light`              | 1440x900  |
| Compact        | `/?fixture=default&compact=1&theme=dark`     | 1440x900  |
| Time compact   | `/?fixture=default&timeCompact=3&theme=dark` | 1440x900  |
| Mobile         | `/?fixture=default&theme=dark`               | 390x844   |
| Capture render | `/?fixture=default&capture=72&theme=dark`    | 1920x1080 |
| OG image       | `/?fixture=default&og=1&theme=dark`          | 1200x630  |

PR 上可以先跑少量 smoke 截图，完整视觉矩阵放到手动 workflow 或 nightly，避免快照维护成本过高。

### 9. Accessibility Tests

天气图表有大量视觉信息，至少保证控制面板和交互路径可访问：

- 所有 icon button 必须有 `aria-label` 或可访问名称。
- 模态/抽屉支持 Esc、点击外部关闭、焦点不丢失。
- 主题、compact、timeCompact、截图模式等状态变化可被按钮状态或文本表达。
- Playwright 或 Testing Library 可加入 `axe-core` 检查主要页面和抽屉。

短期先把 a11y 作为组件测试断言的一部分；引入 `axe-core` 后再作为独立检查。

### 10. Performance And Smoke Tests

性能测试不需要一开始做成复杂基准，但要覆盖几个真实风险：

- 长路线 fixture，例如 7 天、14 天、多城市拼接，页面可在合理时间内完成首屏渲染。
- `timeCompact=3/6` 后 DOM 宽度、列宽和滚动行为稳定。
- Canvas lane 在频繁切换主题/compact 时不产生明显异常。
- 截图导出在固定 fixture 下能生成文件，且捕获区域尺寸稳定。

建议用 Playwright 记录简单 budget：页面加载到关键 selector 的时间、截图元素尺寸、主要交互耗时。不要在普通 PR 上设置过严阈值。

## Test Data Strategy

测试数据分三层：

1. Builder：`src/test-utils/weather.ts` 继续作为单元测试默认入口，扩展 `makeWeatherTimeline`、`makeRouteEntry`、`makeDateSlot`、`makeOpenMeteoResponse` 等 builder。
2. Scenario fixtures：新增小型 JSON 或 TS fixture，覆盖明确天气场景，例如晴天、强降水、强风、高 AQI、缺失字段、ensemble fallback、多城市切换。
3. Full fixture：`fixtures/default.json` 用于截图、视觉回归和手工演示，不作为普通单元测试依赖。

Fixture 命名建议：

```text
fixtures/
  default.json
  scenarios/
    clear-day.json
    storm.json
    polluted-low-visibility.json
    missing-fields.json
    ensemble-fallback.json
    multi-city-switch.json
```

单元测试应优先使用 builder；浏览器和视觉测试使用 scenario/full fixture。

## Coverage Matrix

| Area                   | Tool                           | Must Cover                                | Current Status | Priority |
| ---------------------- | ------------------------------ | ----------------------------------------- | -------------- | -------- |
| Type/lint/build        | ESLint, TypeScript, Vite       | 基础质量门禁                              | 已在 CI        | Keep     |
| Data aggregation       | Vitest                         | 跨城市/日期、缺失值、事件坐标             | 部分已有       | P0       |
| API transform/fallback | Vitest mocks                   | forecast/ensemble/AQI、缺失字段、模型选择 | 部分已有       | P0       |
| URL and route parsing  | Vitest + jsdom                 | route 格式、坐标、switchable、fallback    | 缺少           | P0       |
| Cache/retry            | Vitest fake timers             | TTL、坏缓存、429、并发队列                | 缺少           | P1       |
| Hooks                  | Testing Library                | URL 状态、数据流、模式切换                | 部分已有       | P1       |
| Core controls          | Testing Library                | 按钮状态、URL 同步、可访问名称            | 缺少           | P1       |
| Lane components        | Testing Library + pure helpers | null、阈值、compact 条件                  | 缺少           | P1       |
| Dashboard workflows    | Playwright                     | fixture 加载、切换、探空、截图            | 缺少           | P2       |
| Visual layout          | Playwright screenshots         | dark/light/mobile/capture/OG              | 缺少           | P2       |
| Accessibility          | Testing Library, axe           | 控件名称、键盘、抽屉                      | 部分已有       | P2       |
| Performance smoke      | Playwright                     | 长时间线、截图尺寸、交互耗时              | 缺少           | P3       |
| Live API smoke         | Scheduled workflow             | Open-Meteo/Nominatim 基本可用             | 缺少           | P3       |

## CI Plan

建议分阶段调整脚本和 CI。

第一阶段保留现有 CI，只新增更多 Vitest：

```json
{
  "test": "vitest run",
  "test:watch": "vitest"
}
```

第二阶段引入 Playwright 配置和脚本：

```json
{
  "test:unit": "vitest run",
  "test:e2e": "playwright test tests/e2e",
  "test:visual": "playwright test tests/visual",
  "test:all": "pnpm lint && pnpm typecheck && pnpm test:unit && pnpm build && pnpm test:e2e"
}
```

PR 必跑：

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm build`
- 少量 Playwright smoke

手动或 nightly：

- 完整 Playwright E2E
- 完整视觉回归矩阵
- 可选 live API smoke

## Definition Of Done

新增或修改代码时按以下规则补测试：

- 修改纯函数服务：必须有单元测试覆盖正常路径、缺失值、边界值。
- 修改 API 字段映射：必须有 mocked API response 测试，不能只靠真实接口手测。
- 修改 URL 参数或路由行为：必须覆盖 URL 读写和浏览器导航。
- 修改 hook：必须有 probe component 测用户可观察状态。
- 修改控件/抽屉/弹层：必须覆盖可访问名称、点击、键盘关闭或状态切换。
- 修改 Canvas lane：至少测试绘图前计算或 DOM 条件；高风险视觉变化加截图回归。
- 修 bug：先加能复现 bug 的回归测试，再修。

## Rollout Plan

建议按风险和收益分四步落地：

1. P0 单元补强：补 `urlParser`、`weatherMetrics`、`cache`、`sounding`，扩展 API fallback/aggregation 边界测试。
2. P1 UI 行为：补 toggles、`RouteEditor`、`Dashboard` 截图模式、关键 lane 缺失值/阈值测试。
3. P2 浏览器 smoke：新增 Playwright config 和 `tests/e2e/dashboard.spec.ts`，先覆盖 fixture 加载、模式切换、探空、截图模式。
4. P2/P3 视觉和性能：建立截图基线，增加 dark/light/mobile/capture/OG 矩阵，再根据维护成本决定是否进 PR 必跑。

## Anti-patterns

- 不在 CI PR 测试中调用真实天气 API；真实接口只放 scheduled smoke。
- 不用大型 screenshot snapshot 替代具体业务断言。
- 不在 jsdom 中做 Canvas 像素断言。
- 不因为追求覆盖率去测试 React/浏览器已经保证的行为。
- 不让测试依赖当前日期，除非显式 mock `Date`。
- 不让测试之间共享可变全局状态；每个测试重置 URL、localStorage、timers、mocks。
