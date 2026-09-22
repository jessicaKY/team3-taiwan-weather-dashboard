const CWA_API_BASE = "https://opendata.cwa.gov.tw/api/v1/rest/datastore";
const LOCAL_API_KEY = window.APP_CONFIG?.CWA_API_KEY || "";

const endpoints = {
  rainfall: "O-A0002-001",
  uv: "O-A0005-001",
  stations: "O-A0001-001",
  forecast: "F-C0032-001",
};

const state = { rainfall: [], uv: [], forecast: [] };

const $ = (selector) => document.querySelector(selector);
const safeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number < 999 ? number : 0;
};
const get = (object, paths, fallback = undefined) => {
  for (const path of paths) {
    const value = path.split(".").reduce((target, key) => target?.[key], object);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

function formatDate() {
  const formatter = new Intl.DateTimeFormat("zh-TW", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  $("#hero-date").textContent = formatter.format(new Date());
  $("#current-year").textContent = new Date().getFullYear();
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 3600);
}

function unavailableMarkup(label) {
  return `<div class="data-unavailable">
    <span aria-hidden="true">!</span>
    <strong>${label}暫時無法取得</strong>
    <p>請稍後再試，或按下重新整理重新連線。</p>
    <button class="retry-data" type="button">重新整理資料</button>
  </div>`;
}

async function fetchDataset(dataset) {
  const url = LOCAL_API_KEY
    ? `${CWA_API_BASE}/${dataset}?Authorization=${encodeURIComponent(LOCAL_API_KEY)}&format=JSON`
    : `/api/weather?dataset=${encodeURIComponent(dataset)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${dataset} 回應 ${response.status}`);
  const data = await response.json();
  if (data.success === "false" || data.success === false) throw new Error(`${dataset} 讀取失敗`);
  return data.records || {};
}

function normalizeRainfall(records) {
  const stations = records.Station || records.station || records.location || [];
  return stations.map((item) => ({
    station: get(item, ["StationName", "stationName", "locationName"], "未命名測站"),
    county: get(item, ["GeoInfo.CountyName", "GeoInfo.countyName", "countyName"], "臺灣"),
    value: safeNumber(get(item, ["RainfallElement.Past24hr.Precipitation", "RainfallElement.Past12hr.Precipitation", "rainfallElement.Past24hr.Precipitation", "weatherElement.0.elementValue"], 0)),
  })).filter((item) => item.value >= 0).sort((a, b) => b.value - a.value).slice(0, 6);
}

function collectUvLocations(records) {
  const direct = records.WeatherElement?.Location || records.WeatherElement?.location || records.weatherElement?.location;
  if (Array.isArray(direct)) return direct;
  return records.Station || records.station || records.location || [];
}

function findUvValue(item) {
  const direct = get(item, ["UVIndex", "UV", "uvIndex", "WeatherElement.UVIndex", "weatherElement.UVIndex"]);
  if (direct !== undefined) return safeNumber(direct);
  const values = [];
  const walk = (node, key = "") => {
    if (node && typeof node === "object") Object.entries(node).forEach(([childKey, child]) => walk(child, childKey));
    else if (/uv|uvi|indexvalue|elementvalue/i.test(key)) values.push(safeNumber(node));
  };
  walk(item);
  return Math.max(0, ...values);
}

function buildStationLookup(records) {
  const stations = records.Station || records.station || records.location || [];
  return new Map(stations.map((item) => {
    const id = String(get(item, ["StationId", "StationID", "stationId", "stationID"], ""));
    return [id, {
      station: get(item, ["StationName", "stationName", "LocationName", "locationName"], `測站 ${id}`),
      county: get(item, ["GeoInfo.CountyName", "GeoInfo.countyName", "CountyName", "countyName"], "地區未提供"),
    }];
  }).filter(([id]) => id));
}

function normalizeUv(records, stationRecords) {
  const stationLookup = buildStationLookup(stationRecords);
  
  const allList = collectUvLocations(records).map((item) => {
    const stationId = String(get(item, ["StationID", "StationId", "stationID", "stationId"], ""));
    const lookup = stationLookup.get(stationId);
    return {
      stationId,
      value: findUvValue(item),
      station: lookup?.station || `測站 ${stationId || "未提供"}`,
      county: lookup?.county || "地區未提供",
    };
  }).filter((item) => item.value > 0 && item.county !== "地區未提供");

  const maxByCountyMap = new Map();

  for (const item of allList) {
    const currentMax = maxByCountyMap.get(item.county);
    if (!currentMax || item.value > currentMax.value) {
      maxByCountyMap.set(item.county, item);
    }
  }

  return Array.from(maxByCountyMap.values()).sort((a, b) => b.value - a.value);
}


function readForecastElement(location, elementName) {
  const elements = location.weatherElement || location.WeatherElement || [];
  const element = elements.find((entry) => (entry.elementName || entry.ElementName) === elementName);
  const first = element?.time?.[0] || element?.Time?.[0] || {};
  return get(first, ["parameter.parameterName", "parameter.ParameterName", "elementValue.0.value", "ElementValue.0.Weather", "ElementValue.0.Temperature", "ElementValue.0.ProbabilityOfPrecipitation"], "—");
}

function normalizeForecast(records) {
  const locations = records.location || records.Location || records.Locations?.[0]?.Location || [];
  return locations.map((location) => ({
    city: location.locationName || location.LocationName || "未知縣市",
    weather: readForecastElement(location, "Wx"),
    min: safeNumber(readForecastElement(location, "MinT")),
    max: safeNumber(readForecastElement(location, "MaxT")),
    rain: safeNumber(readForecastElement(location, "PoP")),
    comfort: readForecastElement(location, "CI"),
  }));
}

function rainLevel(value) {
  if (value >= 80) return "雨勢明顯，外出請攜帶雨具並留意低窪地區。";
  if (value >= 40) return "部分地區有較明顯降雨，行程安排請留意。";
  if (value > 0) return "局部地區有短暫降雨，建議隨身攜帶雨具。";
  return "目前觀測雨量偏低，仍請留意最新天氣變化。";
}

function renderRainfall(items) {
  if (!items.length) {
    $("#max-rainfall").textContent = "—";
    $("#wettest-station").textContent = "—";
    $("#wettest-county").textContent = "—";
    $("#rainfall-summary").textContent = "目前沒有可顯示的即時觀測資料。";
    $("#rain-gauge-fill").style.width = "0";
    $("#rainfall-list").innerHTML = unavailableMarkup("雨量資料");
    return;
  }
  const data = items;
  const max = data[0]?.value || 0;
  $("#max-rainfall").textContent = max.toFixed(1).replace(".0", "");
  $("#wettest-station").textContent = data[0]?.station || "—";
  $("#wettest-county").textContent = data[0]?.county || "—";
  $("#rainfall-summary").textContent = rainLevel(max);
  $("#rain-gauge-fill").style.width = `${Math.min(100, max)}%`;
  $("#rainfall-list").innerHTML = data.map((item) => `
    <div class="station-row">
      <div class="station-name"><strong>${item.station}</strong><span>${item.county}</span></div>
      <div class="station-bar"><i style="width:${max ? Math.max(4, item.value / max * 100) : 0}%"></i></div>
      <div class="station-value">${item.value.toFixed(1).replace(".0", "")}<span>mm</span></div>
    </div>`).join("");
}

function uvInfo(value) {
  if (value <= 2) return { label: "低量級", color: "#55e6a5", bars: 1 };
  if (value <= 5) return { label: "中量級", color: "#ffd66b", bars: 2 };
  if (value <= 7) return { label: "高量級", color: "#ff9d66", bars: 3 };
  if (value <= 10) return { label: "過量級", color: "#ff6577", bars: 4 };
  return { label: "危險級", color: "#b77cff", bars: 5 };
}

function renderUv(items = state.uv) {
  const keyword = normalizeSearchText($("#uv-search")?.value || "");

  if (!items.length) {
    if ($("#uv-empty-state")) $("#uv-empty-state").hidden = true;
    $("#uv-list").innerHTML = `<div class="glass-card unavailable-card">${unavailableMarkup("紫外線資料")}</div>`;
    return;
  }

  const data = items.filter((item) =>
    normalizeSearchText(item.county).includes(keyword) ||
    normalizeSearchText(item.station).includes(keyword)
  );

  if ($("#uv-empty-state")) $("#uv-empty-state").hidden = data.length > 0;

  $("#uv-list").innerHTML = data.map((item) => {
    const info = uvInfo(item.value);
    return `<article class="uv-card glass-card" style="--level-color:${info.color}">
      <div class="uv-location"><div><strong>${item.station}</strong><span>${item.county}</span></div><b class="uv-badge">${info.label}</b></div>
      <div class="uv-reading"><strong>${item.value.toFixed(1)}</strong><span>UV INDEX</span></div>
      <div class="uv-meter">${[1,2,3,4,5].map((index) => `<i class="${index <= info.bars ? "active" : ""}"></i>`).join("")}</div>
    </article>`;
  }).join("");
}


function weatherIcon(weather = "") {
  if (/雷/.test(weather)) return "⛈️";
  if (/雨/.test(weather)) return "🌧️";
  if (/陰/.test(weather)) return "☁️";
  if (/多雲/.test(weather)) return "🌤️";
  return "☀️";
}

function normalizeSearchText(text = "") {
  return String(text).trim().toLowerCase().replaceAll("台", "臺");
}

function renderForecast(items = state.forecast) {
  const keyword = normalizeSearchText($("#city-search").value);
  if (!items.length) {
    $("#empty-state").hidden = true;
    $("#forecast-list").innerHTML = `<div class="glass-card unavailable-card">${unavailableMarkup("縣市預報")}</div>`;
    return;
  }
  const data = items.filter((item) =>
    normalizeSearchText(item.city).includes(keyword),
  );
  $("#empty-state").hidden = data.length > 0;
  $("#forecast-list").innerHTML = data.map((item) => `
    <article class="forecast-card glass-card">
      <div class="forecast-top"><div class="forecast-city"><strong>${item.city}</strong><span>未來 12 小時</span></div><span class="weather-icon">${weatherIcon(item.weather)}</span></div>
      <div class="forecast-temp"><strong>${item.max}°</strong><span>${item.weather}</span></div>
      <div class="forecast-meta">
        <div><span>最低溫</span><strong>${item.min}°C</strong></div>
        <div><span>降雨機率</span><strong>${item.rain}%</strong></div>
        <div><span>舒適度</span><strong>${String(item.comfort).slice(0, 6)}</strong></div>
      </div>
    </article>`).join("");
}

async function loadWeatherData({ announce = false } = {}) {
  const refreshButton = $("#refresh-button");
  refreshButton.classList.add("is-loading");
  refreshButton.disabled = true;
  const results = await Promise.allSettled([
    fetchDataset(endpoints.rainfall),
    fetchDataset(endpoints.uv),
    fetchDataset(endpoints.stations),
    fetchDataset(endpoints.forecast),
  ]);

  state.rainfall = results[0].status === "fulfilled" ? normalizeRainfall(results[0].value) : [];
  state.uv = results[1].status === "fulfilled" && results[2].status === "fulfilled"
    ? normalizeUv(results[1].value, results[2].value)
    : [];
  state.forecast = results[3].status === "fulfilled" ? normalizeForecast(results[3].value) : [];
  renderRainfall(state.rainfall);
  renderUv(state.uv);
  renderForecast(state.forecast);

  const failures = [
    results[0].status === "rejected",
    results[1].status === "rejected" || results[2].status === "rejected",
    results[3].status === "rejected",
  ].filter(Boolean).length;
  const time = new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  $("#update-time").textContent = failures
    ? `${failures} 組資料無法取得`
    : `${time} 更新`;
  refreshButton.classList.remove("is-loading");
  refreshButton.disabled = false;
  if (failures) showToast(`有 ${failures} 組即時資料暫時無法取得，請稍後重新整理。`);
  else if (announce) showToast("氣象資料已更新。");
}

formatDate();
$("#city-search").addEventListener("input", () => renderForecast());
$("#uv-search")?.addEventListener("input", () => renderUv()); 
$("#refresh-button").addEventListener("click", () => loadWeatherData({ announce: true }));
document.addEventListener("click", (event) => {
  if (event.target.closest(".retry-data")) loadWeatherData({ announce: true });
});
loadWeatherData();
