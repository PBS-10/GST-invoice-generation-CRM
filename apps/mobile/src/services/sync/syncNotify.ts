type SyncListener = () => void;

let listener: SyncListener | null = null;

/** Called by repositories after a local write that enqueued outbox work. */
export function notifyLocalWrite() {
  listener?.();
}

export function setSyncWriteListener(next: SyncListener | null) {
  listener = next;
}
