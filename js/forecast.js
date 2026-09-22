function weatherIcon(weather = "") {
  if (/雷/.test(weather)) return "⛈️";
  if (/雨/.test(weather)) return "🌧️";
  if (/陰/.test(weather)) return "☁️";
  if (/多雲/.test(weather)) return "🌤️";
  return "☀️";
}

//--- 處理氣象局資料 ---
function readForecastElement(location, elementName, timeIndex = 0) {
  const elements = location.weatherElement || location.WeatherElement || [];
  const element = elements.find((entry) => (entry.elementName || entry.ElementName) === elementName);
  const timeBack = element?.time?.[timeIndex] || element?.Time?.[timeIndex] || {};
  return get(timeBack, ["parameter.parameterName", "parameter.ParameterName", "elementValue.0.value", "ElementValue.0.Weather", "ElementValue.0.Temperature", "ElementValue.0.ProbabilityOfPrecipitation"], "—");
}

//--- 整理氣象資料 ---
function normalizeForecast(records) {
  const locations = records.location || records.Location || records.Locations?.[0]?.Location || [];
  return locations.map((location) => {
    const periods = [0, 1, 2].map(i=>({
        weather: readForecastElement(location, "Wx", i),
        min: safeNumber(readForecastElement(location, "MinT", i)),
        max: safeNumber(readForecastElement(location, "MaxT", i)),
        rain: safeNumber(readForecastElement(location, "PoP", i)),
        comfort: readForecastElement(location, "CI", i),
    }));
    return {
        city: location.locationName || location.LocationName || "未知縣市",
        periods:periods
    };
  });
}

//--- 儲存預報資料的陣列 ---
let forecastData = [];

//--- 渲染畫面 ---
function renderForecast(items = forecastData) {
  const keyword = normalizeSearchText($("#city-search").value);
  if (!items.length) {
    $("#empty-state").hidden = true;
    $("#forecast-list").innerHTML = `<div class="glass-card unavailable-card">${unavailableMarkup("縣市預報")}</div>`;
    return;
  }

  const data = items.filter((item) =>
    normalizeSearchText(item.city).includes(keyword),
  );

  const periodLabels = ["未來 12 小時", "未來 12–24 小時", "未來 24–36 小時"];

  $("#empty-state").hidden = data.length > 0;
  $("#forecast-list").innerHTML = data.map((item) => `
    <article class="forecast-card glass-card" tabindex="0" role="button" aria-label="${item.city}天氣預報，點擊或按 Enter 切換時段" title="點擊切換時段">
      ${item.periods.map((period, i) => `
        <div class="period-content" style="display: ${i === 0 ? 'block' : 'none'};">
          <div class="forecast-top">
            <div class="forecast-city">
              <strong>${item.city}</strong>
              <span style="color: var(--primary);">${periodLabels[i]} ⟳</span>
            </div>
            <span class="weather-icon">${weatherIcon(period.weather)}</span>
          </div>
          <div class="forecast-temp"><strong>${period.max}°</strong><span>${period.weather}</span></div>
          <div class="forecast-meta">
            <div><span>最低溫</span><strong>${period.min}°C</strong></div>
            <div><span>降雨機率</span><strong>${period.rain}%</strong></div>
            <div><span>舒適度</span><strong>${String(period.comfort).slice(0, 6)}</strong></div>
          </div>
        </div>
      `).join("")}
    </article>`).join("");
}

//--- 抓取預報 API 的功能 ---
async function loadForecastData() {
  try {
    const records = await fetchDataset("F-C0032-001");
    forecastData = normalizeForecast(records);
    dataFailures.forecast = false;
    renderForecast(forecastData);
  } catch (error) {
    console.error("預報資料載入失敗:", error);
    forecastData = [];
    dataFailures.forecast = true;
    renderForecast([]);
  }
}

async function refreshAllData({ announce = false } = {}) {
  const refreshButton = $("#refresh-button");
  refreshButton.classList.add("is-loading");
  refreshButton.disabled = true;

  await Promise.all([loadWeatherData(), loadForecastData()]);

  refreshButton.classList.remove("is-loading");
  refreshButton.disabled = false;
  updateDataStatus({ announce });
}

// 綁定搜尋框
$("#city-search").addEventListener("input", () => renderForecast());

//重新整理按鈕
$("#refresh-button").addEventListener("click", () => refreshAllData({ announce: true }));
document.addEventListener("click", (event) => {
  if (event.target.closest(".retry-data")) refreshAllData({ announce: true });
});

//切換溫度資料
function switchForecastPeriod(card) {
  if (!card) return;

  const periods = card.querySelectorAll(".period-content");
  let activeIndex = 0;

  periods.forEach((period, index) => {
    if (period.style.display === "block") activeIndex = index;
  });

  periods[activeIndex].style.display = "none";
  const nextIndex = (activeIndex + 1) % periods.length;
  periods[nextIndex].style.display = "block";
}

$("#forecast-list").addEventListener("click", (event) => {
  switchForecastPeriod(event.target.closest(".forecast-card"));
});

$("#forecast-list").addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest(".forecast-card");
  if (!card) return;
  event.preventDefault();
  switchForecastPeriod(card);
});

//立刻抓取資料
refreshAllData();
