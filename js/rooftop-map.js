
"use strict";
// BLACK SERIES RPG — EP001 Rooftop Prototype v0.4.1
// Add after mobile-ui.js. Existing source files remain unchanged.
(function () {
  const W = 900, H = 506;
  const ROOF = {
    active: false,
    found: { lucifer: false, lilith: false, goliath: false },
    completed: false,
    ending: false
  };
  const crew = [
    { id: "lucifer", name: "ルシファー", x: 260, y: 163 },
    { id: "lilith", name: "リリス", x: 653, y: 173 },
    { id: "goliath", name: "ゴライアス", x: 716, y: 376 }
  ];
  const exit = { x: 160, y: 376 };
  const originalInteract = window.interact;
  const originalSwitch = window.switchCharacter;

  function drawRoof(scene) {
    const g = scene.add.graphics().setDepth(-10);
    // Harbor and distant warehouse silhouettes.
    g.fillGradientStyle(0x101b2a, 0x101b2a, 0x25313d, 0x25313d, 1);
    g.fillRect(0, 0, W, H);
    g.fillStyle(0x0c1521, 1);
    g.fillRect(0, 0, W, 88);
    g.fillStyle(0x1a2937, 1);
    for (let i = 0; i < 11; i++) {
      const xx = i * 93 - 20;
      const hh = 25 + (i * 17) % 45;
      g.fillRect(xx, 88 - hh, 75, hh);
      g.fillStyle(0xd6b47b, 0.22);
      g.fillRect(xx + 11, 82 - hh / 2, 3, 5);
      g.fillRect(xx + 41, 77 - hh / 2, 3, 5);
      g.fillStyle(0x1a2937, 1);
    }
    // Two distant harbor cranes.
    g.lineStyle(3, 0x465664, 0.75);
    for (const cx of [110, 805]) {
      g.lineBetween(cx, 88, cx, 4);
      g.lineBetween(cx - 67, 19, cx + 55, 19);
      g.lineBetween(cx, 4, cx - 67, 19);
      g.lineBetween(cx + 45, 19, cx + 45, 55);
    }
    // Roof slab and parapet.
    g.fillStyle(0x303b46, 1);
    g.fillRect(27, 88, 846, 391);
    g.fillStyle(0x27323d, 1);
    g.fillRect(38, 100, 824, 367);
    g.lineStyle(5, 0x71808a, 0.9);
    g.strokeRect(29, 89, 842, 387);
    g.lineStyle(1, 0xa8b8c1, 0.10);
    for (let i = 0; i < 9; i++) g.lineBetween(45 + i * 100, 102, 45 + i * 100, 465);
    for (let i = 0; i < 5; i++) g.lineBetween(40, 116 + i * 84, 860, 116 + i * 84);
    // Rain-slick surface highlights, drain lines and puddles.
    g.fillStyle(0x6e9aa8, 0.10);
    g.fillEllipse(398, 321, 150, 29);
    g.fillEllipse(560, 418, 118, 21);
    g.fillEllipse(570, 136, 97, 16);
    g.lineStyle(2, 0x8aa1a9, 0.15);
    g.lineBetween(300, 420, 530, 420);
    g.lineBetween(530, 420, 560, 446);
    // HVAC boxes: matched with collision rectangles below.
    for (const a of [
      { x: 360, y: 115, w: 110, h: 75 },
      { x: 405, y: 355, w: 125, h: 70 }
    ]) {
      g.fillStyle(0x111b25, 0.45);
      g.fillRect(a.x + 7, a.y + 9, a.w, a.h);
      g.fillStyle(0x52616b, 1);
      g.fillRoundedRect(a.x, a.y, a.w, a.h, 5);
      g.fillStyle(0x35434e, 1);
      g.fillRect(a.x + 9, a.y + 9, a.w - 18, a.h - 18);
      g.lineStyle(2, 0x7e929e, 0.6);
      for (let k = 0; k < 4; k++)
        g.lineBetween(a.x + 20 + k * 21, a.y + 14, a.x + 20 + k * 21, a.y + a.h - 14);
    }
    // Stairwell / roof access.
    g.fillStyle(0x10151c, 0.6);
    g.fillRect(88, 315, 130, 132);
    g.fillStyle(0x59636d, 1);
    g.fillRect(79, 300, 130, 130);
    g.fillStyle(0x303b48, 1);
    g.fillRect(100, 325, 88, 105);
    g.fillStyle(0x101820, 1);
    g.fillRect(120, 346, 50, 84);
    g.lineStyle(3, 0x95a4ab, 0.8);
    g.strokeRect(120, 346, 50, 84);
    g.fillStyle(0xd8bd7b, 0.95);
    g.fillCircle(161, 393, 3);
    // Warm perimeter lamps.
    for (const lx of [60, 830]) {
      g.fillStyle(0xe4bc80, 0.16);
      g.fillEllipse(lx, 112, 86, 26);
      g.fillStyle(0xe4bc80, 0.9);
      g.fillRect(lx - 7, 99, 14, 5);
    }
    const title = scene.add.text(48, 23, "東湾第七码頭物流倉庫  ／  屋上", {
      fontFamily: "system-ui", fontSize: "17px", fontStyle: "bold", color: "#e3e7ed",
      backgroundColor: "#0b1424bb", padding: { x: 9, y: 6 }
    }).setDepth(30);
    title.setAlpha(0.94);
    return g;
  }

  function showObjective(scene) {
    const n = crew.filter(c => ROOF.found[c.id]).length;
    const message = ROOF.completed
      ? "偵察完了  ｜  階段入口で作戦を確認"
      : `偵察情報  ${n}/3  ｜  仲間に近づいて「調べる」`;
    if (!scene.bsObjective) {
      scene.bsObjective = scene.add.text(450, 64, message, {
        fontFamily: "system-ui", fontSize: "14px", color: "#f5e5e9",
        backgroundColor: "#0b101bd9", padding: { x: 12, y: 7 }
      }).setOrigin(0.5, 0).setDepth(120);
    } else scene.bsObjective.setText(message);
    if (scene.bsExitLabel) scene.bsExitLabel.setVisible(ROOF.completed);
  }

  function dialogue(lines, done) {
    if (typeof BSStartDialogue !== "function") return;
    BSStartDialogue(lines);
    // The original dialogue controller does not expose an end callback.
    // Poll its active flag from the Phaser update loop, not from a timer.
    ROOF.onDialogueEnd = done || null;
    ROOF.waitingForDialogue = true;
  }

  function interactRoof() {
    if (!ROOF.active) return originalInteract && originalInteract();
    if (fighting) return;
    if (BSDialogue.active) { BSAdvanceDialogue(); return; }
    const px = W * x / 100, py = H * y / 100;
    let nearest = null, best = 86;
    for (const c of crew) {
      const d = Math.hypot(px - c.x, py - c.y);
      if (d < best) { best = d; nearest = c; }
    }
    if (nearest) {
      if (nearest.id === "lucifer") dialogue([
        { speaker: "ルシファー", text: "事前情報では二十人前後でした。" },
        { speaker: "ルシファー", text: "見えるだけで、それ以上いますね。" },
        { speaker: "ルシファー", text: "東側は塞がれている。逃げるなら西だ。" }
      ], () => markFound(nearest.id));
      if (nearest.id === "lilith") dialogue([
        { speaker: "リリス", text: "中にもいるわ。それに……全員、妙に慣れてる。" },
        { speaker: "キングメイカー", text: "人の出入りは？" },
        { speaker: "リリス", text: "武装していない人間が何人か。たぶん、雇われただけね。" }
      ], () => markFound(nearest.id));
      if (nearest.id === "goliath") dialogue([
        { speaker: "ゴライアス", text: "裏口に車が三台。" },
        { speaker: "ゴライアス", text: "非戦闘員は中央から離れている。" }
      ], () => markFound(nearest.id));
      return;
    }
    if (Math.hypot(px - exit.x, py - exit.y) < 95) {
      if (!ROOF.completed) {
        dialogue([{ speaker: "探索", text: "まだ確認すべきことがある。仲間から偵察情報を集めよう。" }]);
      } else if (!ROOF.ending) {
        ROOF.ending = true;
        dialogue([
          { speaker: "キングメイカー", text: "……多いな。" },
          { speaker: "キングメイカー", text: "確認してから入る。" },
          { speaker: "キングメイカー", text: "始めるぞ。" },
          { speaker: "SYSTEM", text: "EPISODE 001：屋上偵察完了。次は倉庫潜入・戦闘チュートリアルの実装予定です。" }
        ], () => { ROOF.ending = false; });
      }
      return;
    }
    dialogue([{ speaker: "探索", text: "濡れたコンクリートの向こうに、港の灯りが見える。" }]);
  }

  function markFound(id) {
    ROOF.found[id] = true;
    ROOF.completed = crew.every(c => ROOF.found[c.id]);
    if (ROOF.scene) showObjective(ROOF.scene);
  }

  function init(scene) {
    if (ROOF.active || !scene || !scene.heroSprite || !scene.summitMembers?.lucifer) return;
    ROOF.active = true;
    ROOF.scene = scene;
    // Hide old grid, test obstacles, test NPC/enemy markers and test selectors.
    scene.children.list.slice().forEach(child => {
      if (child instanceof Phaser.GameObjects.Graphics) child.setVisible(false);
    });
    drawRoof(scene);
    Object.values(scene.actors || {}).forEach(actor => {
      actor.rect?.setVisible(false);
      actor.txt?.setVisible(false);
    });
    Object.values(scene.testButtons || {}).forEach(button => {
      button.bg?.setVisible(false).disableInteractive();
      button.txt?.setVisible(false).disableInteractive();
    });
    // This episode has four founders only. Preserve follower code for later maps.
    scene.followerSprite?.setVisible(false);
    scene.heroName = "kingmaker";
    scene.currentAnimation = "";
    for (const c of crew) {
      const member = scene.summitMembers[c.id];
      member.sprite.setPosition(c.x, c.y).setVisible(true);
      member.label.setPosition(c.x, c.y + 10).setVisible(true);
    }
    // Replace the temporary collision objects in place, preserving BS_OBSTACLES reference.
    BS_OBSTACLES.splice(0, BS_OBSTACLES.length,
      { x: 360, y: 115, w: 110, h: 75 },
      { x: 405, y: 355, w: 125, h: 70 },
      { x: 79, y: 300, w: 130, h: 130 }
    );
    x = 27; y = 56; facing = "right";
    scene.isMoving = false;
    if (typeof place === "function") place();
    scene.refreshHero(false);
    scene.bsExitLabel = scene.add.text(exit.x, 449, "▼ 階段入口", {
      fontFamily: "system-ui", fontSize: "13px", color: "#f5dfb8",
      backgroundColor: "#111b25e6", padding: { x: 6, y: 4 }
    }).setOrigin(0.5).setDepth(121).setVisible(false);
    showObjective(scene);
    const hud = document.getElementById("hudName");
    if (hud) hud.textContent = "KINGMAKER";
    const charButton = document.getElementById("charTouch");
    if (charButton) charButton.style.display = "none";
    const testSelect = document.getElementById("character-test");
    if (testSelect) testSelect.style.display = "none";
    const footer = document.querySelector("#game > p");
    if (footer) footer.style.display = "none";
    // Keep the original test system, but prevent episode-inappropriate switching.
    window.BSSetExplorationCharacter = name => name === "kingmaker";
    window.switchCharacter = function () { return false; };
    window.interact = interactRoof;
    scene.events.on("update", () => {
      if (ROOF.waitingForDialogue && !BSDialogue.active) {
        ROOF.waitingForDialogue = false;
        const callback = ROOF.onDialogueEnd;
        ROOF.onDialogueEnd = null;
        if (callback) callback();
      }
    });
    dialogue([
      { speaker: "キングメイカー", text: "……多いな。" },
      { speaker: "SYSTEM", text: "仲間の3人に近づき、「調べる」で偵察情報を確認しよう。" }
    ]);
  }

  function boot() {
    if (!window.Phaser || !Phaser.GAMES) return false;
    for (const game of Phaser.GAMES) {
      if (!game?.scene) continue;
      const scene = game.scene.getScene("TestField");
      if (scene?.sys?.isActive() && scene.heroSprite) {
        init(scene);
        return true;
      }
    }
    return false;
  }
  if (!boot()) {
    const timer = setInterval(() => { if (boot()) clearInterval(timer); }, 100);
    setTimeout(() => clearInterval(timer), 15000);
  }
})();
