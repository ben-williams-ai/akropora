import * as pc from "playcanvas";

const DEFAULT_SPLAT_URL = "./lod/lod-meta.json";
const BROKEN_SPLAT_URL = "./lod/does-not-exist/lod-meta.json";
const HINT_HIDE_DELAY_MS = 7000;
const MIN_DISTANCE = 0.4;
const MAX_DISTANCE = 500;
const PICKER_SCALE = 0.5;
const DAMPING_PER_SECOND = 0.008;
const TOWN_LOD_BASE_DISTANCE = 160;
const TOWN_LOD_MULTIPLIER = 2;
const TOWN_LOD_UPDATE_ANGLE = 5;
const TOWN_LOD_UPDATE_DISTANCE = 0.5;
const TOWN_MIN_DISTANCE = 2.4;
const TOWN_SPLAT_BUDGET = 3_000_000;
const VIEWER_BUILD = "town-local-2026-05-14-no-picker-no-ids-webgl-check";

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
 * Checks whether the browser can create a WebGL context before PlayCanvas starts.
 *
 * Chrome can temporarily lose WebGL after a GPU-process crash. When that happens
 * PlayCanvas throws a short "WebGL not supported" error, but the useful fix is
 * to restart Chrome or re-enable hardware acceleration.
 *
 * @return {boolean} True when WebGL is currently available.
 */
function isWebGLAvailable() {
  const testCanvas = document.createElement("canvas");
  const context =
    testCanvas.getContext("webgl2") ||
    testCanvas.getContext("webgl") ||
    testCanvas.getContext("experimental-webgl");
  return Boolean(context);
}

/**
 * Reads streamed-LOD chunk metadata and derives practical viewer bounds.
 *
 * The engine resource AABB can be too conservative for this large streamed
 * asset, which leaves the town as a tiny speck after initial framing. The
 * coarsest LOD has only a few chunks, so it is cheap to read and gives us a
 * stable startup camera frame without waiting for every high-detail chunk.
 *
 * @param {string} splatUrl URL to the lod-meta.json file.
 * @return {!Promise<?pc.BoundingBox>} Derived bounds, or null if unavailable.
 */
async function getStreamedLodBounds(splatUrl) {
  const entryUrl = new URL(splatUrl, window.location.href);
  const response = await fetch(entryUrl);
  if (!response.ok) {
    return null;
  }

  const entry = await response.json();
  const coarsestLevel = Math.max(0, Number(entry.lodLevels || 1) - 1);
  const chunkFiles = (entry.filenames || []).filter((filename) => {
    return filename.startsWith(`${coarsestLevel}_`) && filename.endsWith("/meta.json");
  });
  if (chunkFiles.length === 0) {
    return null;
  }

  const mins = [Infinity, Infinity, Infinity];
  const maxs = [-Infinity, -Infinity, -Infinity];
  await Promise.all(
    chunkFiles.map(async (filename) => {
      const chunkUrl = new URL(filename, entryUrl);
      const chunkResponse = await fetch(chunkUrl);
      if (!chunkResponse.ok) {
        return;
      }

      const chunk = await chunkResponse.json();
      for (let axis = 0; axis < 3; axis += 1) {
        mins[axis] = Math.min(mins[axis], chunk.means.mins[axis]);
        maxs[axis] = Math.max(maxs[axis], chunk.means.maxs[axis]);
      }
    })
  );

  if (!mins.every(Number.isFinite) || !maxs.every(Number.isFinite)) {
    return null;
  }

  const center = new pc.Vec3(
    (mins[0] + maxs[0]) * 0.5,
    (mins[1] + maxs[1]) * 0.5,
    (mins[2] + maxs[2]) * 0.5
  );
  const halfExtents = new pc.Vec3(
    Math.max((maxs[0] - mins[0]) * 0.5, MIN_DISTANCE),
    Math.max((maxs[1] - mins[1]) * 0.5, MIN_DISTANCE),
    Math.max((maxs[2] - mins[2]) * 0.5, MIN_DISTANCE)
  );

  return new pc.BoundingBox(center, halfExtents);
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
 * @param {function(number, number): void} focusPicker Focus callback.
   */
  constructor(cameraEntity, inputElement, focusPicker) {
    /** @private @const {!pc.Entity} */
    this.cameraEntity = cameraEntity;
    /** @private @const {!pc.CameraComponent} */
    this.camera = cameraEntity.camera;
    /** @private @const {!HTMLCanvasElement} */
    this.inputElement = inputElement;
    /** @private @const {function(number, number): void} */
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
    /** @private {number} */
    this.minDistance = MIN_DISTANCE;
    /** @private {?{mode: string, x: number, y: number}} */
    this.dragState = null;
    /** @private {?{distance: number, midpointX: number, midpointY: number}} */
    this.touchState = null;

    this.bindEvents();
    this.applyCameraTransform();
  }

  /**
   * Sets a scene-specific minimum camera distance.
   *
   * The full-town asset can overwhelm Chrome's GPU process if the camera is
   * allowed inside very dense LOD0 chunks. Keeping a modest stand-off distance
   * still permits close inspection while avoiding pathological near-camera
   * splat expansion.
   *
   * @param {number} minDistance Minimum orbit distance.
   */
  setMinimumDistance(minDistance) {
    this.minDistance = Math.max(minDistance, MIN_DISTANCE);
    this.distance = Math.max(this.distance, this.minDistance);
    this.targetDistance = Math.max(this.targetDistance, this.minDistance);
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
      this.focusPicker(event.clientX, event.clientY);
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
    this.distance = clamp(framedDistance * 1.55, this.minDistance, MAX_DISTANCE);
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
    this.targetDistance = clamp(this.targetDistance * zoomFactor, this.minDistance, MAX_DISTANCE);
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
  console.info(`Akropora LOD viewer build: ${VIEWER_BUILD}`);

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

  if (!isWebGLAvailable()) {
    setStatus(
      "error",
      "WebGL is unavailable in this Chrome session. Restart Chrome, then reopen this local viewer. If it persists, check chrome://gpu and hardware acceleration."
    );
    return;
  }

  let app = null;
  try {
    app = new pc.Application(canvasElement, {
      elementInput: new pc.ElementInput(canvasElement),
      mouse: new pc.Mouse(document.body),
      touch: new pc.TouchDevice(document.body)
    });
  } catch (error) {
    if (String(error).includes("WebGL")) {
      setStatus(
        "error",
        "PlayCanvas could not start WebGL. Restart Chrome after the earlier GPU crash, then reopen this local viewer."
      );
      return;
    }

    throw error;
  }

  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  app.start();

  const onResize = () => {
    app.resizeCanvas();
  };
  window.addEventListener("resize", onResize);

  app.scene.gsplat.radialSorting = true;
  app.scene.gsplat.lodUpdateAngle = TOWN_LOD_UPDATE_ANGLE;
  app.scene.gsplat.lodUpdateDistance = TOWN_LOD_UPDATE_DISTANCE;
  // ID rendering is only needed for picking. It can trigger an internal
  // PlayCanvas camera-list path before the full-town scene is ready in Chrome,
  // so keep it disabled for this stability-focused local viewer.
  app.scene.gsplat.enableIds = false;
  app.scene.gsplat.alphaClip = 0.2;
  app.scene.gsplat.minPixelSize = 1;
  app.scene.gsplat.splatBudget = TOWN_SPLAT_BUDGET;

  const cameraEntity = new pc.Entity("trial-camera");
  cameraEntity.addComponent("camera", {
    clearColor: new pc.Color(0.06, 0.09, 0.08),
    farClip: 5000,
    fov: 55,
    nearClip: 0.2
  });
  app.root.addChild(cameraEntity);

  let controls = null;
  const focusFromScreenPoint = () => {
    console.info("Double-click focus picking is disabled for this full-town stability test.");
  };

  controls = new SuperSplatStyleController(cameraEntity, canvasElement, focusFromScreenPoint);
  controls.setMinimumDistance(TOWN_MIN_DISTANCE);

  app.on("update", (dt) => {
    if (controls) {
      controls.update(dt);
    }
  });

  setStatus("loading", "Fetching the streamed LOD entry file and initial chunks.");
  const metadataBoundsPromise = getStreamedLodBounds(splatUrl).catch(() => null);
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
    splatEntity.gsplat.lodBaseDistance = TOWN_LOD_BASE_DISTANCE;
    splatEntity.gsplat.lodMultiplier = TOWN_LOD_MULTIPLIER;
    app.root.addChild(splatEntity);

    window.setTimeout(async () => {
      const metadataBounds = await metadataBoundsPromise;
      const bounds = metadataBounds || getBounds(splatEntity);
      if (bounds) {
        controls.frameBoundingBox(bounds);
      }

      setStatus(
        "ready",
        "Ready. The full town streamed LOD asset is loaded locally. Double click a visible point to move the focal point there."
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
