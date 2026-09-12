import React, { useMemo, useState } from "react";
import { ArrowRight, Bookmark, BrainCircuit, BusFront, Clock3, MapPin, Navigation, Search, TrainFront, Trash2, Users } from "lucide-react";
import MapView from "@/components/MapView";
import { deleteSavedRoute, listCrowdPredictions, listCrowdReadings, listFacilities, listSavedRoutes, listTransportServices, saveRoute } from "@/lib/supabaseData";
import { useWorkspaceData } from "@/hooks/useWorkspaceData";
import { EmptyState, ErrorState, LoadingState, SectionHeader, StatusBadge } from "@/components/workspace/WorkspaceUI";
import { SettingsPanel } from "@/components/workspace/SettingsPanel";
import { useLanguage } from "@/i18n";

const fileAsBase64 = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error("The CCTV frame could not be read."));
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => reject(new Error("The selected file is not a readable image."));
    image.onload = () => {
      const maxDimension = 1600;
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error("The CCTV frame could not be prepared."));
          return;
        }
        const output = new FileReader();
        output.onload = () => resolve(String(output.result));
        output.onerror = () => reject(new Error("The CCTV frame could not be prepared."));
        output.readAsDataURL(blob);
      }, "image/jpeg", 0.82);
    };
    image.src = String(reader.result);
  };
  reader.readAsDataURL(file);
});

const CrowdResult = ({ result }) => (
  <div className="crowd-result" data-testid="crowd-prediction-result">
    <div><span className="crowd-result-label">AI crowd status</span><StatusBadge value={result.crowd_level}/></div>
    <strong>{result.crowd_percentage === null ? "—" : `${result.crowd_percentage}%`}</strong>
    <span>{result.count} people detected · {result.boxes?.length || 0} boxes · {result.crowd_percentage === null ? "Add vehicle capacity for a percentage" : "occupancy"}</span>
  </div>
);

const TransportExplorer = ({ session }) => {
  const { t } = useLanguage();
  const services = useWorkspaceData(() => listTransportServices(), []);
  const [query, setQuery] = useState("");
  const [fromQuery, setFromQuery] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [mode, setMode] = useState("all");
  const [message, setMessage] = useState("");
  const [prediction, setPrediction] = useState({});
  const [busyId, setBusyId] = useState("");

  const filtered = useMemo(() => services.data.filter(item => {
    const matchesMode = mode === "all" || item.mode === mode;
    const matchesQuery = [item.service_number, item.service_name, item.vehicle_registration].join(" ").toLowerCase().includes(query.toLowerCase());
    const matchesFrom = String(item.origin || "").toLowerCase().includes(fromQuery.toLowerCase());
    const matchesDestination = String(item.destination || "").toLowerCase().includes(destinationQuery.toLowerCase());
    const serviceDate = String(item.service_date || item.created_at || "").slice(0, 10);
    const matchesDate = !date || serviceDate === date;
    const matchesTime = !time || String(item.departure_time || "").slice(0, 5) === time;
    return matchesMode && matchesQuery && matchesFrom && matchesDestination && matchesDate && matchesTime;
  }), [services.data, query, fromQuery, destinationQuery, date, time, mode]);

  const save = async service => {
    try { await saveRoute(session.user.id, service); setMessage(`${service.service_number} ${t("passenger.saved")}`); }
    catch (error) { setMessage(error.message); }
  };

  const predict = async (service, event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusyId(service.id); setMessage("");
    try {
      const response = await fetch("/api/detect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image_base64: await fileAsBase64(file), capacity: Number(service.capacity) || undefined }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "AI crowd prediction failed.");
      setPrediction(current => ({ ...current, [service.id]: result }));
    } catch (error) { setMessage(error.message); }
    finally { setBusyId(""); }
  };

  return <>
    <SectionHeader eyebrow="PASSENGER · LIVE SEARCH" title="Search" description="Find verified buses and railway services by route, date, and leaving time. Upload a real CCTV frame to predict crowd status."/>
    <div className="filter-bar route-filter-bar">
      <label className="route-filter-field"><MapPin size={16}/><span><small>{t("passenger.from")}</small><input value={fromQuery} onChange={event => setFromQuery(event.target.value)} data-testid="transport-from-input" placeholder={t("passenger.startingPoint")} aria-label={t("passenger.from")}/></span></label>
      <label className="route-filter-field"><Navigation size={16}/><span><small>{t("passenger.destination")}</small><input value={destinationQuery} onChange={event => setDestinationQuery(event.target.value)} data-testid="transport-destination-input" placeholder={t("passenger.whereGoing")} aria-label={t("passenger.destination")}/></span></label>
      <label className="route-filter-field"><Clock3 size={16}/><span><small>Date</small><input type="date" value={date} onChange={event => setDate(event.target.value)} data-testid="transport-date-input" aria-label="Travel date"/></span></label>
      <label className="route-filter-field"><Clock3 size={16}/><span><small>Leaving time</small><input type="time" value={time} onChange={event => setTime(event.target.value)} data-testid="transport-time-input" aria-label="Leaving time"/></span></label>
      <label className="service-filter-field"><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} data-testid="transport-search-input" placeholder={t("passenger.serviceSearch")} aria-label={t("passenger.serviceSearch")}/></label>
      <div className="segmented"><button className={mode === "all" ? "active" : ""} data-testid="transport-filter-all" onClick={() => setMode("all")}>{t("passenger.all")}</button><button className={mode === "bus" ? "active" : ""} data-testid="transport-filter-bus" onClick={() => setMode("bus")}>{t("passenger.bus")}</button><button className={mode === "railway" ? "active" : ""} data-testid="transport-filter-railway" onClick={() => setMode("railway")}>{t("passenger.rail")}</button></div>
    </div>
    {(fromQuery || destinationQuery || date || time) && <div className="route-search-summary" data-testid="route-search-summary"><MapPin size={14}/><span>{t("passenger.showingRoutes")} <b>{fromQuery || t("passenger.anywhere")}</b> {t("passenger.to")} <b>{destinationQuery || t("passenger.anywhere")}</b>{date ? ` · ${date}` : ""}{time ? ` · ${time}` : ""}</span></div>}
    {message && <div className="notice-line" data-testid="transport-save-message">{message}</div>}
    {services.loading ? <LoadingState label={t("common.loading")}/> : services.error ? <ErrorState message={services.error}/> : filtered.length ? <div className="service-list">{filtered.map(service => <article className="service-row detailed-service-row" key={service.id} data-testid={`transport-service-${service.id}`}>
      <div className={`service-mode ${service.mode}`}>{service.mode === "bus" ? <BusFront/> : <TrainFront/>}</div>
      <div className="service-main"><span>{service.service_number}</span><div className="route-path" aria-label={`${t("passenger.from")} ${service.origin} ${t("passenger.to")} ${service.destination}`}><span className="route-point"><small>{t("passenger.from")}</small><b>{service.origin}</b></span><ArrowRight className="route-arrow" size={16}/><span className="route-point"><small>{t("passenger.destination")}</small><b>{service.destination}</b></span></div><small>{service.service_name} · {service.vehicle_registration || "Vehicle details pending"} · Capacity {service.capacity || "not set"}</small></div>
      <div className="service-time"><span><Clock3 size={14}/><small>Leaves</small><b>{String(service.departure_time || "").slice(0, 5) || "—"}</b></span><span><Clock3 size={14}/><small>Arrives</small><b>{String(service.arrival_time || "").slice(0, 5) || "—"}</b></span><small>{service.bay_or_platform || t("passenger.platformPending")}</small></div>
      <StatusBadge value={service.status}/><button className="icon-button" title={t("passenger.saveRoute")} aria-label={`${t("passenger.saveRoute")} ${service.service_number}`} data-testid={`save-route-${service.id}`} onClick={() => save(service)}><Bookmark size={17}/></button>
      <label className="predict-button"><input type="file" accept="image/*" capture="environment" onChange={event => predict(service, event)} disabled={busyId === service.id}/><span><BrainCircuit size={16}/>{busyId === service.id ? "Scanning…" : "Predict crowd"}</span></label>
      {prediction[service.id] && <CrowdResult result={prediction[service.id]}/>}
    </article>)}</div> : <EmptyState icon={BusFront} title={t("passenger.noMatching")} message={t("passenger.tryDifferent")} testId="transport-empty"/>}
  </>;
};

const PredictionCenter = () => {
  const predictions = useWorkspaceData(() => listCrowdPredictions(), []);
  return <><SectionHeader eyebrow="PASSENGER · AI" title="AI crowd prediction" description="Predictions come from the server-side YOLO26n model and real CCTV frames only. Open Search to scan a frame from a bus or station service."/>{predictions.loading ? <LoadingState/> : predictions.error ? <ErrorState message={predictions.error}/> : predictions.data.length ? <div className="prediction-list">{predictions.data.map(item => <article key={item.id} data-testid={`crowd-prediction-${item.id}`}><span><b>{item.mahaflow_facilities?.name || "Transit facility"}</b><small>{item.zone} · {new Date(item.prediction_for).toLocaleString()}</small></span><strong>{item.predicted_count}</strong><StatusBadge value={item.crowd_level}/></article>)}</div> : <EmptyState icon={BrainCircuit} title="Ready for a real frame" message="Choose Search, find a service, and use Predict crowd. The server will return detections only when its YOLO .pt model is configured." testId="crowd-predictions-empty"/>}</>;
};

const CrowdMap = () => {
  const { t } = useLanguage();
  const facilities = useWorkspaceData(() => listFacilities(), []);
  const readings = useWorkspaceData(() => listCrowdReadings(), []);
  const latest = useMemo(() => {
    const seen = new Set();
    return readings.data.filter(item => { const key = `${item.facility_id}-${item.zone}`; if (seen.has(key)) return false; seen.add(key); return true; });
  }, [readings.data]);
  const markers = facilities.data.map(facility => {
    const reading = latest.find(item => item.facility_id === facility.id);
    return { lat: facility.latitude, lng: facility.longitude, label: facility.name, level: reading?.crowd_level || t("common.awaitingLiveData") };
  });
  return <><SectionHeader eyebrow={t("passenger.crowdEyebrow")} title={t("passenger.crowdTitle")} description={t("passenger.crowdDescription")}/><div className="map-layout"><MapView markers={markers}/><aside className="map-feed"><h3>{t("passenger.latestReadings")}</h3>{readings.loading ? <LoadingState label={t("common.loading")}/> : latest.length ? latest.map(item => <div className="feed-row" key={item.id} data-testid={`public-crowd-${item.id}`}><span><b>{item.mahaflow_facilities?.name || t("common.transitFacility")}</b><small>{item.zone} · {item.people_count} {t("common.people")} · {item.source}</small></span><StatusBadge value={item.crowd_level}/></div>) : <EmptyState icon={Users} title={t("passenger.noReadings")} message={t("passenger.noReadingsMessage")} testId="crowd-readings-empty"/>}</aside></div></>;
};

const SavedRoutes = ({ session }) => {
  const { t } = useLanguage();
  const routes = useWorkspaceData(() => listSavedRoutes(session.user.id), [session.user.id]);
  const remove = async routeId => { await deleteSavedRoute(session.user.id, routeId); await routes.reload(); };
  return <><SectionHeader eyebrow={t("passenger.personalEyebrow")} title={t("passenger.savedRoutesTitle")} description={t("passenger.savedRoutesDescription")}/>{routes.loading ? <LoadingState label={t("common.loading")}/> : routes.error ? <ErrorState message={routes.error}/> : routes.data.length ? <div className="saved-grid">{routes.data.map(route => <article className="saved-card" key={route.route_id} data-testid={`saved-route-${route.route_id}`}><div className="service-mode">{route.mode === "railway" ? <TrainFront/> : <BusFront/>}</div><span><small>{route.service_number || route.mode}</small><b>{route.origin || t("passenger.from")} → {route.destination || route.route_id}</b></span><button className="icon-button" aria-label={t("passenger.removeSavedRoute")} data-testid={`delete-saved-route-${route.route_id}`} onClick={() => remove(route.route_id)}><Trash2 size={16}/></button></article>)}</div> : <EmptyState icon={Bookmark} title={t("passenger.noSavedRoutes")} message={t("passenger.noSavedRoutesMessage")} testId="saved-routes-empty"/>}</>;
};

export const PassengerWorkspace = ({ page, session, profile, theme, setTheme }) => {
  if (page === "Search") return <TransportExplorer session={session}/>;
  if (page === "AI crowd prediction") return <PredictionCenter/>;
  if (page === "Crowd map") return <CrowdMap/>;
  if (page === "Saved routes") return <SavedRoutes session={session}/>;
  if (page === "Settings") return <SettingsPanel {...{ role: "passenger", session, profile, theme, setTheme }}/>;
  return null;
};