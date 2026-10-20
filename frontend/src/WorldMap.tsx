import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { findArticleLocations } from "./utils/locations";
import type { GeoLocation } from "./utils/locations";

type MapArticle = { id: string; title: string; url: string };
type Props = { articles: MapArticle[]; selectedLocation: GeoLocation | null; showStrategicMarkers?: boolean };

const strategicSites = [
  { name: "Taiwan Strait", lat: 24, lng: 119.5 },
  { name: "Strait of Hormuz", lat: 26.5, lng: 56.3 },
  { name: "Suez Canal", lat: 30.5, lng: 32.3 },
  { name: "South China Sea", lat: 12, lng: 114 },
  { name: "Panama Canal", lat: 9.1, lng: -79.7 },
];

function MapController({ selectedLocation }: { selectedLocation: GeoLocation | null }) {
  const map = useMap();
  useEffect(() => {
    if (selectedLocation) map.flyTo([selectedLocation.lat, selectedLocation.lng], 5, { duration: 1.2 });
  }, [selectedLocation, map]);
  return null;
}

export default function WorldMap({ articles, selectedLocation, showStrategicMarkers = false }: Props) {
  const groups = useMemo(() => {
    const grouped = new Map<string, { location: GeoLocation; articles: MapArticle[] }>();
    for (const article of articles) {
      for (const location of findArticleLocations(article.title)) {
        const current = grouped.get(location.name);
        if (current) current.articles.push(article);
        else grouped.set(location.name, { location, articles: [article] });
      }
    }
    return [...grouped.values()];
  }, [articles]);

  return <div className="world-map">
    <MapContainer center={[19, 10]} zoom={2} minZoom={2} maxZoom={12} zoomControl={true} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapController selectedLocation={selectedLocation} />
      {groups.map(({ location, articles: related }) => {
        const selected = selectedLocation?.name === location.name;
        return <CircleMarker key={location.name} center={[location.lat, location.lng]} radius={selected ? 10 : Math.min(9, 4 + Math.sqrt(related.length) * 2)} pathOptions={{ color: selected ? "#e9c6ff" : "#c084fc", fillColor: selected ? "#e9c6ff" : "#7c3aed", fillOpacity: 0.8, weight: 2 }}>
          <Popup><div className="map-popup"><strong>{location.name}</strong><p>{related.length} headline mention(s)</p><ul>{related.map((article) => <li key={article.id}><a href={article.url} target="_blank" rel="noopener noreferrer">{article.title} ↗</a></li>)}</ul></div></Popup>
        </CircleMarker>;
      })}
      {showStrategicMarkers && strategicSites.map((site) => <CircleMarker key={site.name} center={[site.lat, site.lng]} radius={5} pathOptions={{ color: "#a78bfa", fillColor: "#a78bfa", fillOpacity: 0.7 }}><Popup><strong>{site.name}</strong><p>Reference location — not a live incident</p></Popup></CircleMarker>)}
      {selectedLocation && !groups.some((group) => group.location.name === selectedLocation.name) && <CircleMarker center={[selectedLocation.lat, selectedLocation.lng]} radius={10} pathOptions={{ color: "#e9c6ff", fillColor: "#7c3aed", fillOpacity: 0.9 }}><Popup>{selectedLocation.name}</Popup></CircleMarker>}
    </MapContainer>
  </div>;
}
