// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { VoiceRecorder } from "@/components/voice/VoiceRecorder";
import { SpeechButton } from "@/components/voice/SpeechButton";

let stopTrack: ReturnType<typeof vi.fn>;
let getUserMedia: ReturnType<typeof vi.fn>;
let instances: FakeRecorder[];
class FakeRecorder {
  static isTypeSupported = () => true;
  state = "inactive";
  mimeType = "audio/mp4";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { instances.push(this); }
  start() { this.state = "recording"; }
  stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob(["test recording"], { type: "audio/mp4" }) }); void this.onstop?.(); }
}

beforeEach(() => {
  instances = []; stopTrack = vi.fn(); getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  vi.stubGlobal("fetch", vi.fn());
  URL.createObjectURL = vi.fn().mockReturnValue("blob:labmate-audio"); URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function startRecording(onConfirm = vi.fn()) {
  const view = render(<VoiceRecorder onConfirm={onConfirm} mode="live" />);
  fireEvent.click(screen.getByRole("checkbox", { name: /I consent/ }));
  fireEvent.click(screen.getByRole("button", { name: "Record plan" }));
  await screen.findByRole("button", { name: "Stop recording" });
  return view;
}

it("requires consent before asking for the microphone", () => {
  render(<VoiceRecorder onConfirm={vi.fn()} mode="live" />);
  expect((screen.getByRole("button", { name: "Record plan" }) as HTMLButtonElement).disabled).toBe(true);
  expect(getUserMedia).not.toHaveBeenCalled();
});

it("keeps the typed path available when microphone permission is denied", async () => {
  getUserMedia.mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
  render(<VoiceRecorder onConfirm={vi.fn()} mode="live" />);
  fireEvent.click(screen.getByRole("checkbox", { name: /I consent/ })); fireEvent.click(screen.getByRole("button", { name: "Record plan" }));
  expect((await screen.findByRole("alert")).textContent).toContain("still type"); expect(fetch).not.toHaveBeenCalled();
});

it("only passes an edited transcript after explicit confirmation and never submits a review", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ transcript: "Use ten grams", requiresConfirmation: true }), { headers: { "X-LabMate-Mode": "live", "Content-Type": "application/json" } }));
  const onConfirm = vi.fn(); await startRecording(onConfirm);
  fireEvent.click(screen.getByRole("button", { name: "Stop recording" }));
  const input = await screen.findByRole("textbox", { name: "Edit transcript" });
  expect(stopTrack).toHaveBeenCalled(); expect(onConfirm).not.toHaveBeenCalled();
  expect((screen.getByRole("button", { name: "Use confirmed transcript" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("checkbox", { name: /I checked chemical/ }));
  fireEvent.change(input, { target: { value: "Do not use ten grams" } });
  expect((screen.getByRole("button", { name: "Use confirmed transcript" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("checkbox", { name: /I checked chemical/ })); fireEvent.click(screen.getByRole("button", { name: "Use confirmed transcript" }));
  expect(onConfirm).toHaveBeenCalledWith("Do not use ten grams"); expect(fetch).toHaveBeenCalledTimes(1); expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/transcribe");
});

it("cancels recording and stops tracks without uploading", async () => {
  await startRecording(); fireEvent.click(screen.getByRole("button", { name: "Cancel voice input" }));
  expect(instances[0].state).toBe("inactive"); expect(stopTrack).toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});

it("stops a microphone that arrives after unmount", async () => {
  let grant!: (value: unknown) => void; getUserMedia.mockReturnValue(new Promise(resolve => { grant = resolve; }));
  const view = render(<VoiceRecorder onConfirm={vi.fn()} mode="live" />);
  fireEvent.click(screen.getByRole("checkbox", { name: /I consent/ })); fireEvent.click(screen.getByRole("button", { name: "Record plan" }));
  view.unmount(); await act(async () => { grant({ getTracks: () => [{ stop: stopTrack }] }); });
  expect(stopTrack).toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});

it("discards a late transcription after cancellation", async () => {
  let reply!: (value: Response) => void; vi.mocked(fetch).mockReturnValue(new Promise(resolve => { reply = resolve; }));
  const onConfirm = vi.fn(); await startRecording(onConfirm); fireEvent.click(screen.getByRole("button", { name: "Stop recording" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel voice input" }));
  await act(async () => { reply(new Response(JSON.stringify({ transcript: "Stale draft", requiresConfirmation: true }), { headers: { "X-LabMate-Mode": "live" } })); });
  expect(screen.queryByRole("textbox")).toBeNull(); expect(onConfirm).not.toHaveBeenCalled();
});

it("stops automatically before 30 seconds and releases the microphone", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 503 }));
  await startRecording(); vi.useFakeTimers();
  // The timer was installed before fake timers; capture a fresh start under the fake clock.
  fireEvent.click(screen.getByRole("button", { name: "Cancel voice input" }));
  fireEvent.click(screen.getByRole("button", { name: "Record plan" }));
  await act(async () => {});
  await act(async () => { await vi.advanceTimersByTimeAsync(29_000); });
  expect(instances.at(-1)?.state).toBe("inactive"); expect(stopTrack).toHaveBeenCalled(); vi.useRealTimers();
});

it("labels fixture transcripts so they cannot be mistaken for recognition", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ transcript: "Fixture sample", requiresConfirmation: true }), { headers: { "X-LabMate-Mode": "fixture" } }));
  await startRecording(); fireEvent.click(screen.getByRole("button", { name: "Stop recording" }));
  expect(await screen.findByText(/this is sample text/)).toBeTruthy();
});

function fakeAudio() {
  const player = { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), load: vi.fn(), removeAttribute: vi.fn(), onended: null as (() => void) | null, onerror: null as (() => void) | null };
  vi.stubGlobal("Audio", vi.fn(function () { return player; }));
  vi.mocked(fetch).mockResolvedValue(new Response(new Blob(["audio"], { type: "audio/mpeg" }), { headers: { "Content-Type": "audio/mpeg", "X-LabMate-Mode": "live" } }));
  return player;
}

it("does not autoplay and stops stale readback when the review changes", async () => {
  const player = fakeAudio(); const view = render(<SpeechButton mode="live" speechText="Current summary and limitation." />);
  expect(fetch).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole("checkbox", { name: /I consent/ }));
  fireEvent.click(screen.getByRole("button", { name: "Listen to summary" }));
  await waitFor(() => expect(player.play).toHaveBeenCalled());
  expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({ text: "Current summary and limitation.", consent: true });
  view.rerender(<SpeechButton mode="live" speechText="Replacement summary." />);
  expect(player.pause).toHaveBeenCalled(); expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:labmate-audio");
});

it("preserves visible text when playback fails", async () => {
  const player = fakeAudio(); player.play.mockRejectedValue(new Error("Playback denied"));
  render(<SpeechButton mode="live" speechText="Visible review remains." />);
  fireEvent.click(screen.getByRole("checkbox", { name: /I consent/ })); fireEvent.click(screen.getByRole("button", { name: "Listen to summary" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Read the visible review"); expect(URL.revokeObjectURL).toHaveBeenCalled();
});

it("revokes readback URLs after playback ends and on unmount", async () => {
  const player = fakeAudio(); const view = render(<SpeechButton mode="live" speechText="Summary." />);
  fireEvent.click(screen.getByRole("checkbox", { name: /I consent/ })); fireEvent.click(screen.getByRole("button", { name: "Listen to summary" }));
  await waitFor(() => expect(player.play).toHaveBeenCalled());
  act(() => { player.onended?.(); }); expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:labmate-audio");
  view.unmount(); expect(player.pause).toHaveBeenCalled();
});
