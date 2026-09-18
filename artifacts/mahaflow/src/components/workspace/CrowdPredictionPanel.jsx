import React, { useMemo, useState } from "react";
import { ArrowRight, BrainCircuit, BusFront, Sparkles, Users } from "lucide-react";
import { listCrowdPredictions, listCrowdReadings, listFacilities, listTransportServices } from "@/lib/supabaseData";
import { useWorkspaceData } from "@/hooks/useWorkspaceData";
import { EmptyState, ErrorState, LoadingState, SectionHeader, StatusBadge, formatDateTime12, formatTime12 } from "@/components/workspace/WorkspaceUI";

const compactService = service => ({
  id: service.id,
  mode: service.mode,
  service_number: service.service_number,
  service_name: service.service_name,
  origin: service.origin,
  destination: service.destination,
  service_date: service.service_date,
  departure_time: service.departure_time,
  arrival_time: service.arrival_time,
  status: service.status,
  capacity: service.capacity,
  facility_id: service.facility_id,
});

const compactReading = reading => ({
  facility_id: reading.facility_id,
  zone: reading.zone,
  people_count: reading.people_count,
  crowd_level: reading.crowd_level,
  recorded_at: reading.recorded_at,
});

const compactPrediction = prediction => ({
  facility_id: prediction.facility_id,
  zone: prediction.zone,
  predicted_count: prediction.predicted_count,
  crowd_level: prediction.crowd_level,
  prediction_for: prediction.prediction_for,
});

const cleanAIText = value => String(value || "").replace(/\*\*/g, "").replace(/\*/g, "").trim();

export const CrowdPredictionPanel = ({ role = "passenger", session, profile }) => {
  const isAuthority = role === "authority";
  const facilities = useWorkspaceData(() => listFacilities(), []);
  const services = useWorkspaceData(() => listTransportServices(), []);
  const readings = useWorkspaceData(() => listCrowdReadings(isAuthority ? { ownerId: session.user.id } : {}), [isAuthority, session.user.id]);
  const predictions = useWorkspaceData(() => listCrowdPredictions(isAuthority ? { ownerId: session.user.id } : {}), [isAuthority, session.user.id]);
  const [fromFacilityId, setFromFacilityId] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const scopedFacilities = useMemo(() => {
    const list = facilities.data.filter(item => item.kind === "bus" || item.kind === "railway");
    return isAuthority && profile?.facility_id ? list.filter(item => item.id === profile.facility_id) : list;
  }, [facilities.data, isAuthority, profile?.facility_id]);

  const submit = async event => {
    event.preventDefault();
    if (!fromFacilityId || !destination.trim() || !date || !time || busy) return;
    const facility = scopedFacilities.find(item => item.id === fromFacilityId);
    const matchingServices = services.data.filter(service => {
      const matchesOrigin = service.facility_id === fromFacilityId || String(service.origin || "").toLowerCase().includes(String(facility?.name || "").toLowerCase());
      const matchesDestination = String(service.destination || "").toLowerCase().includes(destination.trim().toLowerCase());
      return matchesOrigin && matchesDestination && (!service.service_date || String(service.service_date).slice(0, 10) === date) && (!service.departure_time || String(service.departure_time).slice(0, 5) === time);
    });
    const request = `Predict the crowd level for a ${facility?.kind === "railway" ? "railway" : "bus"} journey from ${facility?.name || "the selected facility"} to ${destination.trim()} on ${date} at ${formatTime12(time)}. Use only the supplied verified readings, predictions, and matching services. If there is not enough relevant data, say the prediction is currently unavailable. Do not invent a count or crowd level.`;
    setBusy(true);
    setError("");
    setResult("");
    try {
      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: request }],
          context: {
            role,
            selected_journey: { origin: facility?.name, destination: destination.trim(), date, time },
            services: matchingServices.map(compactService),
            crowd_readings: readings.data.filter(item => item.facility_id === fromFacilityId).map(compactReading),
            crowd_predictions: predictions.data.filter(item => item.facility_id === fromFacilityId).map(compactPrediction),
          },
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail || "Crowd prediction is unavailable.");
      setResult(cleanAIText(body.message));
    } catch (requestError) {
      setError(requestError.message || "Crowd prediction is unavailable.");
    } finally {
      setBusy(false);
    }
  };

  const loading = facilities.loading || services.loading || readings.loading || predictions.loading;
  return <div className="crowd-prediction-page">
    <SectionHeader eyebrow="PASSENGER · AI" title="AI crowd prediction" description="Choose a verified journey to review timings and the latest crowd data from authority CCTV and the configured YOLO model."/>
    <div className="crowd-prediction-layout">
      <form className="crowd-prediction-card" onSubmit={submit}>
        <div className="crowd-prediction-card-head"><span className="mf-ai-hub-icon"><BrainCircuit size={22}/></span><span><b>Plan with crowd insight</b><small>Only verified MahaFlow records are used.</small></span></div>
        <label>Leaving from<select value={fromFacilityId} onChange={event => setFromFacilityId(event.target.value)} data-testid="mf-ai-origin-select" required><option value="">Select bus stand or station</option>{scopedFacilities.map(facility => <option value={facility.id} key={facility.id}>{facility.name} · {facility.kind === "railway" ? "Railway station" : "Bus stand"}</option>)}</select></label>
        <label>Arriving at<input value={destination} onChange={event => setDestination(event.target.value)} placeholder="For example, Daund" data-testid="mf-ai-destination-input" required/></label>
        <div className="mf-ai-form-row"><label>Date<input type="date" value={date} onChange={event => setDate(event.target.value)} data-testid="mf-ai-date-input" required/></label><label>Leaving time<input type="time" value={time} onChange={event => setTime(event.target.value)} data-testid="mf-ai-time-input" required/><small className="time-preview">{formatTime12(time)}</small></label></div>
        <button className="mf-ai-predict-button" disabled={busy || !fromFacilityId || !destination.trim() || !date || !time} data-testid="mf-ai-predict-button">{busy ? "Analyzing verified data…" : "Predict crowd"}<ArrowRight size={15}/></button>
        {error && <div className="mf-ai-error" data-testid="mf-ai-error">{error}</div>}
      </form>
      <section className="prediction-results-card">
        <div className="mf-ai-insight-head"><span className="mf-chat-avatar"><Users size={15}/></span><span><b>Latest crowd predictions</b><small>Updated from persisted MahaFlow records</small></span></div>
        {result && <div className="mf-ai-prediction-result" data-testid="mf-ai-prediction-result"><span className="eyebrow">MAHAFLOW AI RESULT</span><p>{result}</p></div>}
        {loading ? <LoadingState label="Loading verified crowd data…"/> : predictions.error || readings.error ? <ErrorState message={predictions.error || readings.error}/> : predictions.data.length ? <div className="prediction-list">{predictions.data.map(item => <article key={item.id} data-testid={`crowd-prediction-${item.id}`}><span><b>{item.mahaflow_facilities?.name || "Transit facility"}</b><small>{item.zone} · {formatDateTime12(item.prediction_for)}</small></span><strong>{item.predicted_count}</strong><StatusBadge value={item.crowd_level}/></article>)}</div> : <EmptyState icon={BusFront} title="Ready for a real frame" message="Predictions appear after an authority worker publishes a real YOLO reading. No values are simulated." testId="crowd-predictions-empty"/>}
      </section>
    </div>
  </div>;
};