import { supabase } from "./supabase";

const requireClient = () => { if (!supabase) throw new Error("Supabase is not configured"); return supabase; };

export async function generateAccessCode(kind, facilityId, expiresAt) {
  const { data, error } = await requireClient().rpc("generate_access_code", { p_kind: kind, p_facility_id: facilityId, p_expires_at: expiresAt });
  if (error) throw error; return data;
}

export async function consumeAuthorityCode(code, details) {
  const { data, error } = await requireClient().rpc("consume_authority_code", { p_code: code, ...details });
  if (error) throw error; return data;
}

export async function getMyCameras() {
  const { data, error } = await requireClient().from("cameras").select("id,name,zone_id,status,enabled,updated_at,facility_id").order("updated_at", { ascending: false });
  if (error) throw error; return data;
}

export async function addMyCamera(camera) {
  const { data, error } = await requireClient().from("cameras").insert(camera).select().single();
  if (error) throw error; return data;
}

export async function removeMyCamera(id) {
  const { error } = await requireClient().from("cameras").delete().eq("id", id);
  if (error) throw error;
}

export async function getPublicCrowd(facilityId) {
  const { data, error } = await requireClient().from("crowd_readings").select("id,zone_id,people_count,level,recorded_at").eq("facility_id", facilityId).eq("source", "public").order("recorded_at", { ascending: false });
  if (error) throw error; return data;
}