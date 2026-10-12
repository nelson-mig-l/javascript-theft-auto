import { METERS_PER_MAP_UNIT } from '../map/CityMap';
import { CityMap } from '../map/CityMap';
import { getHeightAtPosition, isWallAt } from '../map/MapQueries';

export interface CarControls {
  /** 1 = accelerate, -1 = brake / reverse. */
  readonly throttle: number;
  /** -1 = left, 1 = right. */
  readonly steer: number;
}

export const CAR_LENGTH = 4.4;
export const CAR_WIDTH = 2;

const WHEELBASE = 2.8;
// Steering lock and rate from Carnage3D's `Vehicle::UpdateSteer`.
const STEER_LOCK = (30 * Math.PI) / 180;
const STEER_SPEED = (270 * Math.PI) / 180;
const ACCELERATION = 12;
const REVERSE_ACCELERATION = 8;
const BRAKING = 28;
const ROLLING_DRAG = 5;
const MAX_FORWARD_SPEED = 32;
const MAX_REVERSE_SPEED = 10;
const WALL_SPEED_FACTOR = 0.5;
const GRAVITY = 20;
/** Ground up to this far above the car (meters) is climbed rather than fallen through. */
const STEP_HEIGHT = 1;

/**
 * Arcade car driven on the city map. Positions are in meters in map space:
 * `x` east, `y` south, `z` up; `heading` is radians clockwise from north.
 */
export class Car {
  speed = 0;
  steeringAngle = 0;
  pitch = 0;
  private verticalSpeed = 0;

  constructor(
    public x: number,
    public y: number,
    public z: number,
    public heading: number,
  ) {}

  update(deltaSeconds: number, controls: CarControls, map: CityMap): void {
    if (deltaSeconds <= 0) {
      return;
    }

    this.updateSteering(deltaSeconds, clamp(controls.steer, -1, 1));
    this.updateSpeed(deltaSeconds, clamp(controls.throttle, -1, 1));

    const heading = this.heading + (this.speed / WHEELBASE) * Math.tan(this.steeringAngle) * deltaSeconds;
    if (!this.collides(map, this.x, this.y, heading)) {
      this.heading = heading;
    }
    this.move(map, deltaSeconds);
    this.updateHeight(map, deltaSeconds);
  }

  private updateSteering(deltaSeconds: number, steer: number): void {
    const turn = STEER_SPEED * deltaSeconds;
    const delta = clamp(STEER_LOCK * steer - this.steeringAngle, -turn, turn);
    this.steeringAngle = clamp(this.steeringAngle + delta, -STEER_LOCK, STEER_LOCK);
  }

  private updateSpeed(deltaSeconds: number, throttle: number): void {
    if (throttle !== 0 && this.speed !== 0 && Math.sign(throttle) !== Math.sign(this.speed)) {
      this.speed = approach(this.speed, 0, BRAKING * Math.abs(throttle) * deltaSeconds);
    } else if (throttle !== 0) {
      this.speed += (throttle > 0 ? ACCELERATION : REVERSE_ACCELERATION) * throttle * deltaSeconds;
    } else {
      this.speed = approach(this.speed, 0, ROLLING_DRAG * deltaSeconds);
    }
    this.speed = clamp(this.speed, -MAX_REVERSE_SPEED, MAX_FORWARD_SPEED);
  }

  private move(map: CityMap, deltaSeconds: number): void {
    const dx = Math.sin(this.heading) * this.speed * deltaSeconds;
    const dy = -Math.cos(this.heading) * this.speed * deltaSeconds;
    if (!this.collides(map, this.x + dx, this.y + dy, this.heading)) {
      this.x += dx;
      this.y += dy;
    } else if (Math.abs(dx) > 1e-6 && !this.collides(map, this.x + dx, this.y, this.heading)) {
      this.x += dx;
      this.speed *= WALL_SPEED_FACTOR;
    } else if (Math.abs(dy) > 1e-6 && !this.collides(map, this.x, this.y + dy, this.heading)) {
      this.y += dy;
      this.speed *= WALL_SPEED_FACTOR;
    } else {
      this.speed = 0;
    }
  }

  private updateHeight(map: CityMap, deltaSeconds: number): void {
    const ground = this.groundHeight(map, this.x, this.y);
    if (ground >= this.z) {
      this.z = ground;
      this.verticalSpeed = 0;
    } else {
      this.verticalSpeed -= GRAVITY * deltaSeconds;
      this.z = Math.max(ground, this.z + this.verticalSpeed * deltaSeconds);
    }

    const fx = Math.sin(this.heading) * CAR_LENGTH * 0.4;
    const fy = -Math.cos(this.heading) * CAR_LENGTH * 0.4;
    const front = this.groundHeight(map, this.x + fx, this.y + fy);
    const back = this.groundHeight(map, this.x - fx, this.y - fy);
    this.pitch = this.z > ground ? this.pitch : Math.atan2(front - back, CAR_LENGTH * 0.8);
  }

  private groundHeight(map: CityMap, x: number, y: number): number {
    const unit = METERS_PER_MAP_UNIT;
    return getHeightAtPosition(map, x / unit, y / unit, (this.z + STEP_HEIGHT) / unit) * unit;
  }

  private collides(map: CityMap, x: number, y: number, heading: number): boolean {
    const unit = METERS_PER_MAP_UNIT;
    const fx = Math.sin(heading);
    const fy = -Math.cos(heading);
    for (const [side, along] of CAR_OUTLINE) {
      const px = x + fx * along * CAR_LENGTH - fy * side * CAR_WIDTH;
      const py = y + fy * along * CAR_LENGTH + fx * side * CAR_WIDTH;
      if (isWallAt(map, px / unit, py / unit, this.z / unit)) {
        return true;
      }
    }
    return false;
  }
}

/** Outline sample points as fractions of width (right) and length (forward). */
const CAR_OUTLINE: readonly [number, number][] = [
  [-0.5, 0.5],
  [0, 0.5],
  [0.5, 0.5],
  [0.5, 0],
  [0.5, -0.5],
  [0, -0.5],
  [-0.5, -0.5],
  [-0.5, 0],
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function approach(value: number, target: number, step: number): number {
  return value > target ? Math.max(target, value - step) : Math.min(target, value + step);
}
