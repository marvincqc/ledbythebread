import { MapContainer, TileLayer, Circle, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { DeliveryZone } from "../types";

const ZONE_COLORS = [
  "#e91e63", "#3f51b5", "#ff5722", "#4caf50",
  "#ff9800", "#9c27b0", "#00bcd4", "#f44336",
];

interface Props {
  zones: DeliveryZone[];
}

export default function ZoneMapPreview({ zones }: Props) {
  return (
    <MapContainer
      center={[1.3521, 103.8198]}
      zoom={11}
      style={{ height: "400px", width: "100%", borderRadius: "0.75rem" }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {zones.map((zone, i) => {
        const color = ZONE_COLORS[i % ZONE_COLORS.length];
        return (
          <Circle
            key={zone.id}
            center={[zone.center_lat, zone.center_lng]}
            radius={zone.radius_km * 1000}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.35,
              weight: 2,
              opacity: 0.8,
            }}
          >
            <Tooltip permanent direction="center" className="zone-map-label">
              {zone.name}
            </Tooltip>
          </Circle>
        );
      })}
    </MapContainer>
  );
}
