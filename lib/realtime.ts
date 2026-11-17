// Real-time Event Broadcaster & Webhook Bus
// Enables live WebSocket / Server-Sent Events synchronization across partner dashboards.

export interface RealtimeEvent {
  id: string;
  type: "deal.created" | "deal.updated" | "file.uploaded" | "metrics.updated" | "ping";
  timestamp: string;
  data: any;
}

type EventListener = (event: RealtimeEvent) => void;

class RealtimeBus {
  private listeners: Set<EventListener> = new Set();
  private history: RealtimeEvent[] = [];

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  broadcast(type: RealtimeEvent["type"], data: any): RealtimeEvent {
    const event: RealtimeEvent = {
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      timestamp: new Date().toISOString(),
      data,
    };

    this.history.unshift(event);
    if (this.history.length > 50) this.history.pop();

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("[RealtimeBus] listener error:", err);
      }
    }

    return event;
  }

  getRecentEvents(): RealtimeEvent[] {
    return [...this.history];
  }
}

// Global singleton across serverless invocations within worker lifecycle
const globalForBus = global as unknown as { __aarka_bus?: RealtimeBus };
export const realtimeBus = globalForBus.__aarka_bus ?? new RealtimeBus();
if (process.env.NODE_ENV !== "production") globalForBus.__aarka_bus = realtimeBus;

export function broadcastRealtimeEvent(type: RealtimeEvent["type"], data: any) {
  return realtimeBus.broadcast(type, data);
}
