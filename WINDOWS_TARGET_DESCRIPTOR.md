# Production Windows Target Descriptor

Status: frozen design contract for the first production integration slice (2026-09-26).

## Purpose

A Windows element target must survive process restarts, avoid arbitrary selection when multiple candidates exist, work in multi-session Windows/Citrix environments, and remain independent from transient PID/HWND values.

This contract is derived from the Windows POC GUI regression and UIA target laboratory. It defines persistence/API semantics before any DB migration is introduced.

## GuideStep ownership

```text
GuideStep
  Runtime: web | windows
  TargetType: element | none
  Instruction
  ScreenName
  Validation...
  WebTarget?       // only Runtime=web + TargetType=element
  WindowsTarget?   // only Runtime=windows + TargetType=element
```

`Runtime` and `TargetType` are independent. An instruction-only Windows step has `Runtime=windows`, `TargetType=none`, and no Windows target descriptor.

## DTO

```csharp
public sealed record WindowsTargetDescriptor(
    string ProcessName,
    WindowsWindowDescriptor Window,
    WindowsElementDescriptor Element,
    IReadOnlyList<WindowsAncestorDescriptor> Ancestors);

public sealed record WindowsWindowDescriptor(
    string? AutomationId,
    string? Name);

public sealed record WindowsElementDescriptor(
    string ControlType,
    string? AutomationId,
    string? Name);

public sealed record WindowsAncestorDescriptor(
    string ControlType,
    string? AutomationId,
    string? Name);
```

`ControlType` is persisted as the stable UIA programmatic control-type identifier/string, not as an in-memory `ControlType` object.

## Persistence rules

- `ProcessName` is required and stored without PID.
- Element `ControlType` is required.
- Element must have at least one authored discriminator: non-empty `AutomationId` or non-empty `Name`.
- Window identity is captured separately from the element/ancestor path. `AutomationId` and `Name` may both be empty when the application exposes no stable window metadata; ambiguity must then be handled safely at resolution time.
- `Ancestors` is an ordered nearest-to-farthest Control View path of meaningful ancestors between the element and its top-level window. Persist multiple ancestors rather than the POC's single nearest ancestor so nested duplicate controls can be disambiguated without redesigning the schema.
- Do not persist PID, native HWND, Windows SessionId, bounding rectangle, RuntimeId, process start time, foreground state, or visibility. They are transient runtime state.
- SessionId remains a runtime boundary: resolution considers only processes in the current GWTP Windows session.

## Matching semantics

Identity matching is deterministic and ambiguity-safe.

### Property precedence

For Window, Element, and Ancestor descriptors:

1. `ControlType` is a strict match wherever it is present in the descriptor.
2. A non-empty authored `AutomationId` is the preferred stable discriminator and is matched exactly.
3. `Name` is a strict identity discriminator only when that descriptor has no authored `AutomationId`.
4. When `AutomationId` exists, captured `Name` is retained as descriptive/diagnostic metadata but a later Name change must not invalidate the target.

This rule directly addresses the T05 evidence: a target with stable AutomationId must remain rediscoverable when its displayed Name changes.

### Resolution

1. Find processes matching `ProcessName` in the current Windows SessionId.
2. Enumerate their top-level UIA windows only.
3. Use stable Window descriptor fields when available to narrow candidate windows. A captured Name must not override a stable Window AutomationId.
4. Search candidate windows for leaf elements matching the Element descriptor.
5. If exactly one candidate remains, resolve it.
6. If multiple candidates remain, compare the persisted ordered ancestor path and progressively narrow candidates.
7. Resolve only when exactly one candidate remains.
8. Zero candidates means unavailable/pending. Multiple indistinguishable candidates means ambiguous/pending. Never select an arbitrary candidate.

The runtime remains event-driven: pending targets resume on meaningful UIA/window lifecycle events, not polling or fixed retry loops.

## Window-title rule

Dynamic window titles must not become a hidden hard dependency. If a stable window AutomationId exists, Name is diagnostic only. If no stable window AutomationId exists, exact Name may be used as a fallback discriminator, but resolution must fail safely if it no longer identifies a unique candidate.

A future application-specific matcher (for example normalized/regex title matching) must be an explicit authored contract extension; it must not be inferred silently by the runtime.

## Evidence mapped to the contract

- T01: duplicate leaf identity requires hierarchy/ancestor disambiguation.
- T02-T04: targets may have or lack AutomationId, so Name fallback is required.
- T05: Name may change while AutomationId remains stable; Name therefore cannot always be a strict predicate.
- T06: hierarchy can be deep; persist an ancestor path rather than one ancestor.
- T07: target disappearance/reappearance requires pending event-driven lifecycle.
- T08: one process can own multiple top-level windows; window identity is a separate scope.
- Cross-launch regression: PID/HWND cannot be persisted identity.
- Two identical same-session instances: unresolved ambiguity must fail safe instead of choosing one.
- Current-session regression/architecture: SessionId is runtime scoping, not persisted identity.

## First production migration slice

With this contract frozen, the next coherent implementation slice is:

1. add GuideStep runtime and typed Windows target persistence;
2. migrate existing steps to `Runtime=web` compatibly;
3. update API DTO/validation without overloading Web Selector/FrameTarget;
4. add Editor capture/save/read support for Windows targets;
5. connect Preview/Learner execution to the Windows runtime;
6. add persistence/restart and Web-only/Windows-only/Hybrid E2E coverage.

Do not introduce a manually authored Guide platform/type field. Guide classification is derived from its steps.
