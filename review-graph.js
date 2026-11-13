// Review graph: a live React Flow map that continues the Inspect video's site
// visit into review. A scripted cycle builds the evidence tree, draws thinking
// links, raises hypotheses, reaches a conclusion and proposes actions. Then a
// "Professional review" pointer, standing in for the engineer, clicks the tick
// or cross on each hypothesis and action. Any touch pauses the script. After
// IDLE_MS without input the pointer drags moved nodes home one at a time and
// clicks the script's choices back in, then the script carries on. At the end
// of the cycle the map clears and redraws.
//
// Two cards carry pictures from the Inspect walkthrough: "Site visit" has the
// site map and the roof photo card has the analysed photo. Clicking one pops
// the picture up over the graph and holds the script. A click off it, Escape
// or the close button closes it, and so does leaving it for a while (it stays
// while the mouse is on it); then the script carries on where it was.
//
// Exposes window.OxxFlow.ReviewGraph. It uses the page's React 18 and loads
// the @xyflow/react UMD build from its `xyflowSrc` prop on first render, unless
// window.ReactFlow is already there. The `active` prop (default true) says
// whether it may play: with `active: false` before it has started it shows an
// empty map and waits; once started, `active: false` holds it exactly where it
// is and `active: true` carries on from there. The
// homepage mounts it from script.js.
(function () {
  "use strict";
  var React, RF, h; // set by init() once React Flow is loaded
  var IDLE_MS = 4000;
  var VIEW_MS = 6000; // an open picture closes after this, if left alone
  var VIEW_LEFT_MS = 3000; // ...or this long after the mouse leaves it
  // On touch screens a drag on the map scrolls the page instead of moving nodes.
  var TOUCH = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Pictures from the Inspect walkthrough, as it leaves them.
  var VIEWS = {
    map: {
      src: "/assets/review-site-map.webp",
      title: "Site map",
      what: "the site map",
      alt: "Aerial view of the building site with the route walked on the site visit drawn in red and a pin where each capture was made"
    },
    photo: {
      src: "/assets/review-site-photo.webp",
      title: "Roof defect photo",
      what: "the photo",
      alt: "Building site photo, analysed: rebar exposed for further construction, and a handrail built that needs a compliance check"
    }
  };

  // ---- Example case, continuing the site visit from the Inspect video ----
  // A wide window (the homepage's two thirds) gets wider columns so the graph
  // fills it; a tall or square one (phones) keeps them close so text stays big.
  var WIDE = (function () {
    var slot = document.querySelector("[data-review-graph]");
    if (!slot) return false;
    var r = slot.getBoundingClientRect();
    return r.height > 0 && r.width / r.height > 1.15;
  })();
  var COL = WIDE ? [0, 250, 500, 750] : [0, 170, 340, 510];
  var BOUNDS = { x: -14, y: -10, width: COL[3] + 150 + 28, height: 716 };
  // Where the pointer comes in and leaves.
  var ENTRY = { x: BOUNDS.x + BOUNDS.width - 40, y: BOUNDS.y + 40 };
  var EXIT = { x: BOUNDS.x + BOUNDS.width - 40, y: BOUNDS.y + BOUNDS.height - 60 };

  var AREAS = [
    { id: "court", label: "Courtyard", tone: "green", col: 0, level: "High", defect: "Defect" },
    { id: "base", label: "Basement", tone: "blue", col: 1, level: "Low", defect: "No defect" },
    { id: "roof", label: "Rooftop", tone: "yellow", col: 2, level: "High", defect: "Defect" },
    { id: "hist", label: "Historic Report", tone: "purple", col: 3, level: "Medium", defect: "No defect" }
  ];

  var EVIDENCE = [
    { id: "ev-court-video", area: "court", kind: "video", priority: "high", caption: "Courtyard defect", slot: 0, of: 2 },
    { id: "ev-court-report", area: "court", kind: "report", priority: "high", caption: "Courtyard report", slot: 1, of: 2 },
    { id: "ev-base-image", area: "base", kind: "image", priority: "low", caption: "Basement photo", slot: 0, of: 1 },
    { id: "ev-roof-video", area: "roof", kind: "video", priority: "high", caption: "Roof inspection", slot: 0, of: 2 },
    { id: "ev-roof-image", area: "roof", kind: "image", priority: "high", caption: "Roof defect photo", slot: 1, of: 2, view: VIEWS.photo },
    { id: "ev-hist-report", area: "hist", kind: "report", priority: "med", caption: "Historic record", slot: 0, of: 1 }
  ];

  // Thinking links between related pieces of evidence.
  var LINKS = [
    { source: "ev-court-report", target: "ev-court-video" },
    { source: "ev-roof-video", target: "ev-roof-image" },
    { source: "ev-hist-report", target: "ev-roof-image" },
    { source: "ev-base-image", target: "ev-roof-video" }
  ];

  var HYPOTHESES = [
    { id: "hy-settle", col: 0, text: "The courtyard slab is settling", finding: "the courtyard slab is settling", from: ["ev-court-video"], verdict: "rejected" },
    { id: "hy-thermal", col: 1, text: "Thermal movement is cracking the courtyard slab", finding: "the courtyard crack is thermal movement", from: ["ev-court-video", "ev-court-report"], verdict: "accepted" },
    { id: "hy-damp", col: 2, text: "Damp is rising into the basement", finding: "damp is rising into the basement", from: ["ev-base-image"], verdict: "rejected" },
    { id: "hy-roof", col: 3, text: "The roof membrane has failed at the outlet", finding: "water is getting in through a failed roof membrane", from: ["ev-roof-video", "ev-roof-image", "ev-hist-report"], verdict: "accepted" }
  ];

  var ACTIONS = [
    { id: "ac-underpin", col: 0, text: "Underpin the courtyard slab", hyp: "hy-settle" },
    { id: "ac-joint", col: 1, text: "Seal the crack and add a movement joint", hyp: "hy-thermal" },
    { id: "ac-dpc", col: 2, text: "Damp-proof the basement walls", hyp: "hy-damp" },
    { id: "ac-membrane", col: 3, text: "Repair the roof membrane and outlet", hyp: "hy-roof" }
  ];

  // Where every node belongs. Tidying moves nodes back here. The rows from
  // the hypotheses down sit lower to clear the photo card's thumbnail.
  var ROOT_W = 156;
  // The Report section's graph uses the same layout with its own columns.
  function makeLayout(cols) {
    var mid = (cols[3] + 150) / 2;
    var at = { root: { x: mid - ROOT_W / 2, y: 0 }, con: { x: mid - 165, y: 504 } };
    AREAS.forEach(function (a) {
      at["ar-" + a.id] = { x: cols[a.col], y: 66 };
      at["im-" + a.id] = { x: cols[a.col], y: 134 };
    });
    EVIDENCE.forEach(function (e) {
      var col = cols[AREAS.filter(function (a) { return a.id === e.area; })[0].col];
      // 84px wide: a pair overhangs its 150px column by 12px each side.
      at[e.id] = { x: e.of === 2 ? col + (e.slot ? 78 : -12) : col + 33, y: 222 };
    });
    HYPOTHESES.forEach(function (hy) { at[hy.id] = { x: cols[hy.col], y: 378 }; });
    ACTIONS.forEach(function (ac) { at[ac.id] = { x: cols[ac.col], y: 610 }; });
    return at;
  }
  var LAYOUT = makeLayout(COL);

  // Tidying walks the map top to bottom, left to right.
  var ORDER = Object.keys(LAYOUT).sort(function (a, b) {
    return LAYOUT[a].y - LAYOUT[b].y || LAYOUT[a].x - LAYOUT[b].x;
  });

  var STATUS = {
    hyp: { neutral: "pending", yes: "accepted", no: "rejected" },
    act: { neutral: "proposed", yes: "selected", no: "dropped" }
  };

  // ---- Small pieces ----
  function handles() {
    var P = RF.Position;
    return [
      h(RF.Handle, { key: "t", type: "target", position: P.Top, id: "t", isConnectable: false, className: "oxx-handle" }),
      h(RF.Handle, { key: "s", type: "source", position: P.Bottom, id: "s", isConnectable: false, className: "oxx-handle" }),
      h(RF.Handle, { key: "tb", type: "target", position: P.Bottom, id: "tb", isConnectable: false, className: "oxx-handle" })
    ];
  }

  function cls(base, d) {
    return "oxx-n " + base + (d && d.editing ? " is-editing" : "");
  }

  function svg(children, size) {
    return h("svg", { width: size || 14, height: size || 14, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true" }, children);
  }

  var ICONS = {
    video: function () { return svg([h("rect", { key: 1, x: 1.5, y: 2.5, width: 13, height: 11, rx: 2, stroke: "currentColor", strokeWidth: 1.4 }), h("path", { key: 2, d: "M6.5 5.5 L10.5 8 L6.5 10.5 Z", fill: "currentColor" })]); },
    report: function () { return svg([h("rect", { key: 1, x: 2.5, y: 1.5, width: 11, height: 13, rx: 1.6, stroke: "currentColor", strokeWidth: 1.4 }), h("path", { key: 2, d: "M5 5.5 H11 M5 8 H11 M5 10.5 H9", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round" })]); },
    image: function () { return svg([h("rect", { key: 1, x: 1.5, y: 2.5, width: 13, height: 11, rx: 2, stroke: "currentColor", strokeWidth: 1.4 }), h("circle", { key: 2, cx: 5.5, cy: 6, r: 1.3, fill: "currentColor" }), h("path", { key: 3, d: "M3 12 L7 8.5 L9.5 10.5 L11.5 9 L13.5 11", stroke: "currentColor", strokeWidth: 1.3, strokeLinejoin: "round" })]); },
    zoom: function () { return svg(h("path", { d: "M9.5 2.5 H13.5 V6.5 M13.5 2.5 L9.5 6.5 M6.5 13.5 H2.5 V9.5 M2.5 13.5 L6.5 9.5", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" }), 9); },
    tick: function () { return svg(h("path", { d: "M3.5 8.5 L6.5 11.5 L12.5 4.5", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }), 12); },
    cross: function () { return svg(h("path", { d: "M4 4 L12 12 M12 4 L4 12", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" }), 12); }
  };

  var LEVEL_CLASS = { High: "high", Low: "low", Medium: "medium" };

  // A picture's thumbnail, with a small expand mark to say it opens.
  function thumb(view) {
    return h("span", { className: "oxx-thumb" },
      h("img", { src: view.src, alt: "", width: 1000, height: 1000, draggable: false, decoding: "async" }),
      h("span", { className: "oxx-thumb-zoom", "aria-hidden": "true" }, ICONS.zoom()));
  }

  function RootNode(props) {
    var v = props.data.view;
    return h("div", { className: cls("oxx-root" + (v ? " has-view" : ""), props.data) }, handles(),
      v ? thumb(v) : null,
      h("span", null, "Site visit"));
  }

  function AreaNode(props) {
    var d = props.data;
    return h("div", { className: cls("oxx-area tone-" + d.tone, d) }, handles(),
      h("span", { className: "oxx-kicker" }, "Area"),
      h("span", { className: "oxx-area-name" }, d.label));
  }

  function ImportanceNode(props) {
    var d = props.data;
    return h("div", { className: cls("oxx-imp level-" + LEVEL_CLASS[d.level], d) }, handles(),
      h("span", { className: "oxx-imp-level" }, d.level + " importance"),
      h("span", { className: "oxx-imp-defect" }, d.defect));
  }

  function EvidenceNode(props) {
    var d = props.data;
    if (d.view) {
      return h("div", { className: cls("oxx-ev has-view kind-" + d.kind, d) }, handles(),
        h("span", { className: "oxx-ev-top" },
          h("span", { className: "oxx-ev-kind" }, d.kind),
          h("span", { className: "oxx-pill prio-" + d.priority }, d.priority)),
        thumb(d.view),
        h("span", { className: "oxx-ev-caption" }, d.caption));
    }
    return h("div", { className: cls("oxx-ev kind-" + d.kind, d) }, handles(),
      h("span", { className: "oxx-ev-kind" }, d.kind),
      h("span", { className: "oxx-ev-row" }, ICONS[d.kind](), h("span", { className: "oxx-pill prio-" + d.priority }, d.priority)),
      h("span", { className: "oxx-ev-caption" }, d.caption));
  }

  // d.pressing is "yes" or "no" while the pointer holds that button down.
  function decisionButtons(d, yes, no) {
    var s = STATUS[d.kind];
    function state(which, status) {
      return (d.status === status ? " is-on" : "") + (d.pressing === which ? " is-pressing" : "");
    }
    return h("span", { className: "oxx-buttons" },
      h("button", { type: "button", className: "nodrag oxx-btn oxx-btn-yes" + state("yes", s.yes), "aria-label": yes + ": " + d.text, "aria-pressed": d.status === s.yes, title: yes, onClick: function () { d.decide(d.id, s.yes); } }, ICONS.tick()),
      h("button", { type: "button", className: "nodrag oxx-btn oxx-btn-no" + state("no", s.no), "aria-label": no + ": " + d.text, "aria-pressed": d.status === s.no, title: no, onClick: function () { d.decide(d.id, s.no); } }, ICONS.cross()));
  }

  var BADGES = { accepted: "Accepted", rejected: "Rejected", selected: "Selected", dropped: "Not needed" };

  function HypothesisNode(props) {
    var d = props.data;
    return h("div", { className: cls("oxx-hyp status-" + d.status, d) }, handles(),
      h("span", { className: "oxx-card-top" }, h("span", { className: "oxx-kicker" }, "Hypothesis"), BADGES[d.status] ? h("span", { className: "oxx-badge" }, BADGES[d.status]) : null),
      h("span", { className: "oxx-card-text" }, d.text),
      decisionButtons(d, "Accept", "Reject"));
  }

  function ConclusionNode(props) {
    var d = props.data;
    return h("div", { className: cls("oxx-con" + (d.final ? " is-final" : ""), d) }, handles(),
      h("span", { className: "oxx-kicker" }, "Conclusion"),
      h("span", { className: "oxx-card-text" }, d.text));
  }

  function ActionNode(props) {
    var d = props.data;
    return h("div", { className: cls("oxx-act status-" + d.status, d) }, handles(),
      h("span", { className: "oxx-card-top" }, h("span", { className: "oxx-kicker" }, "Action"), BADGES[d.status] ? h("span", { className: "oxx-badge" }, BADGES[d.status]) : null),
      h("span", { className: "oxx-card-text" }, d.text),
      decisionButtons(d, "Select", "Not needed"));
  }

  // The engineer's pointer. Its node position is the arrow's tip.
  var TIP = { x: 3, y: 2 };
  function CursorNode(props) {
    return h("div", { className: "oxx-cursor" + (props.data.pressing ? " is-pressing" : "") },
      h("svg", { width: 22, height: 22, viewBox: "0 0 22 22", "aria-hidden": "true" },
        h("path", { d: "M3 2 L3 18 L7.5 13.8 L10.6 20.4 L13.4 19.1 L10.4 12.6 L16.6 12.4 Z", fill: "#1B1C18", stroke: "#FFFFFF", strokeWidth: 1.4, strokeLinejoin: "round" })),
      h("span", { className: "oxx-cursor-tag" }, "Professional review"));
  }

  var NODE_TYPES = {
    root: RootNode, area: AreaNode, importance: ImportanceNode, evidence: EvidenceNode,
    hypothesis: HypothesisNode, conclusion: ConclusionNode, action: ActionNode, cursor: CursorNode
  };

  // Thinking links join tiles on the same row, where React Flow's bezier
  // flattens out, so draw them as an arc dipping below the row.
  function ArcEdge(props) {
    var sx = props.sourceX, sy = props.sourceY, tx = props.targetX, ty = props.targetY;
    var depth = Math.min(38, 16 + Math.abs(tx - sx) * 0.08) * 2;
    var path = "M " + sx + "," + sy + " Q " + (sx + tx) / 2 + "," + (Math.max(sy, ty) + depth) + " " + tx + "," + ty;
    return h(RF.BaseEdge, { id: props.id, path: path, style: props.style });
  }

  var EDGE_TYPES = { arc: ArcEdge };

  function edge(source, target, kind, extra) {
    return Object.assign({
      id: source + ">" + target,
      source: source,
      target: target,
      sourceHandle: "s",
      targetHandle: "t",
      type: "default", // curved, as in the Inspect video
      className: "oxx-e oxx-e-" + kind
    }, extra || {});
  }

  function capitalise(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function lerp(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
  function near(a, b) { return Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1; }
  function kindOf(id) { return id.indexOf("hy-") === 0 ? "hyp" : id.indexOf("ac-") === 0 ? "act" : null; }

  // ---- The engine: scripted steps, pausing, tidying ----
  function createEngine(api) {
    var S = {
      step: 0, timer: null, idle: null, frame: null, pause: null, token: 0,
      paused: false, alive: true, concluded: false, cursorAt: null,
      reviewing: false, // the pointer is partway through the ticks and crosses
      shown: { hyp: {}, act: {} }, // what the map shows now
      plan: { hyp: {}, act: {} }   // what the script has decided so far
    };

    function addNode(node) {
      node.position = Object.assign({}, LAYOUT[node.id]);
      api.setNodes(function (ns) { return ns.concat(node); });
    }
    function addEdge(e) { api.setEdges(function (es) { return es.concat(e); }); }
    function patchData(id, patch) {
      api.setNodes(function (ns) {
        return ns.map(function (n) { return n.id === id ? Object.assign({}, n, { data: Object.assign({}, n.data, patch) }) : n; });
      });
    }
    function setPositions(map) {
      api.setNodes(function (ns) {
        return ns.map(function (n) { return map[n.id] ? Object.assign({}, n, { position: map[n.id] }) : n; });
      });
    }
    function markEdges(id, dim) {
      api.setEdges(function (es) {
        return es.map(function (e) {
          if (e.source !== id && e.target !== id) return e;
          var base = e.className.replace(/ oxx-dim/g, "");
          return Object.assign({}, e, { className: dim ? base + " oxx-dim" : base });
        });
      });
    }

    function conclusionText() {
      var found = HYPOTHESES.filter(function (hy) { return S.shown.hyp[hy.id] === "accepted"; })
        .map(function (hy) { return hy.finding; });
      if (!found.length) return "No hypothesis accepted yet.";
      return capitalise(found.join(", and ")) + ".";
    }
    function updateConclusion() {
      patchData("con", { text: conclusionText(), final: true });
    }

    // Show a status on the map.
    function show(kind, id, status) {
      S.shown[kind][id] = status;
      patchData(id, { status: status });
      markEdges(id, status === STATUS[kind].no);
      if (kind === "hyp" && S.concluded) updateConclusion();
    }

    // A person clicks a button. Clicking the lit button again clears it.
    function userDecide(id, status) {
      interact();
      var kind = kindOf(id);
      show(kind, id, S.shown[kind][id] === status ? STATUS[kind].neutral : status);
    }

    function cardNode(kind, item) {
      var s = STATUS[kind];
      S.plan[kind][item.id] = s.neutral;
      S.shown[kind][item.id] = s.neutral;
      return {
        id: item.id,
        type: kind === "hyp" ? "hypothesis" : "action",
        data: { id: item.id, kind: kind, text: item.text, status: s.neutral, decide: userDecide }
      };
    }

    // ---- The scripted cycle. Each step waits, then runs. A step that returns
    // a promise holds the cycle until the pointer has finished. ----
    var steps = [];
    function add(wait, run) { steps.push({ wait: wait, run: run }); }
    function noop() {}

    add(600, function () {
      addNode({ id: "root", type: "root", data: { view: VIEWS.map }, ariaLabel: "Site visit. Press Enter to view the site map." });
    });
    AREAS.forEach(function (a) {
      add(420, function () {
        addNode({ id: "ar-" + a.id, type: "area", data: a });
        addEdge(edge("root", "ar-" + a.id, "tree"));
      });
    });
    AREAS.forEach(function (a) {
      add(380, function () {
        addNode({ id: "im-" + a.id, type: "importance", data: a });
        addEdge(edge("ar-" + a.id, "im-" + a.id, "tree"));
      });
    });
    EVIDENCE.forEach(function (e) {
      add(320, function () {
        var node = { id: e.id, type: "evidence", data: e };
        if (e.view) node.ariaLabel = e.caption + ". Press Enter to view " + e.view.what + ".";
        addNode(node);
        addEdge(edge("im-" + e.area, e.id, "tree"));
      });
    });
    LINKS.forEach(function (l) {
      add(650, function () {
        addEdge(edge(l.source, l.target, "think", { type: "arc", targetHandle: "tb", animated: true }));
      });
    });
    HYPOTHESES.forEach(function (hy) {
      add(750, function () {
        addNode(cardNode("hyp", hy));
        hy.from.forEach(function (f) { addEdge(edge(f, hy.id, "support", { type: "default", animated: true })); });
      });
    });
    add(800, function () {
      addNode({ id: "con", type: "conclusion", data: { text: "Weighing the evidence…", final: false } });
      HYPOTHESES.forEach(function (hy) { addEdge(edge(hy.id, "con", "flow")); });
    });
    ACTIONS.forEach(function (ac) {
      add(520, function () {
        addNode(cardNode("act", ac));
        addEdge(edge("con", ac.id, "flow"));
      });
    });
    add(1400, noop);
    HYPOTHESES.forEach(function (hy) {
      add(400, function () { return review(hy.id, hy.verdict); });
    });
    add(900, function () { S.concluded = true; updateConclusion(); });
    ACTIONS.forEach(function (ac) {
      add(400, function () {
        return review(ac.id, S.plan.hyp[ac.hyp] === "accepted" ? "selected" : "dropped");
      });
    });
    add(300, function () { return leave(); });
    add(6000, function () {
      api.setNodes(function (ns) { return ns.map(function (n) { return Object.assign({}, n, { className: "oxx-exit" }); }); });
      api.setEdges(function (es) { return es.map(function (e) { return Object.assign({}, e, { className: e.className + " oxx-exit" }); }); });
    });
    add(700, function () {
      api.setNodes([]);
      api.setEdges([]);
      S.shown = { hyp: {}, act: {} };
      S.plan = { hyp: {}, act: {} };
      S.concluded = false;
    });

    // A touch part-way through a step leaves S.step where it was, so the step
    // runs again on resume. The pointer steps are safe to repeat.
    function schedule() {
      clearTimeout(S.timer);
      if (S.paused || !S.alive) return;
      var step = steps[S.step];
      var token = S.token;
      S.timer = setTimeout(function () {
        if (S.paused || !S.alive) return;
        Promise.resolve(step.run()).then(function () {
          if (token !== S.token || S.paused || !S.alive) return;
          S.step = (S.step + 1) % steps.length;
          schedule();
        });
      }, step.wait);
    }

    // ---- The "Professional review" pointer ----
    // Every wait checks the token, so a new touch stops the whole sequence.
    function wait(ms) {
      var token = S.token;
      return new Promise(function (resolve) {
        S.pause = setTimeout(function () { if (token === S.token && S.alive) resolve(); }, ms);
      });
    }
    function tween(ms, frame) {
      var token = S.token;
      return new Promise(function (resolve) {
        var t0 = performance.now();
        function step(now) {
          if (token !== S.token || !S.alive) return;
          var t = Math.min(1, (now - t0) / ms);
          frame(ease(t));
          if (t < 1) S.frame = requestAnimationFrame(step);
          else resolve();
        }
        S.frame = requestAnimationFrame(step);
      });
    }

    function cursorPos(tip) { return { x: tip.x - TIP.x, y: tip.y - TIP.y }; }
    function showCursor(tip) {
      S.cursorAt = tip;
      api.setNodes(function (ns) {
        return ns.filter(function (n) { return n.id !== "cursor"; }).concat({
          id: "cursor", type: "cursor", position: cursorPos(tip), data: { pressing: false },
          draggable: false, selectable: false, focusable: false, zIndex: 1000, style: { pointerEvents: "none" }
        });
      });
    }
    function hideCursor() {
      S.cursorAt = null;
      api.setNodes(function (ns) {
        return ns.filter(function (n) { return n.id !== "cursor"; }).map(function (n) {
          var d = n.data;
          return d && (d.editing || d.pressing) ? Object.assign({}, n, { data: Object.assign({}, d, { editing: false, pressing: null }) }) : n;
        });
      });
    }
    function press(on) { patchData("cursor", { pressing: on }); }
    function glide(tip, ms) {
      var from = S.cursorAt;
      return tween(ms, function (e) {
        S.cursorAt = lerp(from, tip, e);
        setPositions({ cursor: cursorPos(S.cursorAt) });
      });
    }

    // Drag one node home.
    function moveHome(id) {
      var n = api.getNode(id);
      if (!n || near(n.position, LAYOUT[id])) return Promise.resolve();
      var from = n.position, to = LAYOUT[id], grab = { x: 26, y: 12 };
      return glide({ x: from.x + grab.x, y: from.y + grab.y }, 480)
        .then(function () { patchData(id, { editing: true }); press(true); return wait(140); })
        .then(function () {
          return tween(850, function (e) {
            var p = lerp(from, to, e);
            S.cursorAt = { x: p.x + grab.x, y: p.y + grab.y };
            var map = { cursor: cursorPos(S.cursorAt) };
            map[id] = p;
            setPositions(map);
          });
        })
        .then(function () { press(false); patchData(id, { editing: false }); return wait(180); });
    }

    // Move to a card's tick or cross, hover, press and let go, so the choice
    // is seen being made. With setPlan the click is the script's own decision.
    function clickCard(id, want, setPlan) {
      var kind = kindOf(id);
      var s = STATUS[kind];
      var now = S.shown[kind][id];
      var n = api.getNode(id);
      if (setPlan && now === want) S.plan[kind][id] = want; // already clicked before a pause
      if (!n || now === undefined || now === want) return Promise.resolve();
      var size = n.measured || {};
      var button = want === s.yes || (want === s.neutral && now === s.yes) ? "yes" : "no";
      var tip = { x: n.position.x + (size.width || 150) - (button === "yes" ? 45 : 19), y: n.position.y + (size.height || 84) - 17 };
      if (!S.cursorAt) showCursor(ENTRY);
      return glide(tip, 750)
        .then(function () { patchData(id, { editing: true }); return wait(280); })
        .then(function () { press(true); patchData(id, { pressing: button }); return wait(280); })
        .then(function () {
          if (setPlan) S.plan[kind][id] = want;
          show(kind, id, want);
          press(false);
          patchData(id, { pressing: null });
          return wait(650);
        })
        .then(function () {
          patchData(id, { editing: false });
          if (kind !== "hyp" || !S.concluded) return undefined;
          patchData("con", { editing: true });
          return wait(650).then(function () { patchData("con", { editing: false }); });
        });
    }

    // The script's review: the pointer clicks each verdict in turn.
    function review(id, want) {
      S.reviewing = true;
      return clickCard(id, want, true);
    }

    function leave() {
      S.reviewing = false;
      if (!S.cursorAt) return Promise.resolve();
      return glide(EXIT, 600).then(hideCursor);
    }

    // Click one card back to what the script decided.
    function redo(id) {
      return clickCard(id, S.plan[kindOf(id)][id], false);
    }

    function needsTidy() {
      var byId = {};
      api.getNodes().forEach(function (n) { byId[n.id] = n; });
      return ORDER.some(function (id) {
        var n = byId[id], kind = kindOf(id);
        if (!n) return false;
        return !near(n.position, LAYOUT[id]) || (kind && S.shown[kind][id] !== S.plan[kind][id]);
      });
    }

    function tidy() {
      api.setMode("tidying");
      api.fit(900);
      if (!needsTidy()) return wait(500);
      showCursor(ENTRY);
      var chain = wait(350);
      ORDER.forEach(function (id) {
        chain = chain.then(function () { return moveHome(id); }).then(function () { return kindOf(id) ? redo(id) : undefined; });
      });
      return chain.then(function () {
        // Mid-review the pointer stays and carries on with the next card.
        if (S.reviewing) return wait(300);
        return glide(EXIT, 600).then(function () { hideCursor(); return wait(300); });
      });
    }

    // After a touch: tidy what the visitor moved, then carry on. Not while
    // the page holds the map; release() tidies instead.
    function afterTouch() {
      if (S.held || S.viewing) return;
      var token = S.token;
      tidy().then(function () {
        if (token !== S.token || S.held) return;
        S.touched = false;
        S.paused = false;
        api.setMode("running");
        schedule();
      });
    }

    function interact() {
      if (!S.alive) return;
      S.touched = true;
      S.paused = true;
      S.token += 1;
      clearTimeout(S.timer);
      clearTimeout(S.idle);
      clearTimeout(S.pause);
      if (S.frame) cancelAnimationFrame(S.frame);
      S.frame = null;
      if (S.cursorAt) hideCursor();
      api.setMode("paused");
      if (!S.viewing) S.idle = setTimeout(afterTouch, IDLE_MS);
    }

    // A picture is open: everything waits until it closes, then the map is
    // tidied and the script carries on from where it stopped.
    function viewOpen() {
      if (!S.alive) return;
      interact();
      S.viewing = true;
      clearTimeout(S.idle);
    }

    function viewClose() {
      if (!S.alive || !S.viewing) return;
      S.viewing = false;
      if (S.held) return; // release() carries on instead
      clearTimeout(S.idle);
      S.idle = setTimeout(afterTouch, 700);
    }

    // The page holds the map while another section plays: everything stops
    // where it is, pointer included. release() carries on from the same step
    // (the step in progress runs again; pointer steps are safe to repeat).
    function hold() {
      if (!S.alive || S.held) return;
      S.held = true;
      S.paused = true;
      S.token += 1;
      clearTimeout(S.timer);
      clearTimeout(S.idle);
      clearTimeout(S.pause);
      if (S.frame) cancelAnimationFrame(S.frame);
      S.frame = null;
    }

    function release() {
      if (!S.alive || !S.held) return;
      S.held = false;
      if (S.touched) {
        if (!S.viewing) S.idle = setTimeout(afterTouch, 600);
        return;
      }
      S.paused = false;
      api.setMode("running");
      schedule();
    }

    function stop() {
      S.alive = false;
      clearTimeout(S.timer);
      clearTimeout(S.idle);
      clearTimeout(S.pause);
      if (S.frame) cancelAnimationFrame(S.frame);
    }

    return { start: schedule, interact: interact, hold: hold, release: release, stop: stop, viewOpen: viewOpen, viewClose: viewClose };
  }

  // The chip always reads "Professional review", even while the visitor has the map.
  var STATUS_TEXT = { running: "Professional review", paused: "Professional review", tidying: "Professional review" };

  function ReviewGraphInner(props) {
    var active = props.active;
    var rf = RF.useReactFlow();
    var nodesState = React.useState([]);
    var edgesState = React.useState([]);
    var modeState = React.useState("running");
    var nodes = nodesState[0], setNodes = nodesState[1];
    var edges = edgesState[0], setEdges = edgesState[1];
    var flowRef = React.useRef(null);
    var rfRef = React.useRef(rf);
    rfRef.current = rf;

    var fit = React.useCallback(function (duration) {
      rfRef.current.fitBounds(BOUNDS, { padding: 0.04, duration: duration || 0 });
    }, []);

    var engineRef = React.useRef(null);
    if (!engineRef.current) {
      engineRef.current = createEngine({
        setNodes: setNodes,
        setEdges: setEdges,
        setMode: modeState[1],
        getNodes: function () { return rfRef.current.getNodes(); },
        getNode: function (id) { return rfRef.current.getNode(id); },
        fit: fit
      });
    }
    var engine = engineRef.current;

    var startedRef = React.useRef(false);
    React.useEffect(function () {
      if (active) {
        if (startedRef.current) engine.release();
        else {
          startedRef.current = true;
          engine.start();
        }
      } else if (startedRef.current) {
        engine.hold();
      }
    }, [engine, active]);
    React.useEffect(function () { return engine.stop; }, [engine]);

    React.useEffect(function () {
      var el = flowRef.current;
      if (!el || !window.ResizeObserver) return undefined;
      var ro = new ResizeObserver(function () { fit(0); });
      ro.observe(el);
      return function () { ro.disconnect(); };
    }, [fit]);

    var onNodesChange = React.useCallback(function (changes) {
      setNodes(function (ns) { return RF.applyNodeChanges(changes, ns); });
    }, []);

    function onPointerMove(e) { if (e.buttons) engine.interact(); }

    // ---- A card's picture, popped up over the graph ----
    var viewState = React.useState(null);
    var view = viewState[0], setView = viewState[1];
    var viewRef = React.useRef(null);
    viewRef.current = view;
    var figRef = React.useRef(null);
    var closeRef = React.useRef(null);
    var closingRef = React.useRef(false);
    var viewTimer = React.useRef(null);

    function thumbOf(id) {
      var el = flowRef.current;
      return el ? el.querySelector('.react-flow__node[data-id="' + id + '"] .oxx-thumb') : null;
    }

    // The transform that puts the big picture over a card's thumbnail.
    function overThumb(img, id) {
      var t = thumbOf(id);
      if (REDUCED || !img || !img.animate || !t) return null;
      var a = t.getBoundingClientRect(), b = img.getBoundingClientRect();
      if (!a.width || !b.width) return null;
      var dx = a.left + a.width / 2 - (b.left + b.width / 2);
      var dy = a.top + a.height / 2 - (b.top + b.height / 2);
      return "translate(" + dx + "px, " + dy + "px) scale(" + a.width / b.width + ")";
    }

    function openView(node) {
      if (!node || !node.data || !node.data.view || viewRef.current) return;
      engine.viewOpen();
      closingRef.current = false;
      setView(Object.assign({ id: node.id, keyboard: flowRef.current && flowRef.current.contains(document.activeElement) }, node.data.view));
    }

    var closeView = React.useCallback(function () {
      var v = viewRef.current, fig = figRef.current;
      if (!v || !fig || closingRef.current) return;
      closingRef.current = true;
      clearTimeout(viewTimer.current);
      fig.parentNode.classList.add("is-closing");
      var img = fig.querySelector("img");
      var to = overThumb(img, v.id);
      function done() {
        var t = thumbOf(v.id);
        var node = t && t.closest(".react-flow__node");
        setView(null);
        engine.viewClose();
        if (v.keyboard && node) node.focus({ preventScroll: true });
      }
      if (!to) { setTimeout(done, REDUCED ? 0 : 200); return; }
      img.animate([{ transform: "none", opacity: 1 }, { transform: to, opacity: 0.5 }],
        { duration: 280, easing: "cubic-bezier(0.4, 0, 0.8, 0.4)", fill: "forwards" }).onfinish = done;
    }, [engine]);

    function closeLater(ms) {
      clearTimeout(viewTimer.current);
      viewTimer.current = setTimeout(closeView, ms);
    }

    // Opening: grow out of the thumbnail, then wait to be closed.
    React.useLayoutEffect(function () {
      if (!view) return undefined;
      var img = figRef.current && figRef.current.querySelector("img");
      var from = overThumb(img, view.id);
      if (from) {
        img.animate([{ transform: from, opacity: 0.5 }, { transform: "none", opacity: 1 }],
          { duration: 380, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
      }
      if (view.keyboard && closeRef.current) closeRef.current.focus({ preventScroll: true });
      closeLater(VIEW_MS);
      function onDown(e) { if (figRef.current && !figRef.current.contains(e.target)) closeView(); }
      function onKey(e) { if (e.key === "Escape") closeView(); }
      document.addEventListener("pointerdown", onDown, true);
      document.addEventListener("keydown", onKey);
      return function () {
        clearTimeout(viewTimer.current);
        document.removeEventListener("pointerdown", onDown, true);
        document.removeEventListener("keydown", onKey);
      };
    }, [view, closeView]);

    function onNodeClick(e, node) { openView(node); }

    function onKeyDown(e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var el = e.target.closest && e.target.closest(".react-flow__node");
      var node = el && rf.getNode(el.getAttribute("data-id"));
      if (node && node.data && node.data.view) {
        e.preventDefault();
        openView(node);
      }
    }

    var viewer = view ? h("div", { className: "oxx-viewer", role: "dialog", "aria-label": view.title },
      h("figure", {
        className: "oxx-viewer-fig",
        ref: figRef,
        onPointerEnter: function (e) { if (e.pointerType === "mouse") clearTimeout(viewTimer.current); },
        onPointerLeave: function (e) { if (e.pointerType === "mouse" && !closingRef.current) closeLater(VIEW_LEFT_MS); }
      },
        h("img", { src: view.src, alt: view.alt, width: 1000, height: 1000, draggable: false }),
        h("figcaption", null, view.title),
        h("button", { type: "button", className: "oxx-viewer-close", ref: closeRef, "aria-label": "Close " + view.title.toLowerCase(), onClick: closeView }, ICONS.cross()))) : null;

    return h("div", { className: "oxx-review" },
      h("div", { className: "oxx-review-top" },
        h("span", { className: "oxx-review-label" }, "Review graph"),
        h("span", { className: "oxx-status is-" + modeState[0], "aria-live": "polite" }, STATUS_TEXT[modeState[0]])),
      h("div", { className: "oxx-review-flow", ref: flowRef, onPointerDownCapture: engine.interact, onPointerMoveCapture: onPointerMove, onKeyDown: onKeyDown },
        h(RF.ReactFlow, {
          nodes: nodes,
          edges: edges,
          nodeTypes: NODE_TYPES,
          edgeTypes: EDGE_TYPES,
          onNodesChange: onNodesChange,
          onNodeClick: onNodeClick,
          onInit: function () { fit(0); },
          nodesConnectable: false,
          nodesDraggable: !TOUCH,
          panOnDrag: false,
          zoomOnScroll: false,
          panOnScroll: false,
          preventScrolling: false,
          zoomOnDoubleClick: false,
          minZoom: 0.3,
          maxZoom: 1.6,
          // Removed at the founders' request. React Flow asks sites that hide
          // its credit to take a React Flow Pro subscription (MIT doesn't require it).
          proOptions: { hideAttribution: true },
          defaultEdgeOptions: { focusable: false }
        })),
      h("div", { className: "oxx-review-foot" }, "Connected reasoning • Observation → Hypothesis → Conclusion → Action"),
      viewer);
  }

  function ReviewGraphReady(props) {
    return h(RF.ReactFlowProvider, null, h(ReviewGraphInner, props));
  }

  // ---- Loading ----
  function init() {
    React = window.React;
    RF = window.ReactFlow;
    h = React.createElement;
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  var loading = null;
  function loadReactFlow(src) {
    if (window.ReactFlow) return Promise.resolve();
    if (!loading) {
      // React Flow's UMD build wants a global jsxRuntime, which React 18 has no UMD copy of.
      if (!window.jsxRuntime) {
        var R = window.React;
        var jsx = function (type, props, key) {
          return R.createElement(type, key === undefined ? props : Object.assign({}, props, { key: key }));
        };
        window.jsxRuntime = { Fragment: R.Fragment, jsx: jsx, jsxs: jsx };
      }
      loading = src ? loadScript(src) : Promise.reject(new Error("No xyflowSrc given"));
    }
    return loading;
  }

  function ReviewGraph(props) {
    var R = window.React;
    var state = R.useState(window.ReactFlow ? "ready" : "loading");
    var xyflowSrc = props && props.xyflowSrc;
    R.useEffect(function () {
      if (state[0] === "ready") return undefined;
      var live = true;
      loadReactFlow(xyflowSrc).then(
        function () { if (live) state[1]("ready"); },
        function () { if (live) state[1]("failed"); }
      );
      return function () { live = false; };
    }, []);
    if (state[0] !== "ready") {
      return R.createElement("div", { className: "oxx-review oxx-review-wait" },
        state[0] === "failed" ? "The review graph could not load." : "Loading the review graph…");
    }
    if (!RF) init();
    return R.createElement(ReviewGraphReady, { active: !props || props.active !== false });
  }

  // ---- Report: the reviewed graph becomes the draft report ----
  // The finished review, read-only: nothing can be moved, clicked or opened.
  // The report is written a section at a time, each in one go: every card
  // that goes into the section lifts off the graph together, leaving empty
  // dashed slots, and they fly into the Word page a moment apart, each
  // turning into its line there with a brief highlight. Once the graph is
  // empty the page holds, then both reset and it starts again. Reduced
  // motion shows the finished report straight away.
  var R_COLS = [0, 170, 340, 510];
  var R_LAYOUT = makeLayout(R_COLS);
  var R_BOUNDS = { x: -14, y: -10, width: R_COLS[3] + 150 + 28, height: 690 };
  var FLY_MS = 1050; // one flight
  var STAGGER_MS = 90; // between two cards of a section leaving
  var GAP_MS = 900; // after a section is written, before the next one lifts
  var HOLD_MS = 3200; // the finished report, before the reset
  var PRIORITY = { high: "High", low: "Low", med: "Medium" };
  var ACCEPTED = {};
  HYPOTHESES.forEach(function (hy) { ACCEPTED[hy.id] = hy.verdict === "accepted"; });
  var FINAL_CONCLUSION = capitalise(HYPOTHESES.filter(function (hy) { return ACCEPTED[hy.id]; })
    .map(function (hy) { return hy.finding; }).join(", and ")) + ".";
  function actionVerdict(ac) { return ACCEPTED[ac.hyp] ? "selected" : "dropped"; }
  function areaOf(id) { return AREAS.filter(function (a) { return a.id === id; })[0]; }
  function nothing() {}

  // The graph as Review leaves it: every verdict made, the conclusion final.
  function reviewedGraph() {
    var nodes = [], edges = [];
    function node(id, type, data) {
      nodes.push({ id: id, type: type, data: data, position: Object.assign({}, R_LAYOUT[id]) });
    }
    node("root", "root", { view: VIEWS.map });
    AREAS.forEach(function (a) {
      node("ar-" + a.id, "area", a);
      edges.push(edge("root", "ar-" + a.id, "tree"));
      node("im-" + a.id, "importance", a);
      edges.push(edge("ar-" + a.id, "im-" + a.id, "tree"));
    });
    EVIDENCE.forEach(function (e) {
      node(e.id, "evidence", e);
      edges.push(edge("im-" + e.area, e.id, "tree"));
    });
    LINKS.forEach(function (l) {
      edges.push(edge(l.source, l.target, "think", { type: "arc", targetHandle: "tb", animated: true }));
    });
    HYPOTHESES.forEach(function (hy) {
      node(hy.id, "hypothesis", { id: hy.id, kind: "hyp", text: hy.text, status: hy.verdict, decide: nothing });
      hy.from.forEach(function (f) { edges.push(edge(f, hy.id, "support", { animated: true })); });
    });
    node("con", "conclusion", { text: FINAL_CONCLUSION, final: true });
    HYPOTHESES.forEach(function (hy) { edges.push(edge(hy.id, "con", "flow")); });
    ACTIONS.forEach(function (ac) {
      node(ac.id, "action", { id: ac.id, kind: "act", text: ac.text, status: actionVerdict(ac), decide: nothing });
      edges.push(edge("con", ac.id, "flow"));
    });
    // Links to rejected hypotheses and actions not needed stay dimmed, as in Review.
    var dim = {};
    HYPOTHESES.forEach(function (hy) { if (!ACCEPTED[hy.id]) dim[hy.id] = true; });
    ACTIONS.forEach(function (ac) { if (!ACCEPTED[ac.hyp]) dim[ac.id] = true; });
    edges.forEach(function (e) { if (dim[e.source] || dim[e.target]) e.className += " oxx-dim"; });
    return { nodes: nodes, edges: edges };
  }

  // What goes into the report, in order, and the cards each line takes.
  var ITEMS = [{ id: "title", nodes: ["root"], section: "title" }]
    .concat(AREAS.map(function (a) { return { id: "r-" + a.id, nodes: ["ar-" + a.id, "im-" + a.id], section: "areas", area: a }; }))
    .concat(EVIDENCE.map(function (e) { return { id: "r-" + e.id, nodes: [e.id], section: "obs", ev: e }; }))
    .concat(HYPOTHESES.map(function (hy) { return { id: "r-" + hy.id, nodes: [hy.id], section: "hyp", hy: hy }; }))
    .concat([{ id: "r-con", nodes: ["con"], section: "con" }])
    .concat(ACTIONS.map(function (ac) { return { id: "r-" + ac.id, nodes: [ac.id], section: "act", ac: ac }; }));

  function joinAnd(list) {
    return list.length < 2 ? list.join("") : list.slice(0, -1).join(", ") + " and " + list[list.length - 1];
  }
  var DEFECT_AREAS = AREAS.filter(function (a) { return a.defect === "Defect"; })
    .map(function (a) { return "the " + a.label.toLowerCase(); });

  // Each section opens with a short paragraph, shown with its heading.
  var SECTIONS = [
    { key: "areas", title: "1. Areas Inspected", head: ["Area", "Importance", "Finding"],
      intro: "Each area was given an importance on site and checked for defects." },
    { key: "obs", title: "2. Observations",
      intro: "The evidence captured on site, area by area. A defect was found in " + joinAnd(DEFECT_AREAS) + "." },
    // The discussion and the recommendations are each one paragraph (`para`):
    // the intro opens it, then a sentence per cause or action.
    { key: "hyp", title: "3. Discussion", para: true,
      intro: "Each possible cause was tested against the evidence, then accepted or rejected on professional review." },
    { key: "con", title: "4. Conclusion" },
    { key: "act", title: "5. Recommendations", para: true,
      intro: "The recommendations follow from the causes accepted in the discussion." }
  ];

  // The report is written in these steps: the title block, then each section
  // with all its lines.
  var GROUPS = ["title"].concat(SECTIONS.map(function (s) { return s.key; }))
    .map(function (key) { return ITEMS.filter(function (i) { return i.section === key; }); });

  // Figure 1 is the site map. Each piece of evidence follows as a figure,
  // numbered in page order: a photo, a still from a video, or a document.
  // The stills are crops of the Inspect section's site pictures.
  var SHOTS = {
    "ev-court-video": { src: "/assets/demo-image-site.webp", w: 1200, h: 900, pos: "12% 92%", zoom: 2, text: "Courtyard defect: still from the site video." },
    "ev-court-report": { text: "Courtyard report, added on site." },
    "ev-base-image": { src: "/assets/demo-image-site.webp", w: 1200, h: 900, pos: "92% 96%", zoom: 2.2, text: "Basement photo." },
    "ev-roof-video": { src: "/assets/demo-site-aerial.webp", w: 1000, h: 1000, pos: "70% 36%", zoom: 2.4, text: "Roof inspection: still from the video." },
    "ev-roof-image": { text: "Roof defect photo, analysed on site: (1) rebar exposed for further construction; (2) handrail built, check for compliance." },
    "ev-hist-report": { text: "Historic record: earlier report on the building." }
  };
  var FIG = {};
  EVIDENCE.forEach(function (e, i) { FIG[e.id] = i + 2; });
  var HYP_NO = {};
  HYPOTHESES.forEach(function (hy, i) { HYP_NO[hy.id] = i + 1; });
  function hName(hy) { return "H" + HYP_NO[hy.id]; }
  function lowerFirst(s) { return s.charAt(0).toLowerCase() + s.slice(1); }

  // The conclusion paragraph: the final conclusion, the causes it rests on
  // and those rejected, and a pointer to the recommendations.
  var HYP_YES = HYPOTHESES.filter(function (hy) { return ACCEPTED[hy.id]; }).map(hName);
  var HYP_NO_LIST = HYPOTHESES.filter(function (hy) { return !ACCEPTED[hy.id]; }).map(hName);
  var CON_PARA = FINAL_CONCLUSION +
    " This rests on " + joinAnd(HYP_YES) + ", the " + (HYP_YES.length > 1 ? "causes" : "cause") + " accepted in the discussion" +
    (HYP_NO_LIST.length ? "; " + joinAnd(HYP_NO_LIST) + (HYP_NO_LIST.length > 1 ? " were" : " was") + " rejected" : "") +
    ". The recommendations that follow address " + (HYP_YES.length > 1 ? "them" : "it") + ".";
  function figRefs(ids) {
    var n = ids.map(function (id) { return FIG[id]; }).sort(function (a, b) { return a - b; });
    return (n.length > 1 ? "Figures " : "Figure ") + joinAnd(n.map(String));
  }

  var TITLE = "Site Visit Report";
  var SUBTITLE = "Draft for professional review";
  var DOC_REF = "OXX-2026-121";
  var INTRO = "This report records a site visit to the courtyard, the basement and the rooftop, read with the historic report on the building. " +
    "Every finding is linked to the evidence captured on site, shown in the figures. It is a draft for the professional to review, refine and sign off.";
  var MAP_CAPTION = "Site map: the route walked, with a pin where each capture was made.";

  function obsMeta(e) {
    return areaOf(e.area).label + " · " + PRIORITY[e.priority] + " priority";
  }

  // A cause as the discussion words it, in one sentence: what it was, the
  // evidence it was tested on, and whether it was accepted or rejected.
  // hypText is the sentence up to the verdict word.
  function hypText(hy) {
    return ", that " + lowerFirst(hy.text) + ", " + (ACCEPTED[hy.id] ? "is" : "is not") +
      " supported by the evidence in " + figRefs(hy.from) + " and was ";
  }
  function hypVerdict(hy) { return ACCEPTED[hy.id] ? "accepted" : "rejected"; }

  // An action as the recommendations word it, in one sentence: "To address
  // H2, seal the crack…" or "No need to underpin the courtyard slab, as H1
  // was rejected." The parts: the cause (n), the action (act) and the words
  // around them.
  function actParts(ac) {
    var n = "H" + HYP_NO[ac.hyp], what = lowerFirst(ac.text);
    return ACCEPTED[ac.hyp]
      ? { yes: true, n: n, act: what }
      : { yes: false, n: n, act: "No need to " + what };
  }
  function actSentence(ac) {
    var p = actParts(ac);
    return p.yes ? "To address " + p.n + ", " + p.act + "." : p.act + ", as " + p.n + " was rejected.";
  }

  // The picture in a figure: a photo, a video still with a play mark, or a
  // page standing for a document.
  function figFrame(e) {
    var shot = SHOTS[e.id];
    if (e.view) {
      return h("span", { className: "oxx-doc-frame" },
        h("img", { src: e.view.src, alt: "", width: 1000, height: 1000, draggable: false, decoding: "async" }));
    }
    if (shot.src) {
      return h("span", { className: "oxx-doc-frame" },
        h("img", {
          src: shot.src, alt: "", width: shot.w, height: shot.h, draggable: false, decoding: "async",
          style: { objectPosition: shot.pos, transformOrigin: shot.pos, transform: "scale(" + shot.zoom + ")" }
        }),
        e.kind === "video" ? h("span", { className: "oxx-doc-play" }) : null);
    }
    return h("span", { className: "oxx-doc-frame is-doc" },
      h("span", { className: "oxx-doc-sheet" },
        h("span", { className: "oxx-doc-sheet-title" }, ICONS.report(), e.caption),
        h("i"), h("i"), h("i"), h("i"), h("i")));
  }

  function docRow(item, phase) {
    var cls = "oxx-doc-row is-" + phase;
    if (item.section === "title") {
      return h("div", { key: item.id, className: cls + " oxx-doc-titleblock", "data-row": item.id },
        h("span", { className: "oxx-doc-title" }, TITLE),
        h("span", { className: "oxx-doc-sub" }, SUBTITLE),
        h("span", { className: "oxx-doc-para" }, INTRO),
        h("span", { className: "oxx-doc-figure is-map" },
          h("span", { className: "oxx-doc-frame" },
            h("img", { src: VIEWS.map.src, alt: "", width: 1000, height: 1000, draggable: false, decoding: "async" })),
          h("span", { className: "oxx-doc-caption" }, h("b", null, "Figure 1. "), MAP_CAPTION)));
    }
    if (item.section === "areas") {
      var a = item.area;
      return h("div", { key: item.id, className: cls + " is-table", "data-row": item.id },
        h("span", null, a.label),
        h("span", null, a.level),
        h("span", { className: a.defect === "Defect" ? "oxx-doc-defect" : "" }, a.defect));
    }
    if (item.section === "obs") {
      var e = item.ev;
      return h("div", { key: item.id, className: cls + " oxx-doc-figure kind-" + e.kind, "data-row": item.id },
        figFrame(e),
        h("span", { className: "oxx-doc-caption" }, h("b", null, "Figure " + FIG[e.id] + ". "), SHOTS[e.id].text),
        h("span", { className: "oxx-doc-meta" }, obsMeta(e)));
    }
    if (item.section === "hyp") {
      var hy = item.hy;
      return h("span", { key: item.id, className: cls + " oxx-doc-sentence", "data-row": item.id },
        h("b", null, hName(hy)), hypText(hy),
        h("span", { className: "oxx-doc-verdict " + (ACCEPTED[hy.id] ? "is-yes" : "is-no") }, hypVerdict(hy)), ". ");
    }
    if (item.section === "con") {
      return h("p", { key: item.id, className: cls + " oxx-doc-para", "data-row": item.id }, CON_PARA);
    }
    // An action: the thing to do in green, or "No need to…" in grey.
    var p = actParts(item.ac);
    var act = h("span", { className: "oxx-doc-verdict " + (p.yes ? "is-yes" : "is-skip") }, p.act);
    var n = h("b", null, p.n);
    var parts = p.yes ? ["To address ", n, ", ", act, ". "] : [act, ", as ", n, " was rejected. "];
    return h.apply(null, ["span", { key: item.id, className: cls + " oxx-doc-sentence", "data-row": item.id }].concat(parts));
  }

  // The words on the page as it stands, for the status bar.
  function rowText(item) {
    if (item.section === "title") return [TITLE, SUBTITLE, INTRO, "Figure 1.", MAP_CAPTION].join(" ");
    if (item.section === "areas") return [item.area.label, item.area.level, item.area.defect].join(" ");
    if (item.section === "obs") return "Figure " + FIG[item.ev.id] + ". " + SHOTS[item.ev.id].text + " " + obsMeta(item.ev);
    if (item.section === "hyp") return hName(item.hy) + hypText(item.hy) + hypVerdict(item.hy) + ".";
    if (item.section === "con") return CON_PARA;
    return actSentence(item.ac);
  }
  function countWords(s) { return s.split(/\s+/).filter(function (w) { return /\w/.test(w); }).length; }
  function docWords(rows) {
    var shown = {}, n = 0;
    rows.forEach(function (r) { if (r.phase === "in") shown[r.id] = true; });
    ITEMS.forEach(function (i) { if (shown[i.id]) n += countWords(rowText(i)); });
    SECTIONS.forEach(function (s) {
      var first = ITEMS.filter(function (i) { return i.section === s.key; })[0];
      if (first && shown[first.id]) n += countWords([s.title, s.intro || ""].concat(s.head || []).join(" "));
    });
    return n;
  }

  // The page as it stands: a heading and its opening paragraph appear with
  // the section's first line, and take their room while that line is still
  // on its way. Observations sit two figures to a row. The running header is
  // part of the page; the sign-off lines close the finished draft.
  function docPage(rows, done) {
    var phase = {};
    rows.forEach(function (r) { phase[r.id] = r.phase; });
    var out = [h("div", { key: "runhead", className: "oxx-doc-runhead" },
      h("span", null, "Oxx Report", h("i", null, "|"), TITLE),
      h("span", null, DOC_REF))];
    if (phase.title) out.push(docRow(ITEMS[0], phase.title));
    SECTIONS.forEach(function (s) {
      var items = ITEMS.filter(function (i) { return i.section === s.key && phase[i.id]; });
      if (!items.length) return;
      var first = "is-" + phase[items[0].id];
      var kids = [h("h5", { key: "h", className: "oxx-doc-h " + first }, s.title)];
      if (s.intro && !s.para) kids.push(h("p", { key: "intro", className: "oxx-doc-lead " + first }, s.intro));
      if (s.head) {
        kids.push(h("div", { key: "th", className: "oxx-doc-th " + first },
          s.head.map(function (t) { return h("span", { key: t }, t); })));
      }
      var lines = items.map(function (i) { return docRow(i, phase[i.id]); });
      if (s.key === "obs") kids.push(h("div", { key: "figs", className: "oxx-doc-figs" }, lines));
      // The discussion and the recommendations: one paragraph each, the
      // opening sentence then a sentence per cause or action.
      else if (s.para) {
        kids.push(h("p", { key: "para", className: "oxx-doc-para oxx-doc-prose" },
          h("span", { className: "oxx-doc-lead " + first }, s.intro + " "), lines));
      } else kids = kids.concat(lines);
      out.push(h("section", { key: s.key, className: "oxx-doc-sec sec-" + s.key }, kids));
    });
    if (done) {
      out.push(h("div", { key: "sign", className: "oxx-doc-sign" },
        h("span", null, "Prepared by:", h("i")),
        h("span", null, "Reviewed by:", h("i"))));
    }
    return h("div", { className: "oxx-doc-page" }, out);
  }

  // Word's window furniture, drawn small.
  function svgIcon(d, w) {
    return h("svg", { viewBox: "0 0 " + (w || 12) + " 12", width: w || 12, height: 12, "aria-hidden": "true" },
      h("path", { d: d, stroke: "currentColor", strokeWidth: 1.2, fill: "none", strokeLinecap: "round" }));
  }
  var ALIGN = {
    left: "M1 2.5H11M1 5H8M1 7.5H11M1 10H7",
    center: "M1 2.5H11M2.5 5H9.5M1 7.5H11M3 10H9",
    right: "M1 2.5H11M4 5H11M1 7.5H11M5 10H11"
  };
  var MENU = ["File", "Home", "Insert", "Design", "Layout", "References", "Review", "View"];

  function docChrome(rows, done, scrollRef) {
    return h("div", { className: "oxx-doc" },
      h("div", { className: "oxx-doc-bar" },
        h("span", { className: "oxx-doc-app" }, "W"),
        h("span", { className: "oxx-doc-name" }, "Site_Visit_Report_DRAFT.docx", h("span", { className: "oxx-doc-appname" }, " - Word")),
        h("span", { className: "oxx-doc-win" },
          svgIcon("M2 6H10"),
          h("svg", { viewBox: "0 0 12 12", width: 12, height: 12, "aria-hidden": "true" },
            h("rect", { x: 2, y: 2, width: 8, height: 8, stroke: "currentColor", strokeWidth: 1.2, fill: "none" })),
          svgIcon("M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5"))),
      h("div", { className: "oxx-doc-menu" },
        MENU.map(function (t) { return h("span", { key: t, className: t === "Home" ? "is-on" : "" }, t); })),
      h("div", { className: "oxx-doc-ribbon" },
        h("span", { className: "oxx-doc-field is-font" }, "Calibri (Body)"),
        h("span", { className: "oxx-doc-field is-size" }, "11"),
        h("span", { className: "oxx-doc-tools" }, h("b", null, "B"), h("i", null, "I"), h("u", null, "U")),
        h("span", { className: "oxx-doc-tools oxx-doc-align" }, svgIcon(ALIGN.left), svgIcon(ALIGN.center), svgIcon(ALIGN.right)),
        h("span", { className: "oxx-doc-style" }, "Normal"),
        h("span", { className: "oxx-doc-style is-h1" }, "Heading 1"),
        h("span", { className: "oxx-doc-draft" }, "Draft")),
      h("div", { className: "oxx-doc-view" },
        h("div", { className: "oxx-doc-scroll", ref: scrollRef }, docPage(rows, done)),
        h("span", { className: "oxx-doc-watermark", "aria-hidden": "true" }, "DRAFT")),
      h("div", { className: "oxx-doc-status" },
        h("span", null, "Page 1 of 1"),
        h("span", null, docWords(rows) + " words"),
        h("span", { className: "oxx-doc-lang" }, "English (South Africa)"),
        h("span", { className: "oxx-doc-zoom" }, "100%")));
  }

  function afterPaint(fn) {
    requestAnimationFrame(function () { requestAnimationFrame(fn); });
  }

  // Lift a card off the graph and fly a copy of it onto a line of the page.
  // The copy starts at the card's size on screen (React Flow's zoom) and
  // shrinks to the line's height on the way.
  function flyCard(build, id, target, index) {
    var el = build.querySelector('.react-flow__node[data-id="' + id + '"] .oxx-n');
    if (!el || !el.animate) return;
    var r = el.getBoundingClientRect(), box = build.getBoundingClientRect();
    var w = el.offsetWidth, ht = el.offsetHeight;
    if (!w || !ht || !r.width) return;
    var z = r.width / w;
    var copy = el.cloneNode(true);
    Array.prototype.forEach.call(copy.querySelectorAll(".react-flow__handle"), function (x) { x.parentNode.removeChild(x); });
    copy.classList.add("oxx-flying");
    copy.setAttribute("aria-hidden", "true");
    copy.style.left = r.left - box.left + "px";
    copy.style.top = r.top - box.top + "px";
    copy.style.width = w + "px";
    copy.style.height = ht + "px";
    build.appendChild(copy);
    var s = Math.max(0.3, Math.min(z, (target.height * 1.15) / ht, (target.width * 0.6) / w));
    var dx = target.left + 8 - r.left;
    var dy = target.top + target.height / 2 - (ht * s) / 2 - r.top;
    var up = z * 1.08;
    var lift = "translate(" + (-w * (up - z) / 2) + "px, " + (-8 - ht * (up - z) / 2) + "px) scale(" + up + ")";
    var land = "translate(" + dx + "px, " + dy + "px) scale(" + s + ")";
    var anim = copy.animate([
      { transform: "translate(0px, 0px) scale(" + z + ")", boxShadow: "0 0 0 rgba(14, 14, 14, 0)", opacity: 1, easing: "ease-out" },
      { transform: lift, boxShadow: "0 16px 30px rgba(14, 14, 14, 0.28)", opacity: 1, offset: 0.2, easing: "cubic-bezier(0.45, 0, 0.25, 1)" },
      { transform: land, boxShadow: "0 6px 14px rgba(14, 14, 14, 0.2)", opacity: 1, offset: 0.86 },
      { transform: land, boxShadow: "0 0 0 rgba(14, 14, 14, 0)", opacity: 0 }
    ], { duration: FLY_MS, delay: index * STAGGER_MS, fill: "both" });
    anim.onfinish = anim.oncancel = function () { if (copy.parentNode) copy.parentNode.removeChild(copy); };
  }

  // Scroll the page just enough to show a section, from its heading (`top`,
  // the section or its only line) to its last line, and say where each line
  // will be. A section taller than the page shows from its heading, and the
  // cards for lines below the fold land at the foot of the page.
  function revealLines(scroller, rows, top) {
    var sr = scroller.getBoundingClientRect();
    var now = scroller.scrollTop, max = scroller.scrollHeight - scroller.clientHeight;
    var rects = rows.map(function (row) { return row.getBoundingClientRect(); });
    var first = top.getBoundingClientRect().top;
    var last = Math.max.apply(null, rects.map(function (rr) { return rr.bottom; }));
    var want = now;
    if (last > sr.bottom - 18) want = now + last - (sr.bottom - 18);
    if (first - (want - now) < sr.top + 8) want = now + first - (sr.top + 8);
    want = Math.max(0, Math.min(max, want));
    if (want !== now) scroller.scrollTo({ top: want, behavior: "smooth" });
    return rects.map(function (rr) {
      var y = Math.max(sr.top + 4, Math.min(sr.bottom - rr.height - 4, rr.top - (want - now)));
      return { left: rr.left, top: y, width: rr.width, height: rr.height };
    });
  }

  function ReportGraphInner(props) {
    var active = props.active;
    var rf = RF.useReactFlow();
    var rfRef = React.useRef(rf);
    rfRef.current = rf;
    var base = React.useMemo(reviewedGraph, []);

    // Reduced motion: the finished report, the graph already emptied into it.
    var nodesState = React.useState(function () {
      return REDUCED ? base.nodes.map(function (n) { return Object.assign({}, n, { className: "oxx-taken" }); }) : base.nodes;
    });
    var edgesState = React.useState(function () {
      return REDUCED ? base.edges.map(function (e) { return Object.assign({}, e, { className: e.className + " oxx-gone" }); }) : base.edges;
    });
    var rowsState = React.useState(function () {
      return REDUCED ? ITEMS.map(function (i) { return { id: i.id, phase: "in" }; }) : [];
    });
    var fadingState = React.useState(false);
    var nodes = nodesState[0], setNodes = nodesState[1];
    var edges = edgesState[0], setEdges = edgesState[1];
    var rows = rowsState[0], setRows = rowsState[1];
    var fading = fadingState[0], setFading = fadingState[1];
    var buildRef = React.useRef(null);
    var flowRef = React.useRef(null);
    var scrollRef = React.useRef(null);

    var fit = React.useCallback(function (duration) {
      rfRef.current.fitBounds(R_BOUNDS, { padding: 0.03, duration: duration || 0 });
    }, []);

    React.useEffect(function () {
      var el = flowRef.current;
      if (!el || !window.ResizeObserver) return undefined;
      var ro = new ResizeObserver(function () { fit(0); });
      ro.observe(el);
      return function () { ro.disconnect(); };
    }, [fit]);

    // Measured sizes come back through here, so keep them.
    var onNodesChange = React.useCallback(function (changes) {
      setNodes(function (ns) { return RF.applyNodeChanges(changes, ns); });
    }, []);

    // ---- The loop. Refs only, so the first render's functions stay good. ----
    var engineRef = React.useRef(null);
    if (!engineRef.current) {
      var S = { step: 0, active: false, running: false, started: false, alive: true, timers: [], taken: {} };
      var later = function (ms, fn) {
        var t = setTimeout(function () {
          S.timers = S.timers.filter(function (x) { return x !== t; });
          if (S.alive) fn();
        }, ms);
        S.timers.push(t);
      };
      var showTaken = function () {
        var taken = S.taken;
        setNodes(function (ns) {
          return ns.map(function (n) {
            var on = !!taken[n.id];
            return on === (n.className === "oxx-taken") ? n : Object.assign({}, n, { className: on ? "oxx-taken" : "" });
          });
        });
        setEdges(function (es) {
          return es.map(function (e) {
            var on = !!(taken[e.source] || taken[e.target]);
            var has = e.className.indexOf(" oxx-gone") !== -1;
            if (on === has) return e;
            return Object.assign({}, e, { className: on ? e.className + " oxx-gone" : e.className.replace(/ oxx-gone/g, "") });
          });
        });
      };
      var setPhase = function (id, phase) {
        setRows(function (rs) { return rs.map(function (r) { return r.id === id ? { id: id, phase: phase } : r; }); });
      };
      // One section, in one go: its lines take their room on the page
      // unseen, the page scrolls to it, all its cards lift off together and
      // fly in a moment apart, and each line shows as its cards land.
      var take = function (group) {
        return new Promise(function (resolve) {
          setRows(function (rs) {
            var have = {};
            rs.forEach(function (r) { have[r.id] = true; });
            return rs.concat(group.filter(function (i) { return !have[i.id]; })
              .map(function (i) { return { id: i.id, phase: "pending" }; }));
          });
          afterPaint(function () {
            var build = buildRef.current, scroller = scrollRef.current;
            if (!build || !scroller || !S.alive) { resolve(); return; }
            var rows = group.map(function (i) { return scroller.querySelector('[data-row="' + i.id + '"]'); });
            if (rows.some(function (r) { return !r; })) { resolve(); return; }
            var sec = scroller.querySelector(".sec-" + group[0].section) || rows[0];
            var targets = revealLines(scroller, rows, sec);
            var n = 0; // cards sent so far, for the stagger
            group.forEach(function (item, k) {
              item.nodes.forEach(function (id) {
                flyCard(build, id, targets[k], n);
                S.taken[id] = true;
                n += 1;
              });
              later(FLY_MS - 170 + (n - 1) * STAGGER_MS, function () { setPhase(item.id, "in"); });
            });
            showTaken();
            later(FLY_MS + (n - 1) * STAGGER_MS + 40, resolve);
          });
        });
      };
      var reset = function () {
        return new Promise(function (resolve) {
          setFading(true);
          S.taken = {};
          showTaken();
          later(750, function () {
            setRows([]);
            setFading(false);
            if (scrollRef.current) scrollRef.current.scrollTop = 0;
            resolve();
          });
        });
      };
      // Offscreen, the section in flight lands and the loop stops there.
      var next = function () {
        if (!S.alive) return;
        if (!S.active) { S.running = false; return; }
        if (S.step < GROUPS.length) {
          take(GROUPS[S.step]).then(function () {
            S.step += 1;
            later(GAP_MS, next);
          });
          return;
        }
        // The sign-off lines appear under the last line: bring them into view.
        afterPaint(function () {
          var sc = scrollRef.current;
          if (sc && S.alive) sc.scrollTo({ top: sc.scrollHeight - sc.clientHeight, behavior: "smooth" });
        });
        later(HOLD_MS, function () {
          reset().then(function () {
            S.step = 0;
            later(900, next);
          });
        });
      };
      engineRef.current = {
        setActive: function (on) {
          S.active = on;
          if (!on || S.running || REDUCED) return;
          S.running = true;
          later(S.started ? 300 : 900, next);
          S.started = true;
        },
        stop: function () {
          S.alive = false;
          S.timers.forEach(clearTimeout);
        }
      };
    }
    var engine = engineRef.current;

    React.useEffect(function () { engine.setActive(active); }, [engine, active]);
    React.useEffect(function () { return engine.stop; }, [engine]);

    var done = rows.length === ITEMS.length && rows.every(function (r) { return r.phase === "in"; });

    return h("div", {
      className: "oxx-report-build" + (fading ? " is-fading" : ""),
      ref: buildRef,
      role: "img",
      "aria-label": "The reviewed graph becoming the draft report, a section at a time: its items leave the graph together and become the report's areas inspected, observations, discussion, conclusion and recommendations."
    },
      h("div", { className: "oxx-review oxx-report-graph" },
        h("div", { className: "oxx-review-top" },
          h("span", { className: "oxx-review-label" }, "Reviewed graph"),
          h("span", { className: "oxx-status" }, done ? "Draft ready" : "Building the report")),
        h("div", { className: "oxx-review-flow", ref: flowRef },
          h(RF.ReactFlow, {
            nodes: nodes,
            edges: edges,
            nodeTypes: NODE_TYPES,
            edgeTypes: EDGE_TYPES,
            onNodesChange: onNodesChange,
            onInit: function () { fit(0); },
            nodesDraggable: false,
            nodesConnectable: false,
            nodesFocusable: false,
            edgesFocusable: false,
            elementsSelectable: false,
            panOnDrag: false,
            zoomOnScroll: false,
            zoomOnPinch: false,
            panOnScroll: false,
            zoomOnDoubleClick: false,
            preventScrolling: false,
            minZoom: 0.2,
            maxZoom: 1.6,
            // As on the review graph: removed at the founders' request.
            proOptions: { hideAttribution: true }
          })),
        h("div", { className: "oxx-review-foot" }, "Reviewed graph → draft report")),
      docChrome(rows, done, scrollRef));
  }

  // Same loading as ReviewGraph; `active` says whether it may play.
  function ReportGraph(props) {
    var R = window.React;
    var state = R.useState(window.ReactFlow ? "ready" : "loading");
    var xyflowSrc = props && props.xyflowSrc;
    R.useEffect(function () {
      if (state[0] === "ready") return undefined;
      var live = true;
      loadReactFlow(xyflowSrc).then(
        function () { if (live) state[1]("ready"); },
        function () { if (live) state[1]("failed"); }
      );
      return function () { live = false; };
    }, []);
    if (state[0] !== "ready") {
      return R.createElement("div", { className: "oxx-report-wait" },
        state[0] === "failed" ? "The report preview could not load." : "Loading the report preview…");
    }
    if (!RF) init();
    return R.createElement(RF.ReactFlowProvider, null,
      R.createElement(ReportGraphInner, { active: !props || props.active !== false }));
  }

  window.OxxFlow = window.OxxFlow || {};
  window.OxxFlow.ReviewGraph = ReviewGraph;
  window.OxxFlow.ReportGraph = ReportGraph;
})();
