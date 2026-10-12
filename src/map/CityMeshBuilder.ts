import {
  BLOCK_FACES_COUNT,
  BlockFace,
  CityMap,
  GroundType,
  MAP_LAYERS_COUNT,
  MapBlockInfo,
  METERS_PER_MAP_UNIT,
} from './CityMap';

export interface MapArea {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CityMeshData {
  /** xyz triplets in Babylon world space. */
  positions: Float32Array;
  /** rgba quadruplets. */
  colors: Float32Array;
  indices: Uint32Array;
}

type Vec3 = [number, number, number];
type Rgb = [number, number, number];

const GROUND_COLORS: Record<GroundType, Rgb> = {
  [GroundType.Air]: [0.55, 0.55, 0.58],
  [GroundType.Water]: [0.16, 0.36, 0.7],
  [GroundType.Road]: [0.3, 0.3, 0.32],
  [GroundType.Pavement]: [0.62, 0.6, 0.56],
  [GroundType.Field]: [0.3, 0.56, 0.24],
  [GroundType.Building]: [0.66, 0.52, 0.4],
};
const WALL_COLOR: Rgb = [0.62, 0.48, 0.38];
const FACE_SHADE: Record<BlockFace, number> = {
  [BlockFace.W]: 0.6,
  [BlockFace.E]: 0.7,
  [BlockFace.N]: 0.8,
  [BlockFace.S]: 0.9,
  [BlockFace.Lid]: 1,
};

/**
 * Builds untextured geometry for every block face in `area`, porting Carnage3D's
 * `GameMapHelpers::BuildMapMesh`/`PutBlockFace`.
 *
 * Carnage3D uses a right-handed space with map Y along +Z; Babylon is left-handed,
 * so map Y is mapped to -Z to keep north pointing away from a default camera.
 */
export function buildCityMeshData(map: CityMap, area: MapArea): CityMeshData {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let layer = 0; layer < MAP_LAYERS_COUNT; ++layer) {
    for (let y = area.y; y < area.y + area.h; ++y) {
      for (let x = area.x; x < area.x + area.w; ++x) {
        const block = map.getBlock(x, y, layer);
        for (let face = 0; face < BLOCK_FACES_COUNT; ++face) {
          if (block.faces[face] === 0) {
            continue;
          }
          const baseVertex = positions.length / 3;
          for (const point of getFaceVertices(block, face as BlockFace, x, y, layer)) {
            positions.push(point[0], point[1], -point[2]);
          }
          const [r, g, b] = getFaceColor(map, block, face as BlockFace, x, y, layer);
          for (let i = 0; i < 4; ++i) {
            colors.push(r, g, b, 1);
          }
          indices.push(baseVertex + 3, baseVertex + 1, baseVertex + 0, baseVertex + 3, baseVertex + 2, baseVertex + 1);
        }
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    indices: new Uint32Array(indices),
  };
}

/** Returns the four face corners in Carnage3D map space (meters, Y up, map Y along +Z). */
export function getFaceVertices(block: MapBlockInfo, face: BlockFace, x: number, y: number, layer: number): Vec3[] {
  const cube = getCubePoints(block.slopeType);
  const offset: Vec3 = [x * METERS_PER_MAP_UNIT, layer * METERS_PER_MAP_UNIT, y * METERS_PER_MAP_UNIT];
  let corners: number[];

  switch (face) {
    case BlockFace.Lid:
      corners = [4, 5, 1, 0];
      break;
    case BlockFace.S:
      // Flat blocks draw their S face at the N position.
      corners = block.isFlat ? [4, 5, 6, 7] : [0, 1, 2, 3];
      break;
    case BlockFace.N:
      corners = [5, 4, 7, 6];
      break;
    case BlockFace.W:
      corners = [4, 0, 3, 7];
      break;
    case BlockFace.E:
      // Flat blocks draw their E face at the W position.
      corners = block.isFlat ? [0, 4, 7, 3] : [1, 5, 6, 2];
      break;
  }

  return corners.map((index) => {
    const point = cube[index];
    return [point[0] + offset[0], point[1] + offset[1], point[2] + offset[2]];
  });
}

function getCubePoints(slope: number): Vec3[] {
  const points: Vec3[] = [
    [0, 1, 1],
    [1, 1, 1],
    [1, 0, 1],
    [0, 0, 1],
    [0, 1, 0],
    [1, 1, 0],
    [1, 0, 0],
    [0, 0, 0],
  ];

  const setHeight = (a: number, b: number, height: number) => {
    points[a][1] = height;
    points[b][1] = height;
  };

  if (slope >= 1 && slope <= 8) {
    // 26 degree slopes, two blocks per full rise.
    const step = (slope - 1) % 2;
    const low = step / 2;
    const high = (step + 1) / 2;
    applySlope(Math.floor((slope - 1) / 2), low, high, setHeight);
  } else if (slope >= 9 && slope <= 40) {
    // 7 degree slopes, eight blocks per full rise.
    const step = (slope - 9) % 8;
    const low = step / 8;
    const high = (step + 1) / 8;
    applySlope(Math.floor((slope - 9) / 8), low, high, setHeight);
  } else if (slope === 41) {
    setHeight(0, 1, 0);
  } else if (slope === 42) {
    setHeight(4, 5, 0);
  } else if (slope === 43) {
    setHeight(1, 5, 0);
  } else if (slope === 44) {
    setHeight(0, 4, 0);
  }

  return points.map(([px, py, pz]) => [px * METERS_PER_MAP_UNIT, py * METERS_PER_MAP_UNIT, pz * METERS_PER_MAP_UNIT]);
}

/** direction: 0 = N, 1 = S, 2 = W, 3 = E (the edge that rises to `high`). */
function applySlope(
  direction: number,
  low: number,
  high: number,
  setHeight: (a: number, b: number, height: number) => void,
): void {
  switch (direction) {
    case 0:
      setHeight(0, 1, low);
      setHeight(4, 5, high);
      break;
    case 1:
      setHeight(4, 5, low);
      setHeight(0, 1, high);
      break;
    case 2:
      setHeight(1, 5, low);
      setHeight(0, 4, high);
      break;
    case 3:
      setHeight(0, 4, low);
      setHeight(1, 5, high);
      break;
  }
}

function getFaceColor(map: CityMap, block: MapBlockInfo, face: BlockFace, x: number, y: number, layer: number): Rgb {
  const shade = FACE_SHADE[face];
  let base = WALL_COLOR;

  if (face === BlockFace.Lid) {
    // Ground type bits are stored in the block above the one holding the lid graphic.
    const above = layer + 1 < MAP_LAYERS_COUNT ? map.getBlock(x, y, layer + 1).groundType : GroundType.Air;
    const groundType = above !== GroundType.Air ? above : block.groundType;
    base = GROUND_COLORS[groundType];
  }

  return [base[0] * shade, base[1] * shade, base[2] * shade];
}
