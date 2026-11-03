
"use strict";
// BLACK SERIES RPG — EP001 Rooftop Party Prototype v0.5.1
// Load AFTER mobile-ui.js. Requires phaser-scene.js with window.BSPhaserGame.
(function () {
  const W = 900, H = 506;
  const IDS = ["kingmaker", "lucifer", "lilith", "goliath"];
  const NAMES = { kingmaker: "キングメイカー", lucifer: "ルシファー", lilith: "リリス", goliath: "ゴライアス" };
  const SPEED = { kingmaker: 125, lucifer: 115, lilith: 115, goliath: 115 }; // provisional follower px/sec
  const SPACING = 55;
  const LEADER_SPEED = { kingmaker: 1.25, lucifer: 1, lilith: 1, goliath: 1 };
  const CREW = [
    { id: "lucifer", x: 260, y: 163 },
    { id: "lilith", x: 653, y: 173 },
    { id: "goliath", x: 716, y: 376 }
  ];
  const EXIT = { x: 235, y: 387 };
  const ROOF = { active: false, phase: "scout", found: {}, members: {}, trail: [], pending: null, waiting: false, completed: false, scene: null };
  const FOOT = { kingmaker: { idle: 153, walk: 150.5 }, lucifer: { idle: 153, walk: 150.5 }, lilith: { idle: 153, walk: 150.5 }, goliath: { idle: 153, walk: 150.5 } };
  const HEIGHTS = { idle: 149, walk: 138.5 };
  const SCALE = { kingmaker: .65, lucifer: .72, lilith: .72, goliath: .82 };
  const CORRECTION = { lilith: 137 / 129, goliath: 138 / 131 };
  const WALK_WIDTH = { kingmaker: { right: 1.10 } };
  const oldInteract = window.interact;
  const oldSwitch = window.switchCharacter;
  const oldMove = window.BSTryMove;

  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function canStand(px, py) {
    return px >= 47 && px <= 853 && py >= 112 && py <= 456 &&
      (typeof BSCanStand !== "function" || BSCanStand(px, py));
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
    scene.add.text(48, 23, "東湾第七码頭物流倉庫  ／  屋上", {
      fontFamily: "system-ui", fontSize: "17px", fontStyle: "bold", color: "#e3e7ed",
      backgroundColor: "#0b1424bb", padding: { x: 9, y: 6 }
    }).setDepth(30);
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

  function pointOf(sprite) {
    return { x: sprite.x, y: sprite.y };
  }

  function moveActor(actor, target, dt, maxSpeed) {
    const sprite = actor.sprite;
    const start = pointOf(sprite);
    const dist = distance(start, target);

    if (dist < 10) {
      setActorAnimation(actor.id, sprite, false, actor.dir);
      return true;
    }

    actor.repath -= dt;

    if (
      !actor.path.length ||
      actor.repath <= 0 ||
      distance(actor.goal || start, target) > 28
    ) {
      actor.path = pathTo(start, target);
      actor.goal = { x: target.x, y: target.y };
      actor.repath = .28;
    }

    while (actor.path.length && distance(start, actor.path[0]) < 9) {
      actor.path.shift();
    }

    const aim = actor.path[0];

    if (!aim) {
      setActorAnimation(actor.id, sprite, false, actor.dir);
      return false;
    }

    const dx = aim.x - sprite.x;
    const dy = aim.y - sprite.y;
    const length = Math.hypot(dx, dy);
    const step = Math.min(length, maxSpeed * dt);

    if (length < .001) {
      actor.path.shift();
      return false;
    }

    const nx = sprite.x + dx / length * step;
    const ny = sprite.y + dy / length * step;
    const moving = step > .08 &&
      clearPath(start, { x: nx, y: ny });

    if (moving) {
      sprite.setPosition(nx, ny);
      actor.dir = Math.abs(dx) >= Math.abs(dy)
        ? (dx < 0 ? "left" : "right")
        : (dy < 0 ? "back" : "front");
    } else {
      actor.repath = 0;
    }

    setActorAnimation(actor.id, sprite, moving, actor.dir);
    return distance(pointOf(sprite), target) < 10;
  }

  function recordTrail() {
    const p = { x: W * x / 100, y: H * y / 100 };
    const trail = ROOF.trail;

    if (
      !trail.length ||
      distance(trail[trail.length - 1], p) > 2
    ) {
      trail.push(p);
    }

    if (trail.length > 1300) {
      trail.splice(0, trail.length - 1300);
    }
  }

  function trailTarget(behind) {
    const trail = ROOF.trail;

    if (!trail.length) {
      return { x: W * x / 100, y: H * y / 100 };
    }

    let left = behind;

    for (let i = trail.length - 1; i > 0; i--) {
      const a = trail[i];
      const b = trail[i - 1];
      const length = distance(a, b);

      if (length >= left) {
        const t = length ? left / length : 0;
        return {
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t
        };
      }

      left -= length;
    }

    return trail[0];
  }

  function switchTo(id) {
    if (
      ROOF.phase !== "party" ||
      !IDS.includes(id) ||
      fighting ||
      BSDialogue.active
    ) {
      return false;
    }

    const scene = ROOF.scene;
    const current = scene.heroName;

    if (current === id) return true;

    const next = ROOF.members[id];
    const old = ROOF.members[current];

    if (!next || !old) return false;

    const oldPosition = {
      x: W * x / 100,
      y: H * y / 100
    };

    const nextPosition = pointOf(next.sprite);

    // Keep the previous leader at the exact handover position.
    old.sprite
      .setPosition(oldPosition.x, oldPosition.y)
      .setVisible(true);

    old.label.setVisible(false);
    old.dir = facing;

    // Important: apply the normal display scale before showing.
    setActorAnimation(current, old.sprite, false, old.dir);

    next.sprite.setVisible(false);
    next.label.setVisible(false);

    scene.heroName = id;
    scene.currentAnimation = "";

    x = nextPosition.x / W * 100;
    y = nextPosition.y / H * 100;
    facing = next.dir;

    scene.refreshHero(false);

    // Reset the party trail after switching leaders.
    ROOF.trail = [{
      x: W * x / 100,
      y: H * y / 100
    }];

    // Keep the hidden development selector synchronized.
    const selector = document.getElementById("characterSelect");
    if (selector) selector.value = id;

    const hud = document.getElementById("hudName");
    if (hud) hud.textContent = NAMES[id];

    return true;
  }

  function cycle() {
    const i = IDS.indexOf(ROOF.scene.heroName);
    return switchTo(IDS[(i + 1) % IDS.length]);
  }

  function interactRoof() {
    if (!ROOF.active) return oldInteract?.();
    if (fighting) return;

    if (BSDialogue.active) {
      BSAdvanceDialogue();
      return;
    }

    const p = { x: W * x / 100, y: H * y / 100 };

    if (ROOF.phase === "scout") {
      let closest = null;
      let best = 86;

      for (const c of CREW) {
        const d = distance(p, c);

        if (d < best) {
          best = d;
          closest = c;
        }
      }

      if (closest) {
        const id = closest.id;

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

          if (CREW.every(c => ROOF.found[c.id])) {
            ROOF.phase = "rally";
            ROOF.rallyStarted = false;
            ROOF.rallyElapsed = 0;
          }

          objective();
        });

        return;
      }

      dialogue([{
        speaker: "探索",
        text: "仲間から偵察情報を集めよう。"
      }]);
      return;
    }

    if (ROOF.phase === "rally") {
      dialogue([{
        speaker: "探索",
        text: "仲間が集合している。"
      }]);
      return;
    }

    if (distance(p, EXIT) < 92) {
      dialogue([
        
        { speaker: "キングメイカー", text: "確認してから入る。" },
        { speaker: "キングメイカー", text: "始めるぞ。" },
        { speaker: "SYSTEM", text: "屋上偵察完了。次の倉庫潜入マップは今後実装予定です。" }
      ]);
      return;
    }

    dialogue([
      { speaker: "探索", text: "雨に濡れた屋上から、港の灯りが見える。" }
    ]);
  }

  function finishRally() {
    ROOF.phase = "party";

    const leader = {
      x: W * x / 100,
      y: H * y / 100
    };

    ROOF.trail = [leader];

    for (const c of CREW) {
      ROOF.members[c.id].label.setVisible(false);
    }

    const btn = document.getElementById("charTouch");
    if (btn) btn.style.display = "";

    objective();

    dialogue([
      {
        speaker: "SYSTEM",
        text: "4人が合流しました。「切替」で操作キャラクターを変更できます。"
      }
    ]);
  }

  function tick(time, delta) {
    if (!ROOF.active) return;

    if (ROOF.waiting && !BSDialogue.active) {
      ROOF.waiting = false;
      const done = ROOF.pending;
      ROOF.pending = null;
      if (done) done();
    }

    if (fighting || BSDialogue.active) return;

    const dt = Math.min(delta / 1000, .05);
    const scene = ROOF.scene;

    if (ROOF.phase === "rally") {
      ROOF.rallyElapsed = (ROOF.rallyElapsed || 0) + dt;

      const leader = {
        x: W * x / 100,
        y: H * y / 100
      };

      const positions = [
        { x: leader.x - 42, y: leader.y + 48 },
        { x: leader.x + 42, y: leader.y + 48 },
        { x: leader.x, y: leader.y + 85 }
      ];

      let all = true;

      CREW.forEach((c, i) => {
        const actor = ROOF.members[c.id];
        const goal = positions[i];
        const safeGoal = canStand(goal.x, goal.y) ? goal : leader;

        if (!moveActor(actor, safeGoal, dt, SPEED[c.id])) {
          all = false;
        }

        actor.label.setPosition(
          actor.sprite.x,
          actor.sprite.y + 10
        );
      });

      // Avoid a long wait if an actor cannot reach the exact slot.
      if (all || ROOF.rallyElapsed >= 8) {
        finishRally();
      }

      return;
    }

    if (ROOF.phase !== "party") return;

    recordTrail();

    const others = IDS.filter(id => id !== scene.heroName);

    others.forEach((id, index) => {
      const actor = ROOF.members[id];
      const target = trailTarget(SPACING * (index + 1));
      const gap = distance(pointOf(actor.sprite), target);

      const speed = SPEED[id] * (
        gap > 165 ? 1.75 :
        gap > 95 ? 1.35 : 1
      );

      moveActor(actor, target, dt, speed);

      actor.sprite.setDepth(
        9 + actor.sprite.y / 1000
      );
    });
  }

  function init(scene) {
    if (
      ROOF.active ||
      !scene?.heroSprite ||
      !scene.summitMembers?.lucifer
    ) return;

    ROOF.active = true;
    ROOF.scene = scene;

    for (const child of scene.children.list.slice()) {
      if (child instanceof Phaser.GameObjects.Graphics) {
        child.setVisible(false);
      }
    }

    drawRoof(scene);

    for (const actor of Object.values(scene.actors || {})) {
      actor.rect?.setVisible(false);
      actor.txt?.setVisible(false);
    }

    for (const button of Object.values(scene.testButtons || {})) {
      button.bg?.setVisible(false).disableInteractive();
      button.txt?.setVisible(false).disableInteractive();
    }

    scene.followerSprite?.setVisible(false);

    // Disable the old two-character follower on this map.
    scene.update = function () {};

    // Preserve the existing sprite sheets and animation corrections.
    for (const c of CREW) {
      const member = scene.summitMembers[c.id];

      member.sprite
        .setPosition(c.x, c.y)
        .setVisible(true);

      member.label
        .setPosition(c.x, c.y + 10)
        .setVisible(true);

      ROOF.members[c.id] = {
        id: c.id,
        sprite: member.sprite,
        label: member.label,
        dir: "front",
        path: [],
        goal: null,
        repath: 0
      };
    }

    const kingSprite = scene.add
      .sprite(0, 0, "kingmaker_idle", 0)
      .setVisible(false)
      .setDepth(9);

    ROOF.members.kingmaker = {
      id: "kingmaker",
      sprite: kingSprite,
      label: {
        setVisible() {},
        setPosition() {}
      },
      dir: "right",
      path: [],
      goal: null,
      repath: 0
    };

    // Ensure KINGMAKER follower uses the same scale as the hero.
    setActorAnimation(
      "kingmaker",
      kingSprite,
      false,
      "right"
    );

    BS_OBSTACLES.splice(
      0,
      BS_OBSTACLES.length,
      { x: 360, y: 115, w: 110, h: 75 },
      { x: 405, y: 355, w: 125, h: 70 },
      { x: 79, y: 300, w: 130, h: 130 }
    );

    x = 27;
    y = 56;
    facing = "right";

    scene.heroName = "kingmaker";
    scene.currentAnimation = "";
    scene.isMoving = false;

    if (typeof place === "function") place();
    scene.refreshHero(false);

    scene.bsObjective = scene.add.text(
      450, 64, "",
      {
        fontFamily: "system-ui",
        fontSize: "14px",
        color: "#f5e5e9",
        backgroundColor: "#0b101bd9",
        padding: { x: 12, y: 7 }
      }
    ).setOrigin(.5, 0).setDepth(120);

    scene.bsExitLabel = scene.add.text(
      EXIT.x,
      EXIT.y + 45,
      "▼ 階段入口",
      {
        fontFamily: "system-ui",
        fontSize: "13px",
        color: "#f5dfb8",
        backgroundColor: "#111b25e6",
        padding: { x: 6, y: 4 }
      }
    ).setOrigin(.5).setDepth(121).setVisible(false);

    objective();

    const charButton = document.getElementById("charTouch");
    if (charButton) charButton.style.display = "none";

    const testSelect = document.getElementById("character-test");
    if (testSelect) testSelect.style.display = "none";

    const footer = document.querySelector("#game > p");
    if (footer) footer.style.display = "none";

    window.BSGetLeaderSpeed = () =>
      LEADER_SPEED[scene.heroName] || 1;

    window.BSGetLeaderName = () =>
      scene.heroName;

    window.BSSetExplorationCharacter = switchTo;
    window.switchCharacter = cycle;
    window.interact = interactRoof;

    scene.events.on("update", tick);

    dialogue([
      { speaker: "キングメイカー", text: "……多いな。" },
      {
        speaker: "SYSTEM",
        text: "仲間の3人に近づき、「調べる」で偵察情報を確認しよう。"
      }
    ]);
  }

  function boot() {
    const game = window.BSPhaserGame;
    if (!game?.scene) return false;

    let scene;

    try {
      scene = game.scene.getScene("TestField");
    } catch (error) {
      return false;
    }

    if (
      !scene?.sys?.isActive() ||
      !scene.heroSprite ||
      !scene.summitMembers?.lucifer
    ) return false;

    init(scene);
    return ROOF.active;
  }

  if (!boot()) {
    const timer = setInterval(() => {
      if (boot()) clearInterval(timer);
    }, 100);

    setTimeout(() => clearInterval(timer), 15000);
  }
})();
