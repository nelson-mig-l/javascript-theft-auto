import { GameState } from './GameState';
import type { InputManager } from '../input/InputManager';
import type { RenderEngine } from '../graphics/RenderEngine';
import { CityMap, METERS_PER_MAP_UNIT } from '../map/CityMap';
import { findRoadSpawn } from '../map/MapQueries';
import { Car, CarControls } from './Car';

export class GameplayState implements GameState {
  private readonly id = 'gameplay';
  private map: CityMap | null = null;
  private car: Car | null = null;
  private cameraTogglePressed = false;

  constructor(
    private readonly input?: InputManager,
    private readonly renderEngine?: RenderEngine,
  ) {}

  /** Spawns the player car on a road near the map centre. */
  setCityMap(map: CityMap): void {
    const spawn = findRoadSpawn(map);
    this.map = map;
    this.car = new Car(spawn.x * METERS_PER_MAP_UNIT, spawn.y * METERS_PER_MAP_UNIT, spawn.z * METERS_PER_MAP_UNIT, spawn.heading);
  }

  getCar(): Car | null {
    return this.car;
  }

  enter(): void {
    console.log(`Entered ${this.id} state`);
  }

  update(delta: number): void {
    if (!this.map || !this.car) {
      return;
    }

    this.car.update(delta, this.readControls(), this.map);
    this.renderEngine?.updateCar(this.car, delta);

    // Check for camera toggle (only on key press, not hold)
    const isTogglePressed = this.input?.isPressed('cameraToggle') ?? false;
    if (isTogglePressed && !this.cameraTogglePressed) {
      this.renderEngine?.toggleCameraMode();
    }
    this.cameraTogglePressed = isTogglePressed;
  }

  render(): void {
    // rendering happens in RenderEngine
  }

  leave(): void {
    console.log(`Left ${this.id} state`);
  }

  private readControls(): CarControls {
    const pressed = (action: Parameters<InputManager['isPressed']>[0]) => (this.input?.isPressed(action) ? 1 : 0);
    return {
      throttle: pressed('moveUp') - pressed('moveDown'),
      steer: pressed('moveRight') - pressed('moveLeft'),
    };
  }
}
