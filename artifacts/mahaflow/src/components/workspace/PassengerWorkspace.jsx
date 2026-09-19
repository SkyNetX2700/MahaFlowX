import React, { useMemo, useState } from "react";
import { ArrowRight, Bookmark, BrainCircuit, BusFront, Clock3, MapPin, Navigation, Search, TrainFront, Trash2, Users } from "lucide-react";
import MapView from "@/components/MapView";
import { deleteSavedRoute, listCrowdObservations, listCrowdPredictions, listCrowdReadings, listFacilities, listSavedRoutes, listTransportServices, saveRoute } from "@/lib/supabaseData";
import { useWorkspaceData } from "@/hooks/useWorkspaceData";
import { EmptyState, ErrorState, LoadingState, SectionHeader, StatusBadge, formatDateTime12, formatTime12 } from "@/components/workspace/WorkspaceUI";
import { SettingsPanel } from "@/components/workspace/SettingsPanel";
import { CrowdPredictionPanel } from "@/components/workspace/CrowdPredictionPanel";
import { useLanguage } from "@/i18n";

const CrowdResult = ({ result }) => (
  <div className="crowd-result" data-testid="crowd-prediction-result">
    <div><span className="crowd-result-label">{result.source === "authority" ? "Authority live crowd" : "AI crowd status"}</span><StatusBadge value={result.crowd_level}/></div>
    <strong>{result.crowd_percentage === null ? "—" : `${result.crowd_percentage}%`}</strong>
    <span>{result.count} people {result.source === "authority" ? "reported by the authority video" : "detected"} · {result.boxes?.length || 0} boxes · {result.crowd_percentage === null ? "Add vehicle capacity for a percentage" : "occupancy"}</span>
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
  const [selectedService, setSelectedService] = useState(null);

  const filtered = useMemo(() => services.data.filter(item => {
    const matchesMode = mode === "all" || item.mode === mode;
    const matchesQuery = [item.service_number, item.service_name, item.vehicle_registration].join(" ").toLowerCase().includes(query.toLowerCase());
    const matchesFrom = String(item.origin || "").toLowerCase().includes(fromQuery.toLowerCase());
    const matchesDestination = String(item.destination || "").toLowerCase().includes(destinationQuery.toLowerCase());
    const serviceDate = String(item.service_date || "").slice(0, 10);
    const isRecurring = !serviceDate;
    const matchesDate = !date || isRecurring || serviceDate === date;
    const status = String(item.status || "").toLowerCase();
    const excludedForDate = Boolean(date && serviceDate === date && ["cancelled", "canceled", "delayed"].includes(status));
    const departureMinutes = toMinutes(item.departure_time);
    const requestedMinutes = toMinutes(time);
    const matchesTime = !time || departureMinutes === null || (requestedMinutes !== null && Math.abs(departureMinutes - requestedMinutes) <= 90);
    return matchesMode && matchesQuery && matchesFrom && matchesDestination && matchesDate && !excludedForDate && matchesTime;
  }).sort((left, right) => {
    if (!time) return 0;
    const target = toMinutes(time);
    return Math.abs((toMinutes(left.departure_time) ?? target) - target) - Math.abs((toMinutes(right.departure_time) ?? target) - target);
  }), [services.data, query, fromQuery, destinationQuery, date, time, mode]);

  const save = async service => {
    try { await saveRoute(session.user.id, service); setMessage(`${service.service_number} ${t("passenger.saved")}`); }
    catch (error) { setMessage(error.message); }
  };

  const predict = async service => {
    setBusyId(service.id); setMessage("");
    try {
      const [readings, observations] = await Promise.all([
        listCrowdReadings({ facilityId: service.facility_id }),
        listCrowdObservations({ ownerId: session.user.id }).catch(() => []),
      ]);
      const observation = observations.find(item => item.camera_id === service.camera_id || item.zone === service.origin || item.zone === service.destination);
      const latest = readings.find(item => item.zone === service.origin || item.zone === service.destination) || readings[0] || (observation ? { people_count: observation.head_count, crowd_level: observation.crowd_level, zone: observation.zone } : null);
      if (!latest) {
        throw new Error("The authority video has not published a crowd reading for this service yet.");
      }
      setPrediction(current => ({
        ...current,
        [service.id]: {
          source: "authority",
          count: Number(latest.people_count || 0),
          boxes: [],
          crowd_level: latest.crowd_level,
          crowd_percentage: Number(service.capacity) > 0 ? Math.min(100, Math.round((Number(latest.people_count || 0) / Number(service.capacity)) * 100)) : null,
        },
      }));
    } catch (error) { setMessage(error.message); }
    finally { setBusyId(""); }
  };

  return <>
    <SectionHeader eyebrow="PASSENGER · LIVE SEARCH" title="Search" description="Find verified buses and railway services by route, date, and leaving time. Predict crowd from the latest authority CCTV reading."/>
    <div className="filter-bar route-filter-bar">
      <label className="route-filter-field"><MapPin size={16}/><span><small>{t("passenger.from")}</small><input value={fromQuery} onChange={event => setFromQuery(event.target.value)} data-testid="transport-from-input" placeholder={t("passenger.startingPoint")} aria-label={t("passenger.from")}/></span></label>
      <label className="route-filter-field"><Navigation size={16}/><span><small>{t("passenger.destination")}</small><input value={destinationQuery} onChange={event => setDestinationQuery(event.target.value)} data-testid="transport-destination-input" placeholder={t("passenger.whereGoing")} aria-label={t("passenger.destination")}/></span></label>
       <label className="route-filter-field"><Clock3 size={16}/><span><small>{t("passenger.travelDate")}</small><input type="date" value={date} onChange={event => setDate(event.target.value)} data-testid="transport-date-input" aria-label={t("passenger.travelDate")}/></span></label>
       <label className="route-filter-field"><Clock3 size={16}/><span><small>{t("passenger.departureTime")}</small><input type="time" value={time} onChange={event => setTime(event.target.value)} data-testid="transport-time-input" aria-label={t("passenger.departureTime")}/><small className="time-preview">{formatTime12(time)}</small></span></label>
      <label className="service-filter-field"><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} data-testid="transport-search-input" placeholder={t("passenger.serviceSearch")} aria-label={t("passenger.serviceSearch")}/></label>
      <div className="segmented"><button className={mode === "all" ? "active" : ""} data-testid="transport-filter-all" onClick={() => setMode("all")}>{t("passenger.all")}</button><button className={mode === "bus" ? "active" : ""} data-testid="transport-filter-bus" onClick={() => setMode("bus")}>{t("passenger.bus")}</button><button className={mode === "railway" ? "active" : ""} data-testid="transport-filter-railway" onClick={() => setMode("railway")}>{t("passenger.rail")}</button></div>
    </div>
    {(fromQuery || destinationQuery || date || time) && <div className="route-search-summary" data-testid="route-search-summary"><MapPin size={14}/><span>{t("passenger.showingRoutes")} <b>{fromQuery || t("passenger.anywhere")}</b> {t("passenger.to")} <b>{destinationQuery || t("passenger.anywhere")}</b>{date ? ` · ${date}` : ""}{time ? ` · ${formatTime12(time)}` : ""}</span></div>}
    {message && <div className="notice-line" data-testid="transport-save-message">{message}</div>}
    {services.loading ? <LoadingState label={t("common.loading")}/> : services.error ? <ErrorState message={services.error}/> : filtered.length ? <div className="service-list">{filtered.map(service => <article className={`service-row detailed-service-row ${selectedService?.id === service.id ? "service-row-selected" : ""}`} key={service.id} data-testid={`transport-service-${service.id}`} tabIndex="0" role="button" aria-expanded={selectedService?.id === service.id} onClick={() => setSelectedService(service)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedService(service); } }}>
      <div className={`service-mode ${service.mode}`}>{service.mode === "bus" ? <BusFront/> : <TrainFront/>}</div>
      <div className="service-main"><span>{service.service_number}</span><div className="route-path" aria-label={`${t("passenger.from")} ${service.origin} ${t("passenger.to")} ${service.destination}`}><span className="route-point"><small>{t("passenger.from")}</small><b>{service.origin}</b></span><ArrowRight className="route-arrow" size={16}/><span className="route-point"><small>{t("passenger.destination")}</small><b>{service.destination}</b></span></div><small>{service.service_name} · {service.vehicle_registration || "Vehicle details pending"} · Capacity {service.capacity || "not set"}</small></div>
        <div className="service-time"><span><Clock3 size={14}/><small>{t("passenger.leaves")}</small><b>{formatTime12(service.departure_time)}</b></span><span><Clock3 size={14}/><small>{t("passenger.arrives")}</small><b>{formatTime12(service.arrival_time)}</b></span><small>{service.bay_or_platform || t("passenger.platformPending")}</small></div>
       <StatusBadge value={service.status}/><button className="icon-button" title={t("passenger.saveRoute")} aria-label={`${t("passenger.saveRoute")} ${service.service_number}`} data-testid={`save-route-${service.id}`} onClick={event => { event.stopPropagation(); save(service); }}><Bookmark size={17}/></button>
         <button type="button" className="predict-button" onClick={event => { event.stopPropagation(); predict(service); }} disabled={busyId === service.id}><span>{busyId === service.id ? <span className="predicting-state"><span className="loading-ring"/> {t("passenger.predicting")}</span> : <><BrainCircuit size={16}/>{t("passenger.predictCrowd")}</>}</span></button>
      {prediction[service.id] && <CrowdResult result={prediction[service.id]}/>}
     </article>)}</div> : <EmptyState icon={BusFront} title={t("passenger.noMatching")} message={t("passenger.tryDifferent")} testId="transport-empty"/>}
     {selectedService && <div className="service-detail-backdrop" role="presentation" onClick={() => setSelectedService(null)}><section className="service-detail-panel" role="dialog" aria-modal="true" aria-labelledby="service-detail-title" onClick={event => event.stopPropagation()}><button className="icon-button service-detail-close" onClick={() => setSelectedService(null)} aria-label="Close service details">×</button><span className="eyebrow">{selectedService.mode === "bus" ? "BUS SERVICE" : "RAILWAY SERVICE"} · VERIFIED SCHEDULE</span><h2 id="service-detail-title">{selectedService.service_name || selectedService.service_number}</h2><div className="service-detail-route"><span><small>Leaving from</small><b>{selectedService.origin || "—"}</b><strong>{formatTime12(selectedService.departure_time)}</strong></span><ArrowRight size={22}/><span><small>Arriving at</small><b>{selectedService.destination || "—"}</b><strong>{formatTime12(selectedService.arrival_time)}</strong></span></div><div className="service-detail-grid"><span><small>Service number</small><b>{selectedService.service_number || "—"}</b></span><span><small>Operating status</small><StatusBadge value={selectedService.status}/></span><span><small>Bay / platform</small><b>{selectedService.bay_or_platform || "Pending"}</b></span><span><small>Capacity</small><b>{selectedService.capacity || "Not set"}</b></span></div><div className="service-detail-note"><BrainCircuit size={17}/><span><b>Crowd prediction</b><small>Use the Predict crowd button on this service to view the latest verified crowd reading from the authority.</small></span></div></section></div>}
  </>;
};

const toMinutes = value => {
  const match = String(value || "").slice(0, 5).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
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

export const PassengerWorkspace = ({ page, session, profile, theme, setTheme, onSignOut }) => {
  if (page === "Search") return <TransportExplorer session={session}/>;
  if (page === "AI crowd prediction") return <CrowdPredictionPanel role="passenger" session={session} profile={profile}/>;
  if (page === "Crowd map") return <CrowdMap/>;
  if (page === "Saved routes") return <SavedRoutes session={session}/>;
  if (page === "Settings") return <SettingsPanel {...{ role: "passenger", session, profile, theme, setTheme, onSignOut }}/>;
  return null;
};