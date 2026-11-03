
export type AgentStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export type AgentProgress = {
  node: string;
  label: string;
  status: AgentStatus;
  description: string;
};

export type ReportProgressEvent = {
  job_id: string;
  sequence: number;
  type: "node_progress" | "job_status";
  node?: string;
  label?: string;
  status: string;
  description?: string;
  download_url?: string;
  error?: string;
};

/**
 * Resolve an API base URL.
 *
 * Supports:
 *   ""                         -> current origin
 *   "/"                        -> current origin
 *   "http://localhost:8000"    -> direct backend
 *   "/api"                     -> current origin + /api
 */
function resolveApiBase(apiBaseUrl: string): URL {
  const value = apiBaseUrl.trim();

  return new URL(
    value || "/",
    window.location.origin
  );
}

/**
 * Convert an HTTP(S) URL into a WS(S) URL.
 */
function resolveWebSocketUrl(
  apiBaseUrl: string,
  jobId: string
): string {
  const base = resolveApiBase(apiBaseUrl);

  const wsUrl = new URL(
    `/api/chat/report-jobs/${encodeURIComponent(jobId)}/ws`,
    base
  );

  wsUrl.protocol =
    wsUrl.protocol === "https:" ? "wss:" : "ws:";

  return wsUrl.toString();
}

/**
 * Resolve a report download URL returned by FastAPI.
 */
function resolveDownloadUrl(
  apiBaseUrl: string,
  downloadUrl: string
): string {
  const base = resolveApiBase(apiBaseUrl);

  return new URL(
    downloadUrl,
    base
  ).toString();
}

/**
 * Watch LangGraph report progress through WebSocket.
 *
 * Resolves with the completed PDF URL.
 * Rejects if the job fails or the connection closes.
 */
export function watchReportProgress(
  apiBaseUrl: string,
  jobId: string,
  onEvent: (event: ReportProgressEvent) => void,
  signal: AbortSignal
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let wsUrl: string;

    try {
      wsUrl = resolveWebSocketUrl(apiBaseUrl, jobId);
    } catch {
      reject(new Error("Invalid report WebSocket URL"));
      return;
    }

    const socket = new WebSocket(wsUrl);

    let settled = false;

    function cleanup() {
      signal.removeEventListener("abort", onAbort);

      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;

      if (
        socket.readyState === WebSocket.CONNECTING ||
        socket.readyState === WebSocket.OPEN
      ) {
        socket.close();
      }
    }

    function succeed(downloadUrl: string) {
      if (settled) return;

      let resolvedUrl: string;

      try {
        resolvedUrl = resolveDownloadUrl(
          apiBaseUrl,
          downloadUrl
        );
      } catch {
        fail(new Error("Invalid report download URL"));
        return;
      }

      settled = true;
      cleanup();
      resolve(resolvedUrl);
    }

    function fail(error: Error) {
      if (settled) return;

      settled = true;
      cleanup();
      reject(error);
    }

    function onAbort() {
      fail(new DOMException("Aborted", "AbortError"));
    }

    signal.addEventListener("abort", onAbort, {
      once: true,
    });

    socket.onmessage = (message: MessageEvent) => {
      if (settled) return;

      try {
        const event = JSON.parse(
          message.data
        ) as ReportProgressEvent;

        onEvent(event);

        if (
          event.type === "job_status" &&
          event.status === "completed"
        ) {
          if (!event.download_url) {
            fail(
              new Error("Missing report download URL")
            );
            return;
          }

          succeed(event.download_url);
          return;
        }

        if (
          event.type === "job_status" &&
          event.status === "failed"
        ) {
          fail(
            new Error(
              event.error ?? "Report generation failed"
            )
          );
        }
      } catch (error) {
        fail(
          error instanceof Error
            ? error
            : new Error("Invalid report progress event")
        );
      }
    };

    socket.onerror = () => {
      fail(
        new Error("Report WebSocket connection failed")
      );
    };

    socket.onclose = () => {
      if (!settled) {
        fail(
          new Error("Report WebSocket disconnected")
        );
      }
    };

    if (signal.aborted) {
      onAbort();
    }
  });
}
