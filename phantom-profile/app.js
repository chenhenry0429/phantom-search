const form = document.querySelector("#chat-form");
const input = document.querySelector("#question");
const send = document.querySelector("#send");
const reset = document.querySelector("#reset");
const status = document.querySelector("#status");
const log = document.querySelector("#messages");
const portrait = document.querySelector("#portrait");
const mascot = document.querySelector("#mascot-button");
const mascotArea = document.querySelector("#mascot");
const mascotBubble = document.querySelector("#mascot-bubble");
const mascotJoke = document.querySelector("#mascot-joke");
const mascotQuiet = document.querySelector("#mascot-quiet");
const chatApi = document.querySelector('meta[name="chat-api-base"]')?.content || "";
const welcome = log.firstElementChild.cloneNode(true);
const greetings = ["要聊聊吗？", "下一条线索，由你来问。", "来问问 Henry 的作品吧！"];
const jokes = [
  "冷笑话 · 第 86 号元素是？西元，因为砹在西元前。认真答是氡。",
  "冷笑话 · 物理课上的问题：为什么不拿微波炉加热微波炉？",
  "冷笑话 · 为什么网页不爱开会？因为它一打开就有好多标签。",
];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
let greeting = 0;
let mascotAction;
let turns = [];
let request;
let composing = false;
let jokeIndex = 0;
let automaticJokes = 0;
let mascotVisible = false;
let idleTimer;
let bubbleTimer;

function showMascotBubble(message) {
  clearTimeout(bubbleTimer);
  mascotBubble.textContent = message;
  bubbleTimer = setTimeout(() => { mascotBubble.textContent = "点我，开始对话！"; }, 9000);
}

function tellJoke() {
  showMascotBubble(jokes[jokeIndex]);
  jokeIndex = (jokeIndex + 1) % jokes.length;
}

function scheduleIdleJoke() {
  clearTimeout(idleTimer);
  if (!mascotVisible || document.hidden || mascotQuiet.checked || automaticJokes >= 2 ||
      request || composing || document.activeElement === input || input.value.trim()) return;

  idleTimer = setTimeout(() => {
    automaticJokes++;
    tellJoke();
    scheduleIdleJoke();
  }, 60000);
}

if ("IntersectionObserver" in window) {
  new IntersectionObserver(([entry]) => {
    mascotVisible = entry.isIntersecting && entry.intersectionRatio >= 0.25;
    scheduleIdleJoke();
  }, { threshold: 0.25 }).observe(mascotArea);
}
document.addEventListener("visibilitychange", scheduleIdleJoke);
document.querySelector("#echo").addEventListener("pointermove", scheduleIdleJoke, { passive: true });
document.querySelector("#echo").addEventListener("keydown", scheduleIdleJoke);
mascotQuiet.addEventListener("change", () => {
  if (mascotQuiet.checked) showMascotBubble("点我，开始对话！");
  scheduleIdleJoke();
});
mascotJoke.addEventListener("click", () => {
  tellJoke();
  scheduleIdleJoke();
});

portrait.addEventListener("click", () => {
  const flipped = portrait.getAttribute("aria-pressed") === "false";
  portrait.setAttribute("aria-pressed", String(flipped));
  if (flipped) {
    portrait.setAttribute("aria-describedby", "portrait-details");
  } else {
    portrait.removeAttribute("aria-describedby");
  }
});

if ("IntersectionObserver" in window && !reduceMotion.matches) {
  const entrance = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    mascot.classList.replace("is-awaiting", "is-arriving");
    entrance.disconnect();
  }, { threshold: 0.25 });
  mascot.classList.add("is-awaiting");
  entrance.observe(mascot);
}

function addMessage(kind, content) {
  const message = document.createElement("p");
  message.className = "message " + kind;
  message.textContent = content;
  log.append(message);
  log.scrollTop = log.scrollHeight;
  return message;
}

async function checkStatus() {
  try {
    const response = await fetch(`${chatApi}/api/status`);
    if (!response.ok) throw new Error();
    const data = await response.json();
    status.dataset.ready = String(data.configured);
    status.textContent = data.configured ? data.model + " · 已配置" : "模型待配置";
  } catch {
    status.textContent = "暂时无法检查连接";
  }
}

input.addEventListener("compositionstart", () => {
  composing = true;
});
input.addEventListener("compositionend", () => {
  composing = false;
});
input.addEventListener("blur", () => {
  composing = false;
});
for (const event of ["focus", "blur", "input", "compositionstart", "compositionend"]) {
  input.addEventListener(event, scheduleIdleJoke);
}
input.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey) ||
      composing || event.isComposing || event.keyCode === 229) return;
  event.preventDefault();
  form.requestSubmit();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = input.value.trim();
  if (!question || request || composing) return;
  const controller = new AbortController();
  request = controller;
  scheduleIdleJoke();
  send.disabled = true;
  input.value = "";
  addMessage("user", question);
  const pending = addMessage("notice", "正在生成回答…");
  try {
    const response = await fetch(`${chatApi}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, turns }),
      signal: controller.signal,
    });
    const data = await response.json();
    if (request !== controller) return;
    if (!response.ok || typeof data.answer !== "string") {
      pending.textContent = data.error || "暂时无法取得回答，请稍后再试。";
      if (!input.value) input.value = question;
      return;
    }
    pending.remove();
    addMessage("assistant", data.answer);
    turns = [...turns, { question, answer: data.answer }].slice(-3);
  } catch {
    if (request !== controller) return;
    pending.textContent = "连接失败，请稍后重试。";
    if (!input.value) input.value = question;
  } finally {
    if (request === controller) {
      request = undefined;
      send.disabled = false;
      scheduleIdleJoke();
    }
  }
});

document.querySelectorAll(".suggestions button").forEach((button) => {
  button.addEventListener("click", () => {
    input.value = button.textContent;
    input.focus();
  });
});

mascot.addEventListener("click", () => {
  showMascotBubble(greetings[greeting]);
  greeting = (greeting + 1) % greetings.length;
  mascotAction?.cancel();
  if (!reduceMotion.matches) {
    mascotAction = mascot.animate(
      [{ transform: "none" }, { transform: "translateY(-9px) rotate(-9deg)" }, { transform: "translateY(2px) rotate(4deg)" }, { transform: "none" }],
      { duration: 390, easing: "ease-out" },
    );
  }
  input.focus();
});

reset.addEventListener("click", () => {
  request?.abort();
  request = undefined;
  turns = [];
  log.replaceChildren(welcome.cloneNode(true));
  input.value = "";
  send.disabled = false;
  input.focus();
});

checkStatus();

const feedbackForm = document.querySelector("#feedback-form");
const feedbackMessage = document.querySelector("#feedback-message");
const feedbackCount = document.querySelector("#feedback-count");
const feedbackSend = document.querySelector("#feedback-send");
const feedbackStatus = document.querySelector("#feedback-status");

function updateFeedbackCount() {
  feedbackCount.textContent = feedbackMessage.value.length + " / 500";
}

feedbackMessage.addEventListener("input", updateFeedbackCount);
feedbackForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (feedbackSend.disabled) return;
  const message = feedbackMessage.value.trim();
  if (message.length < 3) {
    feedbackStatus.dataset.state = "error";
    feedbackStatus.textContent = "请至少写下三个字。";
    feedbackMessage.focus();
    return;
  }
  const fields = new FormData(feedbackForm);
  fields.set("message", message);
  fields.set("_subject", "PHANTOM PROFILE - New Feedback");
  fields.set("_template", "table");
  feedbackSend.disabled = true;
  feedbackStatus.dataset.state = "sending";
  feedbackStatus.textContent = "正在提交反馈…";
  try {
    const response = await fetch("https://formsubmit.co/ajax/Henrychen2008@hotmail.com", {
      method: "POST",
      headers: { Accept: "application/json" },
      body: fields,
      signal: AbortSignal.timeout(20000),
    });
    const result = await response.json();
    if (response.ok && (result.success === true || result.success === "true")) {
      feedbackForm.reset();
      updateFeedbackCount();
      feedbackStatus.dataset.state = "success";
      feedbackStatus.textContent = "反馈已提交。谢谢你的建议！";
    } else {
      feedbackStatus.dataset.state = "error";
      feedbackStatus.textContent = /activat/i.test(result?.message || "")
        ? "反馈邮箱需要激活，你填写的内容已保留。"
        : "暂时没能提交反馈，你填写的内容已保留。";
    }
  } catch {
    feedbackStatus.dataset.state = "error";
    feedbackStatus.textContent = "暂时无法确认提交结果，你填写的内容已保留。";
  } finally {
    feedbackSend.disabled = false;
  }
});
