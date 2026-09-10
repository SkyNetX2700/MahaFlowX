import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Camera, CircleOff } from "lucide-react";

export const StreamPlayer = ({ camera }) => {
  const videoRef = useRef(null);
  const [state, setState] = useState(camera.status);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || camera.protocol !== "HLS" || !camera.stream_url) return undefined;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = camera.stream_url; setState("online"); return undefined;
    }
    if (!Hls.isSupported()) { setState("unsupported"); return undefined; }
    const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
    hls.loadSource(camera.stream_url); hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => { setState("online"); void video.play().catch(() => {}); });
    hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) setState("offline"); });
    return () => hls.destroy();
  }, [camera.protocol, camera.stream_url]);

  if (camera.protocol !== "HLS") return <div className="stream-placeholder" data-testid={`camera-stream-${camera.id}`}><Camera/><b>{camera.protocol} endpoint registered</b><span>Playback starts when your secure gateway exposes a browser-compatible stream.</span></div>;
  return <div className="stream-player" data-testid={`camera-stream-${camera.id}`}><video ref={videoRef} controls muted playsInline data-testid={`camera-video-${camera.id}`}/>{state !== "online" && <span className="stream-state"><CircleOff size={14}/>{state}</span>}</div>;
};