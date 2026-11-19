# 尋找大長老

一個好玩的雷達 PWA，雷達視覺來自 [DB-radar](https://github.com/JJptt1980/DB-radar)。

- **尋寶**：在身邊撒七個寶物，走過去撿。
- **好吃的**：附近一公里的餐廳、小吃、咖啡店（資料 © OpenStreetMap 貢獻者）。
- **私房地圖**：存自己的秘密地點。「地球」和「納美克星」各七顆，第三組以後自訂、不限數量。

所有記錄只存在手機瀏覽器裡，不上傳任何伺服器。

## 開發

```bash
npm install
npm run dev      # 網址加 ?fake=25.0339,121.5645 用假定位，console 呼叫 __fakeMove(lat, lon) 移動
npm test
npm run build
```

推到 main 會自動部署到 GitHub Pages。
