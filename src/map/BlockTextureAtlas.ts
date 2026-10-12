import { BLOCK_FACES_COUNT, BlockFace, CityMap, MAP_DIMENSIONS, MAP_LAYERS_COUNT, MapBlockInfo } from './CityMap';
import { BLOCK_REMAPS_COUNT, BLOCK_TEXTURE_DIMS, BlockType, StyleData } from './StyleData';

/** Carnage3D `GTA_CYCLES_PER_FRAME`; block animation frame rate is this divided by the animation speed. */
const GTA_CYCLES_PER_FRAME = 24;
const ATLAS_COLUMNS = 32;

export interface BlockTextureVariant {
  linearIndex: number;
  remap: number;
}

export interface AtlasRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BlockAnimationState {
  /** Linear tile indices; frame 0 is the block itself, followed by aux tiles. */
  readonly frames: number[];
  readonly frameRate: number;
  currentFrame: number;
}

/** Returns the tile and palette variant drawn on a block face, as in Carnage3D `PutBlockFace`. */
export function getFaceTextureVariant(style: StyleData, block: MapBlockInfo, face: BlockFace): BlockTextureVariant {
  const isLid = face === BlockFace.Lid;
  return {
    linearIndex: style.getBlockTextureLinearIndex(isLid ? BlockType.Lid : BlockType.Side, block.faces[face]),
    // Remapping applies to lids only.
    remap: isLid ? block.remap : 0,
  };
}

/** Collects every tile/palette combination referenced by the map's visible faces. */
export function collectBlockTextureVariants(map: CityMap, style: StyleData): BlockTextureVariant[] {
  const keys = new Set<number>();
  for (let layer = 0; layer < MAP_LAYERS_COUNT; ++layer) {
    for (let y = 0; y < MAP_DIMENSIONS; ++y) {
      for (let x = 0; x < MAP_DIMENSIONS; ++x) {
        const block = map.getBlock(x, y, layer);
        for (let face = 0; face < BLOCK_FACES_COUNT; ++face) {
          if (block.faces[face] === 0) {
            continue;
          }
          const variant = getFaceTextureVariant(style, block, face as BlockFace);
          keys.add(variant.linearIndex * BLOCK_REMAPS_COUNT + variant.remap);
        }
      }
    }
  }
  return [...keys]
    .sort((a, b) => a - b)
    .map((key) => ({ linearIndex: Math.floor(key / BLOCK_REMAPS_COUNT), remap: key % BLOCK_REMAPS_COUNT }));
}

/**
 * RGBA atlas of 64x64 block tiles, one cell per tile/palette variant. Carnage3D samples an indexed
 * texture array through palette tables instead; baking the variants keeps the Babylon material simple.
 * Animated blocks are handled by rewriting their cells, mirroring Carnage3D's block indices table.
 */
export class BlockTextureAtlas {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;
  private readonly style: StyleData;
  private readonly cells = new Map<number, number>();
  private readonly animations: BlockAnimationState[] = [];
  private elapsedSeconds = 0;

  constructor(style: StyleData, variants: readonly BlockTextureVariant[]) {
    this.style = style;
    const columns = Math.min(ATLAS_COLUMNS, Math.max(1, variants.length));
    const rows = Math.max(1, Math.ceil(variants.length / columns));
    this.width = nextPowerOfTwo(columns * BLOCK_TEXTURE_DIMS);
    this.height = nextPowerOfTwo(rows * BLOCK_TEXTURE_DIMS);
    this.pixels = new Uint8Array(this.width * this.height * 4);

    variants.forEach((variant, cell) => {
      this.cells.set(variant.linearIndex * BLOCK_REMAPS_COUNT + variant.remap, cell);
      const region = this.getCellRegion(cell);
      style.writeBlockTextureRgba(variant.linearIndex, variant.remap, this.pixels, this.width, region.x, region.y);
    });

    for (const animation of style.blockAnimations) {
      const baseType = animation.which === 0 ? BlockType.Side : BlockType.Lid;
      this.animations.push({
        frames: [
          style.getBlockTextureLinearIndex(baseType, animation.block),
          ...animation.frames.map((frame) => style.getBlockTextureLinearIndex(BlockType.Aux, frame)),
        ],
        frameRate: GTA_CYCLES_PER_FRAME / Math.max(1, animation.speed),
        currentFrame: 0,
      });
    }
  }

  getCellIndex(variant: BlockTextureVariant): number | undefined {
    return this.cells.get(variant.linearIndex * BLOCK_REMAPS_COUNT + variant.remap);
  }

  getCellRegion(cell: number): AtlasRegion {
    const columns = this.width / BLOCK_TEXTURE_DIMS;
    return {
      x: (cell % columns) * BLOCK_TEXTURE_DIMS,
      y: Math.floor(cell / columns) * BLOCK_TEXTURE_DIMS,
      width: BLOCK_TEXTURE_DIMS,
      height: BLOCK_TEXTURE_DIMS,
    };
  }

  /** Maps a tile-local texcoord in [0, 1] to atlas UVs (row 0 at v = 0), inset by half a texel to avoid bleeding. */
  getTexcoord(cell: number, u: number, v: number): [number, number] {
    const region = this.getCellRegion(cell);
    const span = BLOCK_TEXTURE_DIMS - 1;
    return [(region.x + 0.5 + u * span) / this.width, (region.y + 0.5 + v * span) / this.height];
  }

  /** Advances block animations and returns the atlas regions whose pixels changed. */
  update(deltaSeconds: number): AtlasRegion[] {
    this.elapsedSeconds += deltaSeconds;
    const dirty: AtlasRegion[] = [];
    for (const animation of this.animations) {
      const frame = Math.floor(this.elapsedSeconds * animation.frameRate) % animation.frames.length;
      if (frame === animation.currentFrame) {
        continue;
      }
      animation.currentFrame = frame;
      const baseIndex = animation.frames[0];
      for (let remap = 0; remap < BLOCK_REMAPS_COUNT; ++remap) {
        const cell = this.getCellIndex({ linearIndex: baseIndex, remap });
        if (cell === undefined) {
          continue;
        }
        const region = this.getCellRegion(cell);
        this.style.writeBlockTextureRgba(animation.frames[frame], remap, this.pixels, this.width, region.x, region.y);
        dirty.push(region);
      }
    }
    return dirty;
  }

  /** Copies a region's pixels into a tightly packed RGBA array. */
  readRegion(region: AtlasRegion): Uint8Array {
    const out = new Uint8Array(region.width * region.height * 4);
    for (let row = 0; row < region.height; ++row) {
      const start = ((region.y + row) * this.width + region.x) * 4;
      out.set(this.pixels.subarray(start, start + region.width * 4), row * region.width * 4);
    }
    return out;
  }
}

function nextPowerOfTwo(value: number): number {
  let result = 1;
  while (result < value) {
    result *= 2;
  }
  return result;
}
