export const BLOCK_TEXTURE_DIMS = 64;
export const BLOCK_TEXTURE_AREA = BLOCK_TEXTURE_DIMS * BLOCK_TEXTURE_DIMS;
/** Each block tile has four palette variants; lids may pick one through `MapBlockInfo.remap`. */
export const BLOCK_REMAPS_COUNT = 4;

const G24_VERSION_CODE = 336;
const G24_HEADER_SIZE = 16 * 4;
const PALETTE_ENTRIES = 256;
const PALETTE_SIZE = PALETTE_ENTRIES * 4;
const PALETTES_PER_CLUT_PAGE = 64;
const CLUT_PAGE_SIZE = PALETTES_PER_CLUT_PAGE * PALETTE_SIZE;
/** Tile pixels are stored in 256 pixel wide pages, four tiles per scanline. */
const TILES_PER_ROW = 4;

export const BlockType = {
  Side: 0,
  Lid: 1,
  Aux: 2,
} as const;
export type BlockType = (typeof BlockType)[keyof typeof BlockType];

export interface BlockAnimationInfo {
  /** Block number within `which` area. */
  readonly block: number;
  /** 0 = side, 1 = lid. */
  readonly which: number;
  /** Number of game cycles each frame is displayed. */
  readonly speed: number;
  /** Aux block numbers. */
  readonly frames: readonly number[];
}

/** Block tile data of a GTA1 `.G24` style file (see Carnage3D `StyleData`). Sprites are not parsed yet. */
export class StyleData {
  constructor(
    readonly sideBlocksCount: number,
    readonly lidBlocksCount: number,
    readonly auxBlocksCount: number,
    /** 8-bit palette indices, paged four tiles per 256 pixel scanline. */
    private readonly blockTexturesRaw: Uint8Array,
    /** RGBA palettes, 256 entries each. */
    readonly palettes: Uint8Array,
    readonly paletteIndices: Uint16Array,
    readonly blockAnimations: readonly BlockAnimationInfo[],
  ) {}

  get blockTexturesCount(): number {
    return this.sideBlocksCount + this.lidBlocksCount + this.auxBlocksCount;
  }

  getBlockTexturesCount(blockType: BlockType): number {
    switch (blockType) {
      case BlockType.Side:
        return this.sideBlocksCount;
      case BlockType.Lid:
        return this.lidBlocksCount;
      case BlockType.Aux:
        return this.auxBlocksCount;
    }
  }

  /** Converts a block type and relative index to the index in the side/lid/aux tile sequence. */
  getBlockTextureLinearIndex(blockType: BlockType, blockIndex: number): number {
    switch (blockType) {
      case BlockType.Side:
        return blockIndex;
      case BlockType.Lid:
        return blockIndex + this.sideBlocksCount;
      case BlockType.Aux:
        return blockIndex + this.sideBlocksCount + this.lidBlocksCount;
    }
  }

  getBlockTexturePaletteIndex(linearIndex: number, remap: number): number {
    return this.paletteIndices[BLOCK_REMAPS_COUNT * linearIndex + remap];
  }

  /**
   * Writes a 64x64 RGBA tile into `target` (a `targetWidth` pixels wide RGBA image).
   * Palette index 0 gets alpha 0 so flat blocks can treat it as transparent, matching Carnage3D.
   */
  writeBlockTextureRgba(linearIndex: number, remap: number, target: Uint8Array, targetWidth: number, destX: number, destY: number): void {
    const tileX = linearIndex % TILES_PER_ROW;
    const tileY = Math.floor(linearIndex / TILES_PER_ROW);
    const rowStride = TILES_PER_ROW * BLOCK_TEXTURE_DIMS;
    let srcOffset = tileY * BLOCK_TEXTURE_AREA * TILES_PER_ROW + tileX * BLOCK_TEXTURE_DIMS;
    const paletteOffset = this.getBlockTexturePaletteIndex(linearIndex, remap) * PALETTE_SIZE;

    for (let iy = 0; iy < BLOCK_TEXTURE_DIMS; ++iy) {
      let destOffset = ((destY + iy) * targetWidth + destX) * 4;
      for (let ix = 0; ix < BLOCK_TEXTURE_DIMS; ++ix) {
        const entry = this.blockTexturesRaw[srcOffset + ix];
        const color = paletteOffset + entry * 4;
        target[destOffset] = this.palettes[color];
        target[destOffset + 1] = this.palettes[color + 1];
        target[destOffset + 2] = this.palettes[color + 2];
        target[destOffset + 3] = entry === 0 ? 0 : 255;
        destOffset += 4;
      }
      srcOffset += rowStride;
    }
  }
}

/** Parses the block textures, animations and palettes of a `.G24` style (see Carnage3D `StyleData::LoadFromFile`). */
export function parseG24(buffer: ArrayBuffer): StyleData {
  if (buffer.byteLength < G24_HEADER_SIZE) {
    throw new Error('G24 file is too small to contain a header');
  }
  const view = new DataView(buffer);
  const header = Array.from({ length: 16 }, (_, i) => view.getUint32(i * 4, true));
  const [versionCode, sideSize, lidSize, auxSize, animSize, clutSize, , , , , paletteIndexSize] = header;
  if (versionCode !== G24_VERSION_CODE) {
    throw new Error(`Invalid G24 version code: ${versionCode}`);
  }
  if (sideSize % BLOCK_TEXTURE_AREA !== 0 || lidSize % BLOCK_TEXTURE_AREA !== 0 || auxSize % BLOCK_TEXTURE_AREA !== 0) {
    throw new Error('Invalid G24 block texture section size');
  }

  const sideCount = sideSize / BLOCK_TEXTURE_AREA;
  const lidCount = lidSize / BLOCK_TEXTURE_AREA;
  const auxCount = auxSize / BLOCK_TEXTURE_AREA;
  const totalBlocks = sideCount + lidCount + auxCount;
  // Tiles are paged, so the section is padded to a multiple of four tiles.
  const paddedBlocks = Math.ceil(totalBlocks / TILES_PER_ROW) * TILES_PER_ROW;
  const clutsLength = Math.ceil(clutSize / CLUT_PAGE_SIZE) * CLUT_PAGE_SIZE;

  const texturesOffset = G24_HEADER_SIZE;
  const animOffset = texturesOffset + paddedBlocks * BLOCK_TEXTURE_AREA;
  const clutsOffset = animOffset + animSize;
  const paletteIndicesOffset = clutsOffset + clutsLength;
  if (paletteIndicesOffset + paletteIndexSize > buffer.byteLength) {
    throw new Error('G24 file is truncated');
  }

  const blockTextures = new Uint8Array(buffer, texturesOffset, paddedBlocks * BLOCK_TEXTURE_AREA);
  const animations = readAnimations(view, animOffset, animSize);
  const palettes = readPalettes(new Uint8Array(buffer, clutsOffset, clutsLength));

  const paletteIndices = new Uint16Array(paletteIndexSize / 2);
  for (let i = 0; i < paletteIndices.length; ++i) {
    paletteIndices[i] = view.getUint16(paletteIndicesOffset + i * 2, true);
  }
  if (paletteIndices.length < totalBlocks * BLOCK_REMAPS_COUNT) {
    throw new Error('G24 palette indices do not cover every block texture');
  }

  return new StyleData(sideCount, lidCount, auxCount, blockTextures, palettes, paletteIndices, animations);
}

function readAnimations(view: DataView, offset: number, length: number): BlockAnimationInfo[] {
  if (length === 0) {
    return [];
  }
  const end = offset + length;
  const count = view.getUint8(offset);
  const animations: BlockAnimationInfo[] = [];
  let cursor = offset + 1;
  for (let i = 0; i < count; ++i) {
    if (cursor + 4 > end) {
      throw new Error('G24 animation data is truncated');
    }
    const block = view.getUint8(cursor);
    const which = view.getUint8(cursor + 1);
    const speed = view.getUint8(cursor + 2);
    const frameCount = view.getUint8(cursor + 3);
    cursor += 4;
    if (cursor + frameCount > end) {
      throw new Error('G24 animation data is truncated');
    }
    const frames = Array.from({ length: frameCount }, (_, frame) => view.getUint8(cursor + frame));
    cursor += frameCount;
    animations.push({ block, which, speed, frames });
  }
  return animations;
}

/**
 * CLUTs are stored in 64KiB pages of 64 palettes; each 256 byte row holds one BGRA entry for each
 * of the page's palettes. Returns palettes as consecutive 256-entry RGBA arrays.
 */
function readPalettes(cluts: Uint8Array): Uint8Array {
  const pageCount = cluts.length / CLUT_PAGE_SIZE;
  const palettes = new Uint8Array(pageCount * CLUT_PAGE_SIZE);
  let src = 0;
  for (let page = 0; page < pageCount; ++page) {
    for (let entry = 0; entry < PALETTE_ENTRIES; ++entry) {
      for (let palette = 0; palette < PALETTES_PER_CLUT_PAGE; ++palette) {
        const dest = ((page * PALETTES_PER_CLUT_PAGE + palette) * PALETTE_ENTRIES + entry) * 4;
        palettes[dest] = cluts[src + 2];
        palettes[dest + 1] = cluts[src + 1];
        palettes[dest + 2] = cluts[src];
        palettes[dest + 3] = cluts[src + 3];
        src += 4;
      }
    }
  }
  return palettes;
}
