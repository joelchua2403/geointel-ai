
const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export type ReportJob = {
  status: "queued" | "running" | "completed" | "failed";
  error: string | null;
  download_url: string | null;
};

export async function detectReportIntent(
  message: string,
  conversationContext = ""
): Promise<
  | { type: "chat" }
  | { type: "report"; job_id: string; message: string }
> {
  const response = await fetch(`${API}/api/chat/report-intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      conversation_context: conversationContext,
    }),
  });

  if (!response.ok) {
    throw new Error("Unable to classify chat request");
  }

  return response.json();
}

export async function waitForReport(
  jobId: string,
  onProgress?: (status: string) => void,
  signal?: AbortSignal
): Promise<string> {
  for (let attempt = 0; attempt < 180; attempt++) {
    if (signal?.aborted) {
      throw new Error("Report monitoring cancelled");
    }

    const response = await fetch(
      `${API}/api/chat/report-jobs/${jobId}`,
      { signal }
    );

    if (!response.ok) {
      throw new Error("Unable to check report status");
    }

    const job: ReportJob = await response.json();

    onProgress?.(job.status);

    if (job.status === "completed" && job.download_url) {
      return new URL(job.download_url, API).toString();
    }

    if (job.status === "failed") {
      throw new Error(job.error ?? "Report generation failed");
    }

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 2000);

      signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new Error("Report monitoring cancelled"));
        },
        { once: true }
      );
    });
  }

  throw new Error("Report is still running. Check its status later.");
}
