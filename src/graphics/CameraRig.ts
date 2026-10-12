import * as BABYLON from 'babylonjs';
import { approachAngle, catchFactor, computeFollowCameraPose, FOLLOW_CAMERA_SETTINGS, Vec3 } from './FollowCamera';

export interface FollowTarget {
  /** Babylon-space position. */
  readonly position: Vec3;
  /** Babylon yaw. */
  readonly heading: number;
  /** Signed forward speed in m/s. */
  readonly speed: number;
}

/** Chase camera that trails a followed target; it has no user controls of its own. */
export class CameraRig {
  private readonly camera: BABYLON.FreeCamera;
  private focus: Vec3 | null = null;
  private heading = 0;
  private speed = 0;

  constructor(scene: BABYLON.Scene) {
    this.camera = new BABYLON.FreeCamera('camera', new BABYLON.Vector3(0, 5, -10), scene);
    this.camera.setTarget(BABYLON.Vector3.Zero());
  }

  focusOn(position: BABYLON.Vector3, target: BABYLON.Vector3): void {
    this.camera.position.copyFrom(position);
    this.camera.setTarget(target);
  }

  follow(target: FollowTarget, deltaSeconds: number): void {
    if (!this.focus) {
      this.focus = [...target.position];
      this.heading = target.heading;
      this.speed = target.speed;
    } else {
      const s = FOLLOW_CAMERA_SETTINGS;
      const focusFactor = catchFactor(s.focusCatchRate, deltaSeconds);
      const headingFactor = catchFactor(s.headingCatchRate, deltaSeconds);
      for (let i = 0; i < 3; ++i) {
        this.focus[i] += (target.position[i] - this.focus[i]) * focusFactor;
      }
      this.heading = approachAngle(this.heading, target.heading, headingFactor);
      this.speed += (target.speed - this.speed) * headingFactor;
    }

    const pose = computeFollowCameraPose(this.focus, this.heading, this.speed);
    this.camera.position.set(...pose.position);
    this.camera.setTarget(new BABYLON.Vector3(...pose.target));
  }

  getCamera(): BABYLON.FreeCamera {
    return this.camera;
  }
}
