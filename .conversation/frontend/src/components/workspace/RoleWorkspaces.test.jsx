import React from "react";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PassengerWorkspace } from "@/components/workspace/PassengerWorkspace";
import { AuthorityWorkspace } from "@/components/workspace/AuthorityWorkspace";
import { DeveloperWorkspace } from "@/components/workspace/DeveloperWorkspace";
import { AuthorityOnboarding } from "@/components/auth/AuthorityOnboarding";
import * as data from "@/lib/supabaseData";

jest.mock("@/components/MapView", () => () => <div data-testid="mock-google-map">Google Maps connected</div>);
jest.mock("@/lib/supabase", () => ({ supabase: { channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel: jest.fn() } }));
jest.mock("@/lib/supabaseData", () => ({
  listFacilities: jest.fn().mockResolvedValue([{ id: "facility-1", name: "Pune Railway Station", kind: "railway", latitude: 18.52, longitude: 73.87, status: "active", address: "Pune", district: "Pune" }]),
  listTransportServices: jest.fn().mockResolvedValue([]), listCrowdReadings: jest.fn().mockResolvedValue([]), listCrowdPredictions: jest.fn().mockResolvedValue([]), listSavedRoutes: jest.fn().mockResolvedValue([]),
  listCameras: jest.fn().mockResolvedValue([]), listAccessCodes: jest.fn().mockResolvedValue([]), listAuthorities: jest.fn().mockResolvedValue([]), getUserSettings: jest.fn().mockResolvedValue(null), getBranding: jest.fn().mockResolvedValue(null),
  verifyAuthorityCode: jest.fn().mockResolvedValue({ code: "MFR-ABC123", network: "railway", state: "Maharashtra", district: "Pune", location_name: "Pune Railway Station", stand_address: "Pune" }),
  completeAuthorityOnboarding: jest.fn().mockResolvedValue({ role: "authority" }), saveUserSettings: jest.fn(), updateProfile: jest.fn(), saveBranding: jest.fn(), addFacility: jest.fn(), createAccessCode: jest.fn(), blockAccessCode: jest.fn(), setAuthorityStatus: jest.fn(), addCamera: jest.fn(), deleteCamera: jest.fn(), addTransportService: jest.fn(), deleteTransportService: jest.fn(), saveRoute: jest.fn(), deleteSavedRoute: jest.fn(),
}));

const session = { user: { id: "user-1", email: "operator@example.com" } };
const base = { session, profile: { full_name: "Operator", facility_id: "facility-1" }, theme: "light", setTheme: jest.fn() };

beforeEach(() => {
  data.listFacilities.mockResolvedValue([{ id: "facility-1", name: "Pune Railway Station", kind: "railway", latitude: 18.52, longitude: 73.87, status: "active", address: "Pune", district: "Pune" }]);
  data.listTransportServices.mockResolvedValue([]); data.listCrowdReadings.mockResolvedValue([]); data.listCrowdPredictions.mockResolvedValue([]); data.listSavedRoutes.mockResolvedValue([]);
  data.listCameras.mockResolvedValue([]); data.listAccessCodes.mockResolvedValue([]); data.listAuthorities.mockResolvedValue([]); data.getUserSettings.mockResolvedValue(null); data.getBranding.mockResolvedValue(null);
  data.verifyAuthorityCode.mockResolvedValue({ code: "MFR-ABC123", network: "railway", state: "Maharashtra", district: "Pune", location_name: "Pune Railway Station", stand_address: "Pune" });
  data.createAccessCode.mockResolvedValue({ code: "MFR-TEST01", location_name: "Pune Railway Station" });
});

test.each([
  [PassengerWorkspace, "Bus & rail", "transport-search-input"], [PassengerWorkspace, "Crowd map", "mock-google-map"], [PassengerWorkspace, "Saved routes", "saved-routes-empty"], [PassengerWorkspace, "Settings", "settings-save-button"],
  [AuthorityWorkspace, "Live crowd", "authority-readings-empty"], [AuthorityWorkspace, "CCTV cameras", "cctv-add-stream-button"], [AuthorityWorkspace, "Transport registry", "register-transport-button"], [AuthorityWorkspace, "Reports", "section-operations-report"], [AuthorityWorkspace, "Settings", "settings-staff-alerts-toggle"],
  [DeveloperWorkspace, "Access codes", "generate-access-code-button"], [DeveloperWorkspace, "Authorities", "authorities-empty"], [DeveloperWorkspace, "Facilities", "add-facility-button"], [DeveloperWorkspace, "Branding", "branding-save-button"], [DeveloperWorkspace, "Settings", "settings-yolo-url-input"],
])("renders %p page %s", async (Component, page, testId) => {
  render(<Component {...base} page={page}/>);
  expect(await screen.findByTestId(testId)).toBeInTheDocument();
});

test("authority onboarding advances from code to locked facility profile", async () => {
  const user = userEvent.setup();
  render(<AuthorityOnboarding session={session} onComplete={jest.fn()} onCancel={jest.fn()}/>);
  await user.type(screen.getByTestId("onboarding-access-code-input"), "MFR-ABC123");
  await user.click(screen.getByTestId("onboarding-verify-code-button"));
  await waitFor(() => expect(data.verifyAuthorityCode).toHaveBeenCalledWith("MFR-ABC123"));
  expect(await screen.findByTestId("onboarding-facility-select")).toHaveValue("Pune Railway Station");
  expect(screen.getByTestId("onboarding-network-select")).toHaveValue("railway");
});

test("developer can generate a facility-bound access code", async () => {
  const user = userEvent.setup();
  render(<DeveloperWorkspace {...base} page="Access codes"/>);
  const button = await screen.findByTestId("generate-access-code-button");
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
  await waitFor(() => expect(data.createAccessCode).toHaveBeenCalledWith("facility-1", 30));
  expect(await screen.findByTestId("access-code-message")).toHaveTextContent("MFR-TEST01");
});