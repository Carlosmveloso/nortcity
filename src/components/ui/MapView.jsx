import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

function createIcon(color) {
    return L.divIcon({
        className: '',
        html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></span>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        popupAnchor: [0, -8],
    });
}

function MapView({ points, categories, center = [-7.4667, -34.8167], zoom = 13, className = '' }) {
    const colorFor = (category) => categories.find((item) => item.value === category)?.color ?? '#094f66';
    const labelFor = (category) => categories.find((item) => item.value === category)?.label ?? category;

    return (
        <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} className={className}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {points.map((point) => (
                <Marker key={point.id} position={[point.lat, point.lng]} icon={createIcon(colorFor(point.category))}>
                    <Popup>
                        <strong>{point.name}</strong>
                        <br />
                        {labelFor(point.category)}
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
}

export default MapView;
