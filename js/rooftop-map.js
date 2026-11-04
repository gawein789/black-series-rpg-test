"use strict";
// BLACK SERIES RPG — EP001 Rooftop Party Prototype v0.5.24 (safe wall collisions + scouting facing + leader rally order)
// Load AFTER mobile-ui.js. Requires phaser-scene.js with window.BSPhaserGame.
(function () {
  const W = 900, H = 506;
  const IDS = ["kingmaker", "lucifer", "lilith", "goliath"];
  const NAMES = { kingmaker: "キングメイカー", lucifer: "ルシファー", lilith: "リリス", goliath: "ゴライアス" };
  const SPEED = { kingmaker: 125, lucifer: 125, lilith: 125, goliath: 125 }; // follower px/sec
  const SPACING = 54;
  const LEADER_SPEED = { kingmaker: 1.25, lucifer: 1, lilith: 1, goliath: 1 };
  const RALLY_LIMIT = 7;
  const CREW = [
    { id: "lucifer", x: 260, y: 163 },
    { id: "lilith", x: 653, y: 173 },
    { id: "goliath", x: 716, y: 376 }
  ];
  const EXIT = { x: 207, y: 318 }; // reachable approach beside the stairwell; not inside the photo wall
  const ROOF = { active: false, phase: "scout", found: {}, members: {}, trail: [], pending: null, waiting: false, completed: false, scene: null };
  const FOOT = { kingmaker: { idle: 153, walk: 150.5 }, lucifer: { idle: 153, walk: 150.5 }, lilith: { idle: 153, walk: 150.5 }, goliath: { idle: 153, walk: 150.5 } };
  const HEIGHTS = { idle: 149, walk: 138.5 };
  const SCALE = { kingmaker: .65, lucifer: .72, lilith: .72, goliath: .82 };
  const CORRECTION = { lilith: 137 / 129, goliath: 138 / 131 };
  const WALK_WIDTH = { kingmaker: { right: 1.10 } };
  const oldInteract = window.interact;
  const oldSwitch = window.switchCharacter;
  const originalTryMove = window.BSTryMove;

  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  // Photo-aligned walkable region (900x506 game coordinates).
  // Keep the crew spawn points, stair entrance, and the existing obstacles valid.
  // This is deliberately conservative: do not walk onto the left wall or
  // beyond the distant/right-hand railing visible in the rooftop photograph.
  function insideRoofPhoto(px, py) {
    if (px < 48 || px > 844 || py < 150 || py > 456) return false;
    // Building silhouette in the current photographic background.
    // The wall recedes sharply to the left toward the camera.
    // This keeps the solid wall blocked while allowing a narrow door approach.
    const wallEdge = py < 288 ? 205 : py < 375 ? 205 - (py - 288) * 1.68 : 59;
    if (px < wallEdge) return false;
    // Door-side unit: physical footprint only, not the tall visual silhouette.
    // A small buffer prevents feet from standing on the condenser plinth.
    if (px >= 166 && px <= 245 && py >= 267 && py <= 306) return false;
    // Foreground equipment and roof edges.
    if (py >= 315 && px < 72) return false;
    const rightLimit = py < 230 ? 765 : py < 315 ? 765 + (py - 230) * .72 : 826;
    if (px > rightLimit) return false;
    return true;
  }
  function canStand(px, py) {
    return insideRoofPhoto(px, py) &&
      (typeof BSCanStand !== "function" || BSCanStand(px, py));
  }
  // The player and the followers must share exactly the same walkable roof.
  // Rear railing: the leader must remain on the visible floor.
  // Crew spawn at y=163/173, so retain canStand() for rally/pathfinding.
  // Apply this additional boundary only to player-controlled movement.
  const REAR_PLAYER_LIMIT = 176;
  function guardedTryMove(dx, dy) {
    if (typeof originalTryMove !== "function") return false;
    const startX = x, startY = y;
    const attempt = (mx, my) => {
      const bx = x, by = y;
      const result = originalTryMove(mx, my);
      const px = W * x / 100, py = H * y / 100;
      if (!canStand(px, py) || py < REAR_PLAYER_LIMIT) {
        x = bx; y = by;
        return false;
      }
      return result === undefined ? (x !== bx || y !== by) : (x !== bx || y !== by);
    };
    if (attempt(dx, dy)) return true;
    x = startX; y = startY;
    if (dx !== 0 && attempt(dx, 0)) return true;
    if (dy !== 0 && attempt(0, dy)) return true;
    x = startX; y = startY;
    return false;
  }
  function safeNear(target, origin) {
    if (canStand(target.x, target.y)) return target;
    for (let r = 12; r <= 96; r += 12) {
      let best = null, bestDist = Infinity;
      for (let k = 0; k < 16; k++) {
        const a = k * Math.PI / 8;
        const p = { x: target.x + Math.cos(a) * r, y: target.y + Math.sin(a) * r };
        if (!canStand(p.x, p.y)) continue;
        const d = distance(origin, p);
        if (d < bestDist) { best = p; bestDist = d; }
      }
      if (best) return best;
    }
    return null;
  }
  function clearPath(a, b) {
    const count = Math.max(1, Math.ceil(distance(a, b) / 7));
    for (let i = 1; i <= count; i++) {
      const t = i / count;
      if (!canStand(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
    }
    return true;
  }
  function pathTo(a, b) {
    if (!canStand(b.x, b.y)) return [];
    if (clearPath(a, b)) return [b];
    const nodes = [a, b];
    for (const o of BS_OBSTACLES) {
      for (const px of [o.x - 22, o.x + o.w + 22]) {
        for (const py of [o.y - 22, o.y + o.h + 22]) {
          if (canStand(px, py)) nodes.push({ x: px, y: py });
        }
      }
    }
    const ds = nodes.map(() => Infinity), prev = nodes.map(() => -1), used = new Set();
    ds[0] = 0;
    for (let i = 0; i < nodes.length; i++) {
      let u = -1;
      for (let j = 0; j < nodes.length; j++) if (!used.has(j) && (u < 0 || ds[j] < ds[u])) u = j;
      if (u < 0 || !Number.isFinite(ds[u]) || u === 1) break;
      used.add(u);
      for (let v = 0; v < nodes.length; v++) {
        if (used.has(v) || u === v || !clearPath(nodes[u], nodes[v])) continue;
        const next = ds[u] + distance(nodes[u], nodes[v]);
        if (next < ds[v]) { ds[v] = next; prev[v] = u; }
      }
    }
    if (!Number.isFinite(ds[1])) return [];
    const result = [];
    for (let u = 1; u !== 0; u = prev[u]) {
      if (u < 0) return [];
      result.push(nodes[u]);
    }
    return result.reverse();
  }

  function drawRoof(scene) {
    const g = scene.add.graphics().setDepth(-10);
    g.fillGradientStyle(0x101b2a, 0x101b2a, 0x25313d, 0x25313d, 1);
    g.fillRect(0, 0, W, H);
    g.fillStyle(0x0c1521, 1); g.fillRect(0, 0, W, 88);
    for (let i = 0; i < 11; i++) {
      const xx = i * 93 - 20, hh = 25 + (i * 17) % 45;
      g.fillStyle(0x1a2937, 1); g.fillRect(xx, 88 - hh, 75, hh);
      g.fillStyle(0xd6b47b, .22);
      g.fillRect(xx + 11, 82 - hh / 2, 3, 5); g.fillRect(xx + 41, 77 - hh / 2, 3, 5);
    }
    g.lineStyle(3, 0x465664, .75);
    for (const cx of [110, 805]) {
      g.lineBetween(cx, 88, cx, 4); g.lineBetween(cx - 67, 19, cx + 55, 19);
      g.lineBetween(cx, 4, cx - 67, 19); g.lineBetween(cx + 45, 19, cx + 45, 55);
    }
    g.fillStyle(0x303b46, 1); g.fillRect(27, 88, 846, 391);
    g.fillStyle(0x27323d, 1); g.fillRect(38, 100, 824, 367);
    g.lineStyle(5, 0x71808a, .9); g.strokeRect(29, 89, 842, 387);
    g.lineStyle(1, 0xa8b8c1, .10);
    for (let i = 0; i < 9; i++) g.lineBetween(45 + i * 100, 102, 45 + i * 100, 465);
    for (let i = 0; i < 5; i++) g.lineBetween(40, 116 + i * 84, 860, 116 + i * 84);
    g.fillStyle(0x6e9aa8, .10);
    g.fillEllipse(398, 321, 150, 29); g.fillEllipse(560, 418, 118, 21); g.fillEllipse(570, 136, 97, 16);
    for (const a of [{ x: 360, y: 115, w: 110, h: 75 }, { x: 405, y: 355, w: 125, h: 70 }]) {
      g.fillStyle(0x111b25, .45); g.fillRect(a.x + 7, a.y + 9, a.w, a.h);
      g.fillStyle(0x52616b, 1); g.fillRoundedRect(a.x, a.y, a.w, a.h, 5);
      g.fillStyle(0x35434e, 1); g.fillRect(a.x + 9, a.y + 9, a.w - 18, a.h - 18);
      g.lineStyle(2, 0x7e929e, .6);
      for (let k = 0; k < 4; k++) g.lineBetween(a.x + 20 + k * 21, a.y + 14, a.x + 20 + k * 21, a.y + a.h - 14);
    }
    g.fillStyle(0x10151c, .6); g.fillRect(88, 315, 130, 132);
    g.fillStyle(0x59636d, 1); g.fillRect(79, 300, 130, 130);
    g.fillStyle(0x303b48, 1); g.fillRect(100, 325, 88, 105);
    g.fillStyle(0x101820, 1); g.fillRect(120, 346, 50, 84);
    g.lineStyle(3, 0x95a4ab, .8); g.strokeRect(120, 346, 50, 84);
    g.fillStyle(0xd8bd7b, .95); g.fillCircle(161, 393, 3);
    for (const lx of [60, 830]) {
      g.fillStyle(0xe4bc80, .16); g.fillEllipse(lx, 112, 86, 26);
      g.fillStyle(0xe4bc80, .9); g.fillRect(lx - 7, 99, 14, 5);
    }
    scene.add.text(450, 14, "東湾第七码頭物流倉庫 ／ 屋上", {
      fontFamily: "system-ui", fontSize: "12px", color: "#d8dce3",
      backgroundColor: "#0b1424bb", padding: { x: 7, y: 4 }
    }).setOrigin(.5, 0).setDepth(30);
  }

  // v0.5.9: visual-only photo backdrop. Gameplay and collision are untouched.
  // Keep the original procedural roof as a fallback if the asset cannot load.
  function addRooftopPhoto(scene) {
    const image = new Image();
    image.onload = () => {
      if (!scene.sys?.isActive()) return;
      try {
        const key = "bs_rooftop_photo_v0513";
        if (!scene.textures.exists(key)) scene.textures.addImage(key, image);
        scene.add.image(W / 2, H / 2, key)
          .setDisplaySize(W, H).setDepth(-9);
        // No collision-guide overlays: keep all original collision data unchanged.
        console.info("BLACK SERIES rooftop visual polish loaded (v0.5.13)");
      } catch (error) {
        console.warn("Rooftop photo unavailable; using original background", error);
      }
    };
    image.onerror = () => console.warn("Rooftop image missing: assets/maps/ep001-rooftop-v0.5.13.jpg");
    image.src = "assets/maps/ep001-rooftop-v0.5.13.jpg?v=0513";
  }

  // Soft contact shadows match the wet rooftop without modifying sprites.
  // Depth 8 stays behind the character sprites (depth 9+).
  function updateContactShadows() {
    const scene = ROOF.scene;
    const shadow = ROOF.contactShadows;
    if (!scene || !shadow || !scene.heroSprite) return;
    shadow.clear();
    for (const id of IDS) {
      const sprite = id === scene.heroName ? scene.heroSprite : ROOF.members[id]?.sprite;
      if (!sprite || !sprite.visible) continue;
      const px = id === scene.heroName ? W * x / 100 : sprite.x;
      const py = id === scene.heroName ? H * y / 100 : sprite.y;
      // Soft concentric ellipses, kept subtle over photographic reflections.
      shadow.fillStyle(0x02050a, 0.11);
      shadow.fillEllipse(px + 3, py + 3, 53, 17);
      shadow.fillStyle(0x02050a, 0.19);
      shadow.fillEllipse(px + 2, py + 2, 38, 11);
      shadow.fillStyle(0x02050a, 0.24);
      shadow.fillEllipse(px + 1, py + 1, 24, 6);
    }
  }

  function objective() {
    const n = CREW.filter(c => ROOF.found[c.id]).length;
    const msg = ROOF.phase === "scout" ? `偵察情報 ${n}/3 ｜ 仲間に近づいて「調べる」`
      : ROOF.phase === "rally" ? "偵察完了 ｜ 仲間が集合中…"
      : "4人合流 ｜ 「切替」で操作変更・階段入口へ";
    ROOF.scene.bsObjective.setText(msg);
    ROOF.scene.bsExitLabel.setVisible(ROOF.phase === "party");
  }
  function dialogue(lines, done) {
    if (typeof BSStartDialogue !== "function") return;
    ROOF.pending = done || null;
    ROOF.waiting = true;
    BSStartDialogue(lines);
  }
  function setActorAnimation(id, sprite, moving, dir) {
    const mode = moving ? "walk" : "idle";
    const key = `${id}_${mode}_${dir}`;
    if (sprite.anims.currentAnim?.key !== key) sprite.play(key, true);
    const base = SCALE[id] * HEIGHTS.idle / HEIGHTS[mode] * (mode === "idle" ? (CORRECTION[id] || 1) : 1);
    const width = mode === "walk" ? (WALK_WIDTH[id]?.[dir] || 1) : 1;
    sprite.setScale(base * width, base).setOrigin(.5, FOOT[id][mode] / 160);
  }
  function pointOf(sprite) { return { x: sprite.x, y: sprite.y }; }
  // Smooth pursuit. Switching logic below is intentionally unchanged from v0.5.6.
  function moveActor(actor, desired, dt, maxSpeed) {
    const sprite = actor.sprite;
    const start = pointOf(sprite);
    // Avoid a different nearest-safe-point being chosen every single frame.
    const target = canStand(desired.x, desired.y) ? desired : safeNear(desired, start);
    if (!target) {
      actor.animHold = Math.max(0, (actor.animHold || 0) - dt);
      setActorAnimation(actor.id, sprite, actor.animHold > 0, actor.dir);
      return false;
    }
    const gap = distance(start, target);
    // Hysteresis avoids toggling walk/idle around one exact threshold.
    actor.walking = actor.walking ? gap > 13 : gap > 24;
    if (!actor.walking) {
      actor.speed = Math.max(0, (actor.speed || 0) - 250 * dt);
      actor.animHold = Math.max(0, (actor.animHold || 0) - dt);
      setActorAnimation(actor.id, sprite, actor.animHold > 0, actor.dir);
      return gap < 24;
    }
    actor.repath = (actor.repath || 0) - dt;
    const direct = clearPath(start, target);
    if (direct) {
      actor.path = [target];
      actor.goal = { x: target.x, y: target.y };
      actor.repath = .55;
    } else if (!actor.path.length || actor.repath <= 0 ||
               distance(actor.goal || start, target) > 52) {
      actor.path = pathTo(start, target);
      actor.goal = { x: target.x, y: target.y };
      actor.repath = .55;
    }
    while (actor.path.length > 1 && distance(start, actor.path[0]) < 13) actor.path.shift();
    const aim = actor.path[0];
    let moved = false;
    if (aim) {
      const dx = aim.x - sprite.x, dy = aim.y - sprite.y;
      const length = Math.hypot(dx, dy);
      if (length > .01) {
        const desiredSpeed = maxSpeed * Math.min(1, Math.max(.40, (gap - 10) / 80));
        const oldSpeed = actor.speed || 0;
        actor.speed = oldSpeed + Math.max(-280 * dt, Math.min(260 * dt, desiredSpeed - oldSpeed));
        const step = Math.min(length, actor.speed * dt);
        const next = { x: sprite.x + dx / length * step, y: sprite.y + dy / length * step };
        if (step > .04 && clearPath(start, next)) {
          sprite.setPosition(next.x, next.y);
          actor.dir = Math.abs(dx) >= Math.abs(dy)
            ? (dx < 0 ? "left" : "right") : (dy < 0 ? "back" : "front");
          moved = true;
        }
      }
    }
    actor.stuck = moved ? 0 : (actor.stuck || 0) + dt;
    if (!moved && actor.stuck > .35) {
      actor.repath = 0;
      actor.path = [];
    }
    // Retain the successful v0.5.6 recovery for genuinely stuck followers.
    if (actor.stuck > 1.2 && gap > 90) {
      const recovery = safeNear({ x: target.x - 28, y: target.y + 22 }, start);
      if (recovery && clearPath(target, recovery)) {
        sprite.setPosition(recovery.x, recovery.y);
        actor.path = []; actor.stuck = 0; actor.repath = 0; actor.speed = 0;
      }
    }
    actor.animHold = moved ? .20 : Math.max(0, (actor.animHold || 0) - dt);
    setActorAnimation(actor.id, sprite, moved || actor.animHold > 0, actor.dir);
    return distance(pointOf(sprite), target) < 24;
  }
  function recordTrail() {
    const p = { x: W * x / 100, y: H * y / 100 };
    const trail = ROOF.trail;
    if (!trail.length || distance(trail[trail.length - 1], p) > 2) trail.push(p);
    if (trail.length > 1300) trail.splice(0, trail.length - 1300);
  }
  function trailTarget(behind) {
    const trail = ROOF.trail;
    if (!trail.length) return { x: W * x / 100, y: H * y / 100 };
    let left = behind;
    for (let i = trail.length - 1; i > 0; i--) {
      const a = trail[i], b = trail[i - 1], length = distance(a, b);
      if (length >= left) {
        const t = length ? left / length : 0;
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      }
      left -= length;
    }
    return safeNear(trail[0], { x: W * x / 100, y: H * y / 100 }) || trail[0];
  }
  // On-screen diagnostics so errors are visible on iPhone without devtools.
  function switchNotice(message, error) {
    let panel = document.getElementById("bs-switch-diagnostic");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "bs-switch-diagnostic";
      panel.style.cssText = "position:fixed;left:12px;top:18%;z-index:99999;max-width:80vw;padding:10px 14px;border:1px solid #d69eae;border-radius:8px;background:#15151eea;color:#fff;font:14px system-ui;pointer-events:none;white-space:pre-wrap";
      document.body.appendChild(panel);
    }
    panel.textContent = message + (error ? "\n" + (error.message || String(error)) : "");
    console.warn("[BLACK SERIES switch]", message, error || "");
  }

  function switchTo(id) {
    if (ROOF.phase !== "party" || !IDS.includes(id) || fighting || BSDialogue.active) return false;
    const scene = ROOF.scene;
    const current = scene.heroName;
    if (current === id) return true;
    const next = ROOF.members[id], old = ROOF.members[current];
    if (!next || !old || !scene.heroSprite) {
      switchNotice("切替失敗：キャラクター情報がありません");
      return false;
    }
    const oldPosition = { x: W * x / 100, y: H * y / 100 };
    const requested = pointOf(next.sprite);
    const nextPosition = canStand(requested.x, requested.y) && requested.y >= REAR_PLAYER_LIMIT
      ? requested : safeNear({ x: requested.x, y: Math.max(REAR_PLAYER_LIMIT + 2, requested.y) }, oldPosition);
    if (!nextPosition) {
      switchNotice("切替失敗：移動先が見つかりません");
      return false;
    }
    const previousFacing = facing;
    const hero = scene.heroSprite;
    try {
      // Commit the new playable hero before revealing the former leader.
      scene.heroName = id;
      scene.currentAnimation = "";
      x = nextPosition.x / W * 100;
      y = nextPosition.y / H * 100;
      facing = next.dir || "front";
      hero.setVisible(true);
      scene.refreshHero(false);
      updateActorDepths();

      // Validate that the actual hero animation changed as requested.
      const expected = `${id}_idle_${facing}`;
      if (hero.anims.currentAnim?.key !== expected) {
        hero.play(expected, true);
      }

      old.dir = previousFacing;
      old.sprite.setPosition(oldPosition.x, oldPosition.y);
      setActorAnimation(current, old.sprite, false, old.dir);
      for (const memberId of IDS) {
        const actor = ROOF.members[memberId];
        actor.sprite.setVisible(memberId !== id);
        actor.label.setVisible(false);
        actor.path = [];
        actor.repath = 0;
        actor.stuck = 0;
        actor.speed = 0;
        actor.walking = false;
        actor.animHold = 0;
      }
      ROOF.trail = [{ x: W * x / 100, y: H * y / 100 }];
      const hud = document.getElementById("hudName");
      if (hud) hud.textContent = NAMES[id];
      const diagnostic = document.getElementById("bs-switch-diagnostic");
      if (diagnostic) diagnostic.remove();
      return true;
    } catch (error) {
      // Roll back every visible element, preventing a second KINGMAKER.
      scene.heroName = current;
      scene.currentAnimation = "";
      x = oldPosition.x / W * 100;
      y = oldPosition.y / H * 100;
      facing = previousFacing;
      try { scene.refreshHero(false); } catch (_) {}
      for (const memberId of IDS) {
        try { ROOF.members[memberId].sprite.setVisible(memberId !== current); } catch (_) {}
      }
      switchNotice(`切替エラー ${current} → ${id}`, error);
      return false;
    }
  }
  function cycle() {
    const i = IDS.indexOf(ROOF.scene.heroName);
    return switchTo(IDS[(i + 1) % IDS.length]);
  }
  function faceDirection(from, to) {
    const dx = to.x - from.x, dy = to.y - from.y;
    return Math.abs(dx) >= Math.abs(dy)
      ? (dx < 0 ? "left" : "right") : (dy < 0 ? "back" : "front");
  }
  function faceActor(id, dir) {
    const actor = ROOF.members[id];
    if (!actor) return;
    actor.dir = dir;
    if (ROOF.scene.heroName === id) {
      facing = dir;
      ROOF.scene.currentAnimation = "";
      ROOF.scene.refreshHero(false);
    } else {
      setActorAnimation(id, actor.sprite, false, dir);
    }
  }
  function faceEachOther(id) {
    const p = { x: W * x / 100, y: H * y / 100 };
    const other = pointOf(ROOF.members[id].sprite);
    faceActor(ROOF.scene.heroName, faceDirection(p, other));
    faceActor(id, faceDirection(other, p));
  }
  function beginRally() {
    ROOF.phase = "rally";
    ROOF.rallyElapsed = 0;
    objective();
  }
  function interactRoof() {
    if (!ROOF.active) return oldInteract?.();
    if (fighting) return;
    if (BSDialogue.active) { BSAdvanceDialogue(); return; }
    const p = { x: W * x / 100, y: H * y / 100 };
    if (ROOF.phase === "scout") {
      let closest = null, best = 86;
      for (const c of CREW) {
        const d = distance(p, c);
        if (d < best) { best = d; closest = c; }
      }
      if (closest) {
        const id = closest.id;
        faceEachOther(id);
        const lines = id === "lucifer" ? [
          { speaker: "ルシファー", text: "事前情報では二十人前後でした。" },
          { speaker: "ルシファー", text: "見えるだけで、それ以上いますね。" },
          { speaker: "ルシファー", text: "東側は塞がれている。逃げるなら西だ。" }
        ] : id === "lilith" ? [
          { speaker: "リリス", text: "中にもいるわ。それに……全員、妙に慣れてる。" },
          { speaker: "キングメイカー", text: "人の出入りは？" },
          { speaker: "リリス", text: "武装していない人間が何人か。たぶん、雇われただけね。" }
        ] : [
          { speaker: "ゴライアス", text: "裏口に車が三台。" },
          { speaker: "ゴライアス", text: "非戦闘員は中央から離れている。" }
        ];
        dialogue(lines, () => {
          ROOF.found[id] = true;
          objective();
          if (CREW.every(c => ROOF.found[c.id])) {
            faceActor("kingmaker", "front");
            dialogue([
              { speaker: "キングメイカー", text: "……確認は十分だ。全員、集まれ。降りるぞ。" }
            ], beginRally);
          } else {
            // After speaking, resume looking toward the observation area.
            faceActor(id, id === "goliath" ? "front" : "back");
          }
        });
        return;
      }
      dialogue([{ speaker: "探索", text: "仲間から偵察情報を集めよう。" }]);
      return;
    }
    if (ROOF.phase === "rally") {
      dialogue([{ speaker: "探索", text: "仲間が集合している。" }]);
      return;
    }
    if (distance(p, EXIT) < 62) {
      dialogue([
        { speaker: "キングメイカー", text: "確認してから入る。" },
        { speaker: "キングメイカー", text: "始めるぞ。" },
        { speaker: "SYSTEM", text: "屋上偵察完了。次の倉庫潜入マップは今後実装予定です。" }
      ]);
      return;
    }
    dialogue([{ speaker: "探索", text: "雨に濡れた屋上から、港の灯りが見える。" }]);
  }
  function finishRally() {
    ROOF.phase = "party";
    ROOF.trail = [{ x: W * x / 100, y: H * y / 100 }];
    for (const c of CREW) ROOF.members[c.id].label.setVisible(false);
    const btn = document.getElementById("charTouch");
    if (btn) btn.style.display = "";
    objective();
    dialogue([
      { speaker: "SYSTEM", text: "4人が合流しました。「切替」で操作キャラクターを変更できます。" }
    ]);
  }
  // Consistent front/back ordering for every party member, including the
  // Phaser-managed leader sprite. Higher feet on screen = rendered in front.
  function updateActorDepths() {
    const scene = ROOF.scene;
    if (!scene) return;
    for (const id of IDS) {
      const sprite = id === scene.heroName ? scene.heroSprite : ROOF.members[id]?.sprite;
      if (!sprite || !sprite.visible) continue;
      const footY = id === scene.heroName ? H * y / 100 : sprite.y;
      sprite.setDepth(9 + footY / 1000);
    }
  }
  function tick(time, delta) {
    if (!ROOF.active) return;
    updateActorDepths();
    updateContactShadows();
    if (ROOF.waiting && !BSDialogue.active) {
      ROOF.waiting = false;
      const done = ROOF.pending; ROOF.pending = null;
      if (done) done();
    }
    if (fighting || BSDialogue.active) return;
    const dt = Math.min(delta / 1000, .05), scene = ROOF.scene;
    const leader = { x: W * x / 100, y: H * y / 100 };
    if (ROOF.phase === "rally") {
      ROOF.rallyElapsed = (ROOF.rallyElapsed || 0) + dt;
      const slots = [
        { x: leader.x - 45, y: leader.y + 45 },
        { x: leader.x + 45, y: leader.y + 45 },
        { x: leader.x, y: leader.y + 76 }
      ];
      let all = true;
      CREW.forEach((c, i) => {
        const actor = ROOF.members[c.id];
        const goal = safeNear(slots[i], pointOf(actor.sprite)) || leader;
        if (!moveActor(actor, goal, dt, SPEED[c.id] * 1.8)) all = false;
        actor.label.setPosition(actor.sprite.x, actor.sprite.y + 10);
      });
      if (all || ROOF.rallyElapsed >= RALLY_LIMIT) finishRally();
      return;
    }
    if (ROOF.phase !== "party") return;
    recordTrail();
    const others = IDS.filter(id => id !== scene.heroName);
    others.forEach((id, index) => {
      const actor = ROOF.members[id];
      // Trail-following plus lateral offset produces a loose, readable party.
      const anchor = trailTarget(SPACING * (index + 1));
      const lateral = index === 0 ? -18 : index === 1 ? 18 : 0;
      const target = safeNear({ x: anchor.x + lateral, y: anchor.y }, pointOf(actor.sprite)) || anchor;
      const gap = distance(pointOf(actor.sprite), target);
      const speed = SPEED[id] * (gap > 240 ? 1.7 : gap > 135 ? 1.4 : gap > 75 ? 1.18 : 1.05);
      moveActor(actor, target, dt, speed);
    });
  }
  function init(scene) {
    if (ROOF.active || !scene?.heroSprite || !scene.summitMembers?.lucifer) return;
    ROOF.active = true;
    ROOF.scene = scene;
    for (const child of scene.children.list.slice()) {
      if (child instanceof Phaser.GameObjects.Graphics) child.setVisible(false);
    }
    drawRoof(scene);
    addRooftopPhoto(scene);
    // Distinct build marker: confirms the latest file actually loaded on iPhone.
    scene.add.text(885, 14, "MAP v0.5.24", { fontFamily: "system-ui", fontSize: "11px", color: "#c4b5bf", backgroundColor: "#0b1424bb", padding: { x: 5, y: 3 } }).setOrigin(1, 0).setDepth(130);
    if (ROOF.moveDiagnostic?.destroy) ROOF.moveDiagnostic.destroy();
    ROOF.contactShadows = scene.add.graphics().setDepth(8);
    for (const actor of Object.values(scene.actors || {})) {
      actor.rect?.setVisible(false); actor.txt?.setVisible(false);
    }
    for (const button of Object.values(scene.testButtons || {})) {
      button.bg?.setVisible(false).disableInteractive();
      button.txt?.setVisible(false).disableInteractive();
    }
    scene.followerSprite?.setVisible(false);
    scene.followerSprite = null;
    // Prevent legacy Leviathan follower logic from running on the rooftop.
    scene.update = function () {};
    // Keep the existing sprites and all animation keys; never recreate PNG textures.
    for (const c of CREW) {
      const m = scene.summitMembers[c.id];
      m.sprite.setPosition(c.x, c.y).setVisible(true);
      m.label.setPosition(c.x, c.y + 10).setVisible(true);
      const watchDir = c.id === "goliath" ? "front" : "back";
      ROOF.members[c.id] = { id: c.id, sprite: m.sprite, label: m.label, dir: watchDir, path: [], goal: null, repath: 0 };
      setActorAnimation(c.id, m.sprite, false, watchDir);
    }
    const kingSprite = scene.add.sprite(0, 0, "kingmaker_idle", 0).setVisible(false).setDepth(9);
    ROOF.members.kingmaker = { id: "kingmaker", sprite: kingSprite, label: { setVisible() {}, setPosition() {} }, dir: "right", path: [], goal: null, repath: 0 };
    setActorAnimation("kingmaker", kingSprite, false, "right");
    BS_OBSTACLES.splice(0, BS_OBSTACLES.length,
      // Rear HVAC: photo x≈420–520, y≈155–210.
      { x: 417, y: 152, w: 111, h: 63 },
      // Foreground HVAC: photo x≈425–575, y≈365–445.
      { x: 425, y: 363, w: 154, h: 83 },
      // Left foreground equipment: keep the character feet clear of its right edge.
      // The visible box begins around y=345; the safe approach to the door is above it.
      { x: 79, y: 344, w: 151, h: 105 });
    x = 27; y = 56; facing = "right";
    scene.heroName = "kingmaker";
    scene.currentAnimation = "";
    scene.isMoving = false;
    if (typeof place === "function") place();
    scene.refreshHero(false);
    updateActorDepths();
    // Match the initial HUD label to the official Japanese character name.
    const initialHud = document.getElementById("hudName");
    if (initialHud) initialHud.textContent = NAMES[scene.heroName];
    scene.bsObjective = scene.add.text(450, 64, "", {
      fontFamily: "system-ui", fontSize: "14px", color: "#f5e5e9",
      backgroundColor: "#0b101bd9", padding: { x: 12, y: 7 }
    }).setOrigin(.5, 0).setDepth(120);
    scene.bsExitLabel = scene.add.text(EXIT.x + 16, EXIT.y - 23, "◀ 階段入口", {
      fontFamily: "system-ui", fontSize: "13px", color: "#f5dfb8",
      backgroundColor: "#111b25e6", padding: { x: 6, y: 4 }
    }).setOrigin(.5).setDepth(121).setVisible(false);
    objective();
    const charButton = document.getElementById("charTouch");
    if (charButton) charButton.style.display = "none";
    const testSelect = document.getElementById("character-test");
    if (testSelect) testSelect.style.display = "none";
    const footer = document.querySelector("#game > p");
    if (footer) footer.style.display = "none";
    window.BSTryMove = guardedTryMove;
    window.BSGetLeaderSpeed = () => LEADER_SPEED[scene.heroName] || 1;
    window.BSGetLeaderName = () => scene.heroName;
    window.BSSetExplorationCharacter = switchTo;
    window.switchCharacter = cycle;
    window.interact = interactRoof;
    scene.events.on("update", tick);
    dialogue([
      { speaker: "キングメイカー", text: "……多いな。" },
      { speaker: "SYSTEM", text: "仲間の3人に近づき、「調べる」で偵察情報を確認しよう。" }
    ]);
  }
  function boot() {
    const game = window.BSPhaserGame;
    if (!game?.scene) return false;
    let scene;
    try { scene = game.scene.getScene("TestField"); } catch (error) { return false; }
    if (!scene?.sys?.isActive() || !scene.heroSprite || !scene.summitMembers?.lucifer) return false;
    init(scene);
    return ROOF.active;
  }
  if (!boot()) {
    const timer = setInterval(() => { if (boot()) clearInterval(timer); }, 100);
    setTimeout(() => clearInterval(timer), 15000);
  }
})();
