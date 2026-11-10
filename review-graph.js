// Review graph: a live React Flow map that continues the Inspect video's site
// visit into review. A scripted cycle builds the evidence tree, draws thinking
// links, raises hypotheses, reaches a conclusion and proposes actions. Then a
// "Professional review" pointer, standing in for the engineer, clicks the tick
// or cross on each hypothesis and action. Any touch pauses the script. After
// IDLE_MS without input the pointer drags moved nodes home one at a time and
// clicks the script's choices back in, then the script carries on. At the end
// of the cycle the map clears and redraws.
//
// Exposes window.OxxFlow.ReviewGraph. It uses the page's React 18 and loads
// the @xyflow/react UMD build from its `xyflowSrc` prop on first render, unless
// window.ReactFlow is already there. The homepage mounts it from script.js.
(function () {
  "use strict";
  var React, RF, h; // set by init() once React Flow is loaded
  var IDLE_MS = 4000;
  // On touch screens a drag on the map scrolls the page instead of moving nodes.
  var TOUCH = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

  // ---- Example case, continuing the site visit from the Inspect video ----
  var COL = [0, 170, 340, 510];
  var BOUNDS = { x: -14, y: -10, width: 690, height: 690 };
  // Where the pointer comes in and leaves.
  var ENTRY = { x: BOUNDS.x + BOUNDS.width - 40, y: BOUNDS.y + 40 };
  var EXIT = { x: BOUNDS.x + BOUNDS.width - 40, y: BOUNDS.y + BOUNDS.height - 60 };

  var AREAS = [
    { id: "court", label: "Courtyard", tone: "green", col: 0, level: "High", defect: "Defect identified", relevance: "Relevant" },
    { id: "base", label: "Basement", tone: "blue", col: 1, level: "Low", defect: "No defect", relevance: "Reference" },
    { id: "roof", label: "Rooftop", tone: "yellow", col: 2, level: "High", defect: "Defect identified", relevance: "Relevant" },
    { id: "hist", label: "Historic Report", tone: "purple", col: 3, level: "Medium", defect: "No defect", relevance: "Supporting" }
  ];

  var EVIDENCE = [
    { id: "ev-court-video", area: "court", kind: "video", priority: "high", caption: "Courtyard defect", slot: 0, of: 2 },
    { id: "ev-court-report", area: "court", kind: "report", priority: "high", caption: "Courtyard report", slot: 1, of: 2 },
    { id: "ev-base-image", area: "base", kind: "image", priority: "low", caption: "Basement photo", slot: 0, of: 1 },
    { id: "ev-roof-video", area: "roof", kind: "video", priority: "high", caption: "Roof inspection", slot: 0, of: 2 },
    { id: "ev-roof-image", area: "roof", kind: "image", priority: "high", caption: "Roof defect photo", slot: 1, of: 2 },
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

  // Where every node belongs. Tidying moves nodes back here.
  var LAYOUT = { root: { x: 270, y: 0 }, con: { x: 165, y: 478 } };
  AREAS.forEach(function (a) {
    LAYOUT["ar-" + a.id] = { x: COL[a.col], y: 66 };
    LAYOUT["im-" + a.id] = { x: COL[a.col], y: 134 };
  });
  EVIDENCE.forEach(function (e) {
    var col = COL[AREAS.filter(function (a) { return a.id === e.area; })[0].col];
    LAYOUT[e.id] = { x: e.of === 2 ? col + (e.slot ? 78 : 2) : col + 40, y: 230 };
  });
  HYPOTHESES.forEach(function (hy) { LAYOUT[hy.id] = { x: COL[hy.col], y: 352 }; });
  ACTIONS.forEach(function (ac) { LAYOUT[ac.id] = { x: COL[ac.col], y: 584 }; });

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
    tick: function () { return svg(h("path", { d: "M3.5 8.5 L6.5 11.5 L12.5 4.5", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }), 12); },
    cross: function () { return svg(h("path", { d: "M4 4 L12 12 M12 4 L4 12", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" }), 12); }
  };

  var LEVEL_CLASS = { High: "high", Low: "low", Medium: "medium" };

  function RootNode(props) {
    return h("div", { className: cls("oxx-root", props.data) }, handles(), "Site visit");
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
      h("span", { className: "oxx-imp-defect" }, d.defect),
      h("span", { className: "oxx-imp-rel" }, "Relevance: " + d.relevance));
  }

  function EvidenceNode(props) {
    var d = props.data;
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

    add(600, function () { addNode({ id: "root", type: "root", data: {} }); });
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
        addNode({ id: e.id, type: "evidence", data: e });
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

    function interact() {
      if (!S.alive) return;
      S.paused = true;
      S.token += 1;
      clearTimeout(S.timer);
      clearTimeout(S.idle);
      clearTimeout(S.pause);
      if (S.frame) cancelAnimationFrame(S.frame);
      S.frame = null;
      if (S.cursorAt) hideCursor();
      api.setMode("paused");
      S.idle = setTimeout(function () {
        var token = S.token;
        tidy().then(function () {
          if (token !== S.token) return;
          S.paused = false;
          api.setMode("running");
          schedule();
        });
      }, IDLE_MS);
    }

    function stop() {
      S.alive = false;
      clearTimeout(S.timer);
      clearTimeout(S.idle);
      clearTimeout(S.pause);
      if (S.frame) cancelAnimationFrame(S.frame);
    }

    return { start: schedule, interact: interact, stop: stop };
  }

  var STATUS_TEXT = { running: "Professional review", paused: "Paused: you're in control", tidying: "Professional review" };

  function ReviewGraphInner() {
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

    React.useEffect(function () {
      engine.start();
      return engine.stop;
    }, [engine]);

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

    return h("div", { className: "oxx-review" },
      h("div", { className: "oxx-review-top" },
        h("span", { className: "oxx-review-label" }, "Review map"),
        h("span", { className: "oxx-status is-" + modeState[0], "aria-live": "polite" }, STATUS_TEXT[modeState[0]])),
      h("div", { className: "oxx-review-flow", ref: flowRef, onPointerDownCapture: engine.interact, onPointerMoveCapture: onPointerMove },
        h(RF.ReactFlow, {
          nodes: nodes,
          edges: edges,
          nodeTypes: NODE_TYPES,
          edgeTypes: EDGE_TYPES,
          onNodesChange: onNodesChange,
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
          defaultEdgeOptions: { focusable: false }
        })),
      h("div", { className: "oxx-review-foot" }, "Connected reasoning • Observation → Hypothesis → Conclusion → Action"));
  }

  function ReviewGraphReady() {
    return h(RF.ReactFlowProvider, null, h(ReviewGraphInner));
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
        state[0] === "failed" ? "The review map could not load." : "Loading the review map…");
    }
    if (!RF) init();
    return R.createElement(ReviewGraphReady);
  }

  window.OxxFlow = window.OxxFlow || {};
  window.OxxFlow.ReviewGraph = ReviewGraph;
})();
