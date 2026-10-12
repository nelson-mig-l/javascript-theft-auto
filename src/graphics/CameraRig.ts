import * as BABYLON from 'babylonjs';

export class CameraRig {
  private readonly camera: BABYLON.FreeCamera;

  constructor(scene: BABYLON.Scene) {
    this.camera = new BABYLON.FreeCamera('camera', new BABYLON.Vector3(0, 5, -10), scene);
    this.camera.setTarget(BABYLON.Vector3.Zero());
    this.camera.speed = 1.5;

    const canvas = scene.getEngine().getRenderingCanvas();
    if (canvas) {
      this.camera.attachControl(canvas, false);
    }
  }

  focusOn(position: BABYLON.Vector3, target: BABYLON.Vector3, speed = this.camera.speed): void {
    this.camera.position.copyFrom(position);
    this.camera.setTarget(target);
    this.camera.speed = speed;
  }

  getCamera(): BABYLON.FreeCamera {
    return this.camera;
  }
}
