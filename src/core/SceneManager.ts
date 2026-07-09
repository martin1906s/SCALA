import {
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
import type { AbstractMesh, ShadowGenerator as ShadowGeneratorType } from '@babylonjs/core';
import { CELL_SIZE, GRID_SIZE } from '@/config/gameConfig';
import { TEXTURE_URLS, disposeGameTextures, getGameTexture } from '@/utils/textureLoader';

export class SceneManager {
  private engine: Engine | null = null;
  private scene: Scene | null = null;
  private groundMesh: AbstractMesh | null = null;
  private shadowGenerator: ShadowGeneratorType | null = null;
  private skyDome: AbstractMesh | null = null;
  private ambientObserver: { remove: () => void } | null = null;

  init(canvas: HTMLCanvasElement): Scene {
    if (this.scene) {
      return this.scene;
    }

    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      adaptToDeviceRatio: true,
      antialias: true,
    });

    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.45, 0.72, 0.94, 1);
    this.scene.ambientColor = new Color3(0.55, 0.58, 0.62);

    this.createGround();
    this.createLights();
    this.createSkyBackdrop();
    this.startAmbientMotion();

    window.addEventListener('resize', this.handleResize);

    return this.scene;
  }

  getScene(): Scene {
    if (!this.scene) {
      throw new Error('SceneManager not initialized. Call init() first.');
    }
    return this.scene;
  }

  getGroundMesh(): AbstractMesh {
    if (!this.groundMesh) {
      throw new Error('Ground mesh not created.');
    }
    return this.groundMesh;
  }

  getShadowGenerator(): ShadowGeneratorType | null {
    return this.shadowGenerator;
  }

  startRenderLoop(): void {
    if (!this.engine || !this.scene) {
      throw new Error('SceneManager not initialized.');
    }

    this.engine.runRenderLoop(() => {
      this.scene?.render();
    });
  }

  dispose(): void {
    window.removeEventListener('resize', this.handleResize);
    this.ambientObserver?.remove();
    this.ambientObserver = null;

    this.groundMesh?.dispose();
    this.groundMesh = null;
    this.skyDome = null;
    this.shadowGenerator = null;
    disposeGameTextures();

    this.scene?.dispose();
    this.scene = null;

    this.engine?.dispose();
    this.engine = null;
  }

  private createGround(): void {
    const scene = this.getScene();
    const worldSize = GRID_SIZE * CELL_SIZE;

    this.groundMesh = MeshBuilder.CreateGround(
      'terrain',
      { width: worldSize, height: worldSize, subdivisions: 1 },
      scene,
    );
    this.groundMesh.position.y = 0.01;
    this.groundMesh.receiveShadows = true;

    const material = new StandardMaterial('terrainMat', scene);
    const grassTex = getGameTexture(scene, 'grass', TEXTURE_URLS.grass, {
      uScale: GRID_SIZE,
      vScale: GRID_SIZE,
    });
    material.diffuseTexture = grassTex;
    material.diffuseColor = new Color3(1, 1, 1);
    material.specularColor = new Color3(0.06, 0.08, 0.05);
    material.specularPower = 16;
    material.ambientColor = new Color3(0.55, 0.62, 0.5);
    material.emissiveColor = new Color3(0.08, 0.1, 0.06);
    material.maxSimultaneousLights = 4;
    this.groundMesh.material = material;
    this.groundMesh.isPickable = true;
  }

  private createSkyBackdrop(): void {
    const scene = this.getScene();
    const dome = MeshBuilder.CreateSphere('skyDome', { diameter: 120, segments: 16 }, scene);
    dome.position.y = 8;
    dome.scaling.y = 0.45;
    dome.isPickable = false;
    dome.receiveShadows = false;
    this.skyDome = dome;

    const skyMat = new StandardMaterial('skyMat', scene);
    const skyTex = getGameTexture(scene, 'sky', TEXTURE_URLS.sky);
    skyMat.diffuseTexture = skyTex;
    skyMat.emissiveTexture = skyTex;
    skyMat.diffuseColor = new Color3(1, 1, 1);
    skyMat.emissiveColor = new Color3(0.85, 0.9, 1);
    skyMat.specularColor = Color3.Black();
    skyMat.backFaceCulling = false;
    skyMat.disableLighting = true;
    dome.material = skyMat;
  }

  private createLights(): void {
    const scene = this.getScene();

    const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
    hemi.intensity = 0.75;
    hemi.diffuse = new Color3(0.95, 0.97, 1);
    hemi.groundColor = new Color3(0.28, 0.38, 0.22);

    const dir = new DirectionalLight('dir', new Vector3(-0.55, -1, -0.35), scene);
    dir.intensity = 0.85;
    dir.position = new Vector3(14, 22, 10);
    dir.diffuse = new Color3(1, 0.97, 0.9);

    this.shadowGenerator = new ShadowGenerator(2048, dir);
    this.shadowGenerator.useBlurExponentialShadowMap = true;
    this.shadowGenerator.blurKernel = 16;
    this.shadowGenerator.darkness = 0.35;
    this.shadowGenerator.transparencyShadow = true;

    scene.metadata = { ...scene.metadata, shadowGenerator: this.shadowGenerator };
  }

  private startAmbientMotion(): void {
    const scene = this.getScene();
    const hemi = scene.getLightByName('hemi') as HemisphericLight | null;
    const dir = scene.getLightByName('dir') as DirectionalLight | null;
    const start = performance.now();

    this.ambientObserver = scene.onBeforeRenderObservable.add(() => {
      const t = (performance.now() - start) / 1000;
      if (this.skyDome) {
        this.skyDome.rotation.y = t * 0.018;
      }
      if (hemi) {
        hemi.intensity = 0.72 + Math.sin(t * 0.35) * 0.05;
      }
      if (dir) {
        dir.intensity = 0.82 + Math.sin(t * 0.25 + 1) * 0.04;
      }
    });
  }

  private handleResize = (): void => {
    this.engine?.resize();
  };
}
