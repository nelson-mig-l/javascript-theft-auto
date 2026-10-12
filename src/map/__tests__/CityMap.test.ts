import { describe, expect, it } from 'vitest';
import { BlockFace, GroundType, MAP_DIMENSIONS, MAP_LAYERS_COUNT, parseCmp } from '../CityMap';
import { buildCityMeshData, getFaceVertices } from '../CityMeshBuilder';

type BlockRecord = { typeMap: number; typeMapExt?: number; faces: [number, number, number, number, number] };

/** Builds a minimal CMP where every cell shares one column, plus one custom column at (1, 2). */
function createCmp(blocks: BlockRecord[], defaultColumn: number[], customColumn: number[]): ArrayBuffer {
  const columns = [MAP_LAYERS_COUNT - defaultColumn.length, ...defaultColumn, MAP_LAYERS_COUNT - customColumn.length, ...customColumn];
  const columnSize = columns.length * 2;
  const blockSize = blocks.length * 8;
  const buffer = new ArrayBuffer(28 + MAP_DIMENSIONS * MAP_DIMENSIONS * 4 + columnSize + blockSize + 16);
  const view = new DataView(buffer);

  view.setInt32(0, 331, true);
  view.setUint8(4, 1);
  view.setInt32(16, columnSize, true);
  view.setInt32(20, blockSize, true);

  let offset = 28;
  const customColumnOffset = (defaultColumn.length + 1) * 2;
  for (let y = 0; y < MAP_DIMENSIONS; ++y) {
    for (let x = 0; x < MAP_DIMENSIONS; ++x) {
      view.setUint32(offset, x === 1 && y === 2 ? customColumnOffset : 0, true);
      offset += 4;
    }
  }
  for (const value of columns) {
    view.setUint16(offset, value, true);
    offset += 2;
  }
  for (const block of blocks) {
    view.setUint16(offset, block.typeMap, true);
    view.setUint8(offset + 2, block.typeMapExt ?? 0);
    block.faces.forEach((face, index) => view.setUint8(offset + 3 + index, face));
    offset += 8;
  }
  return buffer;
}

const ROAD_LID: BlockRecord = { typeMap: 0, faces: [0, 0, 0, 0, 7] };
const ROAD_MARKER: BlockRecord = { typeMap: (GroundType.Road << 4) | 0x01, faces: [0, 0, 0, 0, 0] };
const BUILDING: BlockRecord = {
  typeMap: (GroundType.Building << 4) | (3 << 14),
  typeMapExt: 0x40 | (2 << 3),
  faces: [1, 2, 3, 4, 5],
};

describe('parseCmp', () => {
  it('decompresses columns bottom-up and decodes block bits', () => {
    // Columns are stored top-down: the last entry is layer 0.
    const map = parseCmp(createCmp([ROAD_LID, ROAD_MARKER, BUILDING], [1, 0], [2, 2, 0]));

    expect(map.styleNumber).toBe(1);
    expect(map.getBlock(0, 0, 0).faces[BlockFace.Lid]).toBe(7);
    expect(map.getBlock(0, 0, 1)).toMatchObject({ groundType: GroundType.Road, upDirection: true });
    expect(map.getBlock(0, 0, 2).faces).toEqual([0, 0, 0, 0, 0]);

    const building = map.getBlock(1, 2, 2);
    expect(building).toMatchObject({
      groundType: GroundType.Building,
      lidRotation: 3,
      remap: 2,
      flipLeftRightFaces: true,
      flipTopBottomFaces: false,
    });
    expect(building.faces).toEqual([1, 2, 3, 4, 5]);
    expect(map.getBlock(1, 2, 3).groundType).toBe(GroundType.Air);
  });

  it('clamps out-of-range coordinates', () => {
    const map = parseCmp(createCmp([ROAD_LID], [0], [0]));

    expect(map.getBlock(-5, 999, -1)).toBe(map.getBlock(0, MAP_DIMENSIONS - 1, 0));
  });

  it('rejects files with an invalid version code', () => {
    const buffer = createCmp([ROAD_LID], [0], [0]);
    new DataView(buffer).setInt32(0, 1, true);

    expect(() => parseCmp(buffer)).toThrow(/version/);
  });

  it('rejects truncated files', () => {
    const buffer = createCmp([ROAD_LID], [0], [0]);

    expect(() => parseCmp(buffer.slice(0, 1000))).toThrow(/truncated/);
  });
});

describe('buildCityMeshData', () => {
  it('emits one quad per visible face', () => {
    const map = parseCmp(createCmp([ROAD_LID, ROAD_MARKER, BUILDING], [1, 0], [2, 2, 0]));
    const data = buildCityMeshData(map, { x: 0, y: 0, w: 2, h: 3 });

    // 6 road lids + 2 building blocks with 5 faces each.
    const quads = 6 + 2 * 5;
    expect(data.positions).toHaveLength(quads * 4 * 3);
    expect(data.colors).toHaveLength(quads * 4 * 4);
    expect(data.indices).toHaveLength(quads * 6);
  });

  it('places lids on top of the block and mirrors map Y to -Z', () => {
    const map = parseCmp(createCmp([ROAD_LID], [0], [0]));
    const data = buildCityMeshData(map, { x: 3, y: 5, w: 1, h: 1 });

    expect(Array.from(data.positions)).toEqual([12, 4, -20, 16, 4, -20, 16, 4, -24, 12, 4, -24]);
  });

  it('applies slope heights to lid corners', () => {
    const map = parseCmp(createCmp([ROAD_LID], [0], [0]));
    // Slope 1: northern edge at half height, southern edge at ground level.
    const slopeBlock = { ...map.getBlock(0, 0, 0), slopeType: 1 };
    const lid = getFaceVertices(slopeBlock, BlockFace.Lid, 0, 0, 0);

    expect(lid.map((point) => point[1])).toEqual([2, 2, 0, 0]);
  });
});
