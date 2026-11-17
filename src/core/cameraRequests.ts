/**
 * Turns the camera's command/event pairs into promises: each command gets an id,
 * and the native event that carries the same id settles it.
 */
export class CameraRequests<T> {
  private next = 1;
  private pending = new Map<number, { resolve: (value: T) => void; reject: (error: Error) => void }>();

  /** Starts a request: `send` receives the id to pass to the native command. */
  start(send: (id: number) => void): Promise<T> {
    const id = this.next++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        send(id);
      } catch (error) {
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Settles the request `id`: rejects with `error` when it is not empty, else resolves.
   * @returns whether a request was waiting for that id.
   */
  settle(id: number, error: string, value: T): boolean {
    const request = this.pending.get(id);
    if (!request) return false;
    this.pending.delete(id);
    if (error) request.reject(new Error(error));
    else request.resolve(value);
    return true;
  }

  /** Rejects every waiting request (the camera went away). */
  cancelAll(reason: string): void {
    const waiting = [...this.pending.values()];
    this.pending.clear();
    waiting.forEach((request) => request.reject(new Error(reason)));
  }
}
