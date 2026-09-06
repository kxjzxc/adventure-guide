/**
 * Adventure Guide — 前端交互脚本
 *
 * 职责：
 * 1. 首页世界地图：渲染所有 Place 标记 + Route 折线
 * 2. 地点详情页：小地图标注当前位置
 * 3. 冒险详情页：渲染冒险路线
 */

(function () {
  'use strict';

  var base = window.AG_BASE || '/';

  // ─── 首页世界地图 ─────────────────────────────────
  var worldMapEl = document.getElementById('world-map');
  if (worldMapEl && window.L && window.AG_PLACES) {
    var map = L.map('world-map', {
      scrollWheelZoom: false,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    var bounds = [];

    // 路线折线
    if (window.AG_ROUTES && window.AG_ROUTES.length > 0) {
      window.AG_ROUTES.forEach(function (routeCoords) {
        var latlngs = routeCoords.map(function (c) { return [c[0], c[1]]; });
        L.polyline(latlngs, {
          color: '#a8622b',
          weight: 2.5,
          opacity: 0.6,
          dashArray: '6,4',
        }).addTo(map);
        bounds = bounds.concat(latlngs);
      });
    }

    // 地点标记
    window.AG_PLACES.forEach(function (p) {
      var marker = L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: 'ag-marker',
          html: '<div class="ag-marker-dot"></div>',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        }),
      }).addTo(map);

      marker.bindPopup(
        '<div class="ag-popup">' +
        '<strong>' + p.name + '</strong>' +
        '<br><a href="' + p.url + '">查看地点 →</a>' +
        '</div>'
      );
      bounds.push([p.lat, p.lng]);
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40] });
    } else {
      map.setView([20, 100], 2);
    }
  }

  // ─── 地点详情页小地图 ──────────────────────────────
  var placeMapEl = document.getElementById('place-map');
  if (placeMapEl && window.L && window.AG_PLACE) {
    var pmap = L.map('place-map', {
      scrollWheelZoom: false,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(pmap);

    L.marker([window.AG_PLACE.lat, window.AG_PLACE.lng], {
      icon: L.divIcon({
        className: 'ag-marker',
        html: '<div class="ag-marker-dot ag-marker-dot-active"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    }).addTo(pmap).bindPopup('<strong>' + window.AG_PLACE.name + '</strong>').openPopup();

    pmap.setView([window.AG_PLACE.lat, window.AG_PLACE.lng], 5);
  }

  // ─── 冒险详情页路线地图 ──────────────────────────────
  var advMapEl = document.getElementById('adventure-map');
  if (advMapEl && window.L && window.AG_ADVENTURE_PLACES && window.AG_ADVENTURE_PLACES.length > 0) {
    var amap = L.map('adventure-map', {
      scrollWheelZoom: false,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(amap);

    // 地点标记
    var placeLatLngs = window.AG_ADVENTURE_PLACES.map(function (c) { return [c[0], c[1]]; });
    placeLatLngs.forEach(function (ll, i) {
      L.marker(ll, {
        icon: L.divIcon({
          className: 'ag-marker',
          html: '<div class="ag-marker-dot">' + (i + 1) + '</div>',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
      }).addTo(amap);
    });

    // 路线段：优先用 AG_ADVENTURE_SEGMENTS（沿 Route.path 的真实曲线），
    // 缺失时回退为地点两点连成的单条折线。
    var allLatLngs = [];
    if (window.AG_ADVENTURE_SEGMENTS && window.AG_ADVENTURE_SEGMENTS.length > 0) {
      window.AG_ADVENTURE_SEGMENTS.forEach(function (seg) {
        var segLatLngs = seg.map(function (c) { return [c[0], c[1]]; });
        L.polyline(segLatLngs, {
          color: '#a8622b',
          weight: 3,
          opacity: 0.7,
        }).addTo(amap);
        allLatLngs = allLatLngs.concat(segLatLngs);
      });
    } else {
      L.polyline(placeLatLngs, {
        color: '#a8622b',
        weight: 3,
        opacity: 0.7,
      }).addTo(amap);
      allLatLngs = placeLatLngs;
    }

    amap.fitBounds(allLatLngs, { padding: [40, 40] });
  }
})();
