const GROQ_TRANSCRIPTIONS_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODEL = "whisper-large-v3";

// Whisper copies the style of its prompt. Without a Roman-script Hinglish sample it writes the Hindi
// parts of a mixed sentence in Devanagari; with one it keeps English as English and Hindi in Roman.
const HINGLISH_STYLE = "Kal maine login bug fix kiya, aaj dashboard pe kaam karunga. No blockers hain.";

// Whisper infers the container from the filename extension, not the Content-Type.
const EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "video/webm": "webm",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "video/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/flac": "flac",
};

export function fileNameForMimetype(mimetype: string): string {
  const base = mimetype.split(";")[0].trim().toLowerCase();
  return `clip.${EXTENSIONS[base] ?? "webm"}`;
}

export class TranscriptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranscriptionError";
  }
}

export async function transcribe(
  apiKey: string,
  audio: ArrayBuffer,
  mimetype: string,
  hints = "",
): Promise<string> {
  if (!apiKey) throw new TranscriptionError("GROQ_API_KEY is not set");

  const form = new FormData();
  form.append("file", new Blob([audio], { type: mimetype }), fileNameForMimetype(mimetype));
  form.append("model", MODEL);
  form.append("response_format", "json");
  form.append("prompt", hints ? `${hints} ${HINGLISH_STYLE}` : HINGLISH_STYLE);

  const response = await fetch(GROQ_TRANSCRIPTIONS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!response.ok) {
    throw new TranscriptionError(`Groq ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }

  const data: unknown = await response.json();
  const text =
    typeof data === "object" && data !== null && "text" in data && typeof data.text === "string"
      ? data.text.trim()
      : "";
  if (!text) throw new TranscriptionError("empty transcript");
  return text;
}
