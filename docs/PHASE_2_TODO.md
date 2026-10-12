| Phase 2 requirement                  | Current status                                           | Assessment                |
| ------------------------------------ | -------------------------------------------------------- | ------------------------- |
| **2.1 Babylon.js Engine**            | `RenderEngine` creates `BABYLON.Engine`                  | ✅ Done                    |
| **2.1 Scene**                        | Creates Babylon `Scene`                                  | ✅ Done                    |
| **2.1 Camera**                       | `CameraRig` creates/configures camera                    | ⚠️ Partial                |
| **2.1 Lighting**                     | Hemispheric light exists                                 | ✅ Done                    |
| **2.1 Shadows**                      | No shadow system                                         | ❌ Missing                 |
| **2.1 Render entry point**           | `render()` exists                                        | ✅ Done                    |
| **2.1 Resize**                       | Window resize → `engine.resize()`                        | ✅ Done                    |
| **2.2 Texture rendering**            | Images converted to Babylon `RawTexture`                 | ⚠️ Partial                |
| **2.2 DynamicTexture**               | Used for font showcase                                   | ✅ Done                    |
| **2.2 Mesh rendering**               | Ground, sphere, box, plane                               | ✅ Done                    |
| **2.2 Materials/transforms**         | StandardMaterial + transforms                            | ✅ Done                    |
| **2.2 Sprite rendering**             | Current "sprite" is actually a textured box              | ❌ Missing                 |
| **2.2 Sprite positioning/scaling**   | No real sprite abstraction                               | ❌ Missing                 |
| **2.2 Atlas regions**                | Manifest has atlas metadata, but not implemented         | ❌ Missing                 |
| **2.2 Billboards**                   | Not implemented                                          | ❌ Missing                 |
| **2.2 ShaderMaterial**               | No implementation                                        | ❌ Missing                 |
| **2.2 HUD/GUI**                      | No Babylon GUI/DOM HUD abstraction                       | ❌ Missing                 |
| **2.3 AssetLoader**                  | Exists and loads runtime assets                          | ✅ Done                    |
| **2.3 Texture loading**              | Implemented                                              | ✅ Done                    |
| **2.3 Sprite-sheet loading**         | No actual sheet/region handling                          | ❌ Missing                 |
| **2.3 Model/mesh data loading**      | Not implemented                                          | ❌ Missing                 |
| **2.3 Resource caching**             | `Map<string, LoadedAsset>` exists                        | ⚠️ Partial                |
| **2.3 Duplicate-load prevention**    | Currently reloads assets                                 | ❌ Missing                 |
| **2.3 `.sty` parsing**               | G24 block tiles, palettes and animations; sprites pending | ⚠️ Partial                |
| **2.3 Relative paths**               | `./assets/...`                                           | ✅ Done                    |
| **2.4 GTA1 camera**                  | Babylon FollowCamera                                     | ⚠️ Partial                |
| **2.4 Configurable zoom**            | No abstraction                                           | ❌ Missing                 |
| **2.4 Configurable camera position** | Hard-coded initial position                              | ⚠️ Partial                |
| **2.5 Rendering isolation**          | RenderEngine/SceneManager separation                     | ✅ Good foundation         |
| **2.5 Game-oriented renderer API**   | Only `showLoadedAssets()`/basic methods                  | ⚠️ Partial                |
| **2.6 Game-loop integration**        | Integrated with `GameEngine.tick()`                      | ✅ Done                    |
| **2.7 Canvas resizing**              | Implemented                                              | ✅ Done                    |
| **2.7 Fullscreen support**           | Not explicitly implemented                               | ❌ Missing                 |
| **2.7 Pointer/touch foundation**     | Camera attaches controls, but no dedicated rendering API | ⚠️ Partial                |
| **2.8 Async loading**                | `loadAll()` is async                                     | ✅ Done                    |
| **2.8 Resource reuse**               | Map exists, but no reuse on repeated loads               | ⚠️ Partial                |
| **2.8 Avoid per-frame recreation**   | Current loop doesn't recreate scene objects              | ✅ Done                    |
| **2.9 Minimal rendered scene**       | Working browser scene                                    | ✅ Done                    |
| **2.10 Relative asset path test**    | Covered by tests                                         | ✅ Done                    |
| **2.10 Browser rendering**           | Confirmed working                                        | ✅ Done                    |

### The biggest gaps

There are five real pieces of Phase 2 work remaining:

1. GTA1 camera
  - Current `CameraRig` uses `BABYLON.FreeCamera`.
  - Phase 2 calls for an isometric/orthographic-style camera direction.
  - Zoom/position should become configurable.
2. Real sprite renderer
  - The current `test.sprite` gets turned into a `RawTexture`, but then is placed on a 3D box.
  - That's a useful Phase 1 showcase, but it isn't a `Sprite2D` replacement yet.
  - We need a plane/billboard sprite abstraction and eventually atlas regions.
3. ShaderMaterial support
  - No `ShaderMaterial` abstraction exists yet.
4. HUD/GUI integration point
  - No Babylon GUI or DOM/CSS HUD layer exists yet.
5. Asset caching
  - This one is subtle.
  - `loadedAssets` stores results, but `loadAsset()` doesn't check the cache before loading.
  - So it isn't yet true duplicate-load prevention.

### Original data format coverage

Section numbers refer to DMA's *CityScape Data Structure* document (CDS, v12.10); Carnage3D's corrections are in `carnage/docs/CorrectionsToCDS.txt`. Sizes are from `NYC.CMP` / `STYLE001.G24`.

Parsed today:

| Data                                   | CDS            | Implementation                      |
| -------------------------------------- | -------------- | ----------------------------------- |
| CMP header, `base`, `column`, `block`  | §2.1–2.4, §2.9 | `parseCmp` (`src/map/CityMap.ts`)   |
| G24 header, side/lid/aux block tiles   | §3.1, §3.7–3.8 | `parseG24` (`src/map/StyleData.ts`) |
| G24 block animations                   | §3.1.1         | `parseG24`, `BlockTextureAtlas`     |
| G24 paged CLUTs and `palette_index`    | §3.5, §3.8.1   | `parseG24`                          |

Not parsed yet (sections are currently skipped by offset):

| Data                         | CDS              | Contents                                                                                                                                                                                                                       | Carnage3D reference                                      | Size in NYC        |
| ---------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ------------------ |
| CMP `object_pos`             | §2.5–2.5.3       | 14-byte startup records: position, object type, remap, rotation/pitch/roll. `remap >= 128` marks a parked car (`type` indexes `car_info`); traffic light boxes store a roadblock route number in `rotation`. Max 2500 objects + 250 cars. | `GameMapManager::ReadStartupObjects`                     | 42210 bytes        |
| CMP `route`                  | §2.6–2.6.1       | Police routes (`route_type` 255) and roadblock routes (0–253): `num_vertices`, `route_type`, then `x,y,z` byte vertices.                                                                                                        | `GameMapManager::ReadRoutes` (skipped there too)         | 2423 bytes         |
| CMP `location_data`          | §2.7             | `x,y,z` byte positions for up to 6 police stations, hospitals and fire stations (plus 3 unused tables); `(0,0,0)` = unused.                                                                                                    | `GameMapManager::ReadServiceBaseLocations`               | 108 bytes (fixed)  |
| CMP `nav_data`               | §2.8             | 35-byte named rectangles: `x,y,w,h`, sample number, 30-char name. Smaller areas win on overlap; drives district names.                                                                                                          | `GameMapManager::ReadNavData`                            | 980 bytes          |
| G24 `object_info`            | §3.1.2–3.1.2.1   | Per object type: collision size (pixels, 64 per block), first sprite, weight, aux, status (normal/ignorable/smashable/invisible), break-into list. Animated objects reuse the fields for frame count, cycles/frame and life.      | `StyleData::ReadObjects`                                 | 2040 bytes         |
| G24 `car_info`               | §3.1.3–3.1.4     | Per car type: size, first sprite, speed/handling descriptors, 12 HLS remaps, vehicle type and model, crane values, physics constants (16.16 fixed point), audio flags, door positions.                                           | `StyleData::ReadVehicles`                                | 6972 bytes         |
| G24 `sprite_info`            | §3.2.1           | Per sprite: width, height, delta count, size, page position and CLUT (24-bit layout per `CorrectionsToCDS.txt`), then delta sizes and offsets.                                                                                    | `StyleData::ReadSprites`                                 | 14706 bytes        |
| G24 24-bit remaps            | §3.2.2           | `h,l,s` remaps used by `car_info`; hue > 1000 means load `remapXXX.tga`.                                                                                                                                                        | `StyleData::ReadVehicles`                                | inside `car_info`  |
| G24 `sprite_graphics`        | §3.2.3–3.2.3.3   | Paged 8-bit sprite pixels followed by deltas (`offset`, `length`, `data` runs relative to the last position).                                                                                                                   | `StyleData::ReadSpriteGraphics`                          | 1137400 bytes      |
| G24 `sprite_numbers`         | §3.2.4           | Count of sprites per category (arrows, digits, cars, peds, objects, …), used to turn relative sprite numbers into absolute ones.                                                                                                 | `StyleData::ReadSpriteNumbers`                           | 42 bytes           |

Note: CDS §2.4 says `blockd[0]` is the ground-level block, but the NYC data (and Carnage3D) store columns top-down; `parseCmp` follows the data.
