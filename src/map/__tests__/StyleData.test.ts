import { describe, expect, it } from 'vitest';
import { BlockTextureAtlas, collectBlockTextureVariants } from '../BlockTextureAtlas';
import { BlockFace, CityMap, EMPTY_BLOCK, MAP_DIMENSIONS, MAP_LAYERS_COUNT, MapBlockInfo } from '../CityMap';
import { buildCityMeshData, getFaceTexcoords } from '../CityMeshBuilder';
import { BlockType, parseG24 } from '../StyleData';

const TILE_AREA = 64 * 64;
const CLUT_PAGE = 64 * 1024;

/**
 * One side, one lid and one aux tile. Tile `t` is filled with palette entry `t + 1` except pixel (0, 0),
 * palette `p` entry `e` is RGBA (200, p, e, 255) and tile `t` remap `r` uses palette `4t + r`.
 * The lid tile is animated with the aux tile at 1 frame per second.
 */
function createG24(): ArrayBuffer {
  const animation = [1, 0, 1, 24, 1, 0];
  const paletteIndexSize = 12 * 2;
  const texturesSize = 4 * TILE_AREA;
  const buffer = new ArrayBuffer(64 + texturesSize + animation.length + CLUT_PAGE + paletteIndexSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  [336, TILE_AREA, TILE_AREA, TILE_AREA, animation.length, 12 * 1024, 12 * 1024, 0, 0, 0, paletteIndexSize].forEach((value, i) =>
    view.setUint32(i * 4, value, true),
  );

  let offset = 64;
  for (let tile = 0; tile < 3; ++tile) {
    for (let y = 0; y < 64; ++y) {
      for (let x = 0; x < 64; ++x) {
        bytes[offset + y * 256 + tile * 64 + x] = x === 0 && y === 0 ? 0 : tile + 1;
      }
    }
  }
  offset += texturesSize;
  bytes.set(animation, offset);
  offset += animation.length;
  for (let entry = 0; entry < 256; ++entry) {
    for (let palette = 0; palette < 64; ++palette) {
      bytes.set([entry, palette, 200, 255], offset + (entry * 64 + palette) * 4);
    }
  }
  offset += CLUT_PAGE;
  for (let i = 0; i < 12; ++i) {
    view.setUint16(offset + i * 2, i, true);
  }
  return buffer;
}

function pixel(data: Uint8Array, width: number, x: number, y: number): number[] {
  const offset = (y * width + x) * 4;
  return Array.from(data.subarray(offset, offset + 4));
}

function createMap(block: MapBlockInfo): CityMap {
  const tiles = new Array<MapBlockInfo>(MAP_LAYERS_COUNT * MAP_DIMENSIONS * MAP_DIMENSIONS).fill(EMPTY_BLOCK);
  tiles[0] = block;
  return new CityMap(1, tiles);
}

describe('parseG24', () => {
  it('reads block counts, animations and de-interleaved palettes', () => {
    const style = parseG24(createG24());

    expect([style.sideBlocksCount, style.lidBlocksCount, style.auxBlocksCount]).toEqual([1, 1, 1]);
    expect(style.getBlockTextureLinearIndex(BlockType.Lid, 0)).toBe(1);
    expect(style.getBlockTextureLinearIndex(BlockType.Aux, 0)).toBe(2);
    expect(style.blockAnimations).toEqual([{ block: 0, which: 1, speed: 24, frames: [0] }]);
    expect(style.getBlockTexturePaletteIndex(1, 2)).toBe(6);
  });

  it('decodes paged tiles to RGBA with palette index 0 transparent', () => {
    const style = parseG24(createG24());
    const target = new Uint8Array(64 * 64 * 4);

    style.writeBlockTextureRgba(1, 2, target, 64, 0, 0);

    expect(pixel(target, 64, 1, 0)).toEqual([200, 6, 2, 255]);
    expect(pixel(target, 64, 63, 63)).toEqual([200, 6, 2, 255]);
    expect(pixel(target, 64, 0, 0)[3]).toBe(0);
  });

  it('rejects other versions', () => {
    const buffer = createG24();
    new DataView(buffer).setUint32(0, 335, true);
    expect(() => parseG24(buffer)).toThrow(/version/);
  });
});

describe('BlockTextureAtlas', () => {
  it('bakes used variants and animates block cells', () => {
    const style = parseG24(createG24());
    const atlas = new BlockTextureAtlas(style, [
      { linearIndex: 1, remap: 0 },
      { linearIndex: 0, remap: 0 },
    ]);

    expect([atlas.width, atlas.height]).toEqual([128, 64]);
    expect(atlas.getCellIndex({ linearIndex: 0, remap: 0 })).toBe(1);
    expect(atlas.getTexcoord(1, 0, 1)).toEqual([64.5 / 128, 63.5 / 64]);
    expect(pixel(atlas.pixels, 128, 1, 0)).toEqual([200, 4, 2, 255]);

    expect(atlas.update(0.5)).toEqual([]);
    expect(atlas.update(0.5)).toEqual([{ x: 0, y: 0, width: 64, height: 64 }]);
    expect(pixel(atlas.pixels, 128, 1, 0)).toEqual([200, 8, 3, 255]);
    expect(pixel(atlas.readRegion({ x: 0, y: 0, width: 64, height: 64 }), 64, 1, 0)).toEqual([200, 8, 3, 255]);
  });

  it('collects lid remaps and side tiles from the map', () => {
    const style = parseG24(createG24());
    const map = createMap({ ...EMPTY_BLOCK, remap: 3, faces: [1, 0, 0, 0, 1] });

    expect(collectBlockTextureVariants(map, style)).toEqual([
      { linearIndex: 1, remap: 0 },
      { linearIndex: 2, remap: 3 },
    ]);
  });
});

describe('block face texcoords', () => {
  it('rotates lid texcoords', () => {
    expect(getFaceTexcoords({ ...EMPTY_BLOCK, lidRotation: 1 }, BlockFace.Lid)).toEqual([
      [0, 1],
      [0, 0],
      [1, 0],
      [1, 1],
    ]);
  });

  it('flips side texcoords', () => {
    const flipped = [
      [1, 0],
      [0, 0],
      [0, 1],
      [1, 1],
    ];
    expect(getFaceTexcoords({ ...EMPTY_BLOCK, flipLeftRightFaces: true }, BlockFace.W)).toEqual(flipped);
    expect(getFaceTexcoords({ ...EMPTY_BLOCK, isFlat: true }, BlockFace.E)).toEqual(flipped);
    expect(getFaceTexcoords({ ...EMPTY_BLOCK, isFlat: true, flipLeftRightFaces: true }, BlockFace.E)[0]).toEqual([0, 0]);
  });

  it('emits atlas uvs and transparency flags', () => {
    const style = parseG24(createG24());
    const map = createMap({ ...EMPTY_BLOCK, isFlat: true, faces: [0, 0, 0, 0, 1] });
    const atlas = new BlockTextureAtlas(style, collectBlockTextureVariants(map, style));

    const data = buildCityMeshData(map, { x: 0, y: 0, w: 1, h: 1 }, { style, atlas });

    expect(data.uvs).toHaveLength(8);
    expect(Array.from(data.uvs!.slice(0, 2))).toEqual([0.5 / 64, 0.5 / 64]);
    expect(Array.from(data.transparency)).toEqual([1, 1, 1, 1]);
  });
});
