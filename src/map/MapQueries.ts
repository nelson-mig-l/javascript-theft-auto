import { CityMap, GroundType, MAP_DIMENSIONS, MAP_LAYERS_COUNT, MapBlockInfo } from './CityMap';

/**
 * Height of a slope surface above the block's bottom, in map units, at block-local
 * `cx`, `cy` (0..1, `cy` grows southwards). Port of `GameMapHelpers::GetSlopeHeight`.
 */
export function getSlopeHeight(slopeType: number, cx: number, cy: number): number {
  let direction: number;
  let low: number;
  let high: number;
  if (slopeType >= 1 && slopeType <= 8) {
    direction = Math.floor((slopeType - 1) / 2);
    low = ((slopeType - 1) % 2) / 2;
    high = low + 1 / 2;
  } else if (slopeType >= 9 && slopeType <= 40) {
    direction = Math.floor((slopeType - 9) / 8);
    low = ((slopeType - 9) % 8) / 8;
    high = low + 1 / 8;
  } else if (slopeType >= 41 && slopeType <= 44) {
    direction = slopeType - 41;
    low = 0;
    high = 1;
  } else {
    return 0;
  }

  // direction is the edge that rises to `high`: 0 = N, 1 = S, 2 = W, 3 = E.
  switch (direction) {
    case 0:
      return high + (low - high) * cy;
    case 1:
      return low + (high - low) * cy;
    case 2:
      return high + (low - high) * cx;
    default:
      return low + (high - low) * cx;
  }
}

/**
 * Ground height in map units below the point (`x`, `y`, `z` in map units), falling
 * through air (and water when `excludeWater`). Port of `GameMapManager::GetHeightAtPosition`.
 *
 * CMP stores ground types in the block above the one drawing the surface, so the
 * slope geometry of a downhill road lives one layer below the road's ground type.
 */
export function getHeightAtPosition(map: CityMap, x: number, y: number, z: number, excludeWater = true): number {
  const px = clamp(x, 0, MAP_DIMENSIONS - 1e-3);
  const py = clamp(y, 0, MAP_DIMENSIONS - 1e-3);
  const bx = Math.floor(px);
  const by = Math.floor(py);

  const slopeHeight = (block: MapBlockInfo, layer: number) => layer + getSlopeHeight(block.slopeType, px - bx, py - by);

  for (let layer = clamp(Math.floor(z), 0, MAP_LAYERS_COUNT - 1); layer > 0; --layer) {
    const block = map.getBlock(bx, by, layer);
    if (block.slopeType) {
      return slopeHeight(block, layer);
    }
    if (block.groundType === GroundType.Air || (block.groundType === GroundType.Water && excludeWater)) {
      continue;
    }
    const below = map.getBlock(bx, by, layer - 1);
    return below.slopeType ? slopeHeight(below, layer - 1) : layer;
  }
  return 0;
}

/** Building blocks at the layer of `z` are solid walls, as in `PhysicsManager`'s map contact filter. */
export function isWallAt(map: CityMap, x: number, y: number, z: number): boolean {
  if (x < 0 || y < 0 || x >= MAP_DIMENSIONS || y >= MAP_DIMENSIONS) {
    return true;
  }
  return map.getBlock(Math.floor(x), Math.floor(y), Math.floor(z + 0.5)).groundType === GroundType.Building;
}

export interface MapSpawn {
  /** Map units. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Radians clockwise from north (map -Y). */
  readonly heading: number;
}

/** Finds the one-way road block closest to the map centre, facing its traffic direction. */
export function findRoadSpawn(map: CityMap): MapSpawn {
  const center = MAP_DIMENSIONS / 2;
  for (let radius = 0; radius < center; ++radius) {
    for (let y = center - radius; y <= center + radius; ++y) {
      for (let x = center - radius; x <= center + radius; ++x) {
        if (Math.max(Math.abs(x - center), Math.abs(y - center)) !== radius) {
          continue;
        }
        const spawn = getRoadSpawn(map, x, y);
        if (spawn) {
          return spawn;
        }
      }
    }
  }
  return { x: center + 0.5, y: center + 0.5, z: getHeightAtPosition(map, center + 0.5, center + 0.5, MAP_LAYERS_COUNT), heading: 0 };
}

function getRoadSpawn(map: CityMap, x: number, y: number): MapSpawn | null {
  const z = getHeightAtPosition(map, x + 0.5, y + 0.5, MAP_LAYERS_COUNT);
  if (!Number.isInteger(z)) {
    return null;
  }
  const block = map.getBlock(x, y, z);
  if (block.groundType !== GroundType.Road || block.slopeType) {
    return null;
  }
  const directions: [boolean, number][] = [
    [block.upDirection, 0],
    [block.rightDirection, Math.PI / 2],
    [block.downDirection, Math.PI],
    [block.leftDirection, -Math.PI / 2],
  ];
  const open = directions.filter(([flag]) => flag);
  if (open.length !== 1) {
    return null;
  }
  for (let dy = -1; dy <= 1; ++dy) {
    for (let dx = -1; dx <= 1; ++dx) {
      if (isWallAt(map, x + dx + 0.5, y + dy + 0.5, z)) {
        return null;
      }
    }
  }
  return { x: x + 0.5, y: y + 0.5, z, heading: open[0][1] };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
