import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  GoogleMap,
  useJsApiLoader,
  MarkerF,
  InfoWindowF,
  CircleF,
  PolylineF,
  PolygonF,
} from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = 'AIzaSyBwfNAvuI8Fy24j2N6VUofcC5TEykupP_I';
const MAP_LOAD_TIMEOUT_MS = 12000;

const ICON_SIZES = { small: [20, 32], medium: [25, 41], large: [30, 50] } as const;

const createMarkerSvg = (color: string, width: number, height: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 25 41"><path d="M12.5 0C5.6 0 0 5.6 0 12.5C0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="${color}" stroke="#fff" stroke-width="1.5"/><circle cx="12.5" cy="12.5" r="5" fill="#fff"/></svg>`;

export type GMapIcon = {
  url: string;
  size: [number, number];
  anchor: [number, number];
  labelOrigin?: [number, number];
  _label?: string;
};

export const createSvgIcon = (color = '#2563eb', size: 'small' | 'medium' | 'large' = 'medium'): GMapIcon => {
  const [w, h] = ICON_SIZES[size];
  const svg = createMarkerSvg(color, w, h);
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    size: [w, h],
    anchor: [w / 2, h],
    labelOrigin: [w / 2, -10],
  };
};

export const createDotIcon = (color = '#2563eb', dotSize = 14): GMapIcon => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${dotSize}" height="${dotSize}"><circle cx="${dotSize / 2}" cy="${dotSize / 2}" r="${dotSize / 2 - 1.5}" fill="${color}" stroke="white" stroke-width="2"/></svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    size: [dotSize, dotSize],
    anchor: [dotSize / 2, dotSize / 2],
  };
};

export const createLabeledSvgIcon = (
  color = '#2563eb',
  label = '',
  size: 'small' | 'medium' | 'large' = 'medium'
): GMapIcon => {
  const icon = createSvgIcon(color, size);
  return { ...icon, _label: label };
};

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
  icon?: GMapIcon;
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
  style?: {
    strokeColor?: string;
    strokeWeight?: number;
    strokeOpacity?: number;
    fillColor?: string;
    fillOpacity?: number;
  };
  popup?: string | React.ReactNode;
};

export type MapPolygon = {
  id?: string | number;
  positions: [number, number][];
  style?: {
    strokeColor?: string;
    strokeWeight?: number;
    fillColor?: string;
    fillOpacity?: number;
  };
  popup?: string | React.ReactNode;
};

export type MapPolyline = {
  id?: string | number;
  positions: [number, number][];
  style?: {
    strokeColor?: string;
    strokeWeight?: number;
    strokeOpacity?: number;
    color?: string;
    weight?: number;
    opacity?: number;
  };
  popup?: string | React.ReactNode;
};

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
  enableClustering: _enableClustering = false,
  enableControls = true,
  flyTo = null as [number, number] | null,
  flyToZoom,
  mapLayers: _mapLayers,
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
  onMapClick?: (latlng: { lat: number; lng: number }) => void;
  enableClustering?: boolean;
  enableControls?: boolean;
  flyTo?: [number, number] | null;
  flyToZoom?: number;
  mapLayers?: Record<string, boolean>;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const [activeInfoWindow, setActiveInfoWindow] = useState<string | number | null>(null);
  const [loaderTimedOut, setLoaderTimedOut] = useState(false);

  useEffect(() => {
    if (isLoaded || loadError) {
      setLoaderTimedOut(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setLoaderTimedOut(true);
    }, MAP_LOAD_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isLoaded, loadError]);

  useEffect(() => {
    if (loadError) {
      console.error('Erro ao carregar Google Maps:', loadError);
    }
  }, [loadError]);

  useEffect(() => {
    if (flyTo && mapRef.current) {
      mapRef.current.panTo({ lat: flyTo[0], lng: flyTo[1] });
      if (flyToZoom) mapRef.current.setZoom(flyToZoom);
    }
  }, [flyTo, flyToZoom]);

  const toGoogleIcon = useCallback((icon: GMapIcon): google.maps.Icon | undefined => {
    if (!window.google?.maps) return undefined;
    return {
      url: icon.url,
      scaledSize: new google.maps.Size(icon.size[0], icon.size[1]),
      anchor: new google.maps.Point(icon.anchor[0], icon.anchor[1]),
      ...(icon.labelOrigin ? { labelOrigin: new google.maps.Point(icon.labelOrigin[0], icon.labelOrigin[1]) } : {}),
    };
  }, []);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className={className} style={style}>
        <div className="h-full w-full flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground px-4 text-center">
          <p className="font-medium">Chave do Google Maps não configurada.</p>
          <p className="text-sm">Adicione uma chave válida para carregar o mapa.</p>
        </div>
      </div>
    );
  }

  if (loadError || loaderTimedOut) {
    const message = loadError?.message || 'O Google Maps demorou demais para responder.';

    return (
      <div className={className} style={style}>
        <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-muted text-muted-foreground px-4 text-center">
          <p className="font-medium">Não foi possível carregar o mapa.</p>
          <p className="max-w-md text-sm">{message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={className} style={style}>
        <div className="h-full w-full flex items-center justify-center bg-muted text-muted-foreground">
          Carregando mapa...
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={style}>
      <GoogleMap
        mapContainerStyle={{ height: '100%', width: '100%' }}
        center={{ lat: center[0], lng: center[1] }}
        zoom={zoom}
        onClick={(e) => {
          if (e.latLng && onMapClick) {
            onMapClick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
          }
          setActiveInfoWindow(null);
        }}
        onLoad={(map) => { mapRef.current = map; }}
        options={{
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: enableControls,
          zoomControl: enableControls,
        }}
      >
        {markers.map((marker) => {
          const icon = marker.icon || createSvgIcon(marker.color || '#2563eb', marker.size || 'medium');
          return (
            <MarkerF
              key={String(marker.id)}
              position={{ lat: marker.position[0], lng: marker.position[1] }}
              icon={toGoogleIcon(icon)}
              label={icon._label ? {
                text: icon._label,
                fontSize: '11px',
                fontWeight: '700',
                color: '#1e293b',
                className: 'gmap-marker-label',
              } : undefined}
              draggable={marker.draggable || false}
              onClick={() => {
                onMarkerClick?.(marker);
                if (marker.popup) setActiveInfoWindow(marker.id);
              }}
              onDragEnd={(e) => {
                if (e.latLng) {
                  onMarkerDragEnd?.(marker, [e.latLng.lat(), e.latLng.lng()]);
                }
              }}
            >
              {activeInfoWindow === marker.id && marker.popup && (
                <InfoWindowF onCloseClick={() => setActiveInfoWindow(null)}>
                  <div style={{ minWidth: 180, maxWidth: 280 }}>
                    {marker.popup.title && (
                      <h3 style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>
                        {marker.popup.title}
                      </h3>
                    )}
                    {typeof marker.popup.content === 'string' ? (
                      <p style={{ fontSize: '12px' }}>{marker.popup.content}</p>
                    ) : (
                      marker.popup.content
                    )}
                  </div>
                </InfoWindowF>
              )}
            </MarkerF>
          );
        })}

        {circles.map((circle, index) => (
          <CircleF
            key={String(circle.id || index)}
            center={{ lat: circle.center[0], lng: circle.center[1] }}
            radius={circle.radius}
            options={{
              strokeColor: circle.style?.strokeColor || '#3b82f6',
              strokeWeight: circle.style?.strokeWeight || 2,
              strokeOpacity: circle.style?.strokeOpacity || 1,
              fillColor: circle.style?.fillColor || '#3b82f6',
              fillOpacity: circle.style?.fillOpacity || 0.2,
            }}
          />
        ))}

        {polylines.map((polyline, index) => (
          <PolylineF
            key={String(polyline.id || index)}
            path={polyline.positions.map((p) => ({ lat: p[0], lng: p[1] }))}
            options={{
              strokeColor: polyline.style?.strokeColor || polyline.style?.color || '#dc2626',
              strokeWeight: polyline.style?.strokeWeight || polyline.style?.weight || 3,
              strokeOpacity: polyline.style?.strokeOpacity || polyline.style?.opacity || 1,
            }}
          />
        ))}

        {polygons.map((polygon, index) => (
          <PolygonF
            key={String(polygon.id || index)}
            paths={polygon.positions.map((p) => ({ lat: p[0], lng: p[1] }))}
            options={{
              strokeColor: polygon.style?.strokeColor || '#7c3aed',
              strokeWeight: polygon.style?.strokeWeight || 2,
              fillColor: polygon.style?.fillColor || '#7c3aed',
              fillOpacity: polygon.style?.fillOpacity || 0.3,
            }}
          />
        ))}

        {children}
      </GoogleMap>
    </div>
  );
}
