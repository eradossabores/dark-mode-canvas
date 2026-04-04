import React, { useState, useEffect, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Polygon,
  Polyline,
  useMap,
  useMapEvents
} from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;

const ICON_SIZES = { small: [20, 32], medium: [25, 41], large: [30, 50] } as const;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return `rgba(37, 99, 235, ${alpha})`;

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const createMarkerSvg = (color: string, width: number, height: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 25 41"><path d="M12.5 0C5.6 0 0 5.6 0 12.5C0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="${color}" stroke="#fff" stroke-width="1.5"/><circle cx="12.5" cy="12.5" r="5" fill="#fff"/></svg>`;

// SVG-based custom icons (avoids MIME-type/loading issues with PNGs)
export const createSvgIcon = (color = '#2563eb', size: 'small' | 'medium' | 'large' = 'medium') => {
  const [w, h] = ICON_SIZES[size];
  const svg = createMarkerSvg(color, w, h);
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [w, h] as [number, number],
    iconAnchor: [w / 2, h] as [number, number],
    popupAnchor: [1, -h + 7] as [number, number],
  });
};

export const createLabeledSvgIcon = (
  color = '#2563eb',
  label = '',
  size: 'small' | 'medium' | 'large' = 'medium'
) => {
  const [w, h] = ICON_SIZES[size];
  const svg = createMarkerSvg(color, w, h);
  const safeLabel = escapeHtml(label.trim());
  const labelWidth = Math.max(132, Math.min(220, safeLabel.length * 7.4));
  const labelHeight = 52;
  const labelGap = 8;
  const totalHeight = h + labelHeight + labelGap;
  const accentSoft = hexToRgba(color, 0.14);
  const accentBorder = hexToRgba(color, 0.22);
  const accentStrong = hexToRgba(color, 0.92);

  return L.divIcon({
    html: `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:flex-start; width:${Math.max(w, labelWidth)}px; height:${totalHeight}px;">
        <div style="position:relative; width:${labelWidth}px; min-width:112px; min-height:${labelHeight}px; padding:4px; margin-bottom:${labelGap}px; border-radius:22px; background:linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,255,255,0.88)); border:1px solid hsl(var(--border) / 0.85); box-shadow:0 22px 40px -24px rgba(15,23,42,0.48), 0 10px 18px -14px ${accentBorder}; backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); overflow:hidden;">
          <div style="position:absolute; inset:0; border-radius:inherit; background:radial-gradient(circle at top right, ${accentSoft} 0%, transparent 48%);"></div>
          <div style="position:relative; display:flex; align-items:center; gap:10px; min-height:${labelHeight - 8}px; padding:0 12px; border-radius:18px; background:rgba(255,255,255,0.72);">
            <div style="display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:999px; background:${accentSoft}; border:1px solid ${accentBorder}; box-shadow:inset 0 1px 0 rgba(255,255,255,0.7); flex-shrink:0;">
              <div style="width:8px; height:8px; border-radius:999px; background:${accentStrong};"></div>
            </div>
            <div style="flex:1; min-width:0; color:hsl(var(--foreground)); font-family:'DM Sans', 'Montserrat', system-ui, sans-serif; font-size:12.5px; font-weight:800; letter-spacing:-0.03em; line-height:1.02; text-align:left; text-transform:uppercase; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; text-overflow:ellipsis; text-wrap:balance;">
              ${safeLabel}
            </div>
          </div>
        </div>
        ${svg}
      </div>
    `,
    className: '',
    iconSize: [Math.max(w, labelWidth), totalHeight] as [number, number],
    iconAnchor: [Math.max(w, labelWidth) / 2, totalHeight] as [number, number],
    popupAnchor: [1, -totalHeight + 10] as [number, number],
  });
};

// Preset color icons
export const MAP_ICONS = {
  blue: createSvgIcon('#2563eb'),
  red: createSvgIcon('#dc2626'),
  green: createSvgIcon('#16a34a'),
  orange: createSvgIcon('#ea580c'),
  violet: createSvgIcon('#7c3aed'),
  gold: createSvgIcon('#d97706', 'large'),
  grey: createSvgIcon('#6b7280'),
  cyan: createSvgIcon('#0891b2'),
};

export type MapMarker = {
  id: string | number;
  position: [number, number];
  color?: string;
  size?: 'small' | 'medium' | 'large';
  icon?: L.Icon | L.DivIcon;
  draggable?: boolean;
  excludeFromCluster?: boolean;
  popup?: {
    title?: string;
    content?: string | React.ReactNode;
  };
  data?: any;
};

export type MapCircle = {
  id?: string | number;
  center: [number, number];
  radius: number;
  style?: L.PathOptions;
  popup?: string | React.ReactNode;
};

export type MapPolygon = {
  id?: string | number;
  positions: [number, number][];
  style?: L.PathOptions;
  popup?: string | React.ReactNode;
};

export type MapPolyline = {
  id?: string | number;
  positions: [number, number][];
  style?: L.PathOptions;
  popup?: string | React.ReactNode;
};

// Map event handler component
function MapEvents({
  onMapClick,
  onLocationFound,
}: {
  onMapClick?: (latlng: L.LatLng) => void;
  onLocationFound?: (latlng: L.LatLng) => void;
}) {
  const map = useMapEvents({
    click: (e) => {
      onMapClick?.(e.latlng);
    },
    locationfound: (e) => {
      onLocationFound?.(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });
  return null;
}

// FlyTo helper
function FlyToTarget({ target, zoom }: { target: [number, number] | null; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo(target, zoom || 17, { duration: 1.2 });
    }
  }, [target, map, zoom]);
  return null;
}

// Layer toggle buttons
function LayerControls({
  onLocate,
  onToggleLayer,
  currentLayers,
}: {
  onLocate: () => void;
  onToggleLayer: (layer: string) => void;
  currentLayers: Record<string, boolean>;
}) {
  const map = useMap();

  useEffect(() => {
    const control = (L.control as any)({ position: 'topright' });

    control.onAdd = () => {
      const div = L.DomUtil.create('div', '');
      div.innerHTML = `
        <div style="background: hsl(var(--background, 0 0% 100%)); padding: 6px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.15); display: flex; flex-direction: column; gap: 4px;">
          <button id="locate-btn" style="padding: 6px 10px; border: 1px solid hsl(var(--border, 0 0% 90%)); border-radius: 6px; cursor: pointer; background: transparent; font-size: 12px;" title="Minha localização">📍</button>
          <button id="satellite-btn" style="padding: 6px 10px; border: 1px solid hsl(var(--border, 0 0% 90%)); border-radius: 6px; cursor: pointer; background: ${currentLayers.satellite ? 'hsl(var(--primary, 220 90% 56%))' : 'transparent'}; color: ${currentLayers.satellite ? 'white' : 'inherit'}; font-size: 12px;" title="Satélite">🛰️</button>
        </div>
      `;

      L.DomEvent.disableClickPropagation(div);

      div.querySelector('#locate-btn')!.addEventListener('click', () => onLocate());
      div.querySelector('#satellite-btn')!.addEventListener('click', () => onToggleLayer('satellite'));

      return div;
    };

    control.addTo(map);
    return () => { control.remove(); };
  }, [map, onLocate, onToggleLayer, currentLayers]);

  return null;
}

// Main AdvancedMap component
export function AdvancedMap({
  center = [2.8195, -60.6714] as [number, number],
  zoom = 13,
  markers = [] as MapMarker[],
  polygons = [] as MapPolygon[],
  circles = [] as MapCircle[],
  polylines = [] as MapPolyline[],
  onMarkerClick,
  onMarkerDragEnd,
  onMapClick,
  enableClustering = false,
  enableControls = true,
  flyTo = null as [number, number] | null,
  flyToZoom,
  mapLayers = { openstreetmap: true, satellite: false },
  className = '',
  style = { height: '500px', width: '100%' },
  children,
}: {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  polygons?: MapPolygon[];
  circles?: MapCircle[];
  polylines?: MapPolyline[];
  onMarkerClick?: (marker: MapMarker) => void;
  onMarkerDragEnd?: (marker: MapMarker, newPosition: [number, number]) => void;
  onMapClick?: (latlng: L.LatLng) => void;
  enableClustering?: boolean;
  enableControls?: boolean;
  flyTo?: [number, number] | null;
  flyToZoom?: number;
  mapLayers?: Record<string, boolean>;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  const [currentLayers, setCurrentLayers] = useState(mapLayers);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  const handleToggleLayer = useCallback((layerType: string) => {
    setCurrentLayers(prev => ({
      ...prev,
      openstreetmap: layerType === 'satellite' ? !prev.satellite : prev.openstreetmap,
      [layerType]: !prev[layerType],
    }));
  }, []);

  const handleLocate = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => console.error('Geolocation error:', error)
      );
    }
  }, []);

  const renderMarkers = (markerList: MapMarker[]) =>
    markerList.map((marker) => (
      <Marker
        key={marker.id}
        position={marker.position}
        icon={marker.icon || createSvgIcon(marker.color || '#2563eb', marker.size || 'medium')}
        draggable={marker.draggable || false}
        eventHandlers={{
          click: () => onMarkerClick?.(marker),
          dragend: (e) => {
            const latlng = e.target.getLatLng();
            onMarkerDragEnd?.(marker, [latlng.lat, latlng.lng]);
          },
        }}
      >
        {marker.popup && (
          <Popup>
            <div className="min-w-[180px]">
              {marker.popup.title && <h3 className="font-bold text-sm">{marker.popup.title}</h3>}
              {typeof marker.popup.content === 'string' ? (
                <p className="text-xs">{marker.popup.content}</p>
              ) : (
                marker.popup.content
              )}
            </div>
          </Popup>
        )}
      </Marker>
    ));

  return (
    <div className={className} style={style}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        {/* Tile layers */}
        {!currentLayers.satellite && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}

        {currentLayers.satellite && (
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        )}

        {/* Map events */}
        <MapEvents onMapClick={onMapClick} onLocationFound={(ll) => setUserLocation([ll.lat, ll.lng])} />

        {/* FlyTo */}
        <FlyToTarget target={flyTo} zoom={flyToZoom} />

        {/* Controls */}
        {enableControls && (
          <LayerControls
            onLocate={handleLocate}
            onToggleLayer={handleToggleLayer}
            currentLayers={currentLayers}
          />
        )}

        {/* Markers */}
        {enableClustering ? (
          <>
            <MarkerClusterGroup chunkedLoading>
              {renderMarkers(markers.filter(m => !m.excludeFromCluster))}
            </MarkerClusterGroup>
            {renderMarkers(markers.filter(m => m.excludeFromCluster))}
          </>
        ) : (
          renderMarkers(markers)
        )}

        {/* User location */}
        {userLocation && (
          <Marker position={userLocation} icon={createSvgIcon('#dc2626', 'medium')}>
            <Popup>📍 Sua localização</Popup>
          </Marker>
        )}

        {/* Polygons */}
        {polygons.map((polygon, index) => (
          <Polygon
            key={polygon.id || index}
            positions={polygon.positions}
            pathOptions={polygon.style || { color: 'purple', weight: 2, fillOpacity: 0.3 }}
          >
            {polygon.popup && <Popup>{polygon.popup}</Popup>}
          </Polygon>
        ))}

        {/* Circles */}
        {circles.map((circle, index) => (
          <Circle
            key={circle.id || index}
            center={circle.center}
            radius={circle.radius}
            pathOptions={circle.style || { color: 'blue', weight: 2, fillOpacity: 0.2 }}
          >
            {circle.popup && <Popup>{circle.popup}</Popup>}
          </Circle>
        ))}

        {/* Polylines */}
        {polylines.map((polyline, index) => (
          <Polyline
            key={polyline.id || index}
            positions={polyline.positions}
            pathOptions={polyline.style || { color: 'red', weight: 3 }}
          >
            {polyline.popup && <Popup>{polyline.popup}</Popup>}
          </Polyline>
        ))}

        {/* Additional children (for page-specific content) */}
        {children}
      </MapContainer>
    </div>
  );
}
