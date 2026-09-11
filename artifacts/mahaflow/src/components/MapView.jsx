import { useEffect, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

let mapsConfigured = false;

const configureMaps = (key) => {
  if (mapsConfigured) return;
  setOptions({ key, v: "weekly", authReferrerPolicy: "origin" });
  mapsConfigured = true;
};

export default function MapView({ center = { lat: 18.5204, lng: 73.8567 }, label = "Pune facility map", markers = [] }) {
  const mapRef = useRef(null);
  const [status, setStatus] = useState("Loading live map…");
  const centerLat = Number(center.lat); const centerLng = Number(center.lng);

  useEffect(() => {
    const key = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY
      || import.meta.env.REACT_APP_GOOGLE_MAPS_BROWSER_KEY
      || import.meta.env.GOOGLE_MAPS_BROWSER_KEY;
    if (!key) { setStatus("Google Maps key is not configured"); return undefined; }
    let cancelled = false;
    const previousAuthFailure = window.gm_authFailure;
    window.gm_authFailure = () => { if (!cancelled) setStatus("Google Maps rejected this key. Check Maps JavaScript API, billing, and HTTP referrers."); };

    const draw = async () => {
      try {
        configureMaps(key);
        const { Map, InfoWindow } = await importLibrary("maps");
        if (cancelled || !mapRef.current) return;
        const map = new Map(mapRef.current, { center: { lat: centerLat, lng: centerLng }, zoom: 10, disableDefaultUI: false, gestureHandling: "cooperative" });
        const points = markers.length ? markers : [{ lat: centerLat, lng: centerLng, label }];
        points.forEach(point => {
          const circle = new window.google.maps.Circle({ map, center: { lat: Number(point.lat), lng: Number(point.lng) }, radius: 650, strokeColor: "#075FD8", strokeOpacity: .9, strokeWeight: 2, fillColor: "#15BEEA", fillOpacity: .42 });
          const content = document.createElement("div"); const title = document.createElement("strong"); title.textContent = point.label || label; const detail = document.createElement("div"); detail.textContent = `Crowd: ${point.level || "Awaiting live data"}`; content.append(title, detail);
          const info = new InfoWindow({ content, position: circle.getCenter() }); circle.addListener("click", () => info.open({ map }));
        });
        setStatus("Google Maps connected");
      } catch (error) {
        if (!cancelled) setStatus(`Google Maps failed: ${error?.message || "configuration error"}`);
      }
    };

    void draw();
    return () => { cancelled = true; window.gm_authFailure = previousAuthFailure; };
  }, [centerLat, centerLng, label, markers]);

  return <div className="map-view" data-testid="facility-map"><div ref={mapRef} className="map-canvas" data-testid="google-map-canvas"/><span className="map-status" data-testid="map-status">{status}</span></div>;
}