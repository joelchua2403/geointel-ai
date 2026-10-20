
import { useEffect, useMemo } from "react";

import {
  MapContainer,
  TileLayer,
  Marker,
  CircleMarker,
  Popup,
  useMap,
  useMapEvents,
  ZoomControl,
} from "react-leaflet";

import MarkerClusterGroup from "react-leaflet-cluster";

import L from "leaflet";

import type { LatLngBoundsExpression } from "leaflet";

import {
  findArticleLocations,
} from "../utils/locations";

import type {
  GeoLocation,
} from "../utils/locations";

import type {
  StrategicSite,
} from "../utils/strategicSites";

import "leaflet/dist/leaflet.css";

// ==========================================
// TYPES
// ==========================================

type MapArticle = {
  id: string;
  title: string;
  category?: string;
  source?: string;
  url?: string;
  published_at?: string;
};

interface WorldMapProps {
  articles: MapArticle[];
  selectedLocation: GeoLocation | null;
  onSelectLocation: (location: GeoLocation) => void;
  showStrategicMarkers?: boolean;
  strategicSites?: StrategicSite[];
  pickingLocation?: boolean;
onPickLocation?: (lat: number, lng: number) => void;
}

type LocationGroup = {
  location: GeoLocation;
  articles: MapArticle[];
};

// ==========================================
// MAP CONFIGURATION
// ==========================================

const WORLD_BOUNDS: LatLngBoundsExpression = [
  [-85, -180],
  [85, 180],
];

const DEFAULT_CENTER: [number, number] = [20, 10];

const DEFAULT_ZOOM = 2;

// ==========================================
// MARKER ICONS
// ==========================================

const newsIcon = L.divIcon({
  className: "geointel-news-icon",
  html: `
    <div style="
      width: 15px;
      height: 15px;
      background: #a78bfa;
      border: 2px solid #e9d5ff;
      border-radius: 50%;
      box-shadow:
        0 0 0 5px rgba(139,92,246,0.18),
        0 0 16px rgba(139,92,246,0.65);
    "></div>
  `,
  iconSize: [19, 19],
  iconAnchor: [9, 9],
});

const selectedNewsIcon = L.divIcon({
  className: "geointel-news-icon selected",
  html: `
    <div style="
      width: 19px;
      height: 19px;
      background: #c4b5fd;
      border: 3px solid #ffffff;
      border-radius: 50%;
      box-shadow:
        0 0 0 7px rgba(139,92,246,0.25),
        0 0 22px rgba(139,92,246,0.9);
    "></div>
  `,
  iconSize: [25, 25],
  iconAnchor: [12, 12],
});

function createClusterIcon(cluster: { getChildCount: () => number }) {
  const count = cluster.getChildCount();

  const size =
    count >= 20 ? 52 : count >= 10 ? 46 : 40;

  return L.divIcon({
    className: "geointel-cluster",
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: rgba(91,33,182,0.88);
        border: 2px solid #c4b5fd;
        color: white;
        font-size: 13px;
        font-weight: 700;
        box-shadow:
          0 0 0 6px rgba(139,92,246,0.12),
          0 0 22px rgba(139,92,246,0.45);
      ">
        ${count}
      </div>
    `,
    iconSize: L.point(size, size),
    iconAnchor: L.point(size / 2, size / 2),
  });
}

// ==========================================
// MAP CONTROLLER
// ==========================================

function MapController({
  selectedLocation,
}: {
  selectedLocation: GeoLocation | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedLocation) {
      map.flyTo(
        [selectedLocation.lat, selectedLocation.lng],
        Math.max(map.getZoom(), 5),
        {
          duration: 1.1,
        }
      );
    }
  }, [map, selectedLocation]);

  return null;
}

function MapLocationPicker({
  active,
  onPick,
}: {
  active: boolean;
  onPick?: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(event) {
      if (!active) return;

      onPick?.(
        Number(event.latlng.lat.toFixed(6)),
        Number(event.latlng.lng.toFixed(6))
      );
    },
  });

  return null;
}
// ==========================================
// WORLD MAP COMPONENT
// ==========================================

export default function WorldMap({
  articles,
  selectedLocation,
  onSelectLocation,
  showStrategicMarkers = false,
  strategicSites = [],
  pickingLocation = false,
onPickLocation,
}: WorldMapProps) {

  // ========================================
  // GROUP NEWS BY LOCATION
  // ========================================

  const groupedLocations = useMemo(() => {
    const groups = new Map<string, LocationGroup>();

    articles.forEach((article) => {
      const locations = findArticleLocations(article.title);

      locations.forEach((location) => {
        const existing = groups.get(location.name);

        if (existing) {
          if (!existing.articles.some(
            (item) => item.id === article.id
          )) {
            existing.articles.push(article);
          }
        } else {
          groups.set(location.name, {
            location,
            articles: [article],
          });
        }
      });
    });

    return Array.from(groups.values());
  }, [articles]);

  // ========================================
  // FILTER ENABLED STRATEGIC SITES
  // ========================================

  const enabledStrategicSites = useMemo(
    () => strategicSites.filter((site) => site.enabled),
    [strategicSites]
  );

  // ========================================
  // RENDER
  // ========================================

  return (
    <div
      className="world-map-container"
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
      }}
    >
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        minZoom={2}
        maxZoom={12}
        maxBounds={WORLD_BOUNDS}
        maxBoundsViscosity={1}
        zoomControl={false}
        worldCopyJump={false}
        style={{
          width: "100%",
          height: "100%",
          background: "#080d18",
        }}
      >
        {/* BASE MAP */}

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          noWrap={true}
          bounds={WORLD_BOUNDS}
          className="geointel-dark-tiles"
        />

        <ZoomControl position="bottomleft" />

        {/* AUTO-ZOOM TO SELECTED LOCATION */}

        <MapController
          selectedLocation={selectedLocation}
        />

        <MapLocationPicker
  active={pickingLocation}
  onPick={onPickLocation}
/>

        {/* ==================================
            NEWS MARKER CLUSTERING
           ================================== */}

        <MarkerClusterGroup
          chunkedLoading
          showCoverageOnHover={false}
          spiderfyOnMaxZoom={true}
          maxClusterRadius={55}
          iconCreateFunction={createClusterIcon}
        >
          {groupedLocations.map(({ location, articles: news }) => {
            const selected =
              selectedLocation?.name === location.name;

            return (
              <Marker
                key={`news-${location.name}`}
                position={[location.lat, location.lng]}
                icon={
                  selected
                    ? selectedNewsIcon
                    : newsIcon
                }
                eventHandlers={{
                  click: () => onSelectLocation(location),
                }}
              >
                <Popup>
                  <div
                    style={{
                      minWidth: 200,
                      maxWidth: 270,
                    }}
                  >
                    <strong
                      style={{
                        fontSize: 14,
                      }}
                    >
                      {location.name}
                    </strong>

                    <p
                      style={{
                        margin: "6px 0",
                        fontSize: 12,
                      }}
                    >
                      {news.length} news article
                      {news.length !== 1 ? "s" : ""}
                    </p>

                    {news.slice(0, 5).map((article) => (
                      <div
                        key={article.id}
                        style={{
                          marginBottom: 8,
                          fontSize: 12,
                        }}
                      >
                        {article.url ? (
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {article.title}
                          </a>
                        ) : (
                          <span>{article.title}</span>
                        )}
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => onSelectLocation(location)}
                      style={{
                        cursor: "pointer",
                        marginTop: 8,
                        padding: "7px 10px",
                        border: "none",
                        borderRadius: 5,
                        background: "#7c3aed",
                        color: "white",
                        fontSize: 11,
                      }}
                    >
                      VIEW REGIONAL INTELLIGENCE →
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>

        {/* ==================================
            USER-MANAGED STRATEGIC SITES
           ================================== */}

        {showStrategicMarkers &&
          enabledStrategicSites.map((site) => (
            <CircleMarker
              key={`strategic-${site.id}`}
              center={[site.lat, site.lng]}
              radius={7}
              pathOptions={{
                color: "#fde68a",
                fillColor: "#f59e0b",
                fillOpacity: 0.9,
                weight: 2,
              }}
            >
              <Popup>
                <div
                  style={{
                    minWidth: 200,
                    maxWidth: 260,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 1,
                      color: "#b45309",
                      marginBottom: 7,
                    }}
                  >
                    ◆ STRATEGIC SITE
                  </div>

                  <strong
                    style={{
                      fontSize: 15,
                    }}
                  >
                    {site.name}
                  </strong>

                  <p
                    style={{
                      fontSize: 12,
                      margin: "6px 0",
                    }}
                  >
                    <strong>Category:</strong>{" "}
                    {site.category}
                  </p>

                  {site.description && (
                    <p
                      style={{
                        fontSize: 12,
                        lineHeight: 1.5,
                      }}
                    >
                      {site.description}
                    </p>
                  )}

                  <p
                    style={{
                      fontSize: 11,
                      opacity: 0.7,
                      fontFamily: "monospace",
                    }}
                  >
                    {site.lat.toFixed(4)},{" "}
                    {site.lng.toFixed(4)}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
      </MapContainer>
    </div>
  );
}
