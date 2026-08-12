import { useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';

function MapInteractionController({ active }) {
    const map = useMap();

    useEffect(() => {
        const toggle = (control, enabled) => {
            if (!control) return;
            if (enabled) control.enable();
            else control.disable();
        };

        toggle(map.dragging, active);
        toggle(map.touchZoom, active);
        toggle(map.doubleClickZoom, active);
        toggle(map.scrollWheelZoom, active);
        if (map.tap) toggle(map.tap, active);
    }, [map, active]);

    return null;
}

function createIcon(color) {
    return L.divIcon({
        className: '',
        html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></span>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        popupAnchor: [0, -8],
    });
}

function MapView({ points, categories, center = [-7.4733, -34.8083], zoom = 13, className = '' }) {
    const [active, setActive] = useState(false);
    const colorFor = (category) => categories.find((item) => item.value === category)?.color ?? '#094f66';
    const labelFor = (category) => categories.find((item) => item.value === category)?.label ?? category;

    return (
        <div className="relative isolate">
            {!active && (
                <button
                    type="button"
                    onClick={() => setActive(true)}
                    onTouchStart={() => setActive(true)}
                    className="absolute inset-0 z-1000 flex items-center justify-center bg-dark-ocean/10"
                    aria-label="Toque para interagir com o mapa"
                >
                    <span className="rounded-full bg-card px-4 py-2 text-sm font-semibold text-dark-ocean shadow-md">
                        Toque para interagir com o mapa
                    </span>
                </button>
            )}
            <MapContainer
                center={center}
                zoom={zoom}
                scrollWheelZoom={false}
                dragging={false}
                touchZoom={false}
                doubleClickZoom={false}
                tap={false}
                className={className}
            >
                <MapInteractionController active={active} />
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {points.map((point) => (
                    <Marker key={point.id} position={[point.lat, point.lng]} icon={createIcon(colorFor(point.category))}>
                        <Popup>
                            <strong>{point.name}</strong>
                            <br />
                            <span className="notranslate" translate="no">
                                {labelFor(point.category)}
                            </span>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
}

export default MapView;
