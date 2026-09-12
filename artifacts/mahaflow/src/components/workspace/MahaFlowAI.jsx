import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, Bot, BusFront, Clock3, MapPin, Send, Sparkles, Users } from "lucide-react";
import { listCrowdPredictions, listCrowdReadings, listFacilities, listTransportServices } from "@/lib/supabaseData";
import { LoadingState, ErrorState, SectionHeader } from "@/components/workspace/WorkspaceUI";

const initialMessage = {
  role: "assistant",
  content: "Namaste. I’m MahaFlow AI, your Maharashtra public transportation assistant. Ask me about verified buses, railways, timings, routes, or crowd levels.",
};

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
  source: reading.source,
  model_version: reading.model_version,
});

const compactPrediction = prediction => ({
  facility_id: prediction.facility_id,
  zone: prediction.zone,
  predicted_count: prediction.predicted_count,
  crowd_level: prediction.crowd_level,
  prediction_for: prediction.prediction_for,
  model_version: prediction.model_version,
});

const ChatBubble = ({ message }) => (
  <div className={`mf-ai-message ${message.role === "assistant" ? "assistant" : "user"}`} data-testid={`mf-ai-message-${message.role}`}>
    {message.role === "assistant" && <div className="mf-ai-avatar"><Bot size={16}/></div>}
    <p>{message.content}</p>
  </div>
);

export const MahaFlowAI = ({ role }) => {
  const [data, setData] = useState({ services: [], readings: [], predictions: [], facilities: [] });
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState("");
  const [messages, setMessages] = useState([initialMessage]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messageError, setMessageError] = useState("");
  const [fromFacilityId, setFromFacilityId] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [predictionBusy, setPredictionBusy] = useState(false);
  const [predictionResult, setPredictionResult] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([listTransportServices(), listCrowdReadings(), listCrowdPredictions(), listFacilities()])
      .then(([services, readings, predictions, facilities]) => {
        if (!active) return;
        setData({ services, readings, predictions, facilities });
      })
      .catch(error => {
        if (active) setDataError(error.message || "Verified MahaFlow data is unavailable.");
      })
      .finally(() => {
        if (active) setLoadingData(false);
      });
    return () => { active = false; };
  }, []);

  const context = useMemo(() => ({
    role,
    services: data.services.map(compactService),
    crowd_readings: data.readings.map(compactReading),
    crowd_predictions: data.predictions.map(compactPrediction),
    facilities: data.facilities.map(facility => ({
      id: facility.id,
      name: facility.name,
      kind: facility.kind,
      district: facility.district,
      state: facility.state,
      address: facility.address,
    })),
  }), [data, role]);
  const busStands = data.facilities.filter(facility => facility.kind === "bus" || facility.kind === "railway");

  const askAI = async (nextMessages, purpose = "chat", requestContext = context) => {
    const response = await fetch("/api/gemini/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: nextMessages, context: { ...requestContext, purpose } }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.detail || "MahaFlow AI is unavailable.");
    return body.message;
  };

  const sendMessage = async event => {
    event.preventDefault();
    const content = input.trim();
    if (!content || busy) return;
    const nextMessages = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    setMessageError("");
    try {
      const answer = await askAI(nextMessages);
      setMessages(current => [...current, { role: "assistant", content: answer }]);
    } catch (error) {
      setMessageError(error.message);
    } finally {
      setBusy(false);
    }
  };

  const predictCrowd = async event => {
    event.preventDefault();
    if (!fromFacilityId || !destination.trim() || !date || !time || predictionBusy) return;
    const facility = data.facilities.find(item => item.id === fromFacilityId);
    const relevantServices = data.services.filter(service => {
      const matchesOrigin = service.facility_id === fromFacilityId || String(service.origin || "").toLowerCase().includes(String(facility?.name || "").toLowerCase());
      const matchesDestination = String(service.destination || "").toLowerCase().includes(destination.trim().toLowerCase());
      const serviceDate = String(service.service_date || "").slice(0, 10);
      const matchesDate = !serviceDate || serviceDate === date;
      const matchesTime = !service.departure_time || String(service.departure_time).slice(0, 5) === time;
      return matchesOrigin && matchesDestination && matchesDate && matchesTime;
    });
    const relevantReadings = data.readings.filter(reading => reading.facility_id === fromFacilityId);
    const relevantPredictions = data.predictions.filter(prediction => prediction.facility_id === fromFacilityId);
    const query = `Predict the crowd level for a ${facility?.kind === "railway" ? "railway" : "bus"} journey from ${facility?.name || "the selected bus stand"} to ${destination.trim()} on ${date} at ${time}. Analyze only the supplied YOLO crowd readings and prediction records for this facility and the matching verified services. If there is not enough relevant YOLO or authority data, say that the prediction is currently unavailable. Do not create a number or crowd level.`;
    const nextMessages = [{ role: "user", content: query }];
    setPredictionBusy(true);
    setPredictionResult("");
    setMessageError("");
    try {
      const answer = await askAI(nextMessages, "crowd_prediction", {
        ...context,
        selected_journey: { origin: facility?.name, destination: destination.trim(), date, time },
        services: relevantServices.map(compactService),
        crowd_readings: relevantReadings.map(compactReading),
        crowd_predictions: relevantPredictions.map(compactPrediction),
      });
      setPredictionResult(answer);
    } catch (error) {
      setMessageError(error.message);
    } finally {
      setPredictionBusy(false);
    }
  };

  return <div className="mf-ai-page">
    <SectionHeader eyebrow={`${role.toUpperCase()} · MAHAFLOW AI`} title="MahaFlow AI" description="Verified Maharashtra transport guidance powered by your Supabase schedules, authority readings, and YOLO crowd records. Live information is never guessed." action={<span className="mf-ai-status"><i/> Data-aware assistant</span>}/>
    {loadingData && <div className="mf-ai-data-note"><LoadingState label="Loading verified MahaFlow data…"/></div>}
    {dataError && <ErrorState message={dataError}/>}
    <div className="mf-ai-layout">
      <section className="mf-ai-chat-panel" data-testid="mf-ai-chat">
        <div className="mf-ai-panel-heading"><div className="mf-ai-avatar large"><Sparkles size={19}/></div><span><b>MahaFlow AI</b><small>Public transportation assistant for Maharashtra</small></span></div>
        <div className="mf-ai-messages">{messages.map((message, index) => <ChatBubble message={message} key={`${message.role}-${index}`}/>)}{busy && <div className="mf-ai-typing"><span/><span/><span/> Checking MahaFlow data…</div>}</div>
        <form className="mf-ai-composer" onSubmit={sendMessage}>
          <input value={input} onChange={event => setInput(event.target.value)} placeholder="Ask about a verified route, timing, delay, or crowd level" aria-label="Ask MahaFlow AI" data-testid="mf-ai-chat-input"/>
          <button className="primary-button" disabled={busy || !input.trim()} data-testid="mf-ai-send-button"><Send size={16}/><span>Ask AI</span></button>
        </form>
        {messageError && <div className="mf-ai-error" data-testid="mf-ai-error">{messageError}</div>}
      </section>

      <section className="mf-ai-prediction-panel" data-testid="mf-ai-prediction">
        <div className="mf-ai-panel-heading"><div className="mf-ai-avatar"><Users size={17}/></div><span><b>AI crowd prediction</b><small>Analyze the YOLO records available for your journey</small></span></div>
        <form className="mf-ai-prediction-form" onSubmit={predictCrowd}>
          <label><span><MapPin size={14}/> Bus stand / station</span><select value={fromFacilityId} onChange={event => setFromFacilityId(event.target.value)} data-testid="mf-ai-origin-select" required><option value="">Select a registered facility</option>{busStands.map(facility => <option value={facility.id} key={facility.id}>{facility.name} · {facility.kind === "railway" ? "Railway station" : "Bus stand"}</option>)}</select></label>
          <label><span><ArrowRight size={14}/> Destination</span><input value={destination} onChange={event => setDestination(event.target.value)} placeholder="Enter destination" data-testid="mf-ai-destination-input" required/></label>
          <div className="mf-ai-form-row"><label><span><Clock3 size={14}/> Date</span><input type="date" value={date} onChange={event => setDate(event.target.value)} data-testid="mf-ai-date-input" required/></label><label><span><Clock3 size={14}/> Time</span><input type="time" value={time} onChange={event => setTime(event.target.value)} data-testid="mf-ai-time-input" required/></label></div>
          <button className="primary-button" disabled={predictionBusy || !fromFacilityId || !destination.trim() || !date || !time} data-testid="mf-ai-predict-button"><Users size={16}/>{predictionBusy ? "Analyzing YOLO data…" : "Predict crowd"}</button>
        </form>
        {predictionResult && <div className="mf-ai-prediction-result" data-testid="mf-ai-prediction-result"><span className="eyebrow">MAHAFLOW AI RESULT</span><p>{predictionResult}</p></div>}
        {!predictionResult && <div className="mf-ai-data-boundary"><BusFront size={16}/><span><b>Data boundary</b><small>Only persisted authority and YOLO readings are used. If no matching reading exists, the answer will say unavailable.</small></span></div>}
      </section>
    </div>
  </div>;
};