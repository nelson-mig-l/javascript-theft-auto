export type Vec3 = [number, number, number];

export interface FollowCameraPose {
  position: Vec3;
  target: Vec3;
}

export interface CameraSettings {
  readonly height: number;
  readonly distance: number;
  readonly lookAheadTime: number;
  readonly heightPerSpeed: number;
  readonly focusCatchRate: number;
  readonly headingCatchRate: number;
}

export const FOLLOW_CAMERA_SETTINGS: CameraSettings = {
  height: 16,
  distance: 11,
  /** Seconds of travel to look ahead, as Carnage3D's `FollowCameraController` (0.35). */
  lookAheadTime: 0.35,
  /** Extra height per m/s of speed, so the view widens when driving fast. */
  heightPerSpeed: 0.25,
  focusCatchRate: 10,
  headingCatchRate: 4,
} as const;

export const TOP_DOWN_CAMERA_SETTINGS: CameraSettings = {
  height: 40,
  distance: 0,
  lookAheadTime: 0,
  heightPerSpeed: 0,
  focusCatchRate: 10,
  headingCatchRate: 4,
} as const;

/**
 * Chase pose in Babylon space for a target at `focus` facing `heading`
 * (Babylon yaw: forward is (sin, 0, cos)), looking slightly ahead of its travel.
 */
export function computeFollowCameraPose(focus: Vec3, heading: number, speed: number, settings: CameraSettings = FOLLOW_CAMERA_SETTINGS): FollowCameraPose {
  const s = settings;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const ahead = speed * s.lookAheadTime;
  const target: Vec3 = [focus[0] + fx * ahead, focus[1], focus[2] + fz * ahead];
  return {
    position: [target[0] - fx * s.distance, target[1] + s.height + Math.abs(speed) * s.heightPerSpeed, target[2] - fz * s.distance],
    target,
  };
}

/** Frame-rate independent exponential smoothing factor. */
export function catchFactor(rate: number, deltaSeconds: number): number {
  return 1 - Math.exp(-rate * deltaSeconds);
}

/** Moves `from` towards `to` along the shortest arc. */
export function approachAngle(from: number, to: number, factor: number): number {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * factor;
}
