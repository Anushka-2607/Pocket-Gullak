
"use strict";

/* POCKET GULLAK — multi-expense voice entry */

const TX_KEY = "pocketGullak.transactions.v1";
const SAVINGS_KEY = "pocketGullak.savings.v1";
const SETTINGS_KEY = "pocketGullak.settings.v1";

const CATEGORIES = [
  "Food", "Groceries", "Travel", "Shopping", "Bills",
  "Health", "Education", "Entertainment", "Personal care", "Other"
];

const PAGE_INFO = {
  home: ["A little more clarity.", "Understand your spending, one small step at a time."],
  voice: ["Every expense has a story.", "Say your daily list, review it, and save it together."],
  stats: ["Know where it goes.", "A clear picture of your spending habits."],
  tips: ["Small insights, better habits.", "Use your spending patterns to make thoughtful choices."],
  savings: ["Make room for tomorrow.", "Build a saving habit with virtual round-ups."]
};

const $ = (selector) => document.querySelector(selector);

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function readJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    alert("Your browser could not save the data. Check your available storage.");
    return false;
  }
}

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number(value) || 0);
}

let transactions = readJSON(TX_KEY, []);
if (!Array.isArray(transactions)) transactions = [];

transactions = transactions.filter((t) =>
  t && typeof t.id === "string" && typeof t.name === "string" &&
  Number.isFinite(Number(t.amount)) && Number(t.amount) > 0 &&
  typeof t.date === "string"
);

const oldSavings = readJSON(SAVINGS_KEY, {});
let savings = {
  movedIds: Array.isArray(oldSavings.movedIds) ? oldSavings.movedIds : []
};

const oldSettings = readJSON(SETTINGS_KEY, {});
let roundIncrement = [5, 10, 20, 50, 100].includes(Number(oldSettings.increment))
  ? Number(oldSettings.increment) : 10;

function saveAll() {
  const a = writeJSON(TX_KEY, transactions);
  const b = writeJSON(SAVINGS_KEY, savings);
  const c = writeJSON(SETTINGS_KEY, { increment: roundIncrement });
  return a && b && c;
}

function roundUp(amount) {
  const cents = Math.round(Number(amount) * 100);
  const step = roundIncrement * 100;
  if (!Number.isFinite(cents) || cents <= 0 || cents % step === 0) return 0;
  return (step - cents % step) / 100;
}

function total(items) {
  return items.reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthItems(key) {
  return transactions.filter((t) => t.date.slice(0, 7) === key);
}

function previousMonthKey() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return monthKey(d);
}

function dateLabel(value) {
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric"
  });
}

/* ---------------- Navigation ---------------- */

function showPage(name) {
  if (!PAGE_INFO[name]) return;

  document.querySelectorAll(".page").forEach((p) =>
    p.classList.toggle("active", p.id === `page-${name}`)
  );

  document.querySelectorAll(".nav-item").forEach((b) =>
    b.classList.toggle("active", b.dataset.page === name)
  );

  $("#pageHeading").textContent = PAGE_INFO[name][0];
  $("#pageSubheading").textContent = PAGE_INFO[name][1];
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-page]").forEach((b) =>
  b.addEventListener("click", () => showPage(b.dataset.page))
);

document.querySelectorAll("[data-go]").forEach((b) =>
  b.addEventListener("click", () => showPage(b.dataset.go))
);

$("#homeLink").addEventListener("click", (e) => {
  e.preventDefault();
  showPage("home");
});

/* ---------------- Categories ---------------- */

function suggestCategory(description) {
  const text = description.toLowerCase();

  const rules = [
    ["Groceries", /\b(grocery|groceries|vegetable|vegetables|fruit|fruits|milk|rice|flour|supermarket|kirana)\b/],
    ["Travel", /\b(bus|train|metro|taxi|cab|uber|ola|auto|rickshaw|petrol|diesel|fuel|travel|parking)\b/],
    ["Bills", /\b(electricity|electric|water bill|internet bill|mobile recharge|recharge|wifi|broadband|gas bill)\b/],
    ["Health", /\b(doctor|hospital|medicine|medicines|pharmacy|medical|clinic|health)\b/],
    ["Education", /\b(book|books|college|course|tuition|exam|education|stationery|school fee)\b/],
    ["Entertainment", /\b(movie|cinema|netflix|concert|game|gaming|entertainment|subscription)\b/],
    ["Personal care", /\b(salon|haircut|shampoo|skincare|personal care|beauty)\b/],
    ["Shopping", /\b(shopping|shirt|dress|clothes|shoes|bag|amazon|flipkart)\b/],
    ["Food", /\b(lunch|dinner|breakfast|food|restaurant|cafe|coffee|tea|snack|snacks|pizza|burger|meal|biryani|dosa|idli)\b/]
  ];

  for (const [category, pattern] of rules) {
    if (pattern.test(text)) return category;
  }

  return "Other";
}

function categoryOptions(selected = "Other") {
  return CATEGORIES.map((c) =>
    `<option value="${c}" ${c === selected ? "selected" : ""}>${c}</option>`
  ).join("");
}

/* ---------------- Number words ---------------- */

const SMALL_NUMBERS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19
};

const TENS = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90
};

const NUMBER_WORD =
  "(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|" +
  "eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|" +
  "eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|" +
  "eighty|ninety|hundred|thousand|lakh|lac|and|point)";

function wordsToNumber(phrase) {
  const words = phrase.toLowerCase().replace(/-/g, " ").split(/\s+/);
  let totalValue = 0;
  let current = 0;
  let decimal = false;
  let decimalDigits = "";

  for (const word of words) {
    if (word === "and") continue;

    if (word === "point") {
      decimal = true;
      continue;
    }

    if (decimal) {
      const digit = Object.prototype.hasOwnProperty.call(SMALL_NUMBERS, word)
        ? SMALL_NUMBERS[word] : null;
      if (digit === null || digit > 9) return null;
      decimalDigits += String(digit);
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(SMALL_NUMBERS, word)) {
      current += SMALL_NUMBERS[word];
    } else if (Object.prototype.hasOwnProperty.call(TENS, word)) {
      current += TENS[word];
    } else if (word === "hundred") {
      current = Math.max(current, 1) * 100;
    } else if (word === "thousand") {
      totalValue += Math.max(current, 1) * 1000;
      current = 0;
    } else if (word === "lakh" || word === "lac") {
      totalValue += Math.max(current, 1) * 100000;
      current = 0;
    } else {
      return null;
    }
  }

  let result = totalValue + current;
  if (decimal && decimalDigits) result += Number(`0.${decimalDigits}`);
  return Number.isFinite(result) ? result : null;
}

/* ---------------- Multi-expense parser ---------------- */

/*
Examples supported:
"50 rupees on lunch, 160 on travel, 140 on groceries"
"I spent 50 on lunch and 160 on travel"
"lunch 50 rupees. bus 40 rupees. coffee 70 rupees"
"one hundred and fifty rupees on dinner, twenty rupees on tea"

We split on commas, sentence endings, "then", and "and" only
when "and" appears before a new amount. This avoids splitting
number phrases like "one hundred and fifty".
*/

function splitExpenseClauses(text) {
  let cleaned = text
    .replace(/\b(?:next|then)\b/gi, " | ")
    .replace(/[;\n.!?]+/g, " | ")
    .replace(/,\s*/g, " | ");

  const numericStart = String.raw`(?:₹\s*\d|\b\d|(?:${NUMBER_WORD})\s+(?:${NUMBER_WORD}|rupees?|rs\.?|inr)\b)`;

  const andBoundary = new RegExp(
    String.raw`\s+\band\b\s+(?=${numericStart})`,
    "gi"
  );

  cleaned = cleaned.replace(andBoundary, " | ");
  return cleaned.split("|").map((s) => s.trim()).filter(Boolean);
}

function findAmount(clause) {
  // Explicit numeric amount: ₹150, Rs. 150, 150 rupees, or 150 on lunch.
  const numericPatterns = [
    /₹\s*(\d[\d,]*(?:\.\d{1,2})?)/i,
    /\b(?:rs\.?|inr)\s*(\d[\d,]*(?:\.\d{1,2})?)/i,
    /\b(\d[\d,]*(?:\.\d{1,2})?)\s*(?:rupees?|rs\.?|inr)\b/i,
    /\b(\d[\d,]*(?:\.\d{1,2})?)\b/
  ];

  for (const pattern of numericPatterns) {
    const match = pattern.exec(clause);
    if (match) {
      const amount = Number(match[1].replace(/,/g, ""));
      if (Number.isFinite(amount) && amount > 0) {
        return { amount, start: match.index, end: match.index + match[0].length };
      }
    }
  }

  // Number words must be followed by a currency word to avoid
  // treating ordinary words in a description as an amount.
  const wordPattern = new RegExp(
    String.raw`\b(${NUMBER_WORD}(?:[\s-]+${NUMBER_WORD})*)\s*(?:rupees?|rs\.?|inr)\b`,
    "i"
  );

  const match = wordPattern.exec(clause);
  if (match) {
    const amount = wordsToNumber(match[1]);
    if (Number.isFinite(amount) && amount > 0) {
      return { amount, start: match.index, end: match.index + match[0].length };
    }
  }

  return null;
}

function cleanDescription(text) {
  return text
    .replace(/₹\s*[\d,]+(?:\.\d{1,2})?/gi, " ")
    .replace(/\b(?:rs\.?|inr)\s*[\d,]+(?:\.\d{1,2})?/gi, " ")
    .replace(/\b[\d,]+(?:\.\d{1,2})?\s*(?:rupees?|rs\.?|inr)\b/gi, " ")
    .replace(new RegExp(
      String.raw`\b${NUMBER_WORD}(?:[\s-]+${NUMBER_WORD})*\s*(?:rupees?|rs\.?|inr)\b`,
      "gi"
    ), " ")
    .replace(/\b(i spent|i paid|spent|paid|bought|purchase|purchased|rupees?|rupee|rs\.?|inr|on|for|and|then|today|yesterday)\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, "")
    .trim();
}

function parseOneClause(clause) {
  const found = findAmount(clause);
  if (!found) return null;

  // First try words after the amount: "50 rupees on lunch".
  const afterAmount = cleanDescription(clause.slice(found.end));
  // Also handle "lunch for 50 rupees".
  const beforeAmount = cleanDescription(clause.slice(0, found.start));

  let description = afterAmount || beforeAmount;

  if (!description || /^[\d\s.,]+$/.test(description)) {
    description = "Expense";
  }

  description = description.charAt(0).toUpperCase() + description.slice(1);

  return {
    name: description.slice(0, 100),
    amount: Math.round(found.amount * 100) / 100,
    date: today(),
    category: suggestCategory(description)
  };
}

function parseExpenseList(text) {
  const clauses = splitExpenseClauses(text);
  const found = [];
  const skipped = [];

  for (const clause of clauses) {
    const expense = parseOneClause(clause);
    if (expense) found.push(expense);
    else skipped.push(clause);
  }

  // If a sentence contains only one amount and the split failed to
  // identify a description, still show the amount for user review.
  return { expenses: found, skipped };
}

/* ---------------- Voice recognition ---------------- */

const SpeechRecognition = window.SpeechRecognition ||
  window.webkitSpeechRecognition;

let recognition = null;
let isListening = false;
let finalTranscript = "";

function setVoiceStatus(message, isError = false) {
  $("#voiceStatus").textContent = message;
  $("#voiceMessage").textContent = "";
  $("#voiceMessage").classList.toggle("error", isError);
}

function startListening() {
  if (!SpeechRecognition) {
    setVoiceStatus("Voice recognition is not supported here. Type your list instead.", true);
    $("#voiceTranscript").focus();
    return;
  }

  if (!window.isSecureContext &&
      location.hostname !== "localhost" &&
      location.hostname !== "127.0.0.1") {
    setVoiceStatus("Use HTTPS or localhost for microphone access. You can type your list instead.", true);
    return;
  }

  if (isListening) {
    try { recognition.stop(); } catch (_) {}
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.interimResults = true;
  recognition.continuous = true;
  recognition.maxAlternatives = 1;
  finalTranscript = "";

  recognition.onstart = () => {
    isListening = true;
    $("#micButton").classList.add("listening");
    $("#micButton").setAttribute("aria-label", "Stop voice recognition");
    setVoiceStatus("Listening… say your full list, then press the microphone to stop.");
  };

  recognition.onresult = (event) => {
    let interim = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const words = event.results[i][0].transcript.trim();
      if (event.results[i].isFinal) {
        finalTranscript += words + " ";
      } else {
        interim += words + " ";
      }
    }

    $("#voiceTranscript").value = (finalTranscript + interim).trim();
  };

  recognition.onerror = (event) => {
    const messages = {
      "not-allowed": "Microphone permission denied. Allow it in your browser settings or type instead.",
      "audio-capture": "No microphone found. Check your device or type instead.",
      "no-speech": "No speech detected. Try again.",
      "network": "The browser speech service could not connect. Try again or type instead.",
      "service-not-allowed": "Speech recognition is not available here. Type your list instead."
    };
    setVoiceStatus(messages[event.error] || "Voice recognition stopped. You can edit the text below.", true);
  };

  recognition.onend = () => {
    isListening = false;
    $("#micButton").classList.remove("listening");
    $("#micButton").setAttribute("aria-label", "Start voice recognition");
    if ($("#voiceTranscript").value.trim()) {
      setVoiceStatus("Recording finished. Select Find all expenses to review your list.");
    }
  };

  try {
    recognition.start();
  } catch {
    setVoiceStatus("Could not start the microphone. Try again or type your list.", true);
  }
}

$("#micButton").addEventListener("click", startListening);

$("#clearVoice").addEventListener("click", () => {
  if (recognition && isListening) {
    try { recognition.stop(); } catch (_) {}
  }

  $("#voiceTranscript").value = "";
  $("#reviewArea").classList.add("hidden");
  $("#voiceMessage").textContent = "";
  $("#batchMessage").textContent = "";
  setVoiceStatus("Press the microphone to begin");
});

document.querySelectorAll("[data-example]").forEach((button) => {
  button.addEventListener("click", () => {
    $("#voiceTranscript").value = button.dataset.example;
    setVoiceStatus("Example added. Select Find all expenses.");
    $("#voiceTranscript").focus();
  });
});

/* ---------------- Batch review interface ---------------- */

let reviewExpenses = [];

function renderBatchReview() {
  const container = $("#batchReviewList");
  container.replaceChildren();

  reviewExpenses.forEach((expense, index) => {
    const card = document.createElement("article");
    card.className = "batch-row";

    const head = document.createElement("div");
    head.className = "batch-row-head";

    const title = document.createElement("strong");
    title.textContent = `Expense ${index + 1}`;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "batch-remove";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      reviewExpenses.splice(index, 1);
      renderBatchReview();
    });

    head.append(title, remove);

    const fields = document.createElement("div");
    fields.className = "batch-fields";

    const fieldSpecs = [
      { key: "name", label: "Description", type: "text", value: expense.name },
      { key: "amount", label: "Amount (₹)", type: "number", value: expense.amount },
      { key: "date", label: "Date", type: "date", value: expense.date },
      { key: "category", label: "Category", type: "select", value: expense.category }
    ];

    for (const spec of fieldSpecs) {
      const wrapper = document.createElement("div");
      const label = document.createElement("label");
      label.textContent = spec.label;

      const input = spec.type === "select"
        ? document.createElement("select")
        : document.createElement("input");

      if (spec.type === "select") {
        input.innerHTML = categoryOptions(spec.value);
      } else {
        input.type = spec.type;
      }

      input.value = spec.value;
      input.required = true;
      if (spec.key === "amount") {
        input.min = "0.01";
        input.step = "0.01";
      }
      if (spec.key === "name") input.maxLength = 100;

      input.addEventListener("input", () => {
        expense[spec.key] = input.value;
        updateBatchTotals();
      });

      wrapper.append(label, input);
      fields.appendChild(wrapper);
    }

    card.append(head, fields);
    container.appendChild(card);
  });

  $("#reviewArea").classList.remove("hidden");
  updateBatchTotals();
}

function updateBatchTotals() {
  $("#batchCount").textContent = reviewExpenses.length;

  const spending = reviewExpenses.reduce((sum, item) => {
    const amount = Number(item.amount);
    return sum + (Number.isFinite(amount) && amount > 0 ? amount : 0);
  }, 0);

  const roundup = reviewExpenses.reduce((sum, item) => {
    const amount = Number(item.amount);
    return sum + (Number.isFinite(amount) && amount > 0 ? roundUp(amount) : 0);
  }, 0);

  $("#batchTotal").textContent = money(spending);
  $("#batchRoundup").textContent = money(roundup);
}

$("#parseVoice").addEventListener("click", () => {
  const text = $("#voiceTranscript").value.trim();

  if (!text) {
    setVoiceStatus("Speak or type your expense list first.", true);
    return;
  }

  const result = parseExpenseList(text);
  reviewExpenses = result.expenses;

  if (!reviewExpenses.length) {
    setVoiceStatus("No amount was found. Try “50 rupees on lunch, 160 on travel” or enter expenses manually.", true);
    $("#reviewArea").classList.add("hidden");
    return;
  }

  renderBatchReview();

  let message = `Found ${reviewExpenses.length} expense${reviewExpenses.length === 1 ? "" : "s"}. Review every row before saving.`;
  if (result.skipped.length) {
    message += ` ${result.skipped.length} phrase(s) could not be interpreted and were skipped.`;
  }

  $("#batchMessage").textContent = message;
  $("#batchMessage").classList.toggle("error", result.skipped.length > 0);
  setVoiceStatus("Expense list prepared. Check the rows below.");
  $("#reviewArea").scrollIntoView({ behavior: "smooth", block: "start" });
});

$("#cancelReview").addEventListener("click", () => {
  $("#reviewArea").classList.add("hidden");
  reviewExpenses = [];
  $("#batchMessage").textContent = "";
});

/* ---------------- Save expenses ---------------- */

function validateExpense(item) {
  if (!String(item.name || "").trim()) return "Every expense needs a description.";

  const amount = Number(item.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return `Enter a valid amount for "${item.name}".`;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date || "") ||
      Number.isNaN(new Date(`${item.date}T12:00:00`).getTime())) {
    return `Choose a valid date for "${item.name}".`;
  }

  return null;
}

function makeTransaction(item) {
  const amount = Math.round(Number(item.amount) * 100) / 100;

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    name: String(item.name).trim().slice(0, 100),
    amount,
    date: item.date,
    category: CATEGORIES.includes(item.category) ? item.category : "Other",
    createdAt: new Date().toISOString()
  };
}

$("#saveBatch").addEventListener("click", () => {
  if (!reviewExpenses.length) {
    $("#batchMessage").textContent = "There are no expenses to save.";
    return;
  }

  for (const expense of reviewExpenses) {
    const error = validateExpense(expense);
    if (error) {
      $("#batchMessage").textContent = error;
      $("#batchMessage").classList.add("error");
      return;
    }
  }

  const newItems = reviewExpenses.map(makeTransaction);
  const previous = transactions;
  transactions = [...transactions, ...newItems];

  if (!saveAll()) {
    transactions = previous;
    return;
  }

  const savedCount = newItems.length;
  const savedTotal = total(newItems);

  reviewExpenses = [];
  $("#reviewArea").classList.add("hidden");
  $("#voiceTranscript").value = "";
  $("#batchMessage").textContent = "";
  $("#voiceMessage").textContent = `Saved ${savedCount} expenses totalling ${money(savedTotal)}.`;
  setVoiceStatus("All reviewed expenses have been saved.");
  renderAll();
  showPage("home");
});

function addSingleExpense(name, amount, date, category, messageElement) {
  const item = { name, amount, date, category };
  const error = validateExpense(item);

  if (error) {
    messageElement.textContent = error;
    messageElement.classList.add("error");
    return false;
  }

  const previous = transactions;
  transactions = [...transactions, makeTransaction(item)];

  if (!saveAll()) {
    transactions = previous;
    return false;
  }

  messageElement.classList.remove("error");
  messageElement.textContent = `Saved ${money(amount)} for ${name}.`;
  renderAll();
  return true;
}

$("#manualForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const saved = addSingleExpense(
    $("#manualName").value,
    $("#manualAmount").value,
    $("#manualDate").value,
    $("#manualCategory").value,
    $("#manualMessage")
  );

  if (saved) {
    $("#manualForm").reset();
    $("#manualDate").value = today();
  }
});

/* ---------------- Transactions list ---------------- */

function renderTransactionList(container, items) {
  container.replaceChildren();

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No expenses yet. Add your first expense to get started.";
    container.appendChild(empty);
    return;
  }

  const sorted = [...items].sort((a, b) =>
    b.date.localeCompare(a.date) ||
    String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
  );

  for (const item of sorted) {
    const row = document.createElement("div");
    row.className = "transaction-row";

    const main = document.createElement("div");
    main.className = "transaction-main";

    const name = document.createElement("div");
    name.className = "transaction-name";
    name.textContent = item.name;

    const meta = document.createElement("div");
    meta.className = "transaction-meta";
    meta.textContent = `${item.category} · ${dateLabel(item.date)}`;
    main.append(name, meta);

    const actions = document.createElement("div");
    actions.className = "transaction-actions";

    const amount = document.createElement("span");
    amount.className = "transaction-amount";
    amount.textContent = money(item.amount);

    const remove = document.createElement("button");
    remove.className = "delete-button";
    remove.type = "button";
    remove.textContent = "Delete";
    remove.setAttribute("aria-label", `Delete ${item.name}`);

    remove.addEventListener("click", () => {
      if (!confirm(`Delete "${item.name}" (${money(item.amount)})?`)) return;

      transactions = transactions.filter((t) => t.id !== item.id);
      savings.movedIds = savings.movedIds.filter((id) => id !== item.id);
      saveAll();
      renderAll();
    });

    actions.append(amount, remove);
    row.append(main, actions);
    container.appendChild(row);
  }
}

/* ---------------- Dashboard and statistics ---------------- */

function renderDashboard() {
  $("#monthlyTotal").textContent = money(total(monthItems(monthKey())));
  $("#lastMonthTotal").textContent = money(total(monthItems(previousMonthKey())));
  $("#transactionCount").textContent = transactions.length;
  $("#potTotal").textContent = money(transactions.reduce((s, t) => s + roundUp(t.amount), 0));
  renderTransactionList($("#recentTransactions"), transactions.slice(-5));
}

function renderCategoryStats() {
  const container = $("#categoryStats");
  container.replaceChildren();

  const groups = {};
  monthItems(monthKey()).forEach((t) => {
    groups[t.category] = (groups[t.category] || 0) + Number(t.amount);
  });

  const entries = Object.entries(groups).sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    container.textContent = "Add expenses to see your categories.";
    container.className = "stats-list empty-state";
    return;
  }
  container.className = "stats-list";

  const max = Math.max(...entries.map((e) => e[1]), 1);

  entries.forEach(([category, value]) => {
    const line = document.createElement("div");
    line.className = "stat-line";

    const label = document.createElement("span");
    label.className = "stat-label";
    label.textContent = category;

    const track = document.createElement("div");
    track.className = "bar-track";

    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = `${value / max * 100}%`;
    track.appendChild(fill);

    const amount = document.createElement("span");
    amount.className = "stat-value";
    amount.textContent = money(value);

    line.append(label, track, amount);
    container.appendChild(line);
  });
}

function renderDailyStats() {
  const container = $("#dailyStats");
  container.replaceChildren();

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    days.push({
      label: d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" }),
      value: total(transactions.filter((t) => t.date === key))
    });
  }

  const max = Math.max(...days.map((d) => d.value), 1);
  days.forEach((day) => {
    const line = document.createElement("div");
    line.className = "stat-line";

    const label = document.createElement("span");
    label.className = "stat-label";
    label.textContent = day.label;

    const track = document.createElement("div");
    track.className = "bar-track";

    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = `${day.value / max * 100}%`;
    track.appendChild(fill);

    const amount = document.createElement("span");
    amount.className = "stat-value";
    amount.textContent = money(day.value);

    line.append(label, track, amount);
    container.appendChild(line);
  });
}

function renderTrends() {
  const container = $("#trendStats");
  container.replaceChildren();

  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({
      label: d.toLocaleDateString("en-IN", { month: "short" }),
      value: total(monthItems(key))
    });
  }

  const max = Math.max(...months.map((m) => m.value), 1);

  months.forEach((month) => {
    const item = document.createElement("div");
    item.className = "trend-item";

    const track = document.createElement("div");
    track.className = "trend-bar-track";

    const bar = document.createElement("div");
    bar.className = "trend-bar";
    bar.style.height = `${Math.max(3, month.value / max * 100)}%`;
    bar.title = money(month.value);
    track.appendChild(bar);

    const amount = document.createElement("div");
    amount.className = "trend-amount";
    amount.textContent = money(month.value);

    const label = document.createElement("div");
    label.className = "trend-label";
    label.textContent = month.label;

    item.append(track, amount, label);
    container.appendChild(item);
  });
}

function renderStatistics() {
  const monthly = monthItems(monthKey());
  const sum = total(monthly);

  $("#statsMonthlyTotal").textContent = money(sum);
  $("#statsTransactionCount").textContent = monthly.length;
  $("#averageExpense").textContent = money(monthly.length ? sum / monthly.length : 0);

  renderCategoryStats();
  renderDailyStats();
  renderTrends();
  renderTransactionList($("#allTransactions"), transactions);
}

/* ---------------- Insights ---------------- */

function renderTips() {
  const container = $("#tipsList");
  container.replaceChildren();

  const monthly = monthItems(monthKey());
  const previous = monthItems(previousMonthKey());
  const groups = {};

  monthly.forEach((t) => {
    groups[t.category] = (groups[t.category] || 0) + Number(t.amount);
  });

  const highest = Object.entries(groups).sort((a, b) => b[1] - a[1])[0];
  const totalRoundups = transactions.reduce((s, t) => s + roundUp(t.amount), 0);

  const tips = [
    [
      "Your recorded spending",
      transactions.length
        ? `You have recorded ${transactions.length} expenses totalling ${money(total(transactions))}.`
        : "Record your first expense to begin understanding your spending."
    ],
    [
      "Your biggest category this month",
      highest
        ? `${highest[0]} is your largest recorded category this month at ${money(highest[1])}.`
        : "Record expenses in different categories to see your spending breakdown."
    ],
    [
      "Month-to-month comparison",
      total(previous) > 0
        ? `This month: ${money(total(monthly))}. Last month: ${money(total(previous))}. Compare the two to understand changes in your spending.`
        : "Your first complete month can become a useful baseline for comparison."
    ],
    [
      "Your virtual round-ups",
      `${money(totalRoundups)} could be set aside across your recorded expenses under your current round-up rule. No money has been transferred.`
    ]
  ];

  tips.forEach(([heading, text]) => {
    const card = document.createElement("article");
    card.className = "insight-card";

    const h = document.createElement("h3");
    h.textContent = heading;

    const p = document.createElement("p");
    p.textContent = text;

    card.append(h, p);
    container.appendChild(card);
  });
}

/* ---------------- Virtual savings ---------------- */

function totalRoundups() {
  return transactions.reduce((sum, t) => sum + roundUp(t.amount), 0);
}

function movedTotal() {
  return transactions
    .filter((t) => savings.movedIds.includes(t.id))
    .reduce((sum, t) => sum + roundUp(t.amount), 0);
}

function renderSavings() {
  const totalSaved = totalRoundups();
  const moved = movedTotal();

  $("#savingsPotMetric").textContent = money(totalSaved);
  $("#potTotal").textContent = money(totalSaved);
  $("#movedTotal").textContent = money(moved);
  $("#remainingTotal").textContent = money(Math.max(0, totalSaved - moved));
  $("#currentIncrement").textContent = money(roundIncrement);
  $("#roundIncrement").value = String(roundIncrement);
}

$("#roundIncrement").addEventListener("change", () => {
  roundIncrement = Number($("#roundIncrement").value);
  saveAll();
  renderAll();

  if (!$("#reviewArea").classList.contains("hidden")) updateBatchTotals();
});

$("#markMoved").addEventListener("click", () => {
  const pending = transactions.filter((t) =>
    !savings.movedIds.includes(t.id) && roundUp(t.amount) > 0
  );

  const amount = pending.reduce((sum, t) => sum + roundUp(t.amount), 0);

  if (!pending.length) {
    $("#savingsMessage").textContent = "There is no new round-up amount to mark as moved.";
    return;
  }

  if (!confirm(`Mark ${money(amount)} as moved? Only confirm if you have transferred it yourself. This website will not make a bank transfer.`)) {
    return;
  }

  savings.movedIds.push(...pending.map((t) => t.id));
  saveAll();
  renderAll();
  $("#savingsMessage").textContent = `${money(amount)} marked as moved. No bank transfer was made by Pocket Gullak.`;
});

/* ---------------- CSV export ---------------- */

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

$("#exportData").addEventListener("click", () => {
  if (!transactions.length) {
    alert("There are no transactions to export yet.");
    return;
  }

  const rows = [
    ["Date", "Description", "Amount INR", "Category", "Round-up INR"],
    ...transactions.map((t) => [
      t.date, t.name, Number(t.amount).toFixed(2), t.category, roundUp(t.amount).toFixed(2)
    ])
  ];

  const csv = "\uFEFF" + rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));

  const link = document.createElement("a");
  link.href = url;
  link.download = `pocket-gullak-${today()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

/* ---------------- Start the app ---------------- */

function renderAll() {
  renderDashboard();
  renderStatistics();
  renderTips();
  renderSavings();
}

function fillCategorySelects() {
  ["#manualCategory"].forEach((selector) => {
    $(selector).innerHTML = categoryOptions("Other");
  });
}

fillCategorySelects();
$("#manualDate").value = today();
$("#roundIncrement").value = String(roundIncrement);
renderAll();
