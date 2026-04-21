import * as pc from "playcanvas";

const DEFAULT_SPLAT_URL = "./lod/lod-meta.json";
const BROKEN_SPLAT_URL = "./lod/does-not-exist/lod-meta.json";
const HINT_HIDE_DELAY_MS = 7000;
const MIN_DISTANCE = 0.4;
const MAX_DISTANCE = 500;
const PICKER_SCALE = 0.5;
const DAMPING_PER_SECOND = 0.008;

const bodyElement = document.body;
const canvasElement = document.getElementById("viewer-canvas");
const startupHintElement = document.getElementById("startup-hint");
const statusSummaryElement = document.getElementById("status-summary");
const statusStateElement = document.getElementById("status-state");
const statusAssetElement = document.getElementById("status-asset");

/**
 * Sets the viewer status card and page state.
 *
 * We keep the status explicit because streamed LOD is loaded over URL-based
 * requests, just like the eventual hosted version. Silent failures are hard to
 * debug, so this page always explains whether the entry file loaded correctly.
 *
 * @param {"loading"|"ready"|"error"} state Viewer state.
 * @param {string} summary Human-readable summary.
 */
function setStatus(state, summary) {
  bodyElement.dataset.viewerState = state;
  statusStateElement.textContent = state.charAt(0).toUpperCase() + state.slice(1);
  statusSummaryElement.textContent = summary;
}

/**
 * Returns the splat URL for this run.
 *
 * The default path uses the same relative layout that a hosted deployment would
 * use. The broken path exists only for deterministic smoke testing of the error
 * state without having to edit files by hand.
 *
 * @return {string} Asset URL.
 */
function getSplatUrl() {
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get("broken") === "1" ? BROKEN_SPLAT_URL : DEFAULT_SPLAT_URL;
}

/**
 * Returns a usable bounding box after the gsplat has loaded.
 *
 * @param {!pc.Entity} splatEntity Entity containing the gsplat component.
 * @return {?pc.BoundingBox} Bounds if available.
 */
function getBounds(splatEntity) {
  if (splatEntity.gsplat.customAabb) {
    return splatEntity.gsplat.customAabb.clone();
  }

  const resource = splatEntity.gsplat.resource;
  if (resource && resource.aabb) {
    return resource.aabb.clone();
  }

  return null;
}

/**
 * Clamps a numeric value.
 *
 * @param {number} value Value to clamp.
 * @param {number} minValue Lower bound.
 * @param {number} maxValue Upper bound.
 * @return {number} Clamped value.
 */
function clamp(value, minValue, maxValue) {
  return Math.min(Math.max(value, minValue), maxValue);
}

/**
 * Returns an exponential damping factor that remains stable across frame rates.
 *
 * @param {number} dt Seconds since last frame.
 * @return {number} Blend amount.
 */
function getDampingFactor(dt) {
  return 1 - Math.pow(DAMPING_PER_SECOND, Math.min(dt, 0.1));
}

class SuperSplatStyleController {
  /**
   * Creates a camera controller that follows the documented SuperSplat mouse
   * conventions: left-drag orbit, right-drag pan, alt+right or middle drag to
   * dolly, and double click to choose a new focus point.
   *
   * @param {!pc.Entity} cameraEntity Camera entity.
   * @param {!HTMLCanvasElement} inputElement Canvas used for input.
   * @param {function(number, number): Promise<void>} focusPicker Async focus picker.
   */
  constructor(cameraEntity, inputElement, focusPicker) {
    /** @private @const {!pc.Entity} */
    this.cameraEntity = cameraEntity;
    /** @private @const {!pc.CameraComponent} */
    this.camera = cameraEntity.camera;
    /** @private @const {!HTMLCanvasElement} */
    this.inputElement = inputElement;
    /** @private @const {function(number, number): Promise<void>} */
    this.focusPicker = focusPicker;
    /** @private {!pc.Vec3} */
    this.focus = new pc.Vec3();
    /** @private {!pc.Vec3} */
    this.targetFocus = new pc.Vec3();
    /** @private {number} */
    this.yaw = 35;
    /** @private {number} */
    this.targetYaw = 35;
    /** @private {number} */
    this.pitch = -18;
    /** @private {number} */
    this.targetPitch = -18;
    /** @private {number} */
    this.distance = 12;
    /** @private {number} */
    this.targetDistance = 12;
    /** @private {?{mode: string, x: number, y: number}} */
    this.dragState = null;
    /** @private {?{distance: number, midpointX: number, midpointY: number}} */
    this.touchState = null;

    this.bindEvents();
    this.applyCameraTransform();
  }

  /** @private */
  bindEvents() {
    this.inputElement.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });

    this.inputElement.addEventListener("mousedown", (event) => {
      const mode = this.getMouseMode(event);
      this.dragState = {
        mode: mode,
        x: event.clientX,
        y: event.clientY
      };
    });

    window.addEventListener("mousemove", (event) => {
      if (!this.dragState) {
        return;
      }

      const deltaX = event.clientX - this.dragState.x;
      const deltaY = event.clientY - this.dragState.y;
      this.dragState.x = event.clientX;
      this.dragState.y = event.clientY;

      switch (this.dragState.mode) {
        case "orbit":
          this.orbit(deltaX, deltaY);
          break;
        case "pan":
          this.pan(deltaX, deltaY);
          break;
        case "dolly":
          this.dolly(deltaY);
          break;
      }
    });

    window.addEventListener("mouseup", () => {
      this.dragState = null;
    });

    this.inputElement.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        this.dolly(event.deltaY * 0.6);
      },
      { passive: false }
    );

    this.inputElement.addEventListener("dblclick", (event) => {
      void this.focusPicker(event.clientX, event.clientY);
    });

    this.inputElement.addEventListener(
      "touchstart",
      (event) => {
        if (event.touches.length === 1) {
          const touch = event.touches[0];
          this.dragState = { mode: "orbit", x: touch.clientX, y: touch.clientY };
          this.touchState = null;
        } else if (event.touches.length === 2) {
          this.dragState = null;
          this.touchState = this.getTouchState(event.touches[0], event.touches[1]);
        }
      },
      { passive: true }
    );

    this.inputElement.addEventListener(
      "touchmove",
      (event) => {
        if (event.touches.length === 1 && this.dragState) {
          const touch = event.touches[0];
          const deltaX = touch.clientX - this.dragState.x;
          const deltaY = touch.clientY - this.dragState.y;
          this.dragState.x = touch.clientX;
          this.dragState.y = touch.clientY;
          this.orbit(deltaX, deltaY);
          return;
        }

        if (event.touches.length === 2 && this.touchState) {
          const nextTouchState = this.getTouchState(event.touches[0], event.touches[1]);
          this.pan(
            nextTouchState.midpointX - this.touchState.midpointX,
            nextTouchState.midpointY - this.touchState.midpointY
          );
          this.targetDistance = clamp(
            this.targetDistance * (this.touchState.distance / nextTouchState.distance),
            MIN_DISTANCE,
            MAX_DISTANCE
          );
          this.touchState = nextTouchState;
        }
      },
      { passive: true }
    );

    this.inputElement.addEventListener("touchend", () => {
      this.dragState = null;
      this.touchState = null;
    });
  }

  /**
   * Frames the camera around the loaded splat bounds.
   *
   * @param {!pc.BoundingBox} boundingBox Bounds to frame.
   */
  frameBoundingBox(boundingBox) {
    this.focus.copy(boundingBox.center);
    this.targetFocus.copy(boundingBox.center);

    const radius = Math.max(boundingBox.halfExtents.length(), MIN_DISTANCE);
    const fieldOfViewRadians = pc.math.DEG_TO_RAD * this.camera.fov;
    const framedDistance = radius / Math.tan(fieldOfViewRadians * 0.5);
    this.distance = clamp(framedDistance * 1.55, MIN_DISTANCE, MAX_DISTANCE);
    this.targetDistance = this.distance;
    this.applyCameraTransform();
  }

  /**
   * Moves the focus target smoothly to a picked world-space point.
   *
   * @param {!pc.Vec3} worldPoint Picked point.
   */
  setFocusPoint(worldPoint) {
    this.targetFocus.copy(worldPoint);
  }

  /**
   * Updates controller smoothing and camera pose.
   *
   * @param {number} dt Seconds since last frame.
   */
  update(dt) {
    const damping = getDampingFactor(dt);
    this.focus.lerp(this.focus, this.targetFocus, damping);
    this.yaw = pc.math.lerp(this.yaw, this.targetYaw, damping);
    this.pitch = pc.math.lerp(this.pitch, this.targetPitch, damping);
    this.distance = pc.math.lerp(this.distance, this.targetDistance, damping);
    this.applyCameraTransform();
  }

  /**
   * Returns the requested mouse interaction mode.
   *
   * @param {!MouseEvent} event Mouse event.
   * @return {string} Interaction mode.
   * @private
   */
  getMouseMode(event) {
    if (event.button === 1 || (event.button === 2 && event.altKey)) {
      return "dolly";
    }

    if (event.button === 2 && event.shiftKey) {
      return "orbit";
    }

    if (event.button === 2) {
      return "pan";
    }

    return "orbit";
  }

  /**
   * Rotates the camera around the current focus point.
   *
   * @param {number} deltaX Horizontal drag delta.
   * @param {number} deltaY Vertical drag delta.
   * @private
   */
  orbit(deltaX, deltaY) {
    this.targetYaw -= deltaX * 0.22;
    this.targetPitch = clamp(this.targetPitch - deltaY * 0.18, -89, 89);
  }

  /**
   * Pans the focus point in camera space.
   *
   * @param {number} deltaX Horizontal drag delta.
   * @param {number} deltaY Vertical drag delta.
   * @private
   */
  pan(deltaX, deltaY) {
    const panScale = Math.max(this.distance * 0.0011, 0.0007);
    const rightOffset = this.cameraEntity.right.clone().mulScalar(-deltaX * panScale);
    const upOffset = this.cameraEntity.up.clone().mulScalar(deltaY * panScale);
    this.targetFocus.add(rightOffset).add(upOffset);
  }

  /**
   * Changes camera distance.
   *
   * @param {number} deltaY Mouse delta or wheel delta.
   * @private
   */
  dolly(deltaY) {
    const zoomFactor = Math.exp(deltaY * 0.0015);
    this.targetDistance = clamp(this.targetDistance * zoomFactor, MIN_DISTANCE, MAX_DISTANCE);
  }

  /**
   * Builds touch state for pinch interactions.
   *
   * @param {!Touch} firstTouch First active touch.
   * @param {!Touch} secondTouch Second active touch.
   * @return {{distance: number, midpointX: number, midpointY: number}} Pinch state.
   * @private
   */
  getTouchState(firstTouch, secondTouch) {
    const deltaX = secondTouch.clientX - firstTouch.clientX;
    const deltaY = secondTouch.clientY - firstTouch.clientY;

    return {
      distance: Math.max(Math.hypot(deltaX, deltaY), 1),
      midpointX: (firstTouch.clientX + secondTouch.clientX) * 0.5,
      midpointY: (firstTouch.clientY + secondTouch.clientY) * 0.5
    };
  }

  /** @private */
  applyCameraTransform() {
    const yawRadians = pc.math.DEG_TO_RAD * this.yaw;
    const pitchRadians = pc.math.DEG_TO_RAD * this.pitch;
    const cosPitch = Math.cos(pitchRadians);
    const offset = new pc.Vec3(
      Math.sin(yawRadians) * cosPitch,
      Math.sin(pitchRadians),
      Math.cos(yawRadians) * cosPitch
    ).mulScalar(this.distance);

    this.cameraEntity.setPosition(this.focus.clone().add(offset));
    this.cameraEntity.lookAt(this.focus);
  }
}

/**
 * Builds the PlayCanvas app and loads the streamed LOD asset.
 */
async function main() {
  const splatUrl = getSplatUrl();
  statusAssetElement.textContent = splatUrl;

  window.addEventListener("error", (event) => {
    if (bodyElement.dataset.viewerState === "ready") {
      return;
    }

    setStatus("error", `Viewer bootstrap failed: ${event.message}`);
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (bodyElement.dataset.viewerState === "ready") {
      return;
    }

    setStatus("error", `Viewer bootstrap failed: ${String(event.reason)}`);
  });

  const app = new pc.Application(canvasElement, {
    elementInput: new pc.ElementInput(canvasElement),
    mouse: new pc.Mouse(document.body),
    touch: new pc.TouchDevice(document.body)
  });

  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  app.start();

  const onResize = () => {
    app.resizeCanvas();
  };
  window.addEventListener("resize", onResize);

  app.scene.gsplat.radialSorting = true;
  app.scene.gsplat.lodUpdateAngle = 90;
  app.scene.gsplat.enableIds = true;
  app.scene.gsplat.alphaClip = 0.2;
  app.scene.gsplat.minPixelSize = 1;

  const cameraEntity = new pc.Entity("trial-camera");
  cameraEntity.addComponent("camera", {
    clearColor: new pc.Color(0.06, 0.09, 0.08),
    farClip: 5000,
    fov: 55,
    nearClip: 0.05
  });
  app.root.addChild(cameraEntity);

  const worldLayer = app.scene.layers.getLayerByName("World");
  const picker = new pc.Picker(app, 1, 1, true);
  let controls = null;

  const focusFromScreenPoint = async (clientX, clientY) => {
    if (!controls || !worldLayer) {
      return;
    }

    const canvasRect = canvasElement.getBoundingClientRect();
    const localX = clientX - canvasRect.left;
    const localY = clientY - canvasRect.top;
    if (localX < 0 || localY < 0 || localX > canvasRect.width || localY > canvasRect.height) {
      return;
    }

    picker.resize(
      Math.max(1, Math.round(canvasRect.width * PICKER_SCALE)),
      Math.max(1, Math.round(canvasRect.height * PICKER_SCALE))
    );
    picker.prepare(cameraEntity.camera, app.scene, [worldLayer]);

    const worldPoint = await picker.getWorldPointAsync(localX * PICKER_SCALE, localY * PICKER_SCALE);
    if (worldPoint) {
      controls.setFocusPoint(worldPoint);
      setStatus("ready", "Ready. The p20 streamed LOD patch is loaded locally.");
    }
  };

  controls = new SuperSplatStyleController(cameraEntity, canvasElement, focusFromScreenPoint);

  app.on("update", (dt) => {
    if (controls) {
      controls.update(dt);
    }
  });

  setStatus("loading", "Fetching the streamed LOD entry file and initial chunks.");
  const asset = new pc.Asset("trial-lod", "gsplat", { url: splatUrl });
  app.assets.add(asset);

  asset.once("error", (error) => {
    setStatus("error", `Could not load the streamed LOD asset: ${error}`);
  });

  asset.once("load", () => {
    const splatEntity = new pc.Entity("trial-splat");
    splatEntity.addComponent("gsplat", {
      asset: asset,
      unified: true
    });
    splatEntity.gsplat.highQualitySH = false;
    splatEntity.gsplat.lodBaseDistance = 3;
    splatEntity.gsplat.lodMultiplier = 2.2;
    app.root.addChild(splatEntity);

    window.setTimeout(() => {
      const bounds = getBounds(splatEntity);
      if (bounds) {
        controls.frameBoundingBox(bounds);
      }

      setStatus(
        "ready",
        "Ready. The p20 streamed LOD patch is loaded locally. Double click a visible point to move the focal point there."
      );
    }, 0);
  });

  app.assets.load(asset);

  window.setTimeout(() => {
    if (startupHintElement) {
      startupHintElement.classList.add("is-hidden");
    }
  }, HINT_HIDE_DELAY_MS);
}

main();
