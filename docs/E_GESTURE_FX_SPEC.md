# E 组 Gesture FX Spec

## 1. 背景

本规范面向 OpenPad Lab 的 E 组模块开发，负责以下文件范围：

- `src/components/FxPanel/`
- `src/components/GesturePanel/`
- `src/modules/effects/fxEngine.ts`
- `src/modules/gesture/gestureTracker.ts`

本模块目标是通过浏览器摄像头读取手势信息，并将手势稳定地映射为音频效果器参数，驱动当前音频引擎中的 FX 链路变化。

本规范以 `docs/BCDE_MODULE_CONTRACTS.md`、`src/types/project.ts`、`src/types/contracts.ts` 和当前 `dev` 分支骨架代码为准。

## 2. 契约约束

### 2.1 必须遵守

- 手势只能控制 FX，不能直接触发 pad 或音符。
- 所有共享 FX 数据必须通过 `useProjectStore` 管理。
- 手动 FX slider 必须始终可用，即使摄像头权限失败。
- 摄像头流、检测器实例、运行时回调等非序列化对象必须保留在 `modules/gesture` 内部。
- FX 数值在写入 store 前必须经过平滑处理。
- 不创建第二套全局状态，不绕过 B 组音频模块边界。

### 2.2 对外契约

E 组最终需要满足以下 API：

```ts
startGestureTracking(videoElement: HTMLVideoElement): Promise<void>
stopGestureTracking(): void
onGestureChange(callback: (gesture: GestureState) => void): void
setFxParam(name: FxParamName, value: number): void
applyFxState(fx: Partial<FxState>): void
mapGestureToFx(gesture: GestureState): Partial<FxState>
smoothValue(previous: number, next: number, factor: number): number
```

## 3. 当前基线

### 3.1 已有能力

- `src/store/useProjectStore.ts` 已提供 `setFx` 与 `resetFx`。
- `src/types/project.ts` 已定义 `FxState` 与 `GestureState`。
- `src/modules/audio/audioEngine.ts` 已提供 `applyFxState(fx)`。
- `src/components/FxPanel/FxPanel.tsx` 已有可工作的手动 slider。
- `src/components/GesturePanel/GesturePanel.tsx` 已预留面板位置。

### 3.2 当前缺口

- `gestureTracker.ts` 仍是占位实现，只返回固定值。
- `fxEngine.ts` 仅实现了基础映射函数，未真正接入 store 和音频引擎。
- `GesturePanel.tsx` 还没有摄像头预览、跟踪开关、状态反馈。
- 手势输入与手动 slider 的优先级、冲突规则、错误状态尚未明确落地。
- 还没有可验证的“手势 -> 平滑 -> store.fx -> audioEngine.applyFxState` 闭环。

## 4. 设计目标

### 4.1 MVP 目标

- 用户允许摄像头后，可以看到视频预览。
- 系统可持续输出归一化 `GestureState`：
  - `handX`
  - `handY`
  - `openness`
  - `confidence`
- 手势变化可以稳定更新 `FxState`，并带来可听见的 FX 变化。
- 摄像头不可用时，`FxPanel` 手动调参仍可工作。
- 所有运行逻辑可通过 `npm run build`。

### 4.2 非目标

- 不做复杂多手识别。
- 不做手势触发 pad。
- 不做手势录制、回放或自动化编排。
- 不新增新的全局状态管理方案。

## 5. 用户流程

### 5.1 正常流程

1. 用户打开页面。
2. 用户通过 `FxPanel` 先可手动调整 FX。
3. 用户在 `GesturePanel` 中点击开始手势控制。
4. 浏览器请求摄像头权限。
5. 授权成功后显示视频预览并启动手势跟踪。
6. 检测器输出 `GestureState`。
7. 系统对手势结果做置信度过滤与平滑。
8. 系统将结果映射为 `Partial<FxState>`。
9. 系统写入 `useProjectStore().setFx(...)`。
10. 系统同步调用音频层 `applyFxState(...)`。
11. 用户听到滤波、延迟、混响等效果变化。

### 5.2 异常流程

- 权限拒绝：面板显示错误状态，但 `FxPanel` 保持可用。
- 未识别到手：保持最近一次稳定值，或暂停继续写入。
- 低置信度：不更新 FX，避免 UI 与声音抖动。

## 6. 数据流设计

```txt
Camera stream
-> gestureTracker runtime
-> GestureState
-> confidence gate
-> smoothing
-> mapGestureToFx
-> useProjectStore.setFx
-> fxEngine.applyFxState
-> audioEngine.applyFxState
```

说明：

- `GestureState` 是检测层输出。
- `FxState` 是共享状态层输出。
- 运行时视频流和检测器实例不进入 Zustand。
- 当前生效 FX 值以 store 为单一事实来源。

## 7. 手势输入规范

### 7.1 GestureState 含义

```ts
interface GestureState {
  handX: number;      // 0~1，左到右
  handY: number;      // 0~1，上到下
  openness: number;   // 0~1，手掌闭合到张开
  confidence: number; // 0~1，识别可信度
}
```

### 7.2 MVP 检测策略

- 第一版只支持单手。
- 优先取画面中最高置信度的手。
- 输出前统一 clamp 到 `0~1`。
- `confidence < 0.6` 时视为无效输入。

### 7.3 手势来源策略

- 首选 MediaPipe Hands。
- 若暂时无法接入完整识别库，允许先在 `gestureTracker` 中设计可替换适配层，但最终对外 API 不变。

## 8. FX 映射规范

### 8.1 参数映射

MVP 推荐映射如下：

- `handX -> delayFeedback`
- `handY -> filterCutoff`
- `openness -> reverbAmount`

### 8.2 数值范围

- `filterCutoff`: UI 层保存为 `200 ~ 12000`
- `reverbAmount`: `0 ~ 1`
- `delayFeedback`: `0 ~ 0.95`
- `bitcrusherAmount`: 第一阶段保留 slider，不由手势控制

### 8.3 推荐映射公式

```ts
filterCutoff = 200 + (1 - handY) * 11800
reverbAmount = openness
delayFeedback = min(0.95, handX)
```

说明：

- `handY` 建议反向映射，让“手抬高 = 滤波更开”更直观。
- `bitcrusherAmount` 不纳入第一阶段手势映射，避免音色过于极端影响演示稳定性。

## 9. 平滑与稳定性

### 9.1 平滑算法

采用一阶低通：

```ts
smoothValue(previous, next, factor) = previous + (next - previous) * factor
```

### 9.2 推荐参数

- 默认 `factor = 0.18`
- 可允许 `0.15 ~ 0.25` 内调试

### 9.3 稳定策略

- 低置信度直接丢弃。
- 差值过小时不更新，减少 UI 抖动。
- 停止跟踪时不强制重置 FX，保留当前值。
- `stopGestureTracking()` 必须释放媒体流轨道并取消回调。

## 10. 组件与模块职责

### 10.1 `src/modules/gesture/gestureTracker.ts`

职责：

- 请求并管理摄像头流。
- 启动和停止手势检测。
- 将原始检测结果转换为 `GestureState`。
- 通过 `onGestureChange` 派发最新结果。

要求：

- 模块内部维护 `MediaStream`、检测器实例、动画帧或轮询句柄。
- `startGestureTracking(videoElement)` 成功后必须把流绑定到 `videoElement.srcObject`。
- 重复调用 `startGestureTracking()` 时要避免重复创建资源。

### 10.2 `src/modules/effects/fxEngine.ts`

职责：

- 暴露 FX 参数写入与整体应用接口。
- 负责手势到 `FxState` 的映射和平滑。
- 桥接 store 与 `audioEngine.applyFxState`。

要求：

- `setFxParam(name, value)` 只更新单一参数。
- `applyFxState(fx)` 负责把 patch 同步给 store 与音频引擎。
- `mapGestureToFx(gesture)` 不访问 DOM，不直接操作组件。

### 10.3 `src/components/FxPanel/FxPanel.tsx`

职责：

- 展示当前 FX 值。
- 提供手动 slider。
- 提供 reset 操作。

要求：

- 手动 slider 始终可用。
- 手动修改时通过 `setFx` 更新 store。
- 每次手动修改后需要把变化同步到音频引擎。

### 10.4 `src/components/GesturePanel/GesturePanel.tsx`

职责：

- 呈现摄像头预览。
- 管理跟踪启停。
- 展示识别状态、实时手势值和映射后关键 FX 值。

要求：

- 必须展示以下状态之一：
  - Idle
  - Requesting
  - Tracking
  - Permission denied
  - Error
- 必须在组件卸载时停止跟踪并释放资源。

## 11. 手动控制与手势控制的协作规则

- `FxPanel` 是基础控制入口，始终可用。
- `GesturePanel` 启动后，手势更新会持续覆盖其负责的映射参数。
- 未纳入映射的参数继续只由 slider 控制。
- 当手势跟踪停止后，最后一次 FX 值保留，不自动回滚。
- `resetFx()` 重置所有 FX 到默认值，并同步到音频引擎。

## 12. 与其他模块的联调要求

### 12.1 与 A 组

- 不主动修改 `App.tsx`、`store`、`types` 结构，除非确有必要并经 review。
- `GesturePanel` 与 `FxPanel` 继续挂载在当前布局区域。

### 12.2 与 B 组

- E 组不直接操作底层音频节点。
- 一切最终音频效果应用通过 `audioEngine.applyFxState` 进入 B 组音频链。
- 若 B 组后续修正 `filterCutoff` 语义，E 组只调整映射，不重写音频链。

### 12.3 与 C/D 组

- E 组不依赖采样与 sequencer 具体实现细节。
- 只要求项目存在可播放声音时，FX 变化应可被听见。

## 13. 开发分期

### Phase 1: 完成 FX 闭环

目标：

- `FxPanel` 滑块变更可同步影响 store 与音频引擎。
- `resetFx()` 同步影响音频引擎。

验收：

- 手动滑动 `Filter/Reverb/Delay/Crush` 时，store 值变化且声音响应变化。

### Phase 2: 完成手势跟踪闭环

目标：

- `GesturePanel` 能启动和停止摄像头。
- 页面能展示实时 `GestureState`。

验收：

- 权限允许后可看到视频。
- 面板能显示实时 `handX/handY/openness/confidence`。

### Phase 3: 完成手势 -> FX 闭环

目标：

- 手势输入经平滑后可驱动 `FxState`。
- store 与音频引擎保持同步。

验收：

- 手移动时，UI 数值变化稳定。
- 播放样本时能听见滤波/混响/延迟变化。

### Phase 4: 稳定性与文档

目标：

- 补齐错误状态。
- 清理资源泄漏。
- 提供手动测试步骤。

验收：

- 权限失败、停止跟踪、重复启停都无明显异常。
- `npm run build` 通过。

## 14. 验收标准

- `FxPanel` 在无摄像头权限场景下完全可用。
- `GesturePanel` 可以正确请求权限、展示视频、启停跟踪。
- 手势不会直接触发 pad。
- FX 更新在进入 store 前完成平滑。
- 使用项目已有 `FxState`、`GestureState`、`useProjectStore`，不新建重复类型或 store。
- `npm run build` 通过。

## 15. 手动测试清单

1. 打开页面，不授权摄像头，确认 `FxPanel` 仍可正常调参。
2. 授权摄像头，确认 `GesturePanel` 进入 `Tracking` 状态并显示预览。
3. 左右移动手，确认 `delayFeedback` 变化。
4. 上下移动手，确认 `filterCutoff` 变化。
5. 张开和闭合手，确认 `reverbAmount` 变化。
6. 停止跟踪，确认摄像头关闭且页面无报错。
7. 播放 pad 或 sequencer，确认 FX 变化可被听见。
8. 运行 `npm run build`，确认打包通过。

## 16. 实施边界

本规范默认只实现 E 组拥有的模块文件；若开发过程中发现必须调整共享 `store`、`types` 或 `App.tsx`，需先记录为额外变更并单独说明原因后再实施。
