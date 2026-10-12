import * as BABYLON from 'babylonjs';
import { CityMap, MAP_DIMENSIONS } from '../map/CityMap';
import { buildCityMeshData } from '../map/CityMeshBuilder';

const CHUNK_DIMENSIONS = 32;

/** Renders the city blocks as untextured, vertex-colored chunk meshes. */
export class CityMapRenderer {
  private readonly scene: BABYLON.Scene;
  private readonly meshes: BABYLON.Mesh[] = [];
  private material: BABYLON.StandardMaterial | null = null;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
  }

  build(map: CityMap): void {
    this.dispose();

    const material = new BABYLON.StandardMaterial('city-map-material', this.scene);
    // Carnage3D draws the city unlit and without face culling; shading is baked into vertex colors.
    material.disableLighting = true;
    material.emissiveColor = BABYLON.Color3.White();
    material.backFaceCulling = false;
    material.freeze();
    this.material = material;

    const chunksPerSide = MAP_DIMENSIONS / CHUNK_DIMENSIONS;
    for (let chunkY = 0; chunkY < chunksPerSide; ++chunkY) {
      for (let chunkX = 0; chunkX < chunksPerSide; ++chunkX) {
        const data = buildCityMeshData(map, {
          x: chunkX * CHUNK_DIMENSIONS,
          y: chunkY * CHUNK_DIMENSIONS,
          w: CHUNK_DIMENSIONS,
          h: CHUNK_DIMENSIONS,
        });
        if (data.indices.length === 0) {
          continue;
        }

        const mesh = new BABYLON.Mesh(`city-chunk-${chunkX}-${chunkY}`, this.scene);
        const vertexData = new BABYLON.VertexData();
        vertexData.positions = data.positions;
        vertexData.colors = data.colors;
        vertexData.indices = data.indices;
        vertexData.applyToMesh(mesh, false);

        mesh.material = material;
        mesh.isPickable = false;
        mesh.freezeWorldMatrix();
        this.meshes.push(mesh);
      }
    }
  }

  dispose(): void {
    this.meshes.splice(0).forEach((mesh) => mesh.dispose());
    this.material?.dispose();
    this.material = null;
  }
}
