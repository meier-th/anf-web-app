# ANF-Frontend Architecture

## Goals

- Keep UI behavior identical while reducing component bloat.
- Move data/realtime/business logic from components into injectable services.
- Eliminate component-to-component coupling (`injector.get(OtherComponent)`).

## Layer boundaries

- `src/app/core/api/*-api.service.ts`
  - Owns backend HTTP calls for a backend resource domain.
  - Components do not construct endpoint URLs or `HttpParams` directly.
- `src/app/core/realtime/*-realtime.service.ts`
  - Owns websocket client setup and topic subscriptions per domain.
  - Components do not instantiate `SockJS`/`Stomp` directly.
- `src/app/core/state/*.store.ts`
  - Shared cross-route state using Angular signals.
  - Components read/write shared state through stores, not through other components.
- `src/app/*/*.component.ts`
  - Owns view composition, local UI state, and template events.
  - Should be thin and depend on `core/api`, `core/realtime`, and `core/state`.

## Dependency injection rules

- Do not use `Injector.get(...)` to fetch peer components.
- Dialog communication must use `DynamicDialogConfig.data`, `DynamicDialogRef.close()`, and `ref.onClose`.
- Cross-component data sharing must go through stores/services, not parent component fields.

## Practical conventions

- Use `ApiConfigService.buildUrl()` for all backend endpoints.
- Keep pure/stateless utility logic in plain helper functions.
- Remove unused files and legacy scaffolding as soon as replacements are in place.

## Current migration status

- Parent-component service-locator coupling has been removed from auth/fight/profile/dialogue/queue/messages/animal-race-choice.
- Shared fight/lobby HTTP logic has started moving to:
  - `src/app/core/api/fight-api.service.ts`
  - `src/app/core/api/lobby-api.service.ts`
