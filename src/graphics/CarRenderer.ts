import * as BABYLON from 'babylonjs';
import { Car, CAR_LENGTH, CAR_WIDTH } from '../game/Car';

/** Placeholder box car until vehicle sprites are read from the style file. */
export class CarRenderer {
  private readonly root: BABYLON.TransformNode;
  private readonly materials: BABYLON.Material[] = [];

  constructor(private readonly scene: BABYLON.Scene) {
    this.root = new BABYLON.TransformNode('player-car', scene);
    this.addBox('body', [CAR_WIDTH, 0.8, CAR_LENGTH], [0, 0.65, 0], [0.8, 0.12, 0.1]);
    this.addBox('cabin', [CAR_WIDTH * 0.85, 0.55, CAR_LENGTH * 0.5], [0, 1.3, -0.25], [0.15, 0.2, 0.28]);
    for (const side of [-1, 1]) {
      this.addBox('headlight', [0.4, 0.2, 0.05], [side * 0.65, 0.75, CAR_LENGTH / 2], [1, 0.95, 0.6]);
      this.addBox('taillight', [0.4, 0.2, 0.05], [side * 0.65, 0.75, -CAR_LENGTH / 2], [0.5, 0, 0]);
    }
  }

  update(car: Car): void {
    this.root.position.set(car.x, car.z, -car.y);
    this.root.rotation.set(-car.pitch, car.heading, 0);
  }

  dispose(): void {
    this.root.dispose();
    for (const material of this.materials) {
      material.dispose();
    }
  }

  private addBox(
    name: string,
    [width, height, depth]: [number, number, number],
    [x, y, z]: [number, number, number],
    [r, g, b]: [number, number, number],
  ): void {
    const mesh = BABYLON.MeshBuilder.CreateBox(`player-car-${name}`, { width, height, depth }, this.scene);
    const material = new BABYLON.StandardMaterial(`player-car-${name}-material`, this.scene);
    material.disableLighting = true;
    material.emissiveColor = new BABYLON.Color3(r, g, b);
    this.materials.push(material);
    mesh.material = material;
    mesh.position.set(x, y, z);
    mesh.isPickable = false;
    mesh.parent = this.root;
  }
}
