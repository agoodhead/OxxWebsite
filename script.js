(function () {
  const POSTHOG_PROJECT_API_KEY = "phc_REPLACE_WITH_PROJECT_KEY";
  const POSTHOG_API_HOST = "https://us.i.posthog.com";

  const initPosthog = () => {
    const apiKey = POSTHOG_PROJECT_API_KEY.trim();
    if (!apiKey || apiKey.includes("REPLACE_WITH_PROJECT_KEY")) return;

    (function (t, e) {
      let o;
      let n;
      let p;
      let r;
      if (e.__SV) return;
      window.posthog = e;
      e._i = e._i || [];
      e.init = function (i, s, a) {
        function g(target, fnName) {
          const parts = fnName.split(".");
          let context = target;
          let method = fnName;
          if (parts.length === 2) {
            context = target[parts[0]];
            method = parts[1];
          }
          context[method] = function () {
            context.push([method].concat(Array.prototype.slice.call(arguments, 0)));
          };
        }

        p = t.createElement("script");
        p.type = "text/javascript";
        p.async = true;
        p.src = s.api_host.replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js";
        r = t.getElementsByTagName("script")[0];
        r.parentNode.insertBefore(p, r);

        let u = e;
        if (a !== undefined) {
          u = e[a] = [];
        } else {
          a = "posthog";
        }

        u.people = u.people || [];
        u.toString = function (stub) {
          let out = "posthog";
          if (a !== "posthog") out += "." + a;
          if (!stub) out += " (stub)";
          return out;
        };
        u.people.toString = function () {
          return u.toString(1) + ".people (stub)";
        };

        o =
          "capture identify alias people.set people.set_once register register_once unregister reset opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing people.delete_user people.remove_user".split(
            " "
          );

        for (n = 0; n < o.length; n += 1) {
          g(u, o[n]);
        }
        e._i.push([i, s, a]);
      };
      e.__SV = 1;
    })(document, window.posthog || []);

    window.posthog.init(apiKey, {
      api_host: POSTHOG_API_HOST,
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: true,
      persistence: "localStorage+cookie"
    });
  };

  const captureEvent = (eventName, properties = {}) => {
    if (!window.posthog || typeof window.posthog.capture !== "function") return;
    window.posthog.capture(eventName, properties);
  };

  initPosthog();

  const navToggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");

  if (navToggle && nav) {
    navToggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(open));
      captureEvent("nav_menu_toggled", { is_open: open, page: window.location.pathname });
    });
    // A menu link jumps down the page, so close the phone menu behind it.
    nav.addEventListener("click", (event) => {
      if (!event.target.closest("a") || !nav.classList.contains("is-open")) return;
      nav.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  }

  // Overview: dotted lines from each capture type, meeting just before the
  // phone. They are drawn from where things sit, so they follow the layout
  // at every width: across when the parts are side by side, down when they
  // are stacked. Items then leave the graph as bubbles, each landing on the
  // report as its section appears in the video.
  const overview = document.querySelector("[data-overview]");
  if (overview) {
    const svg = overview.querySelector("[data-ov-lines]");
    const fx = overview.querySelector("[data-ov-fx]");
    const list = overview.querySelector(".ov-list");
    const phone = overview.querySelector("[data-ov-phone]");
    const reportCard = overview.querySelector(".ov-report");
    const reportVideo = overview.querySelector("[data-ov-video]");
    const items = [...overview.querySelectorAll("[data-ov-from]")];
    const SVG_NS = "http://www.w3.org/2000/svg";
    // On the phone picture, as fractions of its width (measured on the square
    // still it was cut from, so down is a fraction of the width too): where
    // the capture lines meet beside the phone, the record button the joined
    // line runs into, and the site graph panel's right and bottom edges.
    const JOIN = { x: 0.225, y: 0.28 };
    const BUTTON = { x: 0.39, y: 0.283 };
    const GRAPH = { right: 0.965, bottom: 0.943 };
    // Where a bubble lands on the report video: the middle of the page.
    const LANDING = { x: 0.5, y: 0.48 };

    // The Rooftop items on the graph (centre and size, as fractions of the
    // picture's width), which report lane each one rides, and the video time
    // (s) it lands at: just as its section lights up in the report.
    const BUBBLES = [
      { kind: "audio", label: "Audio", text: "Roof audio note", at: [0.618, 0.868], size: [0.093, 0.077], line: 2, land: 2.15 },
      { kind: "image", label: "Image", text: "Roof defect photo", at: [0.669, 0.694], size: [0.093, 0.076], line: 1, land: 4.45 },
      { kind: "video", label: "Video", text: "Roof inspection", at: [0.568, 0.694], size: [0.091, 0.076], line: 1, land: 6.75 },
      { kind: "high", label: "High importance", text: "Defect identified", at: [0.618, 0.607], size: [0.165, 0.062], line: 0, land: 9.05 },
      { kind: "medium", label: "Medium importance", text: "No defect", at: [0.618, 0.776], size: [0.165, 0.064], line: 2, land: 11.45 },
      { kind: "area", label: "Area", text: "Rooftop", at: [0.618, 0.530], size: [0.171, 0.047], line: 0, land: 13.65 },
    ];
    const LIFT = 0.4; // s: the bubble grows out of its card
    const FLY = 1.7; // s: along the line to the report
    const DROP = 0.35; // s: it settles into the page

    const r = (n) => Math.round(n * 10) / 10;
    const pt = (q) => `${r(q.x)} ${r(q.y)}`;
    // The cubic from a to b (without its M), leaving and arriving level when
    // across, upright when down.
    const leg = (a, b, across) => {
      if (across) {
        const dx = (b.x - a.x) / 2;
        return `C${pt({ x: a.x + dx, y: a.y })} ${pt({ x: b.x - dx, y: b.y })} ${pt(b)}`;
      }
      const dy = (b.y - a.y) / 2;
      return `C${pt({ x: a.x, y: a.y + dy })} ${pt({ x: b.x, y: b.y - dy })} ${pt(b)}`;
    };
    const curve = (a, b, across) => `M${pt(a)} ${leg(a, b, across)}`;

    // One empty slot and one bubble per item.
    BUBBLES.forEach((b) => {
      b.slot = document.createElement("span");
      b.slot.className = "ov-slot";
      b.el = document.createElement("span");
      b.el.className = `ov-bubble kind-${b.kind}`;
      b.el.innerHTML = `<b>${b.label}</b><span>${b.text}</span>`;
      fx.append(b.slot, b.el);
    });

    // Put every bubble and slot where the video's time says it is.
    const smooth = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const place = () => {
      const t = reportVideo.currentTime || 0;
      BUBBLES.forEach((b) => {
        if (!b.route) return;
        const ph = t - (b.land - FLY - LIFT);
        b.slot.classList.toggle("is-on", ph >= LIFT * 0.5);
        if (ph < 0 || ph > LIFT + FLY + DROP) {
          b.el.style.opacity = "0";
          return;
        }
        let q;
        let s;
        let o;
        if (ph < LIFT) {
          const e = smooth(ph / LIFT);
          q = b.node;
          s = b.w0 + (1 - b.w0) * e;
          o = Math.min(1, e * 3);
        } else if (ph < LIFT + FLY) {
          q = b.route.getPointAtLength(smooth((ph - LIFT) / FLY) * b.len);
          s = 1;
          o = 1;
        } else {
          const e = (ph - LIFT - FLY) / DROP;
          q = b.route.getPointAtLength(b.len);
          s = 1 - 0.45 * e;
          o = 1 - e;
        }
        b.el.style.opacity = String(o);
        b.el.style.transform = `translate(${r(q.x)}px, ${r(q.y)}px) translate(-50%, -50%) scale(${s.toFixed(3)})`;
      });
    };

    const drawLines = () => {
      const box = overview.getBoundingClientRect();
      if (!box.width) return;
      const at = (rect, fx, fy) => ({
        x: rect.left - box.left + rect.width * fx,
        y: rect.top - box.top + rect.height * fy,
      });
      const p = phone.getBoundingClientRect();
      const pic = (fx, fy) => ({ x: p.left - box.left + p.width * fx, y: p.top - box.top + p.width * fy });
      const v = reportVideo.getBoundingClientRect();
      const c = reportCard.getBoundingClientRect();
      const l = list.getBoundingClientRect();
      const paths = [];
      // The capture lines meet at one point just before the phone. Each
      // leaves its item level (or, stacked, from under the list), turns early
      // and runs in level with the others, so they join as one. A single
      // line then carries on into the phone's record button.
      const phoneBeside = p.left > l.right;
      // Stacked, they meet in the gap between the Inspect and Review cards
      // and a short line runs into the Review card, clear of its text.
      const inspectCard = list.closest(".ov-card").getBoundingClientRect();
      const reviewCard = phone.closest(".ov-card").getBoundingClientRect();
      const join = phoneBeside
        ? pic(JOIN.x, JOIN.y)
        : { x: l.left - box.left + l.width * 0.7, y: (inspectCard.bottom + reviewCard.top) / 2 - box.top };
      items.forEach((item, i) => {
        let d;
        if (phoneBeside) {
          const a = at(item.getBoundingClientRect(), 1, 0.5);
          const dx = join.x - a.x;
          d = `M${pt(a)} C${pt({ x: a.x + dx * 0.3, y: a.y })} ${pt({ x: join.x - dx * 0.6, y: join.y })} ${pt(join)}`;
        } else {
          const a = at(l, 0.5 + (0.4 * i) / Math.max(1, items.length - 1), 1);
          const dy = join.y - a.y;
          d = `M${pt(a)} C${pt({ x: a.x, y: a.y + dy * 0.3 })} ${pt({ x: join.x, y: join.y - dy * 0.6 })} ${pt(join)}`;
        }
        paths.push([d, `ov-line ov-line-${item.dataset.ovFrom}`]);
      });
      const end = phoneBeside ? pic(BUTTON.x, BUTTON.y) : { x: join.x, y: reviewCard.top - box.top + 2 };
      paths.push([curve(join, end, phoneBeside), "ov-line ov-line-join"]);

      // The bubbles' three lanes to the report (not drawn): across from the
      // graph's right edge to the video, or (stacked) down from under the
      // graph to the report card's top.
      const reportBeside = c.left > p.right;
      const landing = at(v, LANDING.x, LANDING.y);
      const lines = [0, 1, 2].map((i) => {
        if (reportBeside) return { a: pic(GRAPH.right, 0.56 + i * 0.13), b: at(v, 0, 0.3 + i * 0.2) };
        const a = pic(0.55 + i * 0.15, GRAPH.bottom);
        return { a, b: { x: a.x + (landing.x - a.x) * 0.35, y: c.top - box.top } };
      });

      // Each bubble's route: off its card to the line, along it, and into
      // the page. Drawn invisibly, to be measured.
      BUBBLES.forEach((bb) => {
        const node = pic(bb.at[0], bb.at[1]);
        const { a, b } = lines[bb.line];
        const hop = reportBeside
          ? `C${pt({ x: node.x, y: node.y - 40 })} ${pt({ x: a.x - 50, y: a.y })} ${pt(a)}`
          : `C${pt({ x: node.x + 30, y: node.y })} ${pt({ x: a.x, y: a.y - 40 })} ${pt(a)}`;
        const into = reportBeside
          ? `C${pt({ x: b.x + 40, y: b.y })} ${pt({ x: landing.x - 40, y: landing.y })} ${pt(landing)}`
          : `C${pt({ x: b.x, y: b.y + 40 })} ${pt({ x: landing.x, y: landing.y - 40 })} ${pt(landing)}`;
        paths.push([`M${pt(node)} ${hop} ${leg(a, b, reportBeside)} ${into}`, "ov-route"]);
        bb.node = node;
        bb.w0 = (p.width * bb.size[0]) / (bb.el.offsetWidth || 1);
        Object.assign(bb.slot.style, {
          left: `${r(p.left - box.left + p.width * (bb.at[0] - bb.size[0] / 2) - 1)}px`,
          top: `${r(p.top - box.top + p.width * (bb.at[1] - bb.size[1] / 2) - 1)}px`,
          width: `${r(p.width * bb.size[0] + 2)}px`,
          height: `${r(p.width * bb.size[1] + 2)}px`,
        });
      });

      svg.setAttribute("viewBox", `0 0 ${Math.round(box.width)} ${Math.round(box.height)}`);
      const els = paths.map(([d, cls]) => {
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", d);
        path.setAttribute("class", cls);
        return path;
      });
      // A dot marks where the capture lines join.
      const dot = document.createElementNS(SVG_NS, "circle");
      dot.setAttribute("cx", r(join.x));
      dot.setAttribute("cy", r(join.y));
      dot.setAttribute("r", "6");
      dot.setAttribute("class", "ov-join");
      svg.replaceChildren(...els, dot);
      els.slice(-BUBBLES.length).forEach((route, i) => {
        BUBBLES[i].route = route;
        BUBBLES[i].len = route.getTotalLength();
      });
      place();
    };

    drawLines();
    new ResizeObserver(drawLines).observe(overview);
    window.addEventListener("load", drawLines);
    if (document.fonts) document.fonts.ready.then(drawLines);

    // The report video loops while it is on screen, unless motion is reduced
    // (then its poster stays, and no bubbles fly). While it plays, the
    // bubbles follow its clock.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reportVideo && !reduceMotion && "IntersectionObserver" in window) {
      let frame = 0;
      const tick = () => {
        place();
        frame = reportVideo.paused ? 0 : requestAnimationFrame(tick);
      };
      reportVideo.addEventListener("play", () => {
        if (!frame) frame = requestAnimationFrame(tick);
      });
      reportVideo.addEventListener("seeked", place);
      new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) reportVideo.play().catch(() => {});
          else reportVideo.pause();
        });
      }, { threshold: 0.3 }).observe(reportVideo);
    }
  }

  // Reveal once a section's top edge is a tenth of the way up the screen.
  // A ratio threshold never fires on phones for sections taller than the
  // screen divided by that ratio, which left the workflow section blank.
  const revealNodes = document.querySelectorAll(".reveal");
  if (revealNodes.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0, rootMargin: "0px 0px -10% 0px" }
    );
    revealNodes.forEach((node) => observer.observe(node));
  }

  document.querySelectorAll(".faq-q").forEach((button) => {
    button.addEventListener("click", () => {
      const item = button.closest(".faq-item");
      const body = item?.querySelector(".faq-a");
      if (!body) return;
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!expanded));
      body.style.display = expanded ? "none" : "block";
      captureEvent("faq_item_toggled", {
        question: button.textContent?.trim() || "unknown",
        is_open: !expanded
      });
    });
  });

  document.querySelectorAll('a[href="https://report.oxx-ai.com/"]').forEach((link) => {
    link.addEventListener("click", () => {
      captureEvent("app_login_clicked", {
        page: window.location.pathname,
        label: link.textContent?.trim() || "Login and Test the App Now"
      });
    });
  });

  // Install prompt: once a visitor has been reading for a while and reaches
  // Pricing, offer the web app. The app is a PWA on report.oxx-ai.com, and a
  // browser only opens its install dialog on the app's own origin, so the
  // button hands over to the app with ?install=1.
  const INSTALL_PROMPT_MIN_READ_MS = 20000;
  const INSTALL_PROMPT_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
  const INSTALL_PROMPT_KEY = "oxx-install-prompt";
  const VISIT_START_KEY = "oxx-visit-start";

  const readStorage = (storage, key) => {
    try {
      return window[storage].getItem(key);
    } catch (_) {
      return null;
    }
  };

  const writeStorage = (storage, key, value) => {
    try {
      window[storage].setItem(key, value);
    } catch (_) {}
  };

  // Reading time counts from the first page of the visit, not just this one.
  const visitStart = (() => {
    const now = Date.now();
    const saved = Number(readStorage("sessionStorage", VISIT_START_KEY));
    if (saved > 0 && saved <= now) return saved;
    writeStorage("sessionStorage", VISIT_START_KEY, String(now));
    return now;
  })();

  const installPromptSnoozed = () => {
    const saved = readStorage("localStorage", INSTALL_PROMPT_KEY);
    if (saved === "accepted") return true;
    const dismissedAt = Number(saved);
    return dismissedAt > 0 && Date.now() - dismissedAt < INSTALL_PROMPT_SNOOZE_MS;
  };

  const installTrigger = document.querySelector("[data-install-trigger]");
  const installPrompt = document.querySelector("[data-install-prompt]");

  if (installTrigger && installPrompt && !installPromptSnoozed()) {
    const isIos =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
    const platform = isIos ? "ios" : "other";
    const hint = installPrompt.querySelector("[data-install-hint]");
    if (hint && isIos) {
      hint.textContent = "Opens the web app. Then tap Share and choose Add to Home Screen.";
    }

    let reachedPricing = false;
    let readLongEnough = false;
    let shown = false;

    const hideInstallPrompt = () => {
      installPrompt.hidden = true;
      document.removeEventListener("keydown", onInstallPromptKeydown);
    };

    const dismissInstallPrompt = () => {
      writeStorage("localStorage", INSTALL_PROMPT_KEY, String(Date.now()));
      hideInstallPrompt();
      captureEvent("install_prompt_dismissed", { page: window.location.pathname, platform });
    };

    function onInstallPromptKeydown(event) {
      if (event.key === "Escape") dismissInstallPrompt();
    }

    const maybeShowInstallPrompt = () => {
      if (shown || !reachedPricing || !readLongEnough) return;
      shown = true;
      installPrompt.hidden = false;
      document.addEventListener("keydown", onInstallPromptKeydown);
      captureEvent("install_prompt_shown", { page: window.location.pathname, platform });
    };

    window.setTimeout(() => {
      readLongEnough = true;
      maybeShowInstallPrompt();
    }, Math.max(0, INSTALL_PROMPT_MIN_READ_MS - (Date.now() - visitStart)));

    // Fires once the top of Pricing has scrolled a third of the way up the screen.
    const pricingObserver = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        reachedPricing = true;
        pricingObserver.disconnect();
        maybeShowInstallPrompt();
      },
      { rootMargin: "0px 0px -35% 0px" }
    );
    pricingObserver.observe(installTrigger);

    installPrompt.querySelector("[data-install-accept]")?.addEventListener("click", () => {
      writeStorage("localStorage", INSTALL_PROMPT_KEY, "accepted");
      hideInstallPrompt();
      captureEvent("install_prompt_accepted", { page: window.location.pathname, platform });
    });

    installPrompt.querySelector("[data-install-dismiss]")?.addEventListener("click", dismissInstallPrompt);
  }

  document.querySelectorAll("[data-workflow-showcase]").forEach((showcase) => {
    const video = showcase.querySelector("[data-workflow-video]");
    const webmSource = showcase.querySelector("[data-video-webm-source]");
    const mp4Source = showcase.querySelector("[data-video-mp4-source]");
    const audioToggle = showcase.querySelector("[data-audio-toggle]");
    const tiles = showcase.querySelectorAll(".workflow-tile");
    if (!video || !webmSource || !mp4Source || !tiles.length) return;
    let audioEnabled = false;

    const syncAudioUi = () => {
      if (!audioToggle) return;
      audioToggle.classList.toggle("is-on", audioEnabled);
      audioToggle.setAttribute("aria-pressed", String(audioEnabled));
      audioToggle.textContent = audioEnabled ? "Audio on" : "Turn on audio";
    };

    const activateTile = (tile) => {
      const webm = tile.dataset.videoWebm;
      const mp4 = tile.dataset.videoMp4;
      if (!webm || !mp4) return;

      tiles.forEach((item) => item.classList.toggle("is-active", item === tile));
      if (webmSource.getAttribute("src") === webm) {
        video.currentTime = 0;
        video.muted = !audioEnabled;
        video.play().catch(() => {});
        return;
      }

      webmSource.setAttribute("src", webm);
      mp4Source.setAttribute("src", mp4);
      video.muted = !audioEnabled;
      video.load();
      video.play().catch(() => {});
      captureEvent("workflow_tile_video_selected", {
        page: window.location.pathname,
        tile: tile.querySelector("strong")?.textContent?.trim() || "unknown"
      });
    };

    tiles.forEach((tile) => {
      tile.addEventListener("mouseenter", () => activateTile(tile));
      tile.addEventListener("focus", () => activateTile(tile));
      tile.addEventListener("click", () => activateTile(tile));
    });

    video.addEventListener("click", () => {
      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });

    if (audioToggle) {
      syncAudioUi();
      audioToggle.addEventListener("click", async () => {
        audioEnabled = !audioEnabled;
        video.muted = !audioEnabled;
        syncAudioUi();
        if (audioEnabled) {
          try {
            await video.play();
          } catch (_) {
            audioEnabled = false;
            video.muted = true;
            syncAudioUi();
          }
        }
        captureEvent("workflow_audio_toggled", {
          page: window.location.pathname,
          audio_enabled: audioEnabled
        });
      });
    }
  });

  document.querySelectorAll("[data-hover-video]").forEach((video) => {
    video.muted = false;

    const playVideo = () => {
      video.play().catch(() => {
        video.muted = true;
        video.play().catch(() => {});
      });
    };

    video.addEventListener("mouseenter", playVideo);
    video.addEventListener("focus", playVideo);
    video.addEventListener("click", () => {
      if (video.paused) {
        playVideo();
      } else {
        video.pause();
      }
    });
  });

  // The line down the side of each list (Inspect, Review) ends level with
  // the middle of the last callout under it, however the callouts wrap.
  document.querySelectorAll(".capture-outcomes").forEach((outcomes) => {
    const items = [...outcomes.querySelectorAll(".tile-callout")];
    if (!items.length) return;
    const placeLine = () => {
      const box = outcomes.getBoundingClientRect();
      const last = items[items.length - 1].getBoundingClientRect();
      outcomes.style.setProperty("--line-bottom", `${Math.round(box.bottom - (last.top + last.height / 2))}px`);
    };
    placeLine();
    new ResizeObserver(placeLine).observe(outcomes);
  });

  // Only one homepage section plays at a time. The Review map takes over when
  // it is in view (see below) and calls this to stop or restart Inspect.
  let setInspectActive = () => {};

  // Inspect tile, three parts:
  // - The capture list on the left is static.
  // - The video in the centre and the walkthrough on the right play
  //   together, with no controls. When the tile comes on screen both start
  //   from the beginning. They pause together when it goes off screen, while
  //   the mouse is on the capture list, or while the Review map plays, and
  //   carry on together from there. Each plays once, like a moving picture;
  //   once the video has ended, the next time the tile comes on screen both
  //   play again from the start. Before its first run the walkthrough rests
  //   on its finished, fully analysed picture (step classes set in the HTML).
  const inspect = document.querySelector("[data-inspect]");
  if (inspect) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Both play at SPEED times the pace they were made at: the video takes
    // about 29 seconds instead of 44, the walkthrough about 22 instead of 33.
    const SPEED = 1.5;

    const video = inspect.querySelector("[data-inspect-video]");
    const demo = inspect.querySelector("[data-capture-demo]");
    let onScreen = false;
    let held = false;
    let blocked = false; // the Review map is playing
    let together = false; // a run of both is under way
    // The walkthrough's controls, set below when it can animate.
    let startDemo = () => {};
    let resumeDemo = () => {};
    let freezeDemo = () => {};

    const play = () => {
      if (!onScreen || held || blocked) return;
      if (!together) {
        together = true;
        video.currentTime = 0;
        startDemo();
      } else {
        resumeDemo();
      }
      if (!video.ended) video.play().catch(() => {});
    };
    const pause = () => {
      video.pause();
      freezeDemo();
    };

    video.muted = true;
    video.defaultPlaybackRate = SPEED;
    video.playbackRate = SPEED;
    if (reduceMotion) {
      video.controls = true;
    } else {
      // On screen while at least a quarter of either tile shows: on a phone
      // they are stacked.
      const showing = new Map();
      const watch = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => showing.set(entry.target, entry.isIntersecting));
          const now = [...showing.values()].some(Boolean);
          if (now === onScreen) return;
          onScreen = now;
          if (!onScreen) {
            pause();
            return;
          }
          if (video.ended) together = false;
          play();
        },
        { threshold: 0.25 }
      );
      watch.observe(video);
      if (demo) watch.observe(demo);
    }

    // The mouse on the capture list holds both where they are. Only a mouse:
    // a finger "leaves" as soon as it lifts.
    const list = inspect.querySelector(".capture-panel");
    list.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "mouse") return;
      held = true;
      pause();
    });
    list.addEventListener("pointerleave", (event) => {
      if (event.pointerType !== "mouse") return;
      held = false;
      play();
    });

    if (demo && !reduceMotion) {
      const scene = demo.querySelector("[data-demo-scene]");
      const voice = demo.querySelector("[data-demo-voice]");
      const typed = demo.querySelector("[data-demo-typed]");
      const map = demo.querySelector("[data-demo-map]");
      const route = map.querySelector(".map-route");
      const pt = (id) => map.querySelector(`[data-map-pt="${id}"]`);
      const conv = demo.querySelector("[data-demo-conv]");
      // Draw the red route up to a fraction of its length over ms.
      const drawTo = (fraction, ms) => () => {
        route.style.transitionDuration = `${ms}ms`;
        route.style.strokeDashoffset = String(1 - fraction);
      };
      const TRANSCRIPT = typed.textContent;

      // Each step: [ms from the start, element, class to add] or [ms, function].
      const STEPS = [
        // Image: the icon opens into the photo, which is analysed.
        [300, scene, "is-pop"],
        [800, scene, "is-open"],
        [1900, scene, "is-thinking"],
        [3000, scene, "is-f1"],
        [4500, scene, "is-f2"],
        [6200, scene, "is-done"],
        // Voice: flip, the photo drops into the corner, the waveform moves
        // and the transcript types out, then becomes the photo's caption.
        [7600, demo, "is-flipped"],
        [8500, voice, "is-pop"],
        [8500, voice, "is-in"],
        [8800, voice, "is-rec"],
        [9100, voice, "is-typing"],
      ];
      const TYPE_FROM = 9200;
      const PER_CHAR = 45;
      for (let i = 1; i <= TRANSCRIPT.length; i += 1) {
        STEPS.push([TYPE_FROM + i * PER_CHAR, () => { typed.textContent = TRANSCRIPT.slice(0, i); }]);
      }
      const typedAt = TYPE_FROM + TRANSCRIPT.length * PER_CHAR;
      STEPS.push(
        [typedAt + 300, () => voice.classList.remove("is-typing")],
        [typedAt + 400, voice, "is-captioned"],
        [typedAt + 900, voice, "is-heard"]
      );

      // Site Mapping, on the front again. Its layer goes in while the back
      // is showing. The route stops at four points (fractions of its length):
      // a photo, the voice note, a video being taken and, at the end, a
      // conversation.
      const M0 = typedAt + 2400;
      STEPS.push(
        [9000, demo, "show-map"],
        [M0, demo, "is-flip-2"],
        [M0 + 900, map, "is-pop"],
        [M0 + 1200, drawTo(0.144, 700)],
        [M0 + 1900, pt("a"), "is-pop"],
        [M0 + 2300, pt("a"), "is-open"],
        [M0 + 3100, pt("a"), "is-pinned"],
        [M0 + 3400, drawTo(0.386, 1300)],
        [M0 + 4700, pt("b"), "is-pop"],
        [M0 + 5300, pt("b"), "is-pinned"],
        [M0 + 5600, drawTo(0.726, 1500)],
        [M0 + 7100, pt("v"), "is-pop"],
        [M0 + 7500, pt("v"), "is-open"],
        [M0 + 8900, pt("v"), "is-pinned"],
        [M0 + 9200, drawTo(1, 1500)],
        [M0 + 10700, pt("t"), "is-pop"],
        [M0 + 11500, pt("t"), "is-pinned"]
      );

      // Conversation, on the back again.
      const C0 = M0 + 12800;
      STEPS.push(
        [M0 + 1500, demo, "show-conv"],
        [C0, demo, "is-flip-3"],
        [C0 + 900, conv, "is-pop"],
        [C0 + 1000, conv, "is-rec"],
        [C0 + 2600, conv, "is-split"],
        [C0 + 3300, conv, "is-l1"],
        [C0 + 3550, conv, "is-l2"],
        [C0 + 3800, conv, "is-l3"],
        [C0 + 5600, conv, "is-heard"]
      );
      STEPS.sort((x, y) => x[0] - y[0]);

      // At SPEED the gaps between steps shrink, and every transition and
      // animation in the tile runs faster to match, so nothing overlaps.
      STEPS.forEach((step) => { step[0] /= SPEED; });
      const END_MS = (C0 + 6500) / SPEED; // after the last step's transitions

      // Transitions and animations under way in the tile: the flips, the
      // waveforms, the route, the pins, the dots and the caret.
      const moving = () => demo.getAnimations({ subtree: true });
      const apply = ([, target, cls]) => {
        if (typeof target === "function") target();
        else target.classList.add(cls);
        moving().forEach((a) => { a.playbackRate = SPEED; });
      };

      let timers = [];
      let next = 0; // index of the next step to apply
      let elapsed = 0; // time into the walkthrough when it last stopped
      let startedAt = 0;
      let running = false;
      let finished = true;

      const schedule = () => {
        startedAt = performance.now() - elapsed;
        timers = STEPS.slice(next).map((step) =>
          setTimeout(() => {
            apply(step);
            next += 1;
          }, Math.max(0, step[0] - elapsed))
        );
        timers.push(
          setTimeout(() => {
            running = false;
            finished = true;
          }, Math.max(0, END_MS - elapsed))
        );
      };

      // Back to the closed Image icon on the front, with no transitions.
      const reset = () => {
        demo.classList.add("no-anim");
        STEPS.forEach(([, target, cls]) => {
          if (typeof target !== "function") target.classList.remove(cls);
        });
        voice.classList.remove("is-typing", "is-captioned");
        typed.textContent = "";
        route.style.transitionDuration = "";
        route.style.strokeDashoffset = "";
        void demo.offsetWidth;
        demo.classList.remove("no-anim");
      };

      const start = () => {
        if (running || blocked) return;
        if (finished) {
          reset();
          next = 0;
          elapsed = 0;
          finished = false;
        }
        moving().forEach((a) => {
          a.playbackRate = SPEED;
          a.play();
        });
        running = true;
        schedule();
      };

      const freeze = () => {
        if (!running) return;
        timers.forEach(clearTimeout);
        timers = [];
        elapsed = performance.now() - startedAt;
        moving().forEach((a) => a.pause());
        running = false;
      };

      // A new run starts from the icon; a paused run carries on from where
      // it stopped, and a finished one stays on its last picture.
      startDemo = start;
      resumeDemo = () => {
        if (!finished) start();
      };
      freezeDemo = freeze;
    }

    setInspectActive = (active) => {
      blocked = !active;
      if (blocked) pause();
      else play();
    };
  }

  // Review map on the homepage: React and React Flow load only when it is
  // about to scroll into view, and the map shows empty. It plays while more
  // than half of it is on screen, and Inspect stops meanwhile; scrolled away,
  // the map holds where it is and Inspect plays again. review-graph.js holds
  // the map.
  // The review map and the Report section's graph share these files, and each
  // loads once whichever asks first: a second copy of React would break both.
  const VENDOR = "/assets/vendor/";
  const loadedFiles = {};
  const loadFile = (tag, attrs) => {
    const key = attrs.src || attrs.href;
    if (!loadedFiles[key]) {
      loadedFiles[key] = new Promise((resolve, reject) => {
        const el = Object.assign(document.createElement(tag), attrs, { onload: resolve, onerror: reject });
        document.head.appendChild(el);
      });
    }
    return loadedFiles[key];
  };
  const loadScript = (src) => loadFile("script", { src });
  const loadStyle = (href) => loadFile("link", { rel: "stylesheet", href });
  const loadFlowGraphs = () =>
    Promise.all([loadStyle(`${VENDOR}xyflow-react-12.12.0.css`), loadStyle("/review-graph.css")])
      .then(() => loadScript(`${VENDOR}react-18.3.1.production.min.js`))
      .then(() => loadScript(`${VENDOR}react-dom-18.3.1.production.min.js`))
      .then(() => loadScript("/review-graph.js"));

  const reviewSlot = document.querySelector("[data-review-graph]");
  if (reviewSlot) {
    let root = null;
    let active = false;
    const renderMap = () => {
      if (!root) return;
      root.render(
        window.React.createElement(window.OxxFlow.ReviewGraph, {
          xyflowSrc: `${VENDOR}xyflow-react-12.12.0.umd.js`,
          active,
        })
      );
    };

    const mountReviewGraph = () =>
      loadFlowGraphs()
        .then(() => {
          root = window.ReactDOM.createRoot(reviewSlot);
          renderMap();
        })
        .catch(() => {});

    const loadObserver = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        loadObserver.disconnect();
        mountReviewGraph();
      },
      { rootMargin: "600px 0px" }
    );
    loadObserver.observe(reviewSlot);

    // "More than half on screen", measured against the screen too, so a map
    // taller than a short screen still counts.
    new IntersectionObserver(
      ([entry]) => {
        const shown = entry.intersectionRect.height;
        const needed = Math.min(entry.boundingClientRect.height, window.innerHeight) * 0.55;
        const nowActive = entry.isIntersecting && shown >= needed;
        if (nowActive === active) return;
        active = nowActive;
        setInspectActive(!active);
        renderMap();
      },
      { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.55, 0.6, 0.7, 0.8, 0.9, 1] }
    ).observe(reviewSlot);
  }

  // Report on the homepage: the reviewed graph's items move one at a time into
  // the draft report. Loads like the review map, and plays while about half
  // of it is on screen. review-graph.js draws it.
  const reportSlot = document.querySelector("[data-report-graph]");
  if (reportSlot) {
    let root = null;
    let active = false;
    const renderReport = () => {
      if (!root) return;
      root.render(
        window.React.createElement(window.OxxFlow.ReportGraph, {
          xyflowSrc: `${VENDOR}xyflow-react-12.12.0.umd.js`,
          active,
        })
      );
    };

    const loadObserver = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        loadObserver.disconnect();
        loadFlowGraphs()
          .then(() => {
            root = window.ReactDOM.createRoot(reportSlot);
            renderReport();
          })
          .catch(() => {});
      },
      { rootMargin: "600px 0px" }
    );
    loadObserver.observe(reportSlot);

    new IntersectionObserver(
      ([entry]) => {
        const shown = entry.intersectionRect.height;
        const needed = Math.min(entry.boundingClientRect.height, window.innerHeight) * 0.45;
        const nowActive = entry.isIntersecting && shown >= needed;
        if (nowActive === active) return;
        active = nowActive;
        renderReport();
      },
      { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8, 0.9, 1] }
    ).observe(reportSlot);
  }

  const chatWidgets = document.querySelectorAll("[data-chat-widget]");
  chatWidgets.forEach((widget) => {
    const messagesRoot = widget.querySelector("[data-chat-messages]");
    const form = widget.querySelector("[data-chat-form]");
    const input = widget.querySelector("[data-chat-input]");
    const history = [];

    if (!messagesRoot || !form || !input) return;

    const append = (role, text) => {
      const row = document.createElement("div");
      row.className = `chat-msg ${role}`;
      row.textContent = text;
      messagesRoot.appendChild(row);
      messagesRoot.scrollTop = messagesRoot.scrollHeight;
      return row;
    };

    append("assistant", "Documentation covers Oxx Report workflow stages, review requirements, platform access, ROI, and demo booking.");

    const endpoint =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? "/api/chat"
        : "/.netlify/functions/chat";

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      captureEvent("chat_message_submitted", {
        page: window.location.pathname,
        chars: text.length
      });

      input.value = "";
      append("user", text);
      const pending = append("assistant", "Working...");

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, history })
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Request failed");
        }
        pending.textContent = payload.reply || "No response generated.";
        captureEvent("chat_message_replied", {
          page: window.location.pathname,
          chars: pending.textContent.length
        });
        history.push({ role: "user", content: text });
        history.push({ role: "assistant", content: pending.textContent });
        while (history.length > 14) history.shift();
      } catch (error) {
        pending.textContent = `Error: ${error.message}`;
        captureEvent("chat_message_error", {
          page: window.location.pathname,
          error: error.message || "unknown"
        });
      }
    });
  });

  const footer = document.querySelector(".site-footer");
  const dockedChats = document.querySelectorAll(".chat-docked");
  const dockedMedia = window.matchMedia("(min-width: 1240px)");

  const updateDockedChatOffset = () => {
    if (!footer || !dockedChats.length || !dockedMedia.matches) {
      dockedChats.forEach((chat) => {
        chat.style.transform = "";
      });
      return;
    }

    const footerTop = footer.getBoundingClientRect().top;
    dockedChats.forEach((chat) => {
      const chatRect = chat.getBoundingClientRect();
      const overlap = chatRect.bottom + 10 - footerTop;
      if (overlap > 0) {
        chat.style.transform = `translateY(-${Math.ceil(overlap)}px)`;
      } else {
        chat.style.transform = "translateY(0)";
      }
    });
  };

  let ticking = false;
  const requestDockedChatUpdate = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      updateDockedChatOffset();
      ticking = false;
    });
  };

  window.addEventListener("scroll", requestDockedChatUpdate, { passive: true });
  window.addEventListener("resize", requestDockedChatUpdate);
  updateDockedChatOffset();
})();
