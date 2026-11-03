
"use strict";
// BLACK SERIES RPG — Mobile UI Ver.0.5.1
// Joystick / four-character switching / leader-specific speed.
(function () {
  const stick = document.getElementById("joystick");
  const knob = document.getElementById("stickKnob");
  const menu = document.getElementById("utilityMenu");
  const selector = document.getElementById("characterSelect");

  let activeId = null;
  let vector = { dx: 0, dy: 0 };
  let frame = null;
  let lastTime = 0;

  const SPEED_X = 16;
  const SPEED_Y = 28;

  const DEFAULT_SPEED = {
    kingmaker: 1.25,
    leviathan: 0.90,
    lucifer: 1.00,
    lilith: 1.00,
    goliath: 1.00
  };

  function currentLeader() {
    if (typeof window.BSGetLeaderName === "function") {
      return window.BSGetLeaderName();
    }
    return selector?.value || "kingmaker";
  }

  function currentSpeed() {
    if (typeof window.BSGetLeaderSpeed === "function") {
      return window.BSGetLeaderSpeed();
    }
    return DEFAULT_SPEED[currentLeader()] || 1;
  }

  function stop() {
    activeId = null;
    vector = { dx: 0, dy: 0 };
    lastTime = 0;

    knob.style.left = "50%";
    knob.style.top = "50%";

    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }

    if (window.BSPhaserStep) {
      window.BSPhaserStep(false);
    }
  }

  function update(e) {
    const r = stick.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const limit = r.width * .29;
    const length = Math.hypot(dx, dy);
    const ratio = length ? Math.min(1, limit / length) : 0;

    knob.style.left = `calc(50% + ${dx * ratio}px)`;
    knob.style.top = `calc(50% + ${dy * ratio}px)`;

    vector = length > limit * .24
      ? { dx: dx / length, dy: dy / length }
      : { dx: 0, dy: 0 };
  }

  function tick(now) {
    if (activeId === null) {
      frame = null;
      return;
    }

    const dt = lastTime
      ? Math.min((now - lastTime) / 1000, .05)
      : 0;

    lastTime = now;

    if (
      (vector.dx || vector.dy) &&
      !fighting &&
      dialog.style.display !== "block"
    ) {
      const speed = currentSpeed();

      const moved = BSTryMove(
        vector.dx * SPEED_X * dt * speed,
        vector.dy * SPEED_Y * dt * speed
      );

      if (Math.abs(vector.dx) >= Math.abs(vector.dy)) {
        facing = vector.dx < 0 ? "left" : "right";
      } else {
        facing = vector.dy < 0 ? "back" : "front";
      }

      place();

      if (window.BSPhaserStep) {
        window.BSPhaserStep(!!moved);
      }
    } else if (window.BSPhaserStep) {
      window.BSPhaserStep(false);
    }

    frame = requestAnimationFrame(tick);
  }

  stick.addEventListener("pointerdown", e => {
    if (activeId !== null || fighting) return;

    activeId = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    update(e);

    lastTime = 0;
    frame = requestAnimationFrame(tick);
    e.preventDefault();
  });

  stick.addEventListener("pointermove", e => {
    if (e.pointerId === activeId) {
      update(e);
      e.preventDefault();
    }
  });

  for (const ev of [
    "pointerup",
    "pointercancel",
    "lostpointercapture"
  ]) {
    stick.addEventListener(ev, e => {
      if (e.pointerId === activeId) stop();
    });
  }

  window.addEventListener("blur", stop);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
  });

  window.toggleUtilityMenu = () => {
    menu.classList.toggle("open");
  };

  window.switchCharacter = () => {
    const current = currentLeader();
    const order = [
      "kingmaker",
      "lucifer",
      "lilith",
      "goliath"
    ];

    const index = order.indexOf(current);
    const next = order[(index + 1) % order.length];

    if (
      typeof window.BSSetExplorationCharacter === "function"
    ) {
      const changed = window.BSSetExplorationCharacter(next);

      if (changed) {
        if (selector) selector.value = next;

        const hud = document.getElementById("hudName");
        if (hud) hud.textContent = next.toUpperCase();
      }
    }
  };

  selector?.addEventListener("change", e => {
    const next = e.target.value;

    if (
      typeof window.BSSetExplorationCharacter === "function"
    ) {
      const changed = window.BSSetExplorationCharacter(next);

      if (changed) {
        const hud = document.getElementById("hudName");
        if (hud) hud.textContent = next.toUpperCase();
      }
    }
  });

  const observer = new MutationObserver(() => {
    if (document.body.classList.contains("in-battle")) {
      stop();
    }
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"]
  });
})();
