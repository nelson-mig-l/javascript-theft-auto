# JTA - Javascript Theft Auto

![Javascript Theft Auto banner](docs/images/banner.png)

A ~~JavaScript~~ TypeScript port of the Carnage3D game engine, built around Babylon.js and modern browser APIs.

> **Project status:** Phase 2 is in progress. The project can parse and render GTA1 city-map geometry with G24 textures and includes a basic WASD-driven car with camera modes, but it is not yet a complete playable port.

## Tech stack

- TypeScript
- Vite
- Babylon.js
- Cannon-es
- Howler
- Vitest
- ESLint
- Prettier

## Getting started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Vite will start the application in development mode.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check the TypeScript project |
| `npm run bundle` | Create the production Vite bundle in `dist/` |
| `npm run preview` | Preview the production Vite bundle locally |
| `npm run test` | Run the Vitest test suite |
| `npm run lint` | Run ESLint |
| `npm run format` | Format the project with Prettier |

The `build` and `bundle` commands are intentionally separate:

- **build** validates TypeScript without emitting files.
- **bundle** runs the Vite production build used for deployment.

## GitHub Pages

The project is configured to be deployable as a Vite static site on GitHub Pages.

The expected production URL is:

**https://nelson-mig-l.github.io/javascript-theft-auto/**

The repository should use **GitHub Actions** as its Pages publishing source.

The deployment process should:

1. Install dependencies.
2. Run the TypeScript check with `npm run build`.
3. Create the production bundle with `npm run bundle`.
4. Publish the generated `dist/` directory to GitHub Pages.

### Deployment / Asset paths

Vite uses a relative base path so the generated site works both under the GitHub Pages repository URL and when served from the custom domain. Runtime asset paths should likewise remain relative (for example, `./assets`) rather than root-relative paths such as `/assets`.

If the deployment model changes, revisit these paths together; changing only one can cause assets to work in one hosting environment but fail in the other.

## Phase 2

Phase 2 moves beyond the initial runtime shell and begins implementing the core GTA1 world and driving loop.

Implemented so far:

- Parse GTA1 `.CMP` city maps, including the six map layers, columns, and block metadata.
- Parse `.G24` style data for block textures, palettes, and block animations.
- Render city blocks in Babylon.js using the parsed style textures.
- Drive a basic car with WASD controls, steering, acceleration, braking/reverse, and preliminary map collision/height handling.
- Follow camera that tracks the car, plus a toggleable top-down camera mode.
- Tests for CMP parsing and city-mesh generation, plus documentation of parsed and not-yet-parsed CDS sections.
- Developer tools for inspecting and converting GTA1/Carnage3D map and style assets.

This is an incremental port: these features provide a first world-rendering and driving prototype, not complete parity with Carnage3D or the original GTA1 game.

## Architecture

The main runtime components are organized roughly as follows:

```text
src/
├── assets/       Asset loading and manifest
├── core/         Engine, game loop, and state machine
├── game/         Game states
├── graphics/     Babylon.js rendering
├── input/        Keyboard and gamepad input
├── physics/      Physics-related systems
└── __tests__/    Smoke/unit tests
```

The intended engine structure is centered around `GameEngine`, which coordinates rendering, input, assets, physics, and game state.

## Current limitations

This repository is still under active development. Current limitations include:

- The current driving loop is a prototype; handling, collision response, slopes, vehicle physics, and camera behavior still need validation against the original game.
- CMP parsing/rendering covers the map's base, column, and block data, but startup objects, routes, service locations, and named district/navigation data are not yet parsed into runtime systems.
- G24 support currently focuses on block tiles, palettes, and animations. Sprite metadata/graphics and deltas, sprite category numbering, object metadata, vehicle metadata/remaps, and related runtime rendering are not yet fully integrated.
- The car is a basic controllable prototype; traffic, pedestrians, police, emergency services, missions, weapons, pickups, damage, and full gameplay rules are not implemented.
- The broader audio, UI/menu, and game-state flows remain incomplete.
- Input is integrated for the basic keyboard driving controls and camera toggle, but full gamepad/action behavior and the original game's input semantics remain incomplete.
- Tests cover selected parsing and geometry logic; they do not replace running the game with real GTA1 assets in a browser/WebGL environment.
- Production deployment requires the Vite bundle rather than the TypeScript type-check alone.

The CDS coverage table in the project planning notes identifies which file sections are parsed and which remain pending. These limitations mean the project is a work-in-progress port, not a complete game.

## Testing

Run the test suite with:

```bash
npm run test
```

For a quick development check, it is also useful to run:

```bash
npm run build
npm run bundle
```

## Development workflow

A typical development cycle is:

```bash
npm install
npm run build
npm run test
npm run bundle
npm run preview
```

Then continue implementing the next phase of the port.

## Roadmap

The immediate objective is to continue Phase 2 by making the world and driving prototype more faithful and data-driven.

Priority areas:

1. Complete and validate `.CMP` parsing for startup objects, routes, service locations, and navigation/district rectangles.
2. Extend `.G24` parsing to sprite metadata, sprite graphics/deltas, sprite numbering, object metadata, and vehicle metadata/remaps; connect those records to runtime asset loading.
3. Improve city rendering and vehicle behavior against Carnage3D, including collision/height edge cases, slopes, camera tuning, and textured geometry validation.
4. Add world entities such as static objects, vehicles, pedestrians, traffic, and service/police systems as the underlying data becomes available.
5. Replace remaining placeholder UI/gameplay flows and progressively implement the original game's mechanics, audio, and mission systems.
6. Expand automated tests and verify the build in a real browser with representative GTA1 assets.

The order may change as format findings and runtime testing expose dependencies. The goal is to build on the current map-rendering and driving prototype rather than treating Phase 2 as complete.

## AI Usage

This project makes use of AI-assisted development tools. AI has been used to help with code generation, refactoring, debugging, documentation, and development workflows.

All AI-generated contributions are reviewed, tested, and integrated as part of the project's development process. The project remains maintained and directed by its human author.
