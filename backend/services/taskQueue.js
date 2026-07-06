/**
 * In-process job queue — limits concurrent heavy tasks (FFmpeg, Gemini)
 * so many users can share one server without OOM / CPU starvation.
 */
class TaskQueue {
  constructor(name, { maxConcurrent = 2, maxQueue = 20 } = {}) {
    this.name = name;
    this.maxConcurrent = Math.max(1, maxConcurrent);
    this.maxQueue = Math.max(1, maxQueue);
    this.running = 0;
    this.queue = [];
    this.runningIds = new Set();
  }

  /**
   * @param {string} taskId
   * @param {() => Promise<void>} fn
   * @param {(position: number) => void} [onQueued]
   */
  enqueue(taskId, fn, onQueued) {
    return new Promise((resolve, reject) => {
      const job = { taskId, fn, resolve, reject };

      if (this.running < this.maxConcurrent) {
        this._run(job);
        return;
      }

      if (this.queue.length >= this.maxQueue) {
        const err = new Error('SERVER_BUSY');
        err.queueFull = true;
        reject(err);
        return;
      }

      this.queue.push(job);
      if (onQueued) onQueued(this.queue.length);
    });
  }

  cancel(taskId) {
    const idx = this.queue.findIndex((j) => j.taskId === taskId);
    if (idx !== -1) {
      const [job] = this.queue.splice(idx, 1);
      const err = new Error('EXPORT_CANCELLED');
      job.reject(err);
      return { removed: true, wasRunning: false };
    }
    if (this.runningIds.has(taskId)) {
      return { removed: false, wasRunning: true };
    }
    return { removed: false, wasRunning: false };
  }

  _run(job) {
    this.running++;
    this.runningIds.add(job.taskId);

    let finished = false;
    // Auto-timeout job after 6 minutes (360,000 ms) to prevent server hangs
    const timeoutMs = 360000;
    const timeoutId = setTimeout(() => {
      if (!finished) {
        finished = true;
        console.warn(`[TaskQueue ${this.name}] Job ${job.taskId} timed out after ${timeoutMs}ms`);
        const err = new Error('Tác vụ quá thời gian cho phép (Timeout).');
        job.reject(err);
        this._onJobFinish(job.taskId);
      }
    }, timeoutMs);

    Promise.resolve()
      .then(() => job.fn())
      .then(() => {
        if (!finished) {
          finished = true;
          clearTimeout(timeoutId);
          job.resolve();
          this._onJobFinish(job.taskId);
        }
      })
      .catch((err) => {
        if (!finished) {
          finished = true;
          clearTimeout(timeoutId);
          job.reject(err);
          this._onJobFinish(job.taskId);
        }
      });
  }

  _onJobFinish(taskId) {
    this.running--;
    this.runningIds.delete(taskId);
    if (this.queue.length > 0) {
      this._run(this.queue.shift());
    }
  }

  getStats() {
    return {
      name: this.name,
      running: this.running,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      maxQueue: this.maxQueue
    };
  }

  hasCapacity() {
    return this.queue.length < this.maxQueue;
  }
}

function envInt(name, fallback) {
  const n = parseInt(process.env[name], 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const exportQueue = new TaskQueue('export', {
  maxConcurrent: envInt('MAX_CONCURRENT_EXPORTS', 2),
  maxQueue: envInt('MAX_QUEUE_EXPORTS', 15)
});

const transcribeQueue = new TaskQueue('transcribe', {
  maxConcurrent: envInt('MAX_CONCURRENT_TRANSCRIBE', 2),
  maxQueue: envInt('MAX_QUEUE_TRANSCRIBE', 15)
});

module.exports = { TaskQueue, exportQueue, transcribeQueue };
