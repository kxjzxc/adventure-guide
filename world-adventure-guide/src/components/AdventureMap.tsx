import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type { Adventure, Place, Route } from '../types';
import { PLACES, ROUTES, getPlacesByWorld, getRoutesByWorld } from '../data/worldData';

/** 自定义 divIcon 渲染：不再依赖默认的 leaflet marker 图 */
function useCustomIcons() {
  return useMemo(() => {
    const build = (klass: string) =>
      L.divIcon({
        className: 'wag-marker',
        html: `<div class="place-marker ${klass}"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
    return {
      default: build(''),
      current: build('current'),
      visited: build('visited'),
      future: build('future'),
    };
  }, []);
}

export interface AdventureMapProps {
  /** 要绘制的冒险；不传则绘制 worldId 对应世界的全部地点 */
  adventure?: Adventure;
  /** 覆盖的高度 */
  height?: number | string;
  /** 点击地点时跳转或回调 */
  adventureIdForLink?: string;
  /**
   * 当没有传 adventure 时，用该 worldId 限定展示的范围。
   * （re-review #2：Map 层必须有 World scope，避免多 World 同 id 串数据）
   */
  worldId?: string;
}

export default function AdventureMap({
  adventure,
  height = 460,
  adventureIdForLink,
  worldId: worldIdProp,
}: AdventureMapProps) {
  const icons = useCustomIcons();

  // 计算展示的地点与路线（按 World scope 过滤 + World 一致性校验）
  const { places, routes, bounds } = useMemo(() => {
    if (adventure) {
      // re-review #2：要求 Adventure.worldId 与它引用的所有 Place/Route 的 worldId 一致
      const worldMismatchPlace = adventure.placeIds
        .map((id) => PLACES.find((p) => p.id === id))
        .find((p) => !!p && p.worldId !== adventure.worldId);
      const worldMismatchRoute = adventure.routeIds
        .map((id) => ROUTES.find((r) => r.id === id))
        .find((r) => !!r && r.worldId !== adventure.worldId);
      if (worldMismatchPlace || worldMismatchRoute) {
        console.error(
          '[AdventureMap] World 一致性失败：Adventure.worldId=',
          adventure.worldId,
          'but first mismatch Place:', worldMismatchPlace,
          'or Route:', worldMismatchRoute
        );
      }
      const pls = adventure.placeIds
        .map((id) => PLACES.find((p) => p.id === id && p.worldId === adventure!.worldId))
        .filter((p): p is Place => !!p);
      const rts = adventure.routeIds
        .map((id) => ROUTES.find((r) => r.id === id && r.worldId === adventure!.worldId))
        .filter((r): r is Route => !!r);
      const latlngs = pls.map((p) => [p.coords.lat, p.coords.lng] as [number, number]);
      return {
        places: pls,
        routes: rts,
        bounds: latlngs.length > 0 ? L.latLngBounds(latlngs).pad(0.4) : undefined,
      };
    }
    // 未传 Adventure：按 worldId（缺省 earth-present）绘制该世界的全部节点和边
    const wid = worldIdProp ?? 'earth-present';
    const pls = getPlacesByWorld(wid);
    const rts = getRoutesByWorld(wid);
    const latlngs = pls.map((p) => [p.coords.lat, p.coords.lng] as [number, number]);
    return {
      places: pls,
      routes: rts,
      bounds: latlngs.length > 0 ? L.latLngBounds(latlngs).pad(0.25) : undefined,
    };
  }, [adventure, worldIdProp]);

  return (
    <MapContainer
      style={{ height, width: '100%' }}
      center={[20, 108]}
      zoom={4}
      scrollWheelZoom
      preferCanvas
      bounds={bounds}
    >
      {/* CARTO Positron：浅色低饱和底图，配合白底棕字的复古纸质感 */}
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
        maxZoom={19}
      />
      {/* 地名叠加层 */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
        opacity={0.95}
      />

      {/* 路线 */}
      {routes.map((r) => (
        <Polyline
          key={r.id}
          positions={r.path.map((c) => [c.lat, c.lng])}
          pathOptions={{
            color: '#a8622b',
            weight: 3,
            opacity: 0.9,
            dashArray: '2, 9',
            lineCap: 'round',
          }}
        >
          <Tooltip direction="top" sticky opacity={0.9}>
            {r.highlights?.[0] || '探索路线'}
          </Tooltip>
        </Polyline>
      ))}

      {/* 地点 */}
      {places.map((p, idx) => {
        const curIdx = adventure ? adventure.currentStep : -1;
        let iconKey: keyof typeof icons = 'default';
        if (adventure) {
          if (idx < curIdx) iconKey = 'visited';
          else if (idx === curIdx) iconKey = 'current';
          else iconKey = 'future';
        }
        const linkPath = adventureIdForLink
          ? `/adventures/${adventureIdForLink}/places/${p.id}`
          : `/places/${p.id}`;
        return (
          <Marker
            key={p.id}
            position={[p.coords.lat, p.coords.lng]}
            icon={icons[iconKey]}
          >
            <Popup maxWidth={260}>
              <div style={{ padding: '2px 4px' }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                  {p.name}
                  <span style={{ marginLeft: 8, fontSize: 11, color: '#6b7280' }}>
                    {p.type === 'city' ? '城市' : p.type}
                  </span>
                </div>
                {p.localName && (
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                    {p.localName}
                  </div>
                )}
                <div style={{ fontSize: 12.5, color: '#374151', marginBottom: 10 }}>
                  {p.summary.length > 90 ? p.summary.slice(0, 90) + '…' : p.summary}
                </div>
                <a
                  href={linkPath}
                  style={{
                    display: 'inline-block',
                    padding: '6px 12px',
                    background: 'var(--accent)',
                    color: '#fff7ec',
                    borderRadius: 6,
                    fontSize: 13,
                    textDecoration: 'none',
                  }}
                >
                  探索此地 →
                </a>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
