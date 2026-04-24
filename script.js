(function () {
  const navToggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");

  if (navToggle && nav) {
    navToggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(open));
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
        history.push({ role: "user", content: text });
        history.push({ role: "assistant", content: pending.textContent });
        while (history.length > 14) history.shift();
      } catch (error) {
        pending.textContent = `Error: ${error.message}`;
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
