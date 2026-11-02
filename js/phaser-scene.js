
"use strict";
// BLACK SERIES RPG - Phaser Field Scene Ver.0.3.3
// Five-character animation test and runtime corrections.
(function () {
  if (typeof Phaser === "undefined") {
    console.warn("Phaser unavailable.");
    return;
  }

  const WIDTH = 900;
  const HEIGHT = 506;
  const ROW = { front: 0, back: 1, left: 2, right: 3 };

  const SPRITE_ROW = {
    kingmaker: { idle: ROW, walk: ROW },
    leviathan: {
      idle: { front: 0, back: 1, left: 3, right: 2 },
      walk: ROW
    },
    lucifer: { idle: ROW, walk: ROW },
    lilith: { idle: ROW, walk: ROW },
    goliath: { idle: ROW, walk: ROW }
  };

  const VISUAL_HEIGHT = {
    kingmaker: { idle: 149, walk: 138.5 },
    leviathan: { idle: 143, walk: 137.5 },
    lucifer: { idle: 149, walk: 138.5 },
    lilith: { idle: 149, walk: 138.5 },
    goliath: { idle: 149, walk: 138.5 }
  };

  const FOOT_Y = {
    kingmaker: { idle: 153, walk: 150.5 },
    leviathan: { idle: 151, walk: 150 },
    lucifer: { idle: 153, walk: 150.5 },
    lilith: { idle: 153, walk: 150.5 },
    goliath: { idle: 153, walk: 150.5 }
  };

  const BASE_SCALE = 0.65;

  const MEMBER_SCALE = {
    lucifer: 0.72,
    lilith: 0.72,
    goliath: 0.82
  };

  const IDLE_SCALE_CORRECTION = {
    lilith: 137 / 129,
    goliath: 138 / 131
  };

  function displayScale(name, mode) {
    const base = MEMBER_SCALE[name] || BASE_SCALE;
    const correction =
      mode === "idle"
        ? IDLE_SCALE_CORRECTION[name] || 1
        : 1;

    return (
      base *
      VISUAL_HEIGHT[name].idle /
      VISUAL_HEIGHT[name][mode] *
      correction
    );
  }

  const IDLE_WIDTH_RATIO = {
    front: 1.08,
    back: 1.10,
    left: 1.20,
    right: 1.20
  };

  const WALK_WIDTH_RATIO = {
    kingmaker: { front: 1, back: 1, left: 1, right: 1.10 },
    leviathan: { front: 1, back: 1, left: 1, right: 1 },
    lucifer: { front: 1, back: 1, left: 1, right: 1 },
    lilith: { front: 1, back: 1, left: 1, right: 1 },
    goliath: { front: 1, back: 1, left: 1, right: 1 }
  };

  const names = [
    "kingmaker",
    "leviathan",
    "lucifer",
    "lilith",
    "goliath"
  ];

  const playableNames = [...names];

  const MOVE_SPEED = {
    kingmaker: 1.25,
    leviathan: 0.90
  };

  const FOLLOW = {
    min: 50,
    preferred: 70,
    max: 100,
    catchupMultiplier: 2.2,
    basePixelsPerSecond: 115,
    acceleration: 450,
    deceleration: 560
  };

  const LEVI_HURRY = {
    startDistance: 83,
    fullDistance: 145,
    acceleration: 780,
    animationMax: 1.65
  };

  function navClear(ax, ay, bx, by) {
    const len = Math.hypot(bx - ax, by - ay);
    const count = Math.max(1, Math.ceil(len / 6));

    for (let i = 1; i <= count; i++) {
      const t = i / count;

      if (
        !BSCanStand(
          ax + (bx - ax) * t,
          ay + (by - ay) * t
        )
      ) {
        return false;
      }
    }

    return true;
  }

  function navRoute(sx, sy, tx, ty) {
    if (!BSCanStand(sx, sy) || !BSCanStand(tx, ty)) {
      return null;
    }

    if (navClear(sx, sy, tx, ty)) {
      return [{ x: tx, y: ty }];
    }

    const nodes = [
      { x: sx, y: sy },
      { x: tx, y: ty }
    ];

    const clearance = 18;

    for (const o of BS_OBSTACLES) {
      for (const xx of [
        o.x - clearance,
        o.x + o.w + clearance
      ]) {
        for (const yy of [
          o.y - clearance,
          o.y + o.h + clearance
        ]) {
          if (
            xx > 8 &&
            xx < WIDTH - 8 &&
            yy > 8 &&
            yy < HEIGHT - 8 &&
            BSCanStand(xx, yy)
          ) {
            nodes.push({ x: xx, y: yy });
          }
        }
      }
    }

    const dist = Array(nodes.length).fill(Infinity);
    const prev = Array(nodes.length).fill(-1);
    const visited = new Set();

    dist[0] = 0;

    for (let k = 0; k < nodes.length; k++) {
      let u = -1;

      for (let i = 0; i < nodes.length; i++) {
        if (
          !visited.has(i) &&
          (u < 0 || dist[i] < dist[u])
        ) {
          u = i;
        }
      }

      if (u < 0 || !Number.isFinite(dist[u])) break;
      if (u === 1) break;

      visited.add(u);

      for (let v = 0; v < nodes.length; v++) {
        if (
          v === u ||
          visited.has(v) ||
          !navClear(
            nodes[u].x,
            nodes[u].y,
            nodes[v].x,
            nodes[v].y
          )
        ) {
          continue;
        }

        const nd =
          dist[u] +
          Math.hypot(
            nodes[v].x - nodes[u].x,
            nodes[v].y - nodes[u].y
          );

        if (nd < dist[v]) {
          dist[v] = nd;
          prev[v] = u;
        }
      }
    }

    if (!Number.isFinite(dist[1])) return null;

    const route = [];
    let at = 1;

    while (at !== 0) {
      route.push(nodes[at]);
      at = prev[at];

      if (at < 0) return null;
    }

    return route.reverse();
  }

  // Original PNG files remain unchanged.
  // Corrections are applied to temporary game textures.
  function prepareColorTexture(
    scene,
    sourceKey,
    outputKey,
    kind
  ) {
    try {
      const texture = scene.textures.get(sourceKey);
      const source = texture.getSourceImage();

      const canvas = document.createElement("canvas");
      canvas.width = source.width;
      canvas.height = source.height;

      const ctx = canvas.getContext("2d", {
        willReadFrequently: true
      });

      ctx.drawImage(source, 0, 0);

      const image = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );

      const data = image.data;

      for (let yy = 0; yy < canvas.height; yy++) {
        const localY = yy % 160;

        for (let xx = 0; xx < canvas.width; xx++) {
          const index = (yy * canvas.width + xx) * 4;
          const alpha = data[index + 3];

          if (alpha < 12) continue;

          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];

          if (kind === "lucifer") {
            // Brighten the idle animation.
            data[index] = Math.min(
              255,
              Math.round(r * 1.08 + 4)
            );

            data[index + 1] = Math.min(
              255,
              Math.round(g * 1.08 + 4)
            );

            data[index + 2] = Math.min(
              255,
              Math.round(b * 1.08 + 4)
            );
          }

          if (kind === "goliath") {
            // Approximate dark hair by position and color.
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const gray = max - min;

            if (
              localY >= 7 &&
              localY <= 52 &&
              max < 180 &&
              gray < 55 &&
              b <= r + 20
            ) {
              const strength =
                localY < 40 ? 0.80 : 0.88;

              data[index] = Math.round(
                r * strength
              );

              data[index + 1] = Math.round(
                g * strength
              );

              data[index + 2] = Math.round(
                b * strength
              );
            }
          }
        }
      }

      ctx.putImageData(image, 0, 0);

      scene.textures.addSpriteSheet(
        outputKey,
        canvas,
        {
          frameWidth: 128,
          frameHeight: 160
        }
      );

      return outputKey;
    } catch (error) {
      console.warn(
        "Color correction skipped:",
        sourceKey,
        error
      );

      return sourceKey;
    }
  }

  class FieldScene extends Phaser.Scene {
    constructor() {
      super("TestField");

      this.actors = {};
      this.heroSprite = null;
      this.heroName = "kingmaker";
      this.currentAnimation = "";

      this.followerSprite = null;
      this.followerAnimation = "";

      this.trail = [];
      this.followerFacing = "right";
      this.followDistance = FOLLOW.preferred;
      this.followSpeed = 0;
      this.followerIsMoving = false;

      this.navPath = [];
      this.navCooldown = 0;
      this.navGoal = null;

      this.summitMembers = {};
      this.testButtons = {};
    }

    preload() {
      for (const name of names) {
        this.load.spritesheet(
          name + "_idle",
          "assets/characters/" + name + "_idle.png",
          {
            frameWidth: 128,
            frameHeight: 160,
            endFrame: 11
          }
        );

        this.load.spritesheet(
          name + "_walk",
          "assets/characters/" + name + "_walk.png",
          {
            frameWidth: 128,
            frameHeight: 160,
            endFrame: 15
          }
        );
      }
    }

    create() {
      const g = this.add.graphics();

      g.fillGradientStyle(
        0x202b37,
        0x202b37,
        0x10151e,
        0x10151e,
        1
      );

      g.fillRect(0, 0, WIDTH, HEIGHT);
      g.lineStyle(1, 0xffffff, 0.035);

      for (let gx = 0; gx < WIDTH; gx += 50) {
        g.lineBetween(gx, 0, gx, HEIGHT);
      }

      for (let gy = 0; gy < HEIGHT; gy += 50) {
        g.lineBetween(0, gy, WIDTH, gy);
      }

      const blocks = this.add.graphics().setDepth(2);

      for (const o of BS_OBSTACLES) {
        blocks.fillStyle(0x354452, 1);

        blocks.fillRoundedRect(
          o.x,
          o.y,
          o.w,
          o.h,
          8
        );

        blocks.lineStyle(3, 0x8299a8, 0.9);

        blocks.strokeRoundedRect(
          o.x,
          o.y,
          o.w,
          o.h,
          8
        );

        blocks.lineStyle(1, 0xffffff, 0.16);

        blocks.lineBetween(
          o.x + 10,
          o.y + 12,
          o.x + o.w - 10,
          o.y + 12
        );
      }

      const addActor = (label, color, outline) => {
        const rect = this.add
          .rectangle(0, 0, 32, 40, color)
          .setStrokeStyle(2, outline);

        const txt = this.add
          .text(0, 0, label, {
            fontFamily: "system-ui",
            fontSize: "22px",
            color: "#ffffff"
          })
          .setOrigin(0.5);

        return { rect, txt };
      };

      this.actors.npc = addActor(
        "♟",
        0x344c64,
        0x8cb3d6
      );

      this.actors.enemy = addActor(
        "⚔",
        0x68442a,
        0xcfa47a
      );

      this.actors.inspect = addActor(
        "?",
        0x315b56,
        0x9bcac1
      );

      const colorKeys = {
        lucifer_idle: prepareColorTexture(
          this,
          "lucifer_idle",
          "lucifer_idle_tuned",
          "lucifer"
        ),

        goliath_walk: prepareColorTexture(
          this,
          "goliath_walk",
          "goliath_walk_tuned",
          "goliath"
        )
      };

      for (const name of names) {
        for (const dir of Object.keys(ROW)) {
          const idleRow =
            SPRITE_ROW[name].idle[dir];

          const walkRow =
            SPRITE_ROW[name].walk[dir];

          this.anims.create({
            key: name + "_idle_" + dir,

            frames: [0, 1, 2, 1].map(i => ({
              key:
                colorKeys[name + "_idle"] ||
                name + "_idle",

              frame: idleRow * 3 + i
            })),

            frameRate: 1.6,
            repeat: -1
          });

          this.anims.create({
            key: name + "_walk_" + dir,

            frames: [0, 1, 2, 3].map(i => ({
              key:
                colorKeys[name + "_walk"] ||
                name + "_walk",

              frame: walkRow * 4 + i
            })),

            frameRate: 1000 / 165,
            repeat: -1
          });
        }
      }

      this.heroSprite = this.add
        .sprite(0, 0, "kingmaker_idle", 0)
        .setOrigin(0.5, 153 / 160)
        .setScale(BASE_SCALE)
        .setDepth(10);

      this.followerSprite = this.add
        .sprite(0, 0, "leviathan_idle", 0)
        .setOrigin(0.5, 151 / 160)
        .setScale(BASE_SCALE)
        .setDepth(9);

      const members = [
        {
          id: "lucifer",
          name: "ルシファー",
          x: 210,
          y: 125,
          dir: "front"
        },
        {
          id: "lilith",
          name: "リリス",
          x: 450,
          y: 120,
          dir: "front"
        },
        {
          id: "goliath",
          name: "ゴライアス",
          x: 720,
          y: 330,
          dir: "front"
        }
      ];

      for (const member of members) {
        const sprite = this.add
          .sprite(
            member.x,
            member.y,
            member.id + "_idle",
            0
          )
          .setOrigin(
            0.5,
            FOOT_Y[member.id].idle / 160
          )
          .setScale(
            displayScale(member.id, "idle")
          )
          .setDepth(9);

        sprite.play(
          member.id + "_idle_" + member.dir
        );

        const label = this.add
          .text(
            member.x,
            member.y + 10,
            member.name,
            {
              fontFamily: "system-ui",
              fontSize: "13px",
              color: "#ffffff",
              backgroundColor: "#111827",
              padding: { x: 5, y: 3 }
            }
          )
          .setOrigin(0.5, 0)
          .setDepth(20);

        this.summitMembers[member.id] = {
          sprite,
          label
        };
      }

      this.resetFollowerTrail("right");

      const selectors = [
        ["kingmaker", "キング"],
        ["lucifer", "ルシ"],
        ["lilith", "リリス"],
        ["goliath", "ゴライ"],
        ["leviathan", "リヴァ"]
      ];

      selectors.forEach(([id, short], i) => {
        const cx = 330 + i * 60;
        const cy = 479;

        const bg = this.add
          .rectangle(
            cx,
            cy,
            56,
            34,
            0x111827,
            0.94
          )
          .setStrokeStyle(
            1,
            0xa78292,
            0.9
          )
          .setDepth(100)
          .setInteractive({
            useHandCursor: true
          });

        const txt = this.add
          .text(cx, cy, short, {
            fontFamily: "system-ui",
            fontSize: "12px",
            color: "#ffffff"
          })
          .setOrigin(0.5)
          .setDepth(101)
          .setInteractive({
            useHandCursor: true
          });

        const choose = () => {
          window.BSSetExplorationCharacter(id);
        };

        bg.on("pointerdown", choose);
        txt.on("pointerdown", choose);

        this.testButtons[id] = { bg, txt };
      });

      this.actors.heroFallback = addActor(
        "♛",
        0x682538,
        0xe2a6b5
      );

      this.actors.heroFallback.rect.setVisible(false);
      this.actors.heroFallback.txt.setVisible(false);

      window.BSSetExplorationCharacter = name => {
        if (!playableNames.includes(name)) {
          return false;
        }

        this.heroName = name;
        this.currentAnimation = "";
        this.followerAnimation = "";

        const originalPair =
          name === "kingmaker" ||
          name === "leviathan";

        this.followerSprite.setVisible(originalPair);

        if (originalPair) {
          this.resetFollowerTrail(facing);
        }

        for (const [id, member] of Object.entries(
          this.summitMembers
        )) {
          const show = id !== name;

          member.sprite.setVisible(show);
          member.label.setVisible(show);
        }

        for (const [id, button] of Object.entries(
          this.testButtons
        )) {
          button.bg.setFillStyle(
            id === name ? 0x77384e : 0x111827,
            id === name ? 1 : 0.94
          );
        }

        this.refreshHero(false);
        return true;
      };

      window.BSPhaserRefresh = () => {
        for (const [name, px, py] of [
          ["npc", 55, 30],
          ["enemy", 80, 65],
          ["inspect", 60, 62]
        ]) {
          this.actors[name].rect.setPosition(
            WIDTH * px / 100,
            HEIGHT * py / 100
          );

          this.actors[name].txt.setPosition(
            WIDTH * px / 100,
            HEIGHT * py / 100
          );
        }

        this.refreshHero(this.isMoving || false);
      };

      window.BSPhaserStep = moving => {
        this.isMoving = !!moving;
        this.refreshHero(this.isMoving);
      };

      window.BSSetExplorationCharacter("kingmaker");
      window.BSPhaserRefresh();

      document
        .getElementById("field")
        .classList.add("phaser-active");
    }

    resetFollowerTrail(dir) {
      const px = WIDTH * x / 100;
      const py = HEIGHT * y / 100;

      const offset = {
        front: [0, -1],
        back: [0, 1],
        left: [1, 0],
        right: [-1, 0]
      }[dir] || [-1, 0];

      const fx =
        px + offset[0] * this.followDistance;

      const fy =
        py + offset[1] * this.followDistance;

      this.trail = [
        { x: fx, y: fy },
        { x: px, y: py }
      ];

      this.followerSprite.setPosition(fx, fy);

      this.followerFacing = dir;
      this.followerAnimation = "";
      this.followSpeed = 0;
      this.followerIsMoving = false;

      this.navPath = [];
      this.navCooldown = 0;
      this.navGoal = null;

      if (this.followerSprite.anims) {
        this.followerSprite.anims.timeScale = 1;
      }
    }

    refreshFollower(px, py, moving) {
      if (!this.followerSprite) return;

      const trail = this.trail;
      const last = trail[trail.length - 1];

      if (
        Math.hypot(
          px - last.x,
          py - last.y
        ) > 0.3
      ) {
        trail.push({ x: px, y: py });
      }

      if (trail.length > 1800) {
        trail.splice(0, trail.length - 1800);
      }

      this.followerSprite.setDepth(
        this.followerSprite.y < py ? 9 : 11
      );
    }

    update(time, delta) {
      if (
        !this.followerSprite ||
        !this.heroSprite ||
        fighting
      ) {
        return;
      }

      if (
        !["kingmaker", "leviathan"].includes(
          this.heroName
        )
      ) {
        return;
      }

      const dt = Math.min(delta / 1000, 0.05);
      const px = WIDTH * x / 100;
      const py = HEIGHT * y / 100;

      this.refreshFollower(
        px,
        py,
        this.isMoving
      );

      const trail = this.trail;
      let remaining = FOLLOW.preferred;
      let target = trail[0];

      for (let i = trail.length - 1; i > 0; i--) {
        const a = trail[i];
        const b = trail[i - 1];

        const len = Math.hypot(
          a.x - b.x,
          a.y - b.y
        );

        if (len >= remaining) {
          const t = len ? remaining / len : 0;

          target = {
            x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t
          };

          break;
        }

        remaining -= len;
      }

      const sprite = this.followerSprite;

      this.navCooldown = Math.max(
        0,
        this.navCooldown - dt
      );

      const blocked = !navClear(
        sprite.x,
        sprite.y,
        target.x,
        target.y
      );

      if (
        blocked &&
        (
          this.navCooldown === 0 ||
          !this.navPath.length ||
          !this.navGoal ||
          Math.hypot(
            target.x - this.navGoal.x,
            target.y - this.navGoal.y
          ) > 35
        )
      ) {
        const candidates = BSCanStand(
          target.x,
          target.y
        ) ? [target] : [];

        const stride = Math.max(
          1,
          Math.floor(trail.length / 12)
        );

        for (
          let i = trail.length - 1;
          i >= 0;
          i -= stride
        ) {
          if (
            BSCanStand(
              trail[i].x,
              trail[i].y
            )
          ) {
            candidates.push(trail[i]);
          }
        }

        candidates.push({ x: px, y: py });

        let route = null;
        let chosen = null;

        for (const candidate of candidates) {
          if (
            Math.hypot(
              candidate.x - sprite.x,
              candidate.y - sprite.y
            ) < 12
          ) {
            continue;
          }

          const found = navRoute(
            sprite.x,
            sprite.y,
            candidate.x,
            candidate.y
          );

          if (
            found &&
            found.length &&
            found.every((point, i) =>
              i > 0
                ? navClear(
                    found[i - 1].x,
                    found[i - 1].y,
                    point.x,
                    point.y
                  )
                : navClear(
                    sprite.x,
                    sprite.y,
                    point.x,
                    point.y
                  )
            )
          ) {
            route = found;
            chosen = candidate;
            break;
          }
        }

        this.navPath = route || [];

        this.navGoal = chosen
          ? { x: chosen.x, y: chosen.y }
          : null;

        this.navCooldown = route ? 0.5 : 0.18;
      }

      if (!blocked) {
        this.navPath = [];
        this.navGoal = null;
      }

      while (
        this.navPath.length &&
        Math.hypot(
          this.navPath[0].x - sprite.x,
          this.navPath[0].y - sprite.y
        ) < 7
      ) {
        this.navPath.shift();
      }

      const aim = blocked
        ? this.navPath[0] || {
            x: sprite.x,
            y: sprite.y
          }
        : target;

      const dx = aim.x - sprite.x;
      const dy = aim.y - sprite.y;
      const dist = Math.hypot(dx, dy);

      const leaderDist = Math.hypot(
        px - sprite.x,
        py - sprite.y
      );

      const followerName =
        this.heroName === "kingmaker"
          ? "leviathan"
          : "kingmaker";

      const normal =
        FOLLOW.basePixelsPerSecond *
        MOVE_SPEED[followerName];

      const isLeviFollower =
        followerName === "leviathan";

      const needCatchup =
        leaderDist >
        (
          isLeviFollower
            ? LEVI_HURRY.startDistance
            : FOLLOW.max
        );

      const catchupFraction = isLeviFollower
        ? Math.max(
            0,
            Math.min(
              1,
              (
                leaderDist -
                LEVI_HURRY.startDistance
              ) /
              (
                LEVI_HURRY.fullDistance -
                LEVI_HURRY.startDistance
              )
            )
          )
        : Math.max(
            0,
            Math.min(
              1,
              (leaderDist - FOLLOW.max) / 65
            )
          );

      const desired =
        dist < 1.5
          ? 0
          : needCatchup
            ? normal *
              (
                1 +
                (
                  FOLLOW.catchupMultiplier - 1
                ) *
                catchupFraction
              )
            : Math.min(
                normal,
                normal * dist / 22
              );

      const rate =
        desired > this.followSpeed &&
        isLeviFollower &&
        needCatchup
          ? LEVI_HURRY.acceleration
          : desired > this.followSpeed
            ? FOLLOW.acceleration
            : FOLLOW.deceleration;

      this.followSpeed += Math.max(
        -rate * dt,
        Math.min(
          rate * dt,
          desired - this.followSpeed
        )
      );

      const travel = Math.min(
        dist,
        this.followSpeed * dt
      );

      let moved = 0;

      if (dist > 0.001 && travel > 0) {
        const nx =
          sprite.x + dx / dist * travel;

        const ny =
          sprite.y + dy / dist * travel;

        if (
          navClear(
            sprite.x,
            sprite.y,
            nx,
            ny
          )
        ) {
          sprite.setPosition(nx, ny);
          moved = travel;
        } else {
          this.navCooldown = 0;
          this.navPath = [];
          this.navGoal = null;
          this.followSpeed = 0;
        }
      }

      const actualMoving = moved > 0.08;

      if (actualMoving) {
        this.followerFacing =
          Math.abs(dx) >= Math.abs(dy)
            ? dx < 0 ? "left" : "right"
            : dy < 0 ? "back" : "front";
      }

      sprite.setDepth(
        sprite.y < py ? 9 : 11
      );

      const mode =
        actualMoving ? "walk" : "idle";

      const dir = this.followerFacing;

      const key =
        followerName + "_" + mode + "_" + dir;

      if (this.followerAnimation !== key) {
        const scale =
          BASE_SCALE *
          VISUAL_HEIGHT[followerName].idle /
          VISUAL_HEIGHT[followerName][mode];

        const widthRatio =
          followerName === "leviathan" &&
          mode === "idle"
            ? IDLE_WIDTH_RATIO[dir]
            : mode === "walk"
              ? WALK_WIDTH_RATIO[followerName][dir]
              : 1;

        sprite
          .setScale(
            scale * widthRatio,
            scale
          )
          .setOrigin(
            0.5,
            FOOT_Y[followerName][mode] / 160
          );

        sprite.play(key);
        this.followerAnimation = key;
      }

      if (
        sprite.anims &&
        sprite.anims.currentAnim
      ) {
        const hurryRatio =
          isLeviFollower &&
          needCatchup &&
          actualMoving
            ? Math.min(
                LEVI_HURRY.animationMax,
                Math.max(
                  1,
                  this.followSpeed / normal
                )
              )
            : 1;

        sprite.anims.timeScale = hurryRatio;
      }

      while (trail.length > 2) {
        const a = trail[0];
        const b = trail[1];

        const vx = b.x - a.x;
        const vy = b.y - a.y;
        const len2 = vx * vx + vy * vy;

        if (len2 < 0.01) {
          trail.shift();
          continue;
        }

        const projection =
          (
            (sprite.x - a.x) * vx +
            (sprite.y - a.y) * vy
          ) / len2;

        if (projection >= 1) {
          trail.shift();
        } else {
          break;
        }
      }
    }

    refreshHero(moving) {
      if (!this.heroSprite) return;

      const px = WIDTH * x / 100;
      const py = HEIGHT * y / 100;

      this.heroSprite.setPosition(px, py);

      if (
        ["kingmaker", "leviathan"].includes(
          this.heroName
        )
      ) {
        this.refreshFollower(
          px,
          py,
          moving
        );
      }

      const mode = moving ? "walk" : "idle";

      const dir =
        ROW[facing] !== undefined
          ? facing
          : "front";

      const key =
        this.heroName + "_" + mode + "_" + dir;

      if (this.currentAnimation !== key) {
        const scale = displayScale(
          this.heroName,
          mode
        );

        const widthRatio =
          this.heroName === "leviathan" &&
          mode === "idle"
            ? IDLE_WIDTH_RATIO[dir]
            : mode === "walk"
              ? WALK_WIDTH_RATIO[this.heroName][dir]
              : 1;

        this.heroSprite.setScale(
          scale * widthRatio,
          scale
        );

        this.heroSprite.setOrigin(
          0.5,
          FOOT_Y[this.heroName][mode] / 160
        );

        this.heroSprite.play(key);
        this.currentAnimation = key;
      }
    }
  }

  try {
    window.BSPhaserGame = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: "phaser-root",
      width: WIDTH,
      height: HEIGHT,
      transparent: true,

      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },

      scene: [FieldScene],

      render: {
        pixelArt: false,
        antialias: true
      }
    });
  } catch (error) {
    console.error(
      "Phaser initialization failed:",
      error
    );
  }
})();
