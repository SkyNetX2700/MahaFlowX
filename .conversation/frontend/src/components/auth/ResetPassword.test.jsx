import React from "react";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResetPassword } from "@/components/auth/ResetPassword";
import { supabase } from "@/lib/supabase";

jest.mock("@/lib/supabase", () => ({ supabase: { auth: { updateUser: jest.fn(), signOut: jest.fn() } } }));

beforeEach(() => {
  supabase.auth.updateUser.mockResolvedValue({ error: null });
  supabase.auth.signOut.mockResolvedValue({ error: null });
});

test("recovery session sets a new Supabase password", async () => {
  const user = userEvent.setup();
  render(<ResetPassword session={{ user: { email: "passenger@example.com" } }} onFinished={jest.fn()}/>);
  await user.type(screen.getByTestId("new-password-input"), "MahaFlow!2026");
  await user.type(screen.getByTestId("confirm-password-input"), "MahaFlow!2026");
  await user.click(screen.getByTestId("update-password-button"));
  await waitFor(() => expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: "MahaFlow!2026" }));
  expect(await screen.findByText("Your password is ready.")).toBeInTheDocument();
});

test("recovery form rejects mismatched passwords", async () => {
  const user = userEvent.setup();
  render(<ResetPassword session={{ user: { email: "passenger@example.com" } }} onFinished={jest.fn()}/>);
  await user.type(screen.getByTestId("new-password-input"), "MahaFlow!2026");
  await user.type(screen.getByTestId("confirm-password-input"), "Different!2026");
  await user.click(screen.getByTestId("update-password-button"));
  expect(await screen.findByTestId("reset-password-message")).toHaveTextContent("Passwords do not match");
  expect(supabase.auth.updateUser).not.toHaveBeenCalled();
});