import { describe, expect, it } from 'vitest';
import { CityMap, EMPTY_BLOCK, GroundType, MAP_DIMENSIONS, MAP_LAYERS_COUNT, MapBlockInfo } from '../../map/CityMap';
import { findRoadSpawn, getHeightAtPosition, getSlopeHeight, isWallAt } from '../../map/MapQueries';
import { Car } from '../Car';
import { GameplayState } from '../GameplayState';

type BlockPatch = [x: number, y: number, layer: number, block: Partial<MapBlockInfo>];

/** Flat road at height 1 (ground types live in the block above the lid). */
function createMap(patches: BlockPatch[] = []): CityMap {
  const tiles = new Array<MapBlockInfo>(MAP_LAYERS_COUNT * MAP_DIMENSIONS * MAP_DIMENSIONS).fill(EMPTY_BLOCK);
  const road = { ...EMPTY_BLOCK, groundType: GroundType.Road };
  tiles.fill(road, MAP_DIMENSIONS * MAP_DIMENSIONS, 2 * MAP_DIMENSIONS * MAP_DIMENSIONS);
  for (const [x, y, layer, block] of patches) {
    tiles[(layer * MAP_DIMENSIONS + y) * MAP_DIMENSIONS + x] = { ...EMPTY_BLOCK, ...block };
  }
  return new CityMap(1, tiles);
}

function drive(car: Car, map: CityMap, seconds: number, throttle: number, steer = 0): void {
  for (let i = 0; i < seconds * 60; ++i) {
    car.update(1 / 60, { throttle, steer }, map);
  }
}

describe('map queries', () => {
  it('interpolates slopes towards their high edge', () => {
    expect(getSlopeHeight(1, 0.5, 0)).toBe(0.5);
    expect(getSlopeHeight(1, 0.5, 1)).toBe(0);
    expect(getSlopeHeight(12, 0, 0.5)).toBeCloseTo(3.5 / 8);
    expect(getSlopeHeight(44, 0.25, 0)).toBe(0.25);
  });

  it('falls through air to the road surface', () => {
    const map = createMap();
    expect(getHeightAtPosition(map, 10.5, 10.5, 5)).toBe(1);
  });

  it('follows a downhill slope stored below the road ground type', () => {
    const map = createMap([
      [20, 20, 1, { groundType: GroundType.Road }],
      [20, 20, 0, { slopeType: 43 }],
    ]);
    expect(getHeightAtPosition(map, 20.75, 20.5, 1.2)).toBeCloseTo(0.25);
  });

  it('treats building blocks at the current layer as walls', () => {
    const map = createMap([[30, 30, 1, { groundType: GroundType.Building }]]);
    expect(isWallAt(map, 30.5, 30.5, 1)).toBe(true);
    expect(isWallAt(map, 31.5, 30.5, 1)).toBe(false);
    expect(isWallAt(map, -1, 30.5, 1)).toBe(true);
  });

  it('spawns on a one-way road facing its direction', () => {
    const map = createMap([[128, 128, 1, { groundType: GroundType.Road, rightDirection: true }]]);
    expect(findRoadSpawn(map)).toEqual({ x: 128.5, y: 128.5, z: 1, heading: Math.PI / 2 });
  });
});

describe('Car', () => {
  it('accelerates forward along its heading', () => {
    const map = createMap();
    const car = new Car(512, 512, 4, 0);

    drive(car, map, 1, 1);

    expect(car.speed).toBeCloseTo(12, 0);
    expect(car.y).toBeLessThan(507);
    expect(car.x).toBeCloseTo(512);
    expect(car.z).toBe(4);
  });

  it('turns left with negative steer and brakes into reverse', () => {
    const map = createMap();
    const car = new Car(512, 512, 4, 0);

    drive(car, map, 1, 1, -1);
    expect(car.heading).toBeLessThan(-0.5);

    drive(car, map, 1.5, -1);
    expect(car.speed).toBeLessThan(0);
  });

  it('stops at building walls', () => {
    const map = createMap([[128, 126, 1, { groundType: GroundType.Building }]]);
    const car = new Car(128.5 * 4, 128 * 4, 4, 0);

    drive(car, map, 2, 1);

    expect(car.y).toBeGreaterThanOrEqual(127 * 4 + 2.2);
    expect(car.speed).toBe(0);
  });

  it('falls into holes in the road', () => {
    const map = createMap([[64, 63, 1, { groundType: GroundType.Air }]]);
    const falling = new Car(64.5 * 4, 63.5 * 4, 4, 0);
    drive(falling, map, 1, 0);
    expect(falling.z).toBe(0);
  });
});

describe('GameplayState', () => {
  it('drives the car from input actions', () => {
    const map = createMap();
    const input = { isPressed: (action: string) => action === 'moveUp' };
    const state = new GameplayState(input as never);

    state.setCityMap(map);
    const startY = state.getCar()!.y;
    state.update(0.5);
    state.update(0.5);

    expect(state.getCar()!.y).toBeLessThan(startY);
  });
});
