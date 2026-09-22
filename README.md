# 第三組 島嶼天氣

<small>組名：夥伴比工具重要</small>

整合中央氣象署開放資料的響應式氣象 Dashboard，包含：

- 顯示全臺近 24 小時累積雨量最高的六個測站
- 顯示各地今日紫外線指數最高的測站，支援縣市與測站搜尋
- 顯示臺灣 22 縣市今明 36 小時預報，支援三個時段切換與縣市搜尋
- API 無法連線時顯示「資料暫時無法取得」與重新整理按鈕，不使用示範資料

## 專案連結

- GitHub Repository：[https://github.com/jessicaKY/team3-taiwan-weather-dashboard](https://github.com/jessicaKY/team3-taiwan-weather-dashboard)

## 成果展示

- 正式網站：[https://team3-taiwan-weather-dashboard.vercel.app](https://team3-taiwan-weather-dashboard.vercel.app)

## 組員分工

### 林冠儀（組長）

- 收集氣象網頁版面參考資料
- 網站架構與功能規劃
- 雨量觀測
- 前端畫面與 RWD
- 簡報製作

### 陳柏宏

- 收集氣象網頁參考資料
- 收集有用的 API 參考資料
- 網站架構與功能規劃
- 所有縣市最新 36 小時氣象預測
- 成果報告

### 黃劭傑

- 收集氣象網頁參考資料
- 收集有用的 API 參考資料
- 網站架構與功能規劃
- 紫外線觀測與其前端畫面
- 成果報告

## 資料來源

本專案使用中央氣象署開放資料平臺：

- `O-A0002-001`：自動雨量站近 24 小時累積雨量觀測資料
- `O-A0005-001`：各測站每日紫外線指數最大值
- `O-A0001-001`：氣象測站名稱與所在縣市資料，用於補充紫外線測站資訊
- `F-C0032-001`：臺灣 22 縣市今明 36 小時天氣預報

紫外線資料不保證包含完整 22 縣市。網站會顯示目前 API 中具有有效資料的縣市，並保留每個縣市紫外線指數最高的測站。

## 功能操作

- 紫外線觀測可搜尋縣市或測站名稱，「台」與「臺」皆可辨識。
- 天氣預報可搜尋臺灣 22 縣市，「台」與「臺」皆可辨識。
- 點擊預報卡片或時段按鈕，可以循環切換「未來 12 小時」、「未來 12–24 小時」與「未來 24–36 小時」預報。
- 點擊導覽列的重新整理按鈕，可重新取得所有氣象資料。

## 專案結構

```text
team3-taiwan-weather-dashboard/
├── index.html
├── css/
│   ├── style.css
│   └── forecast.css
├── js/
│   ├── app.js
│   ├── forecast.js
│   └── config.example.js
├── api/
│   └── weather.js
└── README.md
```

- `index.html`：網站內容與區塊結構。
- `css/style.css`：共用版面、雨量、紫外線、頁尾與 RWD 樣式。
- `css/forecast.css`：預報卡片與時段切換按鈕樣式。
- `js/app.js`：雨量、紫外線、測站配對與共用資料狀態。
- `js/forecast.js`：36 小時預報、縣市搜尋與時段切換。
- `js/config.example.js`：本機 API 金鑰設定格式範例，不包含真實金鑰。
- `api/weather.js`：Vercel Serverless Function API 代理。

## 啟動方式

1. 複製 `js/config.example.js` 為 `js/config.js`。
2. 在 `js/config.js` 填入中央氣象署 API 授權碼。
3. 使用本機 HTTP Server 開啟，請勿直接雙擊 `index.html`：

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

接著開啟 `http://localhost:8000`。

`--bind 127.0.0.1` 會限制只有自己的電腦可以開啟本機網站，避免區域網路中的其他裝置讀取本機 `js/config.js`。

> 正式網站已使用 Vercel Serverless Function 作為後端 API 代理。API 金鑰安全保存在 Vercel 環境變數中，不會出現在前端程式碼或瀏覽器；更新 GitHub `main` 分支後，Vercel 會自動重新部署。

## API 錯誤處理

- 雨量、紫外線與天氣預報會分別記錄資料讀取狀態。
- 任一組 API 失敗時，對應區塊會顯示「資料暫時無法取得」。
- 錯誤區塊會提供「重新整理資料」按鈕。
- 導覽列會顯示目前有幾組資料無法取得。
- API 失敗時不會使用示範資料或假資料代替真實資料。

## 協作流程

1. Fork 此 Repository。
2. 從 Host 的 `develop` 建立自己 Fork 中的 `develop` 分支。
3. 在自己的 `develop` 分支修改、Commit 並 Push。
4. 建立 Pull Request：組員 `develop` → Host `develop`。
5. 組長檢查並將 Pull Request Merge 至 Host `develop`。
6. 所有功能在 Host `develop` 完成整合測試。
7. 確認功能正常後，將 Host `develop` 合併至 `main`。
8. Vercel 偵測到 `main` 更新後，自動重新部署正式網站。

```text
組員 Fork／develop
        ↓ Pull Request
Host develop
        ↓ 整合測試完成
Host main
        ↓
Vercel 自動部署正式網站
```

建立 Pull Request 時，請確認 `base repository` 是本專案，而且 `base branch` 是 `develop`，不要直接提交到 `main`。

## API 金鑰安全

- 請勿將 API 金鑰寫入公開程式碼、Commit、Pull Request 或聊天室。
- 請勿提交 `js/config.js`；此檔案已由 `.gitignore` 排除。
- 本機開發請複製 `js/config.example.js` 為 `js/config.js`，並填入自己的 API 金鑰。
- 正式環境的 API 金鑰只存放於 Vercel Environment Variables。

## Vercel 部署

專案包含 `api/weather.js` Serverless Function。請在 Vercel 專案的 Environment Variables 新增：

```text
CWA_API_KEY=你的中央氣象署 API 授權碼
```

部署後，前端會透過 `/api/weather` 取得即時資料，API 授權碼只存在 Vercel 後端環境。

新增或修改 Vercel Environment Variables 後，需要重新部署，新的環境變數才會生效。
