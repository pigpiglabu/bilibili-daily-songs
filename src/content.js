const PREF_KEY = "bili_ai_music_pref";
const CACHE_KEY = "bili_ai_music_daily_cache";
const PANEL_ID = "bili-ai-daily-music-panel";

const moodPrompt = {
  relax: "温柔、轻松",
  focus: "稳定、少干扰",
  energetic: "高能、节奏感强",
  nostalgia: "复古、回忆感"
};

async function getPrefs() {
  const data = await chrome.storage.local.get(PREF_KEY);
  return data[PREF_KEY] || null;
}

function createAIPrompt(pref) {
  const moodText = moodPrompt[pref.mood] || "均衡";
  return `你是音乐推荐助手，请根据用户偏好生成B站音乐视频搜索词：\n关键词：${pref.keywords.join("、")}\n心情：${moodText}。`;
}

function seededShuffle(items, seedStr) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i += 1) {
    seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    seed = (1664525 * seed + 1013904223) % 4294967296;
    const j = seed % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function fetchByKeyword(keyword) {
  const url = `https://api.bilibili.com/x/web-interface/search/type?search_type=video&page=1&order=click&keyword=${encodeURIComponent(keyword + " 歌曲")}`;
  const resp = await fetch(url);
  const json = await resp.json();
  return (json?.data?.result || []).map((item) => ({
    bvid: item.bvid,
    title: item.title?.replace(/<[^>]+>/g, "") || "未知标题",
    author: item.author || "未知UP",
    play: item.play,
    url: `https://www.bilibili.com/video/${item.bvid}`
  }));
}

async function generateDailyList(pref) {
  const dateKey = new Date().toISOString().slice(0, 10);
  const data = await chrome.storage.local.get(CACHE_KEY);
  if (data[CACHE_KEY]?.dateKey === dateKey) {
    return data[CACHE_KEY].list;
  }

  const aiPrompt = createAIPrompt(pref);
  console.info("[Bili AI Playlist] Prompt =>", aiPrompt);

  const all = [];
  for (const keyword of pref.expandedKeywords) {
    try {
      const result = await fetchByKeyword(keyword);
      all.push(...result);
    } catch (e) {
      console.warn("search failed", keyword, e);
    }
  }

  const uniq = Array.from(new Map(all.map((v) => [v.bvid, v])).values());
  const shuffled = seededShuffle(uniq, `${dateKey}-${pref.expandedKeywords.join("|")}`);
  const picked = shuffled.slice(0, 10);

  await chrome.storage.local.set({
    [CACHE_KEY]: {
      dateKey,
      generatedAt: new Date().toISOString(),
      list: picked
    }
  });

  return picked;
}

function renderPanel(list, pref) {
  if (document.getElementById(PANEL_ID)) {
    return;
  }

  const panel = document.createElement("aside");
  panel.id = PANEL_ID;
  panel.style.cssText = [
    "position:fixed",
    "right:20px",
    "bottom:20px",
    "width:360px",
    "max-height:70vh",
    "overflow:auto",
    "z-index:999999",
    "background:#fff",
    "border:1px solid #e8eaf6",
    "box-shadow:0 8px 28px rgba(0,0,0,.16)",
    "border-radius:12px",
    "padding:14px"
  ].join(";");

  const title = document.createElement("h3");
  title.textContent = `🎧 AI 每日推荐（${new Date().toLocaleDateString()}）`;
  title.style.margin = "0 0 8px";
  panel.appendChild(title);

  const desc = document.createElement("p");
  desc.textContent = `偏好：${pref.keywords.join(" / ")} · 心情：${pref.mood}`;
  desc.style.cssText = "margin:0 0 10px;color:#666;font-size:12px";
  panel.appendChild(desc);

  const listEl = document.createElement("ol");
  listEl.style.cssText = "margin:0;padding-left:20px";

  if (!list.length) {
    const empty = document.createElement("p");
    empty.textContent = "暂未获取到歌曲视频，请调整关键词后再试。";
    empty.style.color = "#c62828";
    panel.appendChild(empty);
  } else {
    list.forEach((item) => {
      const li = document.createElement("li");
      li.style.margin = "0 0 8px";
      li.innerHTML = `<a href="${item.url}" target="_blank" style="color:#1a73e8;text-decoration:none">${item.title}</a><div style="font-size:12px;color:#666">UP: ${item.author}</div>`;
      listEl.appendChild(li);
    });
    panel.appendChild(listEl);
  }

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "关闭";
  closeBtn.style.cssText = "margin-top:8px;border:none;background:#f3f4f6;padding:6px 10px;border-radius:8px;cursor:pointer";
  closeBtn.addEventListener("click", () => panel.remove());
  panel.appendChild(closeBtn);

  document.body.appendChild(panel);
}

async function main() {
  const pref = await getPrefs();
  if (!pref?.expandedKeywords?.length) {
    return;
  }
  const list = await generateDailyList(pref);
  renderPanel(list, pref);
}

main().catch((e) => console.error("Bili AI daily music init failed", e));
