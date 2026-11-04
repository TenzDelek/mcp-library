import { z } from "zod";
import { pickLocalized } from "../domain/localized.js";
import { defineTool, projectContributors } from "./_shared.js";

export const getRecording = defineTool({
  name: "get_recording",
  title: "Get recording",
  description:
    "Metadata for an audio recording of an edition (reciter, format, duration) and a temporary playable URL. Recording ids come from get_edition.recordings. The URL is presigned and expires; fetch it again when needed.",
  inputSchema: {
    recording_id: z.string().describe("Recording id."),
    include_audio_url: z.boolean().default(true).describe("Resolve the temporary audio URL."),
  },
  async handler({ library, config }, input) {
    const [recording, audioUrl] = await Promise.all([
      library.getRecording(input.recording_id),
      input.include_audio_url ? library.getRecordingAudioUrl(input.recording_id) : null,
    ]);
    return {
      id: recording.id,
      edition_id: recording.edition_id,
      text_id: recording.text_id,
      title: pickLocalized(recording.title, config.preferredLanguages)?.value ?? null,
      language: recording.language ?? null,
      format: recording.format,
      size_bytes: recording.size_bytes,
      duration_ms: recording.duration_ms ?? null,
      date: recording.date ?? null,
      license: recording.license,
      contributors: projectContributors(recording.contributions, config.preferredLanguages),
      ...(input.include_audio_url && { audio_url: audioUrl, audio_url_note: audioUrl ? "Presigned, short-lived URL." : "No audio URL was returned." }),
    };
  },
});
