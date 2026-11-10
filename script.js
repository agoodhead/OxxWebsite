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

  // Muted looping videos play while on screen, unless the visitor prefers
  // reduced motion. A video the visitor paused stays paused.
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll("[data-autoplay-video]").forEach((video) => {
    video.muted = true;
    if (reduceMotion) return;
    let started = false;
    let pausedOffScreen = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!started || pausedOffScreen) video.play().catch(() => {});
          started = true;
          pausedOffScreen = false;
        } else if (!video.paused) {
          pausedOffScreen = true;
          video.pause();
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(video);
  });

  // Review map on the homepage: React and React Flow load only when it is
  // about to scroll into view. review-graph.js holds the map itself.
  const reviewSlot = document.querySelector("[data-review-graph]");
  if (reviewSlot) {
    const VENDOR = "/assets/vendor/";
    const loadFile = (tag, attrs) =>
      new Promise((resolve, reject) => {
        const el = Object.assign(document.createElement(tag), attrs, { onload: resolve, onerror: reject });
        document.head.appendChild(el);
      });
    const loadScript = (src) => loadFile("script", { src });
    const loadStyle = (href) => loadFile("link", { rel: "stylesheet", href });

    const mountReviewGraph = () =>
      Promise.all([loadStyle(`${VENDOR}xyflow-react-12.12.0.css`), loadStyle("/review-graph.css")])
        .then(() => loadScript(`${VENDOR}react-18.3.1.production.min.js`))
        .then(() => loadScript(`${VENDOR}react-dom-18.3.1.production.min.js`))
        .then(() => loadScript("/review-graph.js"))
        .then(() => {
          window.ReactDOM.createRoot(reviewSlot).render(
            window.React.createElement(window.OxxFlow.ReviewGraph, { xyflowSrc: `${VENDOR}xyflow-react-12.12.0.umd.js` })
          );
        })
        .catch(() => {});

    const reviewObserver = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        reviewObserver.disconnect();
        mountReviewGraph();
      },
      { rootMargin: "600px 0px" }
    );
    reviewObserver.observe(reviewSlot);
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
