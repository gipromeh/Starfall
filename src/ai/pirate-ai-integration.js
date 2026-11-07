/* STARFALL Pirate AI Core 1.0.1 — native game bridge.
 * Starfall remains authoritative for physics, collisions, damage and weapon execution.
 */
(() => {
  "use strict";
  const CORE_BUNDLE = "./src/ai/pirate-ai-core.esm.gz.b64";
  const API_VERSION = "1.0.0";
  const DECISION_STEP = 0.2; // 5 Hz tactical core; native EAI keeps 15 Hz steering.
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const plain = v => ({ x: v.x, y: v.y, z: v.z });
  const vec = v => new T.Vector3(v.x, v.y, v.z);
  const now = () => performance.now() * 0.001;
  let Core = null;
  let loadError = null;
  let globalTick = 0;

  function loadCore() {
    if (window.__sfPirateCorePromise) return window.__sfPirateCorePromise;
    window.__sfPirateCorePromise = (async () => {
      const response = await fetch(CORE_BUNDLE, { cache: "force-cache" });
      if (!response.ok) throw new Error("Pirate AI core bundle HTTP " + response.status);
      const encoded = (await response.text()).trim();
      const binary = Uint8Array.from(atob(encoded), ch => ch.charCodeAt(0));
      if (typeof DecompressionStream !== "function") throw new Error("GZIP decompression is unavailable.");
      const stream = new Blob([binary]).stream().pipeThrough(new DecompressionStream("gzip"));
      const source = await new Response(stream).text();
      // Safari/WebKit can reject JavaScript modules loaded from blob: URLs.
      // The Core bundle is self-contained, so a UTF-8 data URL avoids blob-module
      // origin/CSP inconsistencies without adding a second network request.
      const bytes = new TextEncoder().encode(source);
      let binaryString = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binaryString += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
      }
      const moduleUrl = "data:text/javascript;base64," + btoa(binaryString);
      const module = await import(moduleUrl);
      if (typeof module.PirateAICore !== "function") throw new Error("PirateAICore export is missing.");
      Core = module.PirateAICore;
      window.SF_PIRATE_AI_VERSION = module.PIRATE_AI_VERSION;
      return Core;
    })().catch(error => {
      loadError = error;
      console.error("[STARFALL Pirate AI] Core load failed; native EAI remains active.", error);
      throw error;
    });
    return window.__sfPirateCorePromise;
  }

  function basisFromQuaternion(q) {
    const forward = new T.Vector3(0, 0, -1).applyQuaternion(q).normalize();
    let up = new T.Vector3(0, 1, 0).applyQuaternion(q).normalize();
    if (Math.abs(forward.dot(up)) > 0.98) up.set(0, 1, 0);
    const right = new T.Vector3().crossVectors(forward, up).normalize();
    up = new T.Vector3().crossVectors(right, forward).normalize();
    return { forward, right, up };
  }

  function transform(position, quaternion) {
    const basis = basisFromQuaternion(quaternion);
    return {
      position: plain(position),
      orientation: { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w },
      forward: plain(basis.forward),
      right: plain(basis.right),
      up: plain(basis.up)
    };
  }

  function contact(entityId, trackId, position, quaternion, velocity, allegiance, radius, hullFraction) {
    return {
      trackId, entityId, classification: "SHIP", allegiance, confidence: 1,
      firstSeenAt: now() - 1, lastSeenAt: now(),
      transform: transform(position, quaternion), velocity: plain(velocity),
      accelerationEstimate: null, estimatedRadius: radius,
      hullFraction, shieldFraction: null, threatClass: allegiance === "HOSTILE" ? 1 : 0,
      tags: allegiance === "HOSTILE" ? ["PLAYER"] : ["PIRATE_FLEET"]
    };
  }

  class StarfallPirateHostBridge {
    constructor(entity) { this.entity = entity; }
    captureSnapshot(tickId, dt) {
      const e = this.entity, g = e.g;
      if (!g || !g.position || e.hp <= 0) throw new Error("Pirate entity is not active.");
      const speed = [54, 61, 58, 53][e.ty] || 50;
      const accel = [68, 76, 52, 58][e.ty] || 50;
      const range = [390, 390, 520, 430][e.ty] || 390;
      const basis = basisFromQuaternion(g.quaternion);
      const entityId = "pirate-fleet-" + e.slot;
      const contacts = [
        contact("player", "player", P, Q, vel, "HOSTILE", 10, clamp(hull / 100, 0, 1))
      ];
      const members = pirateFleet.map(member => {
        const id = "pirate-fleet-" + member.slot;
        if (!member.g || member.hp <= 0) {
          return { entityId: id, role: member.ty === 2 ? "ASSAULT" : member.ty === 1 ? "SCOUT" : "INTERCEPTOR",
            status: "DESTROYED", transform: null, velocity: null, connected: true };
        }
        if (member !== e) contacts.push(contact(id, id, member.g.position, member.g.quaternion, member.vel || new T.Vector3(), "FRIENDLY",
          member.hitRadius || member.r || 8, clamp(member.hp / Math.max(1, member.mx), 0, 1)));
        return { entityId: id, role: member.ty === 2 ? "ASSAULT" : member.ty === 1 ? "SCOUT" : "INTERCEPTOR",
          status: "ACTIVE", transform: transform(member.g.position, member.g.quaternion),
          velocity: plain(member.vel || new T.Vector3()), connected: true };
      });
      const threats = [];
      for (let i = Math.max(0, bul.length - 32); i < bul.length; i++) {
        const b = bul[i];
        if (!b || !b.m || !b.v || b.life <= 0) continue;
        const delta = b.m.position.clone().sub(g.position);
        if (delta.lengthSq() > 300 * 300 || b.v.dot(g.position.clone().sub(b.m.position)) <= 0) continue;
        threats.push({
          threatId: "player-projectile-" + i, sourceTrackId: "player", kind: "PROJECTILE",
          position: plain(b.m.position), velocity: plain(b.v), radius: 2.5,
          estimatedImpactTime: null, estimatedMissDistance: null, severity: 0.95, confidence: 0.95
        });
      }
      const hullFraction = clamp(e.hp / Math.max(1, e.mx), 0, 1);
      const weaponReady = (e.fire || 0) <= 0 && (e.burstGap || 0) <= 0;
      return {
        apiVersion: API_VERSION, tickId, simulationTime: now(), deltaTime: dt,
        controlledEntityId: entityId,
        self: {
          entityId, transform: transform(g.position, g.quaternion), velocity: plain(e.vel || new T.Vector3()),
          angularVelocity: null, mass: 1, dryMass: 1, fuelMass: 0,
          propulsion: { maxThrust: accel, availableAcceleration: accel, maxSpeed: speed,
            exhaustVelocity: null, canTranslate: true, canRotate: true, canReverseThrust: true,
            throttleLimit: 1, engineAvailable: true },
          survivability: { hullFraction, shieldFraction: null, criticalDamage: hullFraction < 0.12,
            disabledSystems: [], heatFraction: null },
          capabilities: { collisionRadius: e.hitRadius || e.r || 8, weaponSlots: ["primary-laser"],
            sensorRange: 9000, maxAngularRate: 2.5, maxAngularAcceleration: 3,
            canUseAfterburner: false, tags: ["PIRATE", "NPC"] },
          status: "ACTIVE", factionId: "pirates",
          roleHint: "SCOUT"
        },
        contacts, threats,
        weapons: [{
          slotId: "primary-laser", weaponType: "LASER", ready: weaponReady,
          cooldownRemaining: Math.max(0, e.fire || 0), ammo: null, energyFraction: 1,
          projectileSpeed: 200, effectiveRange: range, optimalRange: range,
          maxFireAngle: 0.55, fireRate: 5, damageEstimate: [5, 3.8, 6.2, 4.4][e.ty] || 5,
          tracking: "FIXED", targetLockRequired: false, canFire: true
        }],
        group: { groupId: "pirate-fleet", leaderEntityId: "pirate-fleet-0", orderId: null,
          members, formationId: "combat-wing", communicationAvailable: true, lastOrderAt: null },
        environment: { obstacles: [], noGoZones: [], gravityAcceleration: null, safeWaypoints: [] },
        orders: [],
        rulesOfEngagement: { mayAttackHostile: true, mayAttackNeutral: false,
          mayAttackUnknown: false, mayAttackPlayer: true, friendlyFireAvoidance: true, ceaseFire: false }
      };
    }
    commitAIFrame(frame) {
      if (frame.entityId !== "pirate-fleet-" + this.entity.slot || frame.tickId !== this.entity.sfAiTick)
        throw new Error("Pirate AI command identity/tick mismatch.");
      if (!frame.navigation || !Array.isArray(frame.weapons) || !Number.isFinite(frame.validUntil))
        throw new Error("Invalid Pirate AI command frame.");
      this.entity.sfAiFrame = frame;
    }
    applySafeFallback() {
      this.entity.sfAiFrame = null;
      this.entity.sfAiFire = false;
      this.entity.sfAiEnabled = false;
    }
    reportAIError(error) {
      if (!this.entity.sfAiErrorLogged) {
        this.entity.sfAiErrorLogged = true;
        console.warn("[STARFALL Pirate AI] " + (error && error.message || error));
      }
    }
  }

  function ensureAI(entity) {
    if (entity.sfAI && entity.sfAIHost) return;
    const idSeed = (((sy + 1) * 0x9e3779b1) ^ ((wave + 1) * 0x85ebca6b) ^ ((score + 1) * 0xc2b2ae35) ^ ((entity.slot + 1) * 0x27d4eb2d)) >>> 0;
    entity.sfAI = new Core({
      apiVersion: API_VERSION, seed: idSeed || 1, profileId: "starfall-pirate-v1",
      decisionHz: 5, navigationHz: 15, safetyHz: 15, maxAcceptedDt: 0.25,
      approachSpeed: [54, 61, 58, 53][entity.ty] || 50,
      maxAttackersPerTarget: 2
    });
    entity.sfAIHost = new StarfallPirateHostBridge(entity);
    entity.sfAiElapsed = 0;
    entity.sfAiTick = 0;
    entity.sfAiFrame = null;
    entity.sfAiEnabled = true;
  }

  // The intercept point is a steering target only. Braking must use the live
  // target distance; otherwise a near-zero predicted-intercept distance can
  // stall an approaching fighter hundreds of metres from its target.
  function applyActualDistanceBraking(frame, snapshot) {
    const navigation = frame && frame.navigation;
    if (!navigation || frame.tacticalState !== "APPROACH" ||
        navigation.mode !== "VELOCITY" || navigation.maneuver !== "INTERCEPT") return frame;
    const target = snapshot.contacts.find(contact => contact.trackId === frame.selectedTargetTrackId);
    if (!target || !target.transform || !target.transform.position) return frame;
    const self = snapshot.self;
    const propulsion = self && self.propulsion;
    const selfPosition = self && self.transform && self.transform.position;
    const targetPosition = target.transform.position;
    const acceleration = propulsion && propulsion.availableAcceleration;
    const maxSpeed = propulsion && propulsion.maxSpeed;
    if (!selfPosition || !Number.isFinite(acceleration) || acceleration <= 0 ||
        !Number.isFinite(maxSpeed) || maxSpeed <= 0) return frame;
    const dx = targetPosition.x - selfPosition.x;
    const dy = targetPosition.y - selfPosition.y;
    const dz = targetPosition.z - selfPosition.z;
    const distance = Math.hypot(dx, dy, dz);
    if (!Number.isFinite(distance)) return frame;
    const stoppingDistance = Math.max(20,
      (self.capabilities && self.capabilities.collisionRadius || 0) +
      (target.estimatedRadius || 0) + 20);
    const brakingDistance = Math.max(0, distance - stoppingDistance);
    const distanceLimitedSpeed = Math.min(maxSpeed, Math.sqrt(2 * acceleration * brakingDistance));
    const desired = navigation.desiredVelocity;
    if (!desired || !Number.isFinite(desired.x) || !Number.isFinite(desired.y) || !Number.isFinite(desired.z)) return frame;
    const currentSpeed = Math.hypot(desired.x, desired.y, desired.z);
    if (Math.abs(currentSpeed - distanceLimitedSpeed) <= 1e-6) return frame;
    // Keep Core's predicted-intercept direction. If it supplied no direction,
    // use the actual target bearing; speed still comes only from actual distance.
    const inverseLength = currentSpeed > 1e-6 ? 1 / currentSpeed : (distance > 1e-6 ? 1 / distance : 0);
    const direction = currentSpeed > 1e-6
      ? { x: desired.x * inverseLength, y: desired.y * inverseLength, z: desired.z * inverseLength }
      : { x: dx * inverseLength, y: dy * inverseLength, z: dz * inverseLength };
    return {
      ...frame,
      navigation: {
        ...navigation,
        desiredVelocity: {
          x: direction.x * distanceLimitedSpeed,
          y: direction.y * distanceLimitedSpeed,
          z: direction.z * distanceLimitedSpeed
        }
      }
    };
  }

  function updateAI(entity, dt) {
    if (!Core || !entity.g || entity.hp <= 0 || entity.warp > 0 || state !== "play") return null;
    try {
      ensureAI(entity);
      entity.sfAiElapsed = (entity.sfAiElapsed || 0) + Math.max(0, dt);
      const previousFrame = entity.sfAiFrame;
      const frameExpired = !previousFrame || previousFrame.validUntil < now();
      if (entity.sfAiElapsed + 1e-6 >= DECISION_STEP || frameExpired) {
        const aiDt = clamp(Math.max(entity.sfAiElapsed, DECISION_STEP), 0.001, 0.25);
        entity.sfAiElapsed = 0;
        const tick = ++globalTick;
        entity.sfAiTick = tick;
        const snapshot = entity.sfAIHost.captureSnapshot(tick, aiDt);
        const coreOutput = entity.sfAI.update(snapshot, aiDt);
        if (coreOutput.entityId !== snapshot.controlledEntityId || coreOutput.tickId !== tick ||
            !coreOutput.navigation || !Number.isFinite(coreOutput.validUntil) ||
            !coreOutput.navigation.desiredVelocity && coreOutput.navigation.mode === "VELOCITY") {
          entity.sfAIHost.applySafeFallback();
          return null;
        }
        const output = applyActualDistanceBraking(coreOutput, snapshot);
        entity.sfAIHost.commitAIFrame(output);
      }
      const frame = entity.sfAiFrame;
      if (!frame || frame.validUntil < now()) {
        entity.sfAiFire = false;
        return null;
      }
      entity.sfAiFire = frame.weapons.some(weapon => weapon.slotId === "primary-laser" && weapon.fireRequest === true);
      return frame;
    } catch (error) {
      if (entity.sfAIHost) {
        entity.sfAIHost.applySafeFallback();
        entity.sfAIHost.reportAIError(error);
      }
      return null;
    }
  }

  window.SF_PIRATE_AI = Object.freeze({
    version: API_VERSION,
    update: updateAI,
    clear(entity) {
      if (!entity) return;
      if (entity.sfAIHost) entity.sfAIHost.applySafeFallback();
      entity.sfAI = null; entity.sfAIHost = null; entity.sfAiFrame = null;
      entity.sfAiElapsed = 0; entity.sfAiTick = 0; entity.sfAiEnabled = false;
    },
    get ready() { return !!Core; },
    get error() { return loadError; }
  });

  loadCore().catch(() => {});
})();