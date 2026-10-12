import { AssetLoader, LoadedAsset, LoadedAssetBuckets } from '../assets/AssetLoader';
import { GameplayState } from '../game/GameplayState';
import { MainMenuState } from '../game/MainMenuState';
import { InputManager } from '../input/InputManager';
import { RenderEngine } from '../graphics/RenderEngine';
import { CityMap, parseCmp } from '../map/CityMap';
import { parseG24, StyleData } from '../map/StyleData';
import { createEngineConfig, EngineConfig } from './EngineConfig';
import { GameLoop } from './GameLoop';
import { GameState, StateMachine } from './StateMachine';

export class GameEngine {
  private readonly config: EngineConfig;
  private readonly renderEngine: RenderEngine;
  private readonly assetLoader: AssetLoader;
  private readonly inputManager: InputManager;
  private readonly stateMachine: StateMachine;
  private readonly gameLoop: GameLoop;
  private readonly gameplayState: GameplayState;
  private started = false;

  constructor(canvas?: HTMLCanvasElement | string | null, config: Partial<EngineConfig> = {}) {
    this.config = createEngineConfig(config);
    this.renderEngine = new RenderEngine(canvas);
    this.assetLoader = new AssetLoader();
    this.inputManager = new InputManager();
    this.stateMachine = new StateMachine();
    this.stateMachine.register('boot', {
      enter: () => undefined,
      update: () => undefined,
      leave: () => undefined,
      render: () => this.renderEngine.render(),
    });
    this.stateMachine.register('mainMenu', new MainMenuState());
    this.gameplayState = new GameplayState(this.inputManager, this.renderEngine);
    this.stateMachine.register('gameplay', this.gameplayState);

    this.gameLoop = new GameLoop((delta) => this.tick(delta), this.config);
  }

  registerState(name: string, state: GameState): void {
    this.stateMachine.register(name, state);
  }

  getRenderEngine(): RenderEngine {
    return this.renderEngine;
  }

  getInputManager(): InputManager {
    return this.inputManager;
  }

  getCurrentState(): string | null {
    return this.stateMachine.currentState;
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    this.started = true;
    const assets = await this.assetLoader.loadAll();
    this.renderEngine.showLoadedAssets(assets);
    const map = this.showCityMap(assets.maps['map.nyc'], assets);
    this.inputManager.bindKeyboard();
    if (map) {
      this.gameplayState.setCityMap(map);
      this.stateMachine.enter('gameplay');
    } else {
      this.stateMachine.enter('mainMenu');
    }
    this.gameLoop.start();
  }

  stop(): void {
    this.gameLoop.stop();
  }

  private showCityMap(asset: LoadedAsset | undefined, assets: LoadedAssetBuckets): CityMap | null {
    if (!asset?.ready || !(asset.resource instanceof ArrayBuffer)) {
      console.warn('[GameEngine] City map not loaded', asset?.error ?? '');
      return null;
    }

    const map = parseCmp(asset.resource);
    this.renderEngine.showCityMap(map, this.loadStyle(assets.styles[`style.${String(map.styleNumber).padStart(3, '0')}`]));
    return map;
  }

  private loadStyle(asset: LoadedAsset | undefined): StyleData | undefined {
    if (!asset?.ready || !(asset.resource instanceof ArrayBuffer)) {
      console.warn('[GameEngine] City style not loaded, rendering untextured', asset?.error ?? '');
      return undefined;
    }

    return parseG24(asset.resource);
  }

  private tick(delta: number): void {
    this.renderEngine.beginFrame();
    this.inputManager.update(delta);
    this.stateMachine.update(delta);
    this.stateMachine.render();
    this.renderEngine.render();
  }
}
