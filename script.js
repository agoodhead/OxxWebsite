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
      { threshold: 0.14 }
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

  document.querySelectorAll('a[href="https://agentm.oxx-ai.com/"]').forEach((link) => {
    link.addEventListener("click", () => {
      captureEvent("download_app_clicked", {
        page: window.location.pathname,
        label: link.textContent?.trim() || "Download App"
      });
    });
  });

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

    append("assistant", "Ask me about Oxx-AI features, use cases, platforms, downloads, or booking a demo.");

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
