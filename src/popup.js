const PREF_KEY = "bili_ai_music_pref";

const moodExpansions = {
  relax: ["轻音乐", "治愈", "舒缓", "晚安曲"],
  focus: ["纯音乐", "学习", "专注", "lofi"],
  energetic: ["热血", "摇滚", "节奏", "电音"],
  nostalgia: ["经典", "怀旧", "老歌", "港风"]
};

const statusEl = document.getElementById("status");
const keywordInput = document.getElementById("keywords");
const moodSelect = document.getElementById("mood");

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? "#c62828" : "#2e7d32";
}

function parseKeywords(raw) {
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

async function loadPrefs() {
  const data = await chrome.storage.local.get(PREF_KEY);
  const pref = data[PREF_KEY];
  if (!pref) {
    return;
  }
  keywordInput.value = pref.keywords.join(",");
  moodSelect.value = pref.mood;
  setStatus("已加载偏好");
}

async function savePrefs() {
  const keywords = parseKeywords(keywordInput.value);
  const mood = moodSelect.value;

  if (!keywords.length) {
    setStatus("请至少输入一个关键词", true);
    return;
  }

  const expanded = [...new Set([...keywords, ...(moodExpansions[mood] || [])])];
  const payload = {
    keywords,
    mood,
    expandedKeywords: expanded,
    updatedAt: new Date().toISOString()
  };

  await chrome.storage.local.set({ [PREF_KEY]: payload });
  setStatus("保存成功，打开 B 站首页即可查看今日推荐");
}

document.getElementById("saveBtn").addEventListener("click", () => {
  savePrefs().catch((err) => {
    console.error(err);
    setStatus("保存失败，请重试", true);
  });
});

loadPrefs().catch((err) => {
  console.error(err);
  setStatus("加载偏好失败", true);
});
