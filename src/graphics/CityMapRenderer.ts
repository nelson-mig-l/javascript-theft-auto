import * as BABYLON from 'babylonjs';
import { BlockTextureAtlas, collectBlockTextureVariants } from '../map/BlockTextureAtlas';
import { CityMap, MAP_DIMENSIONS } from '../map/CityMap';
import { buildCityMeshData, CityMeshTextures } from '../map/CityMeshBuilder';
import { StyleData } from '../map/StyleData';

const CHUNK_DIMENSIONS = 32;

const CITY_VERTEX_SHADER = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
attribute float transparency;
uniform mat4 worldViewProjection;
varying vec2 vUV;
varying float vTransparency;
void main() {
  vUV = uv;
  vTransparency = transparency;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

// Port of Carnage3D's city_mesh.glsl: unlit, palette index 0 is only see-through on flat blocks.
const CITY_FRAGMENT_SHADER = `
precision highp float;
uniform sampler2D blockAtlas;
varying vec2 vUV;
varying float vTransparency;
void main() {
  vec4 texel = texture2D(blockAtlas, vUV);
  if (vTransparency > 0.5 && texel.a < 0.5) {
    discard;
  }
  gl_FragColor = vec4(texel.rgb, 1.0);
}
`;

/** Renders the city blocks as chunk meshes, textured from the style's block tiles when available. */
export class CityMapRenderer {
  private readonly scene: BABYLON.Scene;
  private readonly meshes: BABYLON.Mesh[] = [];
  private material: BABYLON.Material | null = null;
  private atlasTexture: BABYLON.RawTexture | null = null;
  private animationObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.Scene>> = null;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
  }

  build(map: CityMap, style?: StyleData): void {
    this.dispose();

    let textures: CityMeshTextures | undefined;
    if (style) {
      textures = { style, atlas: new BlockTextureAtlas(style, collectBlockTextureVariants(map, style)) };
      this.material = this.createTexturedMaterial(textures.atlas);
    } else {
      this.material = this.createVertexColorMaterial();
    }

    const chunksPerSide = MAP_DIMENSIONS / CHUNK_DIMENSIONS;
    for (let chunkY = 0; chunkY < chunksPerSide; ++chunkY) {
      for (let chunkX = 0; chunkX < chunksPerSide; ++chunkX) {
        const data = buildCityMeshData(
          map,
          { x: chunkX * CHUNK_DIMENSIONS, y: chunkY * CHUNK_DIMENSIONS, w: CHUNK_DIMENSIONS, h: CHUNK_DIMENSIONS },
          textures,
        );
        if (data.indices.length === 0) {
          continue;
        }

        const mesh = new BABYLON.Mesh(`city-chunk-${chunkX}-${chunkY}`, this.scene);
        const vertexData = new BABYLON.VertexData();
        vertexData.positions = data.positions;
        vertexData.indices = data.indices;
        if (data.uvs) {
          vertexData.uvs = data.uvs;
        } else {
          vertexData.colors = data.colors;
        }
        vertexData.applyToMesh(mesh, false);
        if (data.uvs) {
          mesh.setVerticesData('transparency', data.transparency, false, 1);
        }

        mesh.material = this.material;
        mesh.isPickable = false;
        mesh.freezeWorldMatrix();
        this.meshes.push(mesh);
      }
    }
  }

  dispose(): void {
    this.meshes.splice(0).forEach((mesh) => mesh.dispose());
    this.scene.onBeforeRenderObservable.remove(this.animationObserver);
    this.animationObserver = null;
    this.material?.dispose();
    this.material = null;
    this.atlasTexture?.dispose();
    this.atlasTexture = null;
  }

  private createVertexColorMaterial(): BABYLON.Material {
    const material = new BABYLON.StandardMaterial('city-map-material', this.scene);
    // Carnage3D draws the city unlit and without face culling; shading is baked into vertex colors.
    material.disableLighting = true;
    material.emissiveColor = BABYLON.Color3.White();
    material.backFaceCulling = false;
    material.freeze();
    return material;
  }

  private createTexturedMaterial(atlas: BlockTextureAtlas): BABYLON.Material {
    const texture = BABYLON.RawTexture.CreateRGBATexture(
      atlas.pixels,
      atlas.width,
      atlas.height,
      this.scene,
      false,
      false,
      BABYLON.Texture.NEAREST_SAMPLINGMODE,
    );
    texture.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
    texture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
    this.atlasTexture = texture;

    const material = new BABYLON.ShaderMaterial(
      'city-map-material',
      this.scene,
      { vertexSource: CITY_VERTEX_SHADER, fragmentSource: CITY_FRAGMENT_SHADER },
      { attributes: ['position', 'uv', 'transparency'], uniforms: ['worldViewProjection'], samplers: ['blockAtlas'] },
    );
    material.setTexture('blockAtlas', texture);
    material.backFaceCulling = false;

    const engine = this.scene.getEngine() as BABYLON.Engine;
    this.animationObserver = this.scene.onBeforeRenderObservable.add(() => {
      const internalTexture = texture.getInternalTexture();
      if (!internalTexture) {
        return;
      }
      for (const region of atlas.update(engine.getDeltaTime() / 1000)) {
        engine.updateTextureData(internalTexture, atlas.readRegion(region), region.x, region.y, region.width, region.height);
      }
    });
    return material;
  }
}
