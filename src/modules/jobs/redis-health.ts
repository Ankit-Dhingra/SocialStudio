type RedisHealth = { status: 'pending' | 'ok' | 'unavailable'; checkedAt?: string };
type RedisPing = { ping(): Promise<string> };

export function monitorRedis(redis: RedisPing, intervalMs = 300_000, timeoutMs = 3_000) {
  let state: RedisHealth = { status: 'pending' };
  let timer: ReturnType<typeof setTimeout>;
  let stopped = false;
  async function check() {
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      const expiry = new Promise<never>((_resolve, reject) => { deadline = setTimeout(() => reject(new Error('Redis health timeout')), timeoutMs); });
      const answer = await Promise.race([redis.ping(), expiry]);
      state = { status: answer === 'PONG' ? 'ok' : 'unavailable', checkedAt: new Date().toISOString() };
    } catch { state = { status: 'unavailable', checkedAt: new Date().toISOString() }; }
    finally {
      if (deadline) clearTimeout(deadline);
      if (!stopped) { timer = setTimeout(() => void check(), intervalMs); timer.unref(); }
    }
  }
  void check();
  return { read: () => ({ ...state }), stop: () => { stopped = true; clearTimeout(timer); } };
}
