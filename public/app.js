const mealTypes = ["pre-breakfast", "breakfast", "lunch", "dinner"];
let state = {
  meals: [],
  stats: null,
  draft: null,
  commentMeal: null,
  mealType: "pre-breakfast",
  view: "public"
};

const $ = (selector) => document.querySelector(selector);

const els = {
  publicView: $("#publicView"),
  adminView: $("#adminView"),
  tabs: document.querySelectorAll("[data-view]"),
  mealForm: $("#mealForm"),
  mealDate: $("#mealDate"),
  rawText: $("#rawText"),
  photoUrl: $("#photoUrl"),
  analyzeButton: $("#analyzeButton"),
  publishButton: $("#publishButton"),
  draftPreview: $("#draftPreview"),
  floatingComments: $("#floatingComments"),
  commentDialog: $("#commentDialog"),
  commentPulse: $("#commentPulse"),
  closeCommentDialog: $("#closeCommentDialog"),
  commentForm: $("#commentForm"),
  commentName: $("#commentName"),
  commentText: $("#commentText"),
  commentMealCaption: $("#commentMealCaption"),
  toast: $("#toast"),
  latestDayTitle: $("#latestDayTitle"),
  latestMeals: $("#latestMeals"),
  recentMeals: $("#recentMeals"),
  routineMap: $("#routineMap"),
  topFoods: $("#topFoods"),
  sourceSplit: $("#sourceSplit")
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function titleCase(value) {
  return String(value || "").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("is-visible"), 2400);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Request failed");
  return payload;
}

async function refresh() {
  const [meals, stats] = await Promise.all([api("/api/meals"), api("/api/stats")]);
  state.meals = meals;
  state.stats = stats;
  render();
}

function switchView(view) {
  state.view = view;
  els.publicView.hidden = view !== "public";
  els.adminView.hidden = view !== "admin";
  els.tabs.forEach((button) => button.classList.toggle("is-active", button.dataset.view === view));
}

function setMealType(mealType) {
  state.mealType = mealType;
  document.querySelectorAll("[data-meal-type]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mealType === mealType);
  });
}

function chipList(tags = [], limit = 4) {
  return tags
    .slice(0, limit)
    .map((tag, index) => `<span class="chip ${index === 0 ? "tomato" : ""}">${escapeHtml(tag)}</span>`)
    .join("");
}

function sourceLabel(source) {
  if (source === "restaurant") return "out";
  if (source === "takeout") return "takeout";
  if (source === "home") return "home";
  if (source === "skipped") return "skipped";
  return "source?";
}

function mealCard(meal, { compact = false } = {}) {
  if (!meal) {
    return `
      <article class="meal-card empty">
        <div class="meal-meta"><span>empty</span></div>
        <p>No public entry.</p>
      </article>
    `;
  }

  const foods = meal.foods?.length ? meal.foods.join(", ") : "Skipped";
  const commentCount = Array.isArray(meal.comments) ? meal.comments.length : 0;
  return `
    <article class="meal-card meal-${escapeHtml(meal.mealType)} source-${escapeHtml(meal.source || "unknown")}">
      <div class="meal-meta">
        <span class="meal-meta-left">
          <span>${escapeHtml(titleCase(meal.mealType))}</span>
          <span class="source-badge source-${escapeHtml(meal.source || "unknown")}">${escapeHtml(sourceLabel(meal.source))}</span>
        </span>
        <span>${formatDate(meal.date)}</span>
      </div>
      <p>${escapeHtml(meal.publicCaption || foods)}</p>
      <div class="meal-actions">
        ${compact ? "" : `<div class="chips">${chipList(meal.tags || [])}</div>`}
        <button class="comment-action" type="button" data-comment-meal-id="${escapeHtml(meal.id)}">
          ${commentCount ? `${commentCount} comment${commentCount === 1 ? "" : "s"}` : "comment"}
        </button>
      </div>
    </article>
  `;
}

function renderTopline(stats) {
  $("#agentDigest").textContent = stats.digest;
  $("#totalMeals").textContent = stats.totalMeals;
  $("#currentStreak").textContent = stats.currentStreak;
  $("#entropyScore").textContent = stats.entropy;

  setRing("#breakfastRing", stats.breakfastConsistency);
  setRing("#publicRing", stats.publicCompleteness);
  setRing("#repeatRing", stats.repeatGravity);

  $("#streakFood").textContent = titleCase(stats.longestFoodStreak.label);
  $("#streakDays").textContent = `${stats.longestFoodStreak.days} days`;
}

function setRing(selector, value) {
  const ring = $(selector);
  ring.style.setProperty("--value", value);
  ring.querySelector("span").textContent = `${value}%`;
}

function renderLatest(stats) {
  const latestDate = stats.lastDate;
  els.latestDayTitle.textContent = formatDate(latestDate);
  const byType = new Map(state.meals.filter((meal) => meal.date === latestDate).map((meal) => [meal.mealType, meal]));
  els.latestMeals.innerHTML = mealTypes.map((type) => mealCard(byType.get(type), { compact: true })).join("");
}

function routineCellTitle(date, type, cell) {
  const stateLabel = titleCase(cell.state);
  const source = sourceLabel(cell.source);
  const repeat = cell.repeatCount ? `${cell.repeatCount} appearance${cell.repeatCount === 1 ? "" : "s"}` : "not repeated";
  const comments = cell.commentCount ? `${cell.commentCount} comment${cell.commentCount === 1 ? "" : "s"}` : "no comments";
  return `${formatDate(date)} ${type}: ${stateLabel}. ${source}. ${repeat}. ${comments}. ${cell.label}`;
}

function renderRoutineMap(stats) {
  els.routineMap.innerHTML = stats.routineMap
    .map((day) => {
      const label = day.weekday.slice(0, 1);
      return `
        <div class="routine-day" title="${formatDate(day.date)}">
          <span class="routine-label">${label}</span>
          ${mealTypes
            .map((type) => {
              const cell = day.cells[type];
              const classes = [
                "routine-cell",
                `routine-${cell.state}`,
                `source-${cell.source || "unknown"}`,
                cell.commentCount ? "has-comments" : ""
              ]
                .filter(Boolean)
                .join(" ");
              return `<span class="${classes}" title="${escapeHtml(routineCellTitle(day.date, type, cell))}" aria-label="${escapeHtml(routineCellTitle(day.date, type, cell))}" role="img"></span>`;
            })
            .join("")}
        </div>
      `;
    })
    .join("");
}

function renderBars(stats) {
  const max = Math.max(1, ...stats.topFoods.map((item) => item.count));
  els.topFoods.innerHTML = stats.topFoods
    .slice(0, 8)
    .map(
      (item) => `
        <div class="bar-row">
          <span>${titleCase(item.label)}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${Math.max(8, (item.count / max) * 100)}%"></span></span>
          <span>${item.count}</span>
        </div>
      `
    )
    .join("");
}

function renderSourceSplit(stats) {
  const total = Math.max(1, stats.sourceCounts.reduce((sum, item) => sum + item.count, 0));
  els.sourceSplit.innerHTML = stats.sourceCounts
    .map(
      (item, index) => `
        <div class="source-item">
          <header><span>${titleCase(item.label)}</span><span>${item.count}</span></header>
          <div class="source-line"><span style="width:${(item.count / total) * 100}%; background:${["#168ca1", "#2aa866", "#e75d45", "#c79220"][index % 4]}"></span></div>
        </div>
      `
    )
    .join("");
}

function renderRecent(stats) {
  els.recentMeals.innerHTML = stats.latestMeals.map((meal) => mealCard(meal)).join("");
}

function renderDraft() {
  const draft = state.draft;
  els.publishButton.disabled = !draft;
  if (!draft) {
    els.draftPreview.className = "draft-empty";
    els.draftPreview.innerHTML = "No draft yet.";
    return;
  }

  els.draftPreview.className = "draft-card";
  const issues = draft.privacyIssues?.length
    ? `<div class="chips">${draft.privacyIssues.map((issue) => `<span class="chip tomato">${issue.label}</span>`).join("")}</div>`
    : `<div class="chips"><span class="chip">privacy clear</span></div>`;

  els.draftPreview.innerHTML = `
    <div class="draft-caption">${draft.publicCaption}</div>
    <div class="draft-meta">
      <div><small>source</small><span>${draft.source}</span></div>
      <div><small>cuisine</small><span>${draft.cuisine}</span></div>
      <div><small>confidence</small><span>${Math.round(draft.confidence * 100)}%</span></div>
    </div>
    ${issues}
    <ul class="trace">
      ${(draft.agentTrace || [])
        .map(
          (step) => `
            <li>
              <b>${step.name}</b>
              <span class="status ${step.status}">${step.status}</span>
              <span>${step.summary}</span>
            </li>
          `
        )
        .join("")}
    </ul>
  `;
}

function render() {
  if (!state.stats) return;
  renderTopline(state.stats);
  renderLatest(state.stats);
  renderRoutineMap(state.stats);
  renderBars(state.stats);
  renderSourceSplit(state.stats);
  renderFloatingComments(state.stats);
  renderRecent(state.stats);
  renderDraft();
}

function floatingPoint(index, total) {
  const columns = [18, 50, 82, 18, 50, 82];
  const rows = [31, 31, 31, 69, 69, 69];
  return {
    x: columns[index % columns.length],
    y: rows[(index + total) % rows.length],
    delay: (index % 6) * -1.3
  };
}

function renderFloatingComments(stats) {
  const comments = stats.recentComments || [];
  els.commentPulse.textContent = `${stats.commentCount || 0} public comment${stats.commentCount === 1 ? "" : "s"} from ${stats.activeCommenters || 0} friend${stats.activeCommenters === 1 ? "" : "s"}.`;
  if (!comments.length) {
    els.floatingComments.innerHTML = `<div class="floating-empty">No comments yet.</div>`;
    return;
  }

  els.floatingComments.innerHTML = comments
    .slice(0, 6)
    .map((comment, index) => {
      const point = floatingPoint(index, comments.length);
      const tone = index % 4;
      return `
        <button class="floating-comment tone-${tone}" type="button" data-comment-meal-id="${escapeHtml(comment.mealId)}" style="--x:${point.x}%; --y:${point.y}%; --delay:${point.delay}s">
          <strong>${escapeHtml(comment.name)}</strong>
          <span>${escapeHtml(comment.text)}</span>
        </button>
      `;
    })
    .join("");
}

function openCommentDialog(mealId) {
  const meal = state.meals.find((item) => item.id === mealId);
  if (!meal) return;
  state.commentMeal = meal;
  els.commentMealCaption.textContent = meal.publicCaption || meal.foods?.join(", ") || "Meal";
  els.commentText.value = "";
  els.commentDialog.hidden = false;
  els.commentName.focus();
}

function closeCommentDialog() {
  els.commentDialog.hidden = true;
  state.commentMeal = null;
}

async function submitComment(event) {
  event.preventDefault();
  if (!state.commentMeal) return;

  const button = els.commentForm.querySelector("button");
  button.disabled = true;
  try {
    await api(`/api/meals/${encodeURIComponent(state.commentMeal.id)}/comments`, {
      method: "POST",
      body: JSON.stringify({
        name: els.commentName.value,
        text: els.commentText.value
      })
    });
    closeCommentDialog();
    await refresh();
    showToast("Comment posted.");
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
  }
}

function formPayload() {
  return {
    date: els.mealDate.value,
    mealType: state.mealType,
    rawText: els.rawText.value,
    photoUrl: els.photoUrl.value
  };
}

async function analyzeMeal(event) {
  event.preventDefault();
  els.analyzeButton.disabled = true;
  els.analyzeButton.textContent = "Running...";
  try {
    state.draft = await api("/api/analyze", {
      method: "POST",
      body: JSON.stringify(formPayload())
    });
    renderDraft();
    showToast("Agents produced a draft.");
  } catch (error) {
    showToast(error.message);
  } finally {
    els.analyzeButton.disabled = false;
    els.analyzeButton.textContent = "Run Agents";
  }
}

async function publishMeal() {
  if (!state.draft) return;
  els.publishButton.disabled = true;
  try {
    await api("/api/meals", {
      method: "POST",
      body: JSON.stringify(state.draft)
    });
    state.draft = null;
    els.rawText.value = "";
    els.photoUrl.value = "";
    await refresh();
    switchView("public");
    showToast("Meal published.");
  } catch (error) {
    showToast(error.message);
  } finally {
    renderDraft();
  }
}

function wireEvents() {
  els.tabs.forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });
  document.querySelectorAll("[data-meal-type]").forEach((button) => {
    button.addEventListener("click", () => setMealType(button.dataset.mealType));
  });
  els.mealForm.addEventListener("submit", analyzeMeal);
  els.publishButton.addEventListener("click", publishMeal);
  els.closeCommentDialog.addEventListener("click", closeCommentDialog);
  els.commentDialog.addEventListener("click", (event) => {
    if (event.target === els.commentDialog) closeCommentDialog();
  });
  els.commentForm.addEventListener("submit", submitComment);
  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-comment-meal-id]");
    if (target) openCommentDialog(target.dataset.commentMealId);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.commentDialog.hidden) closeCommentDialog();
  });
}

async function init() {
  els.mealDate.value = todayIso();
  wireEvents();
  await refresh();
}

init().catch((error) => {
  showToast(error.message);
});
