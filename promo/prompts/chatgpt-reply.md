# ChatGPT 回覆（2026-11-22，使用者貼回）

我覺得這組提示詞的方向相當完整，而且三張圖的用途分配是正確的：hero 負責吸引目光、OG 負責社群分享辨識、FB 負責讓人理解玩法。

不過，我建議在交給 Meta AI（Muse）之前做幾個調整。尤其是 GB子的角色一致性、雷達畫面的真實感，以及七顆寶物的視覺呈現。這三件事會直接影響整個廣宣的品質。

## ① 提示詞檢查與修改建議

### 1. hero.png：主視覺
| 要改什麼 | 為什麼 |
|---|---|
| 把右側 2x2 拼貼改成四個小型情境畫面 | 原本的拼貼容易讓畫面像旅遊廣告，搶走 GB子的主角地位。 |
| GB子明確設定為成年台灣女性 | 避免生成結果出現年齡不明或過度幼態的角色。 |
| 手機螢幕要求正面朝向鏡頭 | AI 很容易把手機畫成背面，或把螢幕畫成無法辨識的介面。 |
| 雷達畫面明確指定圓形、格線、掃描扇形 | 讓雷達看起來像真正的遊戲介面，而不是一般科技光圈。 |
| 七顆寶物要求數量明確 | 避免生成大量光點，讓「七顆」的玩法失去辨識度。 |
| 增加人物與雷達之間的視覺連結 | 讓 GB子看起來像正在邀請觀眾一起玩，而不是單純拿手機拍照。 |

我的建議：GB子佔畫面左側約 55%，右側用四個小型場景表現獨自探索、朋友、情侶、親子。主角仍然是 GB子。

### 2. og.png：社群分享縮圖
| 要改什麼 | 為什麼 |
|---|---|
| 雷達移到右側約 60% 的區域 | 左側保留標題空間，方便網站動態疊加文字。 |
| 紅色三角形改成琥珀色定位標記 | 避免引入不一致的第三種強烈色彩。 |
| 七顆光點採用不同距離與大小 | 讓畫面有探索感，而非單純七個平均分布的裝飾。 |
| 增加縮小後的辨識度 | OG 圖常以小尺寸顯示，細格線不能太密。 |

我的建議：OG 不要放人物，也不要放太多裝飾。要讓人一眼就知道這是一款雷達尋寶遊戲。

### 3. fb.png：FB 貼文配圖
| 要改什麼 | 為什麼 |
|---|---|
| 保留手持手機的近景構圖 | 讓觀眾直接理解遊戲是透過手機操作。 |
| 手機畫面要清楚可辨識 | 這張圖最重要的任務就是解釋玩法。 |
| 背景增加台灣公園的生活感 | 比純粹的幻想場景更容易讓台灣使用者產生共鳴。 |
| 寶物亮點放在雷達與現實環境的視覺對應位置 | 建立「手機雷達找到現實地點」的概念。 |

我的建議：FB 圖要比 hero 更接地氣，不必太科幻，像是晚上下班後真的可以拿手機出去玩的感覺。

### 4. 三張圖共同需要補充的規則
- 三張圖統一使用 #2fd16b、#05100a、#f5b83d。
- 雷達都是圓形，不要變成方形導航地圖。
- 手機都是一般現代智慧型手機，不要出現奇幻道具。
- 寶物永遠只呈現小型琥珀色光點或星光。
- 不出現任何神龍、動漫人物、球形道具或可辨識的原作造型。
- 不要讓 AI 自行生成文字、Logo 或假英文。
- 三張圖維持相同的光影語言與品牌視覺。

另外，GB子如果未來有正式人物參考照片，建議在 Muse 裡三張圖都使用同一張參考照片，這樣角色一致性會好很多。

## ② 修正版提示詞

### A. hero.png — 主視覺（16:9 · Photorealistic）
Create a premium 16:9 landscape promotional hero image for a casual mobile web radar treasure-hunting game.

Main character — GB子: A clearly adult young Taiwanese woman, with long straight black hair, natural bangs, expressive large eyes, and a gentle friendly smile. She is the JJptt community mascot. She wears casual modern outdoor clothing with a clearly visible small green armband featuring the letters "JJ". Photorealistic human appearance, natural Taiwanese facial features, realistic skin texture.

Composition: GB子 occupies approximately 55% of the left side of the image, shown from the waist up. She holds a modern ordinary smartphone toward the camera. The phone screen must face the viewer directly and clearly display a recognizable circular green radar interface with subtle grid lines, a sweeping radar sector, and small amber glowing treasure markers.

On the right side, create four small, visually separated photographic lifestyle scenes: 1. A solo young adult exploring a park. 2. Two friends walking together. 3. A young couple enjoying an evening walk. 4. Parents exploring outdoors with their children. All scenes should feel like authentic everyday life in Taiwan, not fantasy or science fiction.

Treasure visual: Exactly seven small amber glowing dots or tiny star-like sparkles, representing hidden treasures. Never depict recognizable objects or physical treasure balls.

Environment and atmosphere: A beautiful Taiwanese urban park at night, subtle city lights in the distance, dark forest-green atmosphere, cinematic soft lighting, premium commercial photography.

Brand colors: Radar green #2fd16b, dark background #05100a, amber highlights #f5b83d.

Strong visual hierarchy, clear facial details, realistic hands and smartphone proportions, clean composition, attractive commercial advertising quality. No text, no watermark, no extra logos.

Strict exclusions: No existing anime characters, no dragons, no dragon balls, no orange spherical objects, no recognizable copyrighted props, no fantasy creatures, no summoned entities. The mysterious ending must never be shown.

### B. og.png — 社群分享縮圖（1200 × 630 · Landscape）
Create a premium 1200x630 landscape Open Graph social sharing image for a casual mobile radar treasure-hunting game.

Composition: Dark cinematic background in deep green-black #05100a. Place a large, beautiful glowing circular radar interface on the RIGHT 60% of the canvas. Keep the LEFT 40% clean, dark, and uncluttered, with generous negative space for adding a headline later.

Radar interface: A clearly circular radar with subtle concentric rings, clean technical grid lines, a luminous green scanning sector, and exactly seven small glowing amber treasure markers distributed at different distances from the center. Use one subtle amber location indicator near the radar center. The radar should feel like a polished real mobile game interface, not a complicated military instrument.

Visual style: Minimalist, modern, high contrast, premium technology advertising, soft neon glow, subtle atmospheric lighting, restrained vignette.

Brand colors: Radar green #2fd16b, background #05100a, amber #f5b83d.

Ensure the radar remains recognizable when displayed as a small social media thumbnail.

No text, no letters, no logos, no watermark, no characters, no phone, no dragons, no anime references, no spherical treasure objects, no fantasy creatures.

### C. fb.png — Facebook 貼文配圖（1:1 · Square）
Create a premium square 1:1 promotional image for a casual mobile web radar treasure-hunting game.

Main composition: A realistic close-up photograph of a young adult person's hand holding a modern ordinary smartphone while standing on a beautiful Taiwanese urban park path at dusk or early evening. The smartphone is the main focal point, positioned prominently in the center. The screen faces the camera and clearly displays a polished glowing green circular radar interface with concentric grid lines, a sweeping radar sector, and one especially bright amber treasure marker.

Environment: A realistic Taiwanese park walking path, softly blurred trees, warm street lights, subtle evening city atmosphere. One or two tiny amber sparkles in the distant environment subtly suggest hidden treasures waiting to be discovered.

Mood: Curious, playful, inviting, and approachable. The feeling should be: "I can open my phone and start exploring nearby right now."

Visual style: High-end lifestyle advertising photography, natural lighting, realistic hand anatomy, realistic smartphone proportions, cinematic depth of field.

Brand colors: Radar green #2fd16b, dark green-black #05100a, amber #f5b83d.

Keep the smartphone screen crisp, bright, and easy to recognize even at small display sizes.

No text, no watermark, no logos, no anime characters, no dragons, no dragon balls, no recognizable copyrighted objects, no fantasy creatures.

（ChatGPT 另外說明：Free 方案生圖額度用完，這次沒有產生參考圖。本流程原本就決定不叫 ChatGPT 生圖。）
