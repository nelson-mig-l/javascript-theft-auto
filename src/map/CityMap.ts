export const MAP_DIMENSIONS = 256;
export const MAP_LAYERS_COUNT = 6;
export const METERS_PER_MAP_UNIT = 4;

const CMP_VERSION_CODE = 331;
const CMP_HEADER_SIZE = 28;
const BLOCK_RECORD_SIZE = 8;

export const BlockFace = {
  W: 0,
  E: 1,
  N: 2,
  S: 3,
  Lid: 4,
} as const;
export type BlockFace = (typeof BlockFace)[keyof typeof BlockFace];
export const BLOCK_FACES_COUNT = 5;

export const GroundType = {
  Air: 0,
  Water: 1,
  Road: 2,
  Pavement: 3,
  Field: 4,
  Building: 5,
} as const;
export type GroundType = (typeof GroundType)[keyof typeof GroundType];

export interface MapBlockInfo {
  readonly upDirection: boolean;
  readonly downDirection: boolean;
  readonly leftDirection: boolean;
  readonly rightDirection: boolean;
  readonly groundType: GroundType;
  readonly isFlat: boolean;
  /** 0 = none, 1-40 = gradient slopes, 41-44 = 45 degree slopes. */
  readonly slopeType: number;
  readonly lidRotation: number;
  readonly trafficHint: number;
  readonly remap: number;
  readonly flipTopBottomFaces: boolean;
  readonly flipLeftRightFaces: boolean;
  readonly isRailway: boolean;
  /** Texture index per face, indexed by `BlockFace`. Zero means no face. */
  readonly faces: readonly number[];
}

export const EMPTY_BLOCK: MapBlockInfo = Object.freeze({
  upDirection: false,
  downDirection: false,
  leftDirection: false,
  rightDirection: false,
  groundType: GroundType.Air,
  isFlat: false,
  slopeType: 0,
  lidRotation: 0,
  trafficHint: 0,
  remap: 0,
  flipTopBottomFaces: false,
  flipLeftRightFaces: false,
  isRailway: false,
  faces: Object.freeze([0, 0, 0, 0, 0]),
});

export class CityMap {
  readonly styleNumber: number;
  /** Indexed by [layer][y][x]; layer 0 is the lowest layer, as in Carnage3D. */
  private readonly tiles: MapBlockInfo[];

  constructor(styleNumber: number, tiles: MapBlockInfo[]) {
    if (tiles.length !== MAP_LAYERS_COUNT * MAP_DIMENSIONS * MAP_DIMENSIONS) {
      throw new Error(`Invalid city map tile count: ${tiles.length}`);
    }
    this.styleNumber = styleNumber;
    this.tiles = tiles;
  }

  /** Coordinates are clamped to the map bounds, matching Carnage3D's `GetBlockInfo`. */
  getBlock(x: number, y: number, layer: number): MapBlockInfo {
    const cx = clamp(x, 0, MAP_DIMENSIONS - 1);
    const cy = clamp(y, 0, MAP_DIMENSIONS - 1);
    const cz = clamp(layer, 0, MAP_LAYERS_COUNT - 1);
    return this.tiles[(cz * MAP_DIMENSIONS + cy) * MAP_DIMENSIONS + cx];
  }
}

/** Parses the block data of a GTA1 `.CMP` city map (see Carnage3D `GameMapManager::LoadFromFile`). */
export function parseCmp(buffer: ArrayBuffer): CityMap {
  const view = new DataView(buffer);
  if (buffer.byteLength < CMP_HEADER_SIZE) {
    throw new Error('CMP file is too small to contain a header');
  }

  const versionCode = view.getInt32(0, true);
  if (versionCode !== CMP_VERSION_CODE) {
    throw new Error(`Invalid CMP version code: ${versionCode}`);
  }

  const styleNumber = view.getUint8(4);
  const columnSize = view.getInt32(16, true);
  const blockSize = view.getInt32(20, true);

  if (columnSize % 2 !== 0) {
    throw new Error(`Invalid CMP column data size: ${columnSize}`);
  }
  if (blockSize % BLOCK_RECORD_SIZE !== 0) {
    throw new Error(`Invalid CMP block data size: ${blockSize}`);
  }

  const baseOffset = CMP_HEADER_SIZE;
  const baseSize = MAP_DIMENSIONS * MAP_DIMENSIONS * 4;
  const columnOffset = baseOffset + baseSize;
  const blockOffset = columnOffset + columnSize;
  if (blockOffset + blockSize > buffer.byteLength) {
    throw new Error('CMP file is truncated');
  }

  const columnData = new Uint16Array(columnSize / 2);
  for (let i = 0; i < columnData.length; ++i) {
    columnData[i] = view.getUint16(columnOffset + i * 2, true);
  }

  const blocks: MapBlockInfo[] = [];
  for (let offset = blockOffset; offset < blockOffset + blockSize; offset += BLOCK_RECORD_SIZE) {
    blocks.push(readBlock(view, offset));
  }

  const tiles = new Array<MapBlockInfo>(MAP_LAYERS_COUNT * MAP_DIMENSIONS * MAP_DIMENSIONS).fill(EMPTY_BLOCK);
  for (let y = 0; y < MAP_DIMENSIONS; ++y) {
    for (let x = 0; x < MAP_DIMENSIONS; ++x) {
      const columnByteOffset = view.getUint32(baseOffset + (y * MAP_DIMENSIONS + x) * 4, true);
      const column = columnByteOffset / 2;
      if (!Number.isInteger(column) || column >= columnData.length) {
        throw new Error(`Invalid CMP column offset at (${x}, ${y}): ${columnByteOffset}`);
      }

      const columnHeight = MAP_LAYERS_COUNT - columnData[column];
      if (columnHeight < 0 || columnHeight > MAP_LAYERS_COUNT || column + columnHeight >= columnData.length) {
        throw new Error(`Invalid CMP column height at (${x}, ${y}): ${columnHeight}`);
      }

      // Columns are stored top-down; layer 0 is the last entry.
      for (let layer = 0; layer < columnHeight; ++layer) {
        const blockIndex = columnData[column + columnHeight - layer];
        const block = blocks[blockIndex];
        if (!block) {
          throw new Error(`Invalid CMP block index at (${x}, ${y}, ${layer}): ${blockIndex}`);
        }
        tiles[(layer * MAP_DIMENSIONS + y) * MAP_DIMENSIONS + x] = block;
      }
    }
  }

  return new CityMap(styleNumber, tiles);
}

function readBlock(view: DataView, offset: number): MapBlockInfo {
  const typeMap = view.getUint16(offset, true);
  const typeMapExt = view.getUint8(offset + 2);

  return {
    upDirection: (typeMap & 0x01) !== 0,
    downDirection: (typeMap & 0x02) !== 0,
    leftDirection: (typeMap & 0x04) !== 0,
    rightDirection: (typeMap & 0x08) !== 0,
    groundType: ((typeMap >> 4) & 0x07) as GroundType,
    isFlat: (typeMap & 0x80) !== 0,
    slopeType: (typeMap >> 8) & 0x3f,
    lidRotation: (typeMap >> 14) & 0x03,
    trafficHint: typeMapExt & 0x07,
    remap: (typeMapExt >> 3) & 0x03,
    flipTopBottomFaces: (typeMapExt & 0x20) !== 0,
    flipLeftRightFaces: (typeMapExt & 0x40) !== 0,
    isRailway: (typeMapExt & 0x80) !== 0,
    // File order is W, E, N, S, Lid, matching `BlockFace`.
    faces: [
      view.getUint8(offset + 3),
      view.getUint8(offset + 4),
      view.getUint8(offset + 5),
      view.getUint8(offset + 6),
      view.getUint8(offset + 7),
    ],
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
