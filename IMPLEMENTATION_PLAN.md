# Implementation Plan (AI execution unavailable)

## Task
Implement BLE communication in Electron

## Description
## Summary
Set up the secure IPC foundation for Electron communication, including the preload script API surface and main process handler infrastructure.

Implement Bluetooth Low Energy communication in Electron's main process for wireless keyboard connections.

## Acceptance Criteria
- [ ] Define TypeScript interfaces for all IPC channels and payloads
- [ ] Implement `contextBridge.exposeInMainWorld()` API in preload script
- [ ] Set up main process IPC handler registration pattern
- [ ] Ensure `nodeIntegration: false` and `contextIsolation: true` are configured
- [ ] Create input validation utilities for IPC handlers
- [ ] Add platform detection to choose between Tauri/Electron backends
- [ ] Implement BLE device scanning with filters
- [ ] Implement BLE device connection
- [ ] Implement BLE device disconnection
- [ ] Handle BLE connection state changes and disconnections
- [ ] Wire up BLE UI to use Electron backend when running in Electron

## Reference Files
- `src/preload/index.ts` - Preload script to extend
- `src/main/index.ts` - Main process entry point
- `src/renderer/src/tauri/index.ts` - API surface reference
- `src/renderer/src/tauri/ble.ts` - Tauri BLE implementation
- `src/renderer/src/transport/gatt.ts` - GATT transport layer

Parent issue: #28 Implement the communication with electron
https://github.com/Wolffyx/remappr/issues/28

## Plan
# Task: Implement the following issue

## Issue Title
Implement BLE communication in Electron

## Issue Description
## Summary
Set up the secure IPC foundation for Electron communication, including the preload script API surface and main process handler infrastructure.

Implement Bluetooth Low Energy communication in Electron's main process for wireless keyboard connections.

## Acceptance Criteria
- [ ] Define TypeScript interfaces for all IPC channels and payloads
- [ ] Implement `contextBridge.exposeInMainWorld()` API in preload script
- [ ] Set up main process IPC handler registration pattern
- [ ] Ensure `nodeIntegration: false` and `contextIsolation: true` are configured
- [ ] Create input validation utilities for IPC handlers
- [ ] Add platform detection to choose between Tauri/Electron backends
- [ ] Implement BLE device scanning with filters
- [ ] Implement BLE device connection
- [ ] Implement BLE device disconnection
- [ ] Handle BLE connection state changes and disconnections
- [ ] Wire up BLE UI to use Electron backend when running in Electron

## Reference Files
- `src/preload/index.ts` - Preload script to extend
- `src/main/index.ts` - Main process entry point
- `src/renderer/src/tauri/index.ts` - API surface reference
- `src/renderer/src/tauri/ble.ts` - Tauri BLE implementation
- `src/renderer/src/transport/gatt.ts` - GATT transport layer

Parent issue: #28 Implement the communication with electron
https://github.com/Wolffyx/remappr/issues/28

## Implementation Plan
# Implementation Specification (Spec)

## Task
Implement BLE communication in Electron

## Description
## Summary
Set up the secure IPC foundation for Electron communication, including the preload script API surface and main process handler infrastructure.

Implement Bluetooth Low Energy communication in Electron's main process for wireless keyboard connections.

## Acceptance Criteria
- [ ] Define TypeScript interfaces for all IPC channels and payloads
- [ ] Implement `contextBridge.exposeInMainWorld()` API in preload script
- [ ] Set up main process IPC handler registration pattern
- [ ] Ensure `nodeIntegration: false` and `contextIsolation: true` are configured
- [ ] Create input validation utilities for IPC handlers
- [ ] Add platform detection to choose between Tauri/Electron backends
- [ ] Implement BLE device scanning with filters
- [ ] Implement BLE device connection
- [ ] Implement BLE device disconnection
- [ ] Handle BLE connection state changes and disconnections
- [ ] Wire up BLE UI to use Electron backend when running in Electron

## Reference Files
- `src/preload/index.ts` - Preload script to extend
- `src/main/index.ts` - Main process entry point
- `src/renderer/src/tauri/index.ts` - API surface reference
- `src/renderer/src/tauri/ble.ts` - Tauri BLE implementation
- `src/renderer/src/transport/gatt.ts` - GATT transport layer

Parent issue: #28 Implement the communication with electron
https://github.com/Wolffyx/remappr/issues/28

## Analysis Requirements
Before implementing, analyze the following:
1. Identify all files that need to be modified
2. List any new files that need to be created
3. Check for existing patterns in the codebase to follow
4. Identify any dependencies or related components

## Implementation Steps
1. **Preparation**
   - Review existing code structure
   - Identify integration points

2. **Core Changes**
   - Implement the main functionality
   - Follow existing code patterns and conventions

3. **Integration**
   - Wire up new components
   - Update any necessary imports/exports

4. **Testing**
   - Add or update tests as needed
   - Verify existing tests still pass

## Verification
- Lint: `pnpm lint`
- Test: `pnpm test`
- Build: `pnpm build`

## Allowed Commands
- pnpm install
- pnpm lint
- pnpm test
- pnpm build

## Forbidden Paths
- .github/workflows/
- .gitlab-ci.yml

## Important Constraints
- Only use these commands: pnpm install, pnpm lint, pnpm test, pnpm build
- Do NOT modify these paths: .github/workflows/, .gitlab-ci.yml
- Working directory: D:\Projects\Typescript\React\zmk-studio-original-worktrees\github-37-implement-ble-communication-in-electron
- Repo root: D:\Projects\Typescript\React\zmk-studio-original
- After implementation, run the verification commands if they exist

## Verification Commands
- Lint: pnpm lint
- Test: pnpm test
- Build: pnpm build

## Project Memory (from .flowpatch)
### AGENTS.md (top)
# FlowPatch Agent Notes

- Where things live:
- Commands:
- When asked X check Y:

<!-- FLOWPATCH:BEGIN generated -->
## Index Summary (generated)

- Files indexed: 12862
- Chunks: 2614
- Symbols: 448
- Last indexed: 2026-01-16T21:30:24.757Z
- SHA: 279b0be269ff29650a01a9ea9bf9492f4261feab
<!-- FLOWPATCH:END generated -->

### ARCHITECTURE.md (top)
# Architecture

### PLAN.md (top)
# Implementation Plan

## Task Description
<!--
Provide a clear, concise summary of what needs to be built or fixed.
Include:
- The specific feature, bug, or improvement
- The user-facing behavior expected
- Any constraints or requirements

Example:
"Add a dark mode toggle to the settings page that persists user preference
to localStorage and applies the theme across all components."
-->


## Context & Background
<!--
Explain WHY this task exists and provide relevant context:
- Link to related issues, PRs, or discussions
- Describe the current behavior vs desired behavior
- Note any previous attempts or related work
- Include relevant technical debt or limitations

Example:
"Currently the app only supports light mode. Users have requested dark mode
support (Issue #123). The design team has provided mockups in Figma [link].
We use Tailwind CSS which has built-in dark mode support via the 'dark:' prefix."
-->


## Technical Analysis
<!--
Document your understanding of the codebase relevant to this task:
- Key files and their responsibilities
- Existing patterns to follow
- Dependencies and integrations affected
- Potential risks or edge cases

Example:
"Theme state should live in ThemeContext (src/contexts/ThemeContext.tsx).
All color classes need dark: variants. The Header, Sidebar, and Card
components are the main surfaces that need theme support."
-->


## Implementation Steps
<!--
Break down the work into discrete, actionable steps.
Each step should be:
- Small enough to verify independently
- Ordered by dependency (what must happen first)
- Clear about what "done" means for that step

Mark steps as you complete them: [ ] -> [x]
-->

1. [ ] **Step 1 title**: Description of what to do and expected outcome
2. [ ] **Step 2 title**: Description of what to do and expected outcome
3. [ ] **Step 3 title**: Description of what to do and expected outcome


## Files to Modify
<!--
List all files that will be created, modified, or deleted.
This helps track scope and ensures nothing is missed.
-->

| File | Action | Description |
|------|--------|-------------|
| `src/path/to/file.ts` | modify | Brief description of changes |
| `src/path/to/new-file.ts` | create | Purpose of new file |
| `src/path/to/old-file.ts` | delete | Why it's being removed |


## Testing Strategy
<!--
Define how to verify the implementation works correctly:
-->

### Unit Tests
<!-- Test individual functions/components in isolation -->
- [ ] Test case 1: Description and expected result
- [ ] Test case 2: Description and expected result

### Integration Tests
<!-- Test how components work together -->
- [ ] Test case 1: Description and expected result

### Manual Testing
<!-- Steps to manually verify the feature -->
- [ ] Step 1: Action to take and what to verify
- [ ] Step 2: Action to take and what to verify

### Edge Cases
<!-- Unusual scenarios to test -->
- [ ] Edge case 1: What could go wrong and how to test it


## Acceptance Criteria
<!--
Define the specific, measurable condit
…
### Suggested files (from local index)
- src/renderer/src/components/DeviceCard.tsx (symbol:DeviceStatus, symbol:DeviceCardProps, symbol:DeviceCard)
- src/renderer/src/stores/ConnectionStore.ts (symbol:ConnectionState, symbol:useConnectionStore, symbol:ConnectionState)
- src/renderer/src/components/DeviceList.tsx (symbol:DeviceList, symbol:DeviceListProps, symbol:DeviceList)
- src/renderer/src/transport/types.ts (symbol:SerialConnectionState, symbol:AvailableDevice, symbol:AvailableDevice)
- src/renderer/src/services/RpcConnectionService.ts (symbol:DeviceInfoDetails, symbol:useConnectedDeviceData, symbol:DeviceInfoDetails)
- src/renderer/src/behaviors/HidUsagePicker.stories.ts (symbol:Keyboard, symbol:KeyboardModSelection, symbol:KeyboardAndConsumer)
- src/renderer/src/rpc/ConnectionContext.ts (symbol:ConnectionState, symbol:ConnectionState, symbol:ConnectionContext)
- src/renderer/src/components/SimpleDevicePicker.tsx (symbol:SimpleDevicePicker, symbol:SimpleDevicePickerProps, symbol:SimpleDevicePicker)
- src/renderer/src/components/StartPage.tsx (symbol:DeviceWithTransport, symbol:DeviceWithTransport, symbol:DeviceWithTransport)
- src/renderer/src/components/keyboard/Keyboard.tsx (symbol:Keyboard, symbol:KeyboardProps)
- src/renderer/src/services/KeyboardKeypressService.ts (symbol:KeyboardKeypressService, symbol:keyboardKeypressService)
- src/renderer/src/data/keys/index.ts (symbol:KeyboardKeys, symbol:keyboards)
### Snippets (bounded, may be redacted)
(none)

Please implement the changes now.

## Iteration Context
This is iteration 1 of 3.

### Implementation Phase
Focus on implementing the card requirements:
- Work through the implementation plan
- Make meaningful progress on the feature
- Commit working chunks of code

### Current Subtask
Focus on this subtask: Set up Electron BLE permissions and device selection in main process
Update src/main/index.ts to handle Electron's Web Bluetooth permissions: register 'select-bluetooth-device' event handler on the webContents to present device chooser, and set up bluetooth-related permission request/check handlers. Create src/main/handlers/ble.ts with IPC handlers that coordinate the BLE flow between main and renderer processes (device selection callback, connection state tracking).

Remaining subtasks: 5

### Iteration Guidelines
- Focus on making incremental progress
- Commit meaningful chunks of work
- Leave the codebase in a working state
- If you complete the current subtask, move to the next one

## User Feedback from Issue Comments

The following feedback was provided by users on this issue. Please address these points:

### Additional Feedback
- No changes have been made in this task to be implemented

Please implement the changes manually following the plan above.
