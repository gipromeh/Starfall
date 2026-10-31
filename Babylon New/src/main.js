import "./../styles.css";
import {
  Engine, Scene, Color4, Color3, Vector3, Quaternion, Matrix,
  HemisphericLight, DirectionalLight, FreeCamera, GlowLayer,
  Mesh, MeshBuilder, StandardMaterial, PBRMaterial, VertexData,
  TransformNode, PointLight
} from "@babylonjs/core";
import RAPIER from "@dimforge/rapier3d-compat";
import * as YUKA from "yuka";
import { gsap } from "gsap";
import { FixedStepLoop } from "./core/FixedStepLoop.js";
import { InputAdapter } from "./platform/InputAdapter.js";
import { FlightModel } from "./simulation/FlightModel.js";
import { DamageSystem } from "./simulation/DamageSystem.js";
import { PirateAI } from "./ai/PirateAI.js";
import { ProjectileSystem } from "./combat/ProjectileSystem.js";
import { EventBus } from "./core/EventBus.js";

const $ = id => document.getElementById(id);
const canvas = $("renderCanvas");
const overlay = $("overlay");
const hud = $("hud");
const bootError = $("boot-error");
const message = $("message");
const bus = new EventBus();

let engine, scene, camera, glow, input, loop, world, collisionQueue, playerBody, pirateBody;
let playerRoot, pirateRoot, starField, pirateAI, projectiles, flight, damage;
let running = false, paused = false, elapsed = 0, laserCooldown = 0, pirateRespawn = 0;
let pirateHull = 70, lastEnemyShot = 0, cameraShake = 0, messageTween = null;
const playerPosition = new Vector3(0, 0, 0);
const up = Vector3.Up();
const colliderTags = new Map();

function showMessage(text, duration = 1.6, color = "#ffc56b") {
  message.textContent = text;
  message.style.color = color;
  gsap.killTweensOf(message);
  gsap.set(message, { opacity: 0, y: -8 });
  gsap.to(message, { opacity: 1, y: 0, duration: 0.18, yoyo: true, repeat: 1, repeatDelay: duration / 2, ease: "power2.out" });
}

function makeMaterial(name, color, metalness = 0.55, roughness = 0.38, emissive = null) {
  const mat = new PBRMaterial(name, scene);
  mat.albedoColor = Color3.FromHexString(color);
  mat.metallic = metalness;
  mat.roughness = roughness;
  if (emissive) mat.emissiveColor = Color3.FromHexString(emissive);
  return mat;
}

function createWingMesh(name, material, parent) {
  const outline = [
    [0, -4.0], [0.9, -1.5], [4.2, 2.4], [4.7, 3.2], [1.3, 2.8],
    [0.8, 3.4], [-0.8, 3.4], [-1.3, 2.8], [-4.7, 3.2], [-4.2, 2.4], [-0.9, -1.5]
  ];
  const positions = [0, 0.16, 0, 0, -0.16, 0];
  const indices = [];
  for (const [x, z] of outline) positions.push(x, 0.16, z, x, -0.16, z);
  const count = outline.length;
  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count;
    const topA = 2 + i * 2, bottomA = topA + 1;
    const topB = 2 + next * 2, bottomB = topB + 1;
    indices.push(0, topB, topA, 1, bottomA, bottomB);
    indices.push(topA, bottomA, bottomB, topA, bottomB, topB);
  }
  const mesh = new Mesh(name, scene);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = [];
  VertexData.ComputeNormals(positions, indices, data.normals);
  data.applyToMesh(mesh, true);
  mesh.material = material;
  mesh.parent = parent;
  return mesh;
}

function createShip(name, enemy = false) {
  const root = new TransformNode(name, scene);
  const hullMat = makeMaterial(`${name}-hull`, enemy ? "#7e2636" : "#c9d8e6", 0.82, 0.28);
  hullMat.backFaceCulling = false;
  const darkMat = makeMaterial(`${name}-armor`, "#202c3c", 0.9, 0.32);
  const glassMat = makeMaterial(`${name}-canopy`, enemy ? "#5b1d2a" : "#15516d", 0.65, 0.12, enemy ? "#a52138" : "#126a91");
  const glowMat = makeMaterial(`${name}-glow`, enemy ? "#ff4a62" : "#42dfff", 0.25, 0.22, enemy ? "#ff263f" : "#21cfff");
  const orangeMat = makeMaterial(`${name}-trim`, enemy ? "#ff7b42" : "#e0a45e", 0.72, 0.3, enemy ? "#6c2010" : "#42200c");
  const attach = mesh => { mesh.parent = root; return mesh; };

  const fuselage = attach(MeshBuilder.CreateCylinder(`${name}-fuselage`, {
    height: 7.4, diameterTop: 0.62, diameterBottom: 1.55, tessellation: 12
  }, scene));
  fuselage.rotation.x = -Math.PI / 2;
  fuselage.position.z = 0.25;
  fuselage.material = hullMat;

  const nose = attach(MeshBuilder.CreateCylinder(`${name}-nose`, {
    height: 2.5, diameterTop: 0, diameterBottom: 0.68, tessellation: 12
  }, scene));
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -4.45;
  nose.material = darkMat;

  const cockpit = attach(MeshBuilder.CreateSphere(`${name}-cockpit`, { diameter: 1, segments: 20 }, scene));
  cockpit.scaling.set(0.66, 0.48, 1.45);
  cockpit.position.set(0, 0.57, -0.85);
  cockpit.material = glassMat;

  createWingMesh(`${name}-main-wing`, hullMat, root);

  for (const side of [-1, 1]) {
    const wingRail = attach(MeshBuilder.CreateBox(`${name}-wing-rail-${side}`, {
      width: 0.1, height: 0.08, depth: 2.5
    }, scene));
    wingRail.position.set(side * 2.25, 0.08, 1.05);
    wingRail.rotation.y = -side * 0.18;
    wingRail.material = orangeMat;

    const enginePod = attach(MeshBuilder.CreateCylinder(`${name}-engine-${side}`, {
      height: 2.25, diameter: 0.76, tessellation: 12
    }, scene));
    enginePod.rotation.x = -Math.PI / 2;
    enginePod.position.set(side * 1.2, -0.05, 2.75);
    enginePod.material = darkMat;

    const nozzle = attach(MeshBuilder.CreateCylinder(`${name}-nozzle-${side}`, {
      height: 0.12, diameter: 0.58, tessellation: 12
    }, scene));
    nozzle.rotation.x = -Math.PI / 2;
    nozzle.position.set(side * 1.2, -0.05, 3.92);
    nozzle.material = glowMat;

    const stripe = attach(MeshBuilder.CreateBox(`${name}-stripe-${side}`, {
      width: 0.11, height: 0.05, depth: 2.1
    }, scene));
    stripe.position.set(side * 2.25, 0.01, 0.85);
    stripe.material = orangeMat;
  }

  const dorsal = attach(MeshBuilder.CreateBox(`${name}-dorsal`, {
    width: 0.36, height: 0.42, depth: 2.5
  }, scene));
  dorsal.position.set(0, 0.58, 1.25);
  dorsal.material = darkMat;

  const fin = attach(MeshBuilder.CreateBox(`${name}-fin`, {
    width: 0.14, height: 0.9, depth: 1.8
  }, scene));
  fin.position.set(0, 0.86, 2.05);
  fin.material = hullMat;

  root.metadata = { hullMat, darkMat, glassMat, glowMat, orangeMat };
  return root;
}

function createStarField() {
  const count = 1800;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const radius = 500 + Math.random() * 2200;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  starField = new Mesh("star-field", scene);
  const data = new VertexData();
  data.positions = Array.from(positions);
  data.indices = Array.from({ length: count }, (_, i) => i);
  data.applyToMesh(starField, true);
  const material = new StandardMaterial("star-points", scene);
  material.pointsCloud = true;
  material.pointSize = 2.1;
  material.disableLighting = true;
  material.emissiveColor = new Color3(0.55, 0.78, 1);
  starField.material = material;
  starField.alwaysSelectAsActiveMesh = true;

  const nebulaA = MeshBuilder.CreateSphere("nebula-blue", { diameter: 900, segments: 12 }, scene);
  nebulaA.position.set(-900, 500, -1800);
  const nebulaMat = new StandardMaterial("nebula-blue-mat", scene);
  nebulaMat.emissiveColor = new Color3(0.035, 0.09, 0.24);
  nebulaMat.alpha = 0.12;
  nebulaMat.disableLighting = true;
  nebulaMat.backFaceCulling = false;
  nebulaA.material = nebulaMat;

  const nebulaB = MeshBuilder.CreateSphere("nebula-magenta", { diameter: 1100, segments: 12 }, scene);
  nebulaB.position.set(1200, -500, -2400);
  const nebulaMatB = new StandardMaterial("nebula-magenta-mat", scene);
  nebulaMatB.emissiveColor = new Color3(0.16, 0.025, 0.12);
  nebulaMatB.alpha = 0.09;
  nebulaMatB.disableLighting = true;
  nebulaMatB.backFaceCulling = false;
  nebulaB.material = nebulaMatB;
}

function createPhysicsBody(position, radius, tag) {
  const desc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(position.x, position.y, position.z)
    .setGravityScale(0)
    .setLinearDamping(0.02)
    .setAngularDamping(8)
    .lockRotations()
    .setCanSleep(false);
  const body = world.createRigidBody(desc);
  const collider = world.createCollider(
    RAPIER.ColliderDesc.ball(radius)
      .setRestitution(0.28)
      .setFriction(0.12)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    body
  );
  colliderTags.set(collider.handle, tag);
  return { body, collider };
}

function initScene() {
  engine = new Engine(canvas, true, {
    preserveDrawingBuffer: false, stencil: true, powerPreference: "high-performance",
    adaptToDeviceRatio: true
  });
  scene = new Scene(engine);
  scene.clearColor = new Color4(0.003, 0.006, 0.018, 1);
  scene.ambientColor = new Color3(0.12, 0.16, 0.24);
  camera = new FreeCamera("chase-camera", new Vector3(0, 3.4, 10.5), scene);
  camera.fov = 70 * Math.PI / 180;
  camera.minZ = 0.1;
  camera.maxZ = 20000;
  camera.setTarget(new Vector3(0, 0, -18));
  scene.activeCamera = camera;

  const hemi = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.56;
  const key = new DirectionalLight("key-light", new Vector3(-0.5, -0.8, 0.3), scene);
  key.intensity = 1.25;
  const rim = new PointLight("ship-rim", new Vector3(0, 5, 5), scene);
  rim.diffuse = new Color3(0.18, 0.62, 1);
  rim.intensity = 45;
  rim.range = 90;
  glow = new GlowLayer("starfall-glow", scene, { blurKernelSize: 48 });
  glow.intensity = 0.36;

  createStarField();
  playerRoot = createShip("player-ship");
  pirateRoot = createShip("pirate-interceptor", true);
  pirateRoot.position.set(0, 12, -260);

  return scene;
}

function initPhysics() {
  world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.timestep = 1 / 60;
  collisionQueue = new RAPIER.EventQueue(true);
  const player = createPhysicsBody(new Vector3(0, 0, 0), 3.9, "player");
  const pirate = createPhysicsBody(new Vector3(0, 12, -260), 4.6, "pirate");
  playerBody = player.body;
  pirateBody = pirate.body;
}

function updateHud(speed, pirateDistance) {
  const setBar = (id, value) => { $(id).style.width = `${Math.max(0, Math.min(100, value))}%`; };
  setBar("hull-bar", damage.hull);
  setBar("shield-bar", damage.shield);
  setBar("heat-bar", damage.heat);
  setBar("fuel-bar", flight.fuel);
  $("hull-value").textContent = Math.round(damage.hull);
  $("shield-value").textContent = Math.round(damage.shield);
  $("heat-value").textContent = Math.round(damage.heat);
  $("fuel-value").textContent = Math.round(flight.fuel);
  $("speed").textContent = String(Math.round(speed)).padStart(3, "0");
  $("enemy-bar").style.width = `${Math.max(0, pirateHull / 70 * 100)}%`;
  $("target-range").textContent = `ДИСТАНЦИЯ ${Math.round(pirateDistance)} м · РАКЕТЫ ${damage.missiles}`;
  $("flight-state").textContent = flight.boost > 0.2 ? "ФОРСАЖ" : (flight.throttle < 0.08 ? "ДРЕЙФ" : "ПОЛЁТ");
}

function syncBody(body, mesh, position, orientation) {
  const p = body.translation();
  position.set(p.x, p.y, p.z);
  mesh.position.copyFrom(position);
  mesh.rotationQuaternion = orientation.clone();
}

function aimDirection() {
  return new Vector3(0, 0, -1).applyRotationQuaternion(flight.orientation).normalize();
}

function fireLaser() {
  if (!damage.fireLaser()) {
    showMessage("ЛАЗЕР ПЕРЕГРЕТ · ОХЛАЖДЕНИЕ", 1.3, "#ffb66b");
    return;
  }
  const q = flight.orientation;
  const dir = aimDirection();
  for (const side of [-1, 1]) {
    const local = new Vector3(side * 1.8, -0.1, -5.2).applyRotationQuaternion(q);
    const muzzle = playerPosition.add(local);
    projectiles.fire(muzzle.clone(), dir.clone(), { speed: 420, damage: 17, life: 1.25 });
  }
  laserCooldown = 0.115;
  gsap.fromTo(".reticle", { scale: 1, opacity: 1 }, { scale: 1.18, opacity: 0.68, duration: 0.08, yoyo: true, repeat: 1 });
}

function fireMissile() {
  if (damage.missiles <= 0) {
    showMessage("РАКЕТЫ ИЗРАСХОДОВАНЫ", 1.2, "#ff8e8e");
    return;
  }
  damage.missiles--;
  const dir = aimDirection();
  const local = new Vector3(0, -0.28, -5.6).applyRotationQuaternion(flight.orientation);
  const muzzle = playerPosition.add(local);
  const toPirate = pirateRoot.position.subtract(playerPosition).normalize();
  const forward = aimDirection();
  const locked = Vector3.Dot(forward, toPirate) > Math.cos(0.22) && playerPosition.subtract(pirateRoot.position).length() < 1300;
  projectiles.fire(muzzle.clone(), dir.clone(), {
    speed: 170, damage: 100, life: 4.5, missile: true,
    target: locked && pirateRoot.isEnabled() ? pirateRoot : null
  });
  showMessage(`РАКЕТА ЗАПУЩЕНА · ${damage.missiles} ОСТАЛОСЬ`, 0.9, "#ffc56b");
}

function destroyPirate() {
  if (pirateRespawn > 0) return;
  pirateRespawn = 4;
  pirateRoot.setEnabled(false);
  pirateBody.setTranslation({ x: 0, y: -10000, z: 0 }, true);
  showMessage("ПИРАТСКИЙ ПЕРЕХВАТЧИК УНИЧТОЖЕН", 2.2, "#8dffcb");
}

function handleProjectileHit({ projectile, tag, point }) {
  if (tag === "pirate" && !projectile.enemy) {
    pirateHull = Math.max(0, pirateHull - projectile.damage);
    cameraShake = Math.max(cameraShake, 0.08);
    gsap.fromTo("#enemy-bar", { opacity: 0.4 }, { opacity: 1, duration: 0.22 });
    if (pirateHull <= 0) destroyPirate();
  } else if (tag === "player" && projectile.enemy) {
    const result = damage.damage(projectile.damage, elapsed);
    cameraShake = Math.max(cameraShake, 0.28);
    gsap.fromTo("#hud", { opacity: 0.55 }, { opacity: 1, duration: 0.24 });
    showMessage(`ПОПАДАНИЕ · ЩИТ ${Math.round(damage.shield)}%`, 0.7, "#ff8290");
    if (result.destroyed) {
      paused = true;
      showMessage("КОРАБЛЬ УНИЧТОЖЕН · ПЕРЕЗАПУСК", 5, "#ff6677");
      overlay.classList.remove("hidden");
      $("overlay-copy").textContent = "Корпус уничтожен. Перезапусти перехват.";
      $("start-button").textContent = "ПОВТОРИТЬ ПЕРЕХВАТ";
      hud.classList.add("hidden");
    }
  }
  bus.emit("combat:hit", { tag, point, damage: projectile.damage });
}

function respawnPirate() {
  pirateHull = 70;
  const spawn = playerPosition.add(new Vector3((Math.random() - 0.5) * 100, 15 + Math.random() * 30, -280 - Math.random() * 100));
  pirateBody.setTranslation({ x: spawn.x, y: spawn.y, z: spawn.z }, true);
  pirateBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
  pirateRoot.position.copyFrom(spawn);
  pirateRoot.setEnabled(true);
  pirateAI = new PirateAI();
  pirateAI.syncPhysics(spawn, { x: 0, y: 0, z: 0 });
  showMessage("НОВЫЙ ПИРАТСКИЙ КОНТАКТ", 1.6);
}

function updateSimulation(dt) {
  if (paused || !running) return;
  elapsed += dt;

  const flightState = flight.update(dt, input);
  const q = flight.orientation;
  playerBody.setLinvel({
    x: flight.velocity.x, y: flight.velocity.y, z: flight.velocity.z
  }, true);
  playerBody.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);

  const ai = pirateAI.update(dt, playerPosition, flight.velocity);
  pirateBody.setLinvel({ x: ai.velocity.x, y: ai.velocity.y, z: ai.velocity.z }, true);
  const enemyDirection = new Vector3(ai.direction.x, ai.direction.y, ai.direction.z);
  pirateRoot.position.copyFromFloats(ai.position.x, ai.position.y, ai.position.z);

  world.timestep = dt;
  world.step(collisionQueue);
  collisionQueue.drainCollisionEvents((handleA, handleB, started) => {
    if (!started) return;
    const tagA = colliderTags.get(handleA);
    const tagB = colliderTags.get(handleB);
    if ((tagA === "player" && tagB === "pirate") || (tagA === "pirate" && tagB === "player")) {
      damage.damage(10, elapsed);
      pirateHull = Math.max(0, pirateHull - 12);
      cameraShake = Math.max(cameraShake, 0.35);
      showMessage("СТОЛКНОВЕНИЕ КОРАБЛЕЙ", 1.1, "#ff9d77");
      if (pirateHull <= 0) destroyPirate();
    }
  });

  const p = playerBody.translation();
  playerPosition.set(p.x, p.y, p.z);
  flight.velocity.set(playerBody.linvel().x, playerBody.linvel().y, playerBody.linvel().z);
  playerRoot.position.copyFrom(playerPosition);
  playerRoot.rotationQuaternion = q.clone();

  const ep = pirateBody.translation();
  pirateRoot.position.set(ep.x, ep.y, ep.z);
  const pirateVelocity = pirateBody.linvel();
  pirateAI.syncPhysics(
    { x: ep.x, y: ep.y, z: ep.z },
    { x: pirateVelocity.x, y: pirateVelocity.y, z: pirateVelocity.z }
  );
  if (enemyDirection.length() > 0.001) {
    pirateRoot.lookAt(pirateRoot.position.add(enemyDirection.scale(-1)));
  }

  const forward = new Vector3(0, 0, -1).applyRotationQuaternion(q);
  const cameraOffset = new Vector3(0, 3.4, 10.5).applyRotationQuaternion(q);
  const desiredCamera = playerPosition.add(cameraOffset);
  camera.position = Vector3.Lerp(camera.position, desiredCamera, Math.min(1, 8 * dt));
  const lookTarget = playerPosition.add(forward.scale(22));
  camera.setTarget(lookTarget);
  camera.fov += (((70 + flight.boost * 22) * Math.PI / 180) - camera.fov) * Math.min(1, 5 * dt);
  starField.position.copyFrom(playerPosition);

  if (cameraShake > 0) {
    camera.position.addInPlace(new Vector3(
      (Math.random() - 0.5) * cameraShake,
      (Math.random() - 0.5) * cameraShake,
      (Math.random() - 0.5) * cameraShake
    ));
    cameraShake = Math.max(0, cameraShake - dt * 1.5);
  }

  laserCooldown -= dt;
  if (input.firing && laserCooldown <= 0) fireLaser();
  if (input.consumeMissile()) fireMissile();

  if (ai.canFire && elapsed - lastEnemyShot > 1.15 && pirateHull > 0) {
    lastEnemyShot = elapsed;
    const origin = new Vector3(ep.x, ep.y, ep.z);
    const lead = playerPosition.add(flight.velocity.scale(Math.min(1.2, ai.distance / 150)));
    const direction = lead.subtract(origin).normalize();
    origin.addInPlace(direction.scale(6));
    projectiles.fire(origin, direction, { enemy: true, speed: 150, damage: 12, life: 4 });
  }

  projectiles.update(dt, handleProjectileHit);
  damage.update(dt, elapsed, input.firing);
  if (pirateRespawn > 0) {
    pirateRespawn -= dt;
    if (pirateRespawn <= 0) respawnPirate();
  }

  const distance = playerPosition.subtract(pirateRoot.position).length();
  updateHud(flightState.speed, distance);
  if (damage.destroyed) return;
}

function resetGame() {
  elapsed = 0; laserCooldown = 0; pirateRespawn = 0; pirateHull = 70;
  lastEnemyShot = 0; cameraShake = 0;
  input.firing = false;
  input.keys.clear();
  input.pointer.x = input.pointer.y = 0.5;
  damage = new DamageSystem();
  flight = new FlightModel();
  flight.velocity.set(0, 0, 0);
  flight.orientation.copyFrom(Quaternion.Identity());
  playerPosition.set(0, 0, 0);
  playerBody.setTranslation({ x: 0, y: 0, z: 0 }, true);
  playerBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
  playerBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  pirateBody.setTranslation({ x: 0, y: 12, z: -260 }, true);
  pirateBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
  pirateRoot.position.set(0, 12, -260);
  pirateRoot.rotationQuaternion = Quaternion.Identity();
  pirateRoot.setEnabled(true);
  pirateAI = new PirateAI();
  projectiles.dispose();
  projectiles = new ProjectileSystem(scene, { RAPIER, world, tags: colliderTags });
  camera.position.set(0, 3.4, 10.5);
  camera.setTarget(new Vector3(0, 0, -20));
  paused = false; running = true;
  hud.classList.remove("hidden");
  overlay.classList.add("hidden");
  showMessage("ПИРАТСКИЙ ПЕРЕХВАТЧИК · ОТКРЫТЬ ОГОНЬ", 2.2);
}

function attachTouchControls() {
  const fire = $("fire-touch");
  const missile = $("missile-touch");
  fire.addEventListener("pointerdown", e => {
    e.preventDefault(); input.firing = true; fire.setPointerCapture(e.pointerId);
  });
  fire.addEventListener("pointerup", () => input.firing = false);
  fire.addEventListener("pointercancel", () => input.firing = false);
  missile.addEventListener("pointerdown", e => { e.preventDefault(); input.missileRequested = true; });
  document.querySelectorAll("[data-key]").forEach(button => {
    const code = button.dataset.key;
    button.addEventListener("pointerdown", e => {
      e.preventDefault(); input.keys.add(code); button.setPointerCapture(e.pointerId);
    });
    const release = () => input.keys.delete(code);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  });
}

async function boot() {
  try {
    await RAPIER.init();
    initScene();
    initPhysics();
    input = new InputAdapter(canvas);
    projectiles = new ProjectileSystem(scene, { RAPIER, world, tags: colliderTags });
    flight = new FlightModel();
    damage = new DamageSystem();
    pirateAI = new PirateAI();
    attachTouchControls();
    loop = new FixedStepLoop({
      step: 1 / 60,
      maxFrame: 0.08,
      maxSubSteps: 5,
      update: updateSimulation,
      render: () => scene.render()
    });
    $("start-button").addEventListener("click", () => {
      if (running && paused && !damage.destroyed) {
        paused = false;
        overlay.classList.add("hidden");
      } else {
        resetGame();
      }
    });
    window.addEventListener("keydown", e => {
      if ((e.code === "Escape" || e.code === "KeyP") && running) {
        paused = !paused;
        if (paused) {
          overlay.classList.remove("hidden");
          $("overlay-copy").textContent = "ПАУЗА. Продолжай перехват, когда будешь готов.";
          $("start-button").textContent = "ПРОДОЛЖИТЬ";
        } else {
          overlay.classList.add("hidden");
        }
      }
    });
    window.addEventListener("resize", () => engine.resize());
    window.addEventListener("pagehide", () => {
      loop.stop(); input.dispose(); projectiles.dispose(); scene.dispose(); engine.dispose(); world.free();
    }, { once: true });
    loop.start();
    $("overlay-copy").textContent = "Babylon.js + Rapier + Yuka. Сохранили исходные клавиши, инерционный разгон, торможение, форсаж и боевой ритм.";
    window.starfallBabylonNew = { scene, engine, world, flight, damage, pirateAI, projectiles, bus };
  } catch (error) {
    console.error("[STARFALL Babylon New] boot failed", error);
    bootError.classList.remove("hidden");
    bootError.textContent = `ОШИБКА ЗАПУСКА\n${error?.stack || error}`;
  }
}

boot();
