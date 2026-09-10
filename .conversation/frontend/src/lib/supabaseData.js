import { supabase } from "@/lib/supabase";

const result = async (request) => {
  const { data, error } = await request;
  if (error) throw error;
  return data;
};

export const listFacilities = () => result(
  supabase.from("mahaflow_facilities").select("*").order("name")
);

export const addFacility = (facility) => result(
  supabase.from("mahaflow_facilities").insert(facility).select().single()
);

export const listTransportServices = ({ ownerId } = {}) => {
  let query = supabase.from("mahaflow_transport_services").select("*").order("departure_time");
  if (ownerId) query = query.eq("owner_user_id", ownerId);
  return result(query);
};

export const addTransportService = (service) => result(
  supabase.from("mahaflow_transport_services").insert(service).select().single()
);

export const deleteTransportService = (id) => result(
  supabase.from("mahaflow_transport_services").delete().eq("id", id)
);

export const listCameras = (ownerId) => result(
  supabase.from("mahaflow_cameras").select("*").eq("owner_user_id", ownerId).order("created_at", { ascending: false })
);

export const addCamera = (camera) => result(
  supabase.from("mahaflow_cameras").insert(camera).select().single()
);

export const deleteCamera = (id) => result(
  supabase.from("mahaflow_cameras").delete().eq("id", id)
);

export const listCrowdReadings = ({ ownerId } = {}) => {
  let query = supabase.from("mahaflow_crowd_readings").select("*,mahaflow_facilities(name,latitude,longitude)").order("recorded_at", { ascending: false }).limit(40);
  if (ownerId) query = query.eq("owner_user_id", ownerId);
  return result(query);
};

export const listCrowdPredictions = ({ ownerId } = {}) => {
  let query = supabase.from("mahaflow_crowd_predictions").select("*,mahaflow_facilities(name,latitude,longitude)").order("prediction_for").limit(40);
  if (ownerId) query = query.eq("owner_user_id", ownerId);
  return result(query);
};

export const listSavedRoutes = (ownerId) => result(
  supabase.from("mahaflow_saved_routes").select("*").eq("owner_user_id", ownerId).order("created_at", { ascending: false })
);

export const saveRoute = (ownerId, service) => result(
  supabase.from("mahaflow_saved_routes").upsert({
    owner_user_id: ownerId,
    route_id: service.id,
    origin: service.origin,
    destination: service.destination,
    mode: service.mode,
    service_number: service.service_number,
  }).select().single()
);

export const deleteSavedRoute = (ownerId, routeId) => result(
  supabase.from("mahaflow_saved_routes").delete().eq("owner_user_id", ownerId).eq("route_id", routeId)
);

export const getUserSettings = async (ownerId) => {
  const { data, error } = await supabase.from("mahaflow_user_settings").select("*").eq("owner_user_id", ownerId).maybeSingle();
  if (error) throw error;
  return data;
};

export const saveUserSettings = (settings) => result(
  supabase.from("mahaflow_user_settings").upsert(settings).select().single()
);

export const updateProfile = (ownerId, profile) => result(
  supabase.from("mahaflow_profiles").update({ ...profile, updated_at: new Date().toISOString() }).eq("id", ownerId).select().single()
);

export const verifyAuthorityCode = (code) => result(
  supabase.rpc("mahaflow_get_access_code_details", { p_code: code })
);

export const completeAuthorityOnboarding = (payload) => result(
  supabase.rpc("mahaflow_complete_authority_onboarding", payload)
);

export const listAccessCodes = () => result(
  supabase.from("mahaflow_access_codes").select("*").order("created_at", { ascending: false })
);

export const createAccessCode = (facilityId, expiresDays = 30) => result(
  supabase.rpc("mahaflow_create_access_code", { p_facility_id: facilityId, p_expires_days: expiresDays })
);

export const blockAccessCode = (id) => result(
  supabase.from("mahaflow_access_codes").update({ status: "blocked" }).eq("id", id).select().single()
);

export const listAuthorities = () => result(supabase.rpc("mahaflow_list_authorities"));

export const setAuthorityStatus = (userId, status) => result(
  supabase.rpc("mahaflow_set_authority_status", { p_user_id: userId, p_status: status })
);

export const getBranding = async () => {
  const { data, error } = await supabase.from("mahaflow_branding_settings").select("*").eq("id", true).maybeSingle();
  if (error) throw error;
  return data;
};

export const saveBranding = (ownerId, branding) => result(
  supabase.from("mahaflow_branding_settings").upsert({ id: true, ...branding, updated_by: ownerId, updated_at: new Date().toISOString() }).select().single()
);