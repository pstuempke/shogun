import * as THREE from "three";
import { CAM_LERP, CAM_VIEW_HEIGHT, CAM_ZOOM_MAX, CAM_ZOOM_MIN } from "../core/constants";
import { PAL } from "./palette";

// Classic isometric: orthographic camera on a fixed diagonal, smoothly
// tracking the player — a deliberate upgrade over the 1986 screen-flip.
export class IsoScene {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly renderer: THREE.WebGLRenderer;
  private sun: THREE.DirectionalLight;
  private target = new THREE.Vector3();
  private lookTarget = new THREE.Vector3();
  viewHeight = CAM_VIEW_HEIGHT;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene.background = new THREE.Color(PAL.sky);
    this.scene.fog = new THREE.Fog(PAL.fog, 110, 210);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 400);
    this.resize();

    const ambient = new THREE.HemisphereLight(0xe8f4ff, 0x8a9a6a, 0.9);
    this.scene.add(ambient);

    this.sun = new THREE.DirectionalLight(0xfff2dd, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -45;
    this.sun.shadow.camera.right = 45;
    this.sun.shadow.camera.top = 45;
    this.sun.shadow.camera.bottom = -45;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 160;
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun, this.sun.target);

    window.addEventListener("resize", () => this.resize());
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    const aspect = w / h;
    this.camera.top = this.viewHeight;
    this.camera.bottom = -this.viewHeight;
    this.camera.left = -this.viewHeight * aspect;
    this.camera.right = this.viewHeight * aspect;
    this.camera.updateProjectionMatrix();
  }

  zoom(delta: number): void {
    this.viewHeight = Math.min(CAM_ZOOM_MAX, Math.max(CAM_ZOOM_MIN, this.viewHeight + delta));
    this.resize();
  }

  snapTo(target: THREE.Vector3): void {
    this.target.copy(target);
    this.lookTarget.copy(target);
    this.updateCamera(1);
  }

  follow(target: THREE.Vector3, dt: number): void {
    this.target.copy(target);
    this.lookTarget.lerp(this.target, Math.min(1, CAM_LERP * dt));
    this.updateCamera(dt);
  }

  private updateCamera(_dt: number): void {
    const d = 60;
    this.camera.position.set(this.lookTarget.x + d, this.lookTarget.y + d * 0.82, this.lookTarget.z + d);
    this.camera.lookAt(this.lookTarget);
    this.sun.position.set(this.lookTarget.x - 25, this.lookTarget.y + 55, this.lookTarget.z + 18);
    this.sun.target.position.copy(this.lookTarget);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
