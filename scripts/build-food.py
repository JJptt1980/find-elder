#!/usr/bin/env python3
"""把 OpenStreetMap 檔案（.osm.pbf）裡有名字的餐廳、小吃、咖啡甜點挑出來，切成小方格 JSON。

App 打開「好吃的」時只下載身邊那幾格（GitHub Pages 的靜態檔，很快），不用等即時查詢的伺服器。

用法：python3 scripts/build-food.py taiwan-latest.osm.pbf public/food
需要：pip install osmium
"""
import json
import math
import os
import shutil
import sys
from collections import defaultdict

import osmium

# 方格大小（度）：0.02 度約 2.2 公里；App 看 1 公里內，最多讀 4 格
TILE = 0.02
AMENITY = {'restaurant': 'r', 'fast_food': 'f', 'food_court': 'c', 'cafe': 'k', 'ice_cream': 'i'}
BAKERY = 'b'


def kind_of(tags):
    a = tags.get('amenity')
    if a in AMENITY:
        return AMENITY[a]
    if tags.get('shop') == 'bakery':
        return BAKERY
    return None


def name_of(tags):
    return tags.get('name:zh-Hant') or tags.get('name:zh') or tags.get('name')


class Food(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.rows = []

    def add(self, tags, lat, lon):
        k = kind_of(tags)
        name = name_of(tags)
        if not k or not name:
            return
        row = [round(lat, 5), round(lon, 5), name, k]
        cuisine = tags.get('cuisine')
        hours = tags.get('opening_hours')
        if cuisine or hours:
            row.append(cuisine or '')
        if hours:
            row.append(hours)
        self.rows.append(row)

    def node(self, n):
        if n.location.valid():
            self.add(n.tags, n.location.lat, n.location.lon)

    def area(self, a):
        # 建築物、店面畫成多邊形的：取外框各點的平均當位置
        if not kind_of(a.tags) or not name_of(a.tags):
            return
        pts = [(nd.lat, nd.lon) for ring in a.outer_rings() for nd in ring if nd.location.valid()]
        if pts:
            self.add(a.tags, sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))


def tile_key(lat, lon):
    return f'{math.floor(lat / TILE)}_{math.floor(lon / TILE)}'


def main():
    src, out = sys.argv[1], sys.argv[2]
    h = Food()
    h.apply_file(src, locations=True)
    tiles = defaultdict(list)
    for r in h.rows:
        tiles[tile_key(r[0], r[1])].append(r)
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    for k, rows in tiles.items():
        with open(os.path.join(out, f'{k}.json'), 'w', encoding='utf-8') as f:
            json.dump(rows, f, ensure_ascii=False, separators=(',', ':'))
    index = {
        'tile': TILE,
        # App 用來判斷「這裡有沒有預先整理好的資料」：身邊那幾格都不在清單裡（例如出國）才改用即時查詢
        'tiles': sorted(tiles),
        'count': len(h.rows),
    }
    with open(os.path.join(out, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(index, f, separators=(',', ':'))
    print(f'{len(h.rows)} places, {len(tiles)} tiles')


if __name__ == '__main__':
    main()
