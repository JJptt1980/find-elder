# 尋找大長老

[![Ko-fi](https://img.shields.io/badge/Ko--fi-%E8%AB%8B%E6%88%91%E5%96%9D%E6%9D%AF%E5%92%96%E5%95%A1-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/jjptt1980)

一個好玩的雷達 PWA，雷達視覺來自 [DB-radar](https://github.com/JJptt1980/DB-radar)。

👉 立即使用：https://jjptt1980.github.io/find-elder/

## 功能

- **尋寶**：在身邊撒七個寶物，跟著雷達走過去撿。範圍可選 100／300／800 公尺；寶物不會撒在腳邊，兩顆之間也會隔開。集滿七顆有召喚演出，四種結局輪流出現。
- **好吃的**：附近一公里的餐廳、小吃、咖啡店，雷達直接指方向（資料 © OpenStreetMap 貢獻者，每週更新）。
- **私房地圖**：存自己的秘密地點。「地球」和「納美克星」各七顆，第三組以後自訂、不限數量。

所有記錄只存在手機瀏覽器裡，不上傳任何伺服器。

## 安裝

不用裝 App。用手機瀏覽器打開上面的網址，再從選單點「加到主畫面」，就能像 App 一樣全螢幕使用，也能離線開啟。需要允許定位；指南針方向需要手機有方位感測器。

## 使用方式

1. 下方分頁切換「尋寶／好吃的／私房地圖」。
2. 尋寶：按「重新撒寶物」選範圍，跟著雷達上的亮點走，靠近就會自動撿起來。
3. 好吃的：雷達上顯示附近的店，點一下看名稱和距離。
4. 私房地圖：在地圖上點選或用目前位置，存成自己的地點。

## 截圖

廣宣用的截圖放在 [`promo/screens/`](promo/screens/)。

## 開發

```bash
npm install
npm run dev      # 網址加 ?fake=25.0339,121.5645 用假定位，console 呼叫 __fakeMove(lat, lon) 移動
npm test
npm run build
```

推到 main 會自動部署到 GitHub Pages。

本作是粉絲自製的小遊戲，與任何官方作品無關。
