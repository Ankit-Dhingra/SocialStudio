export default {
  hook(s) {
    const { top, h, w } = s.safe;
    const u = Math.min(w, h) / 100;
    s.title('ZOMATO SURGE PRICING', { y: top + h * 0.15, size: u * 8, at: -1 });
    s.icon('smartphone', { id: 'phone', x: w * 0.5, y: top + h * 0.38, size: u * 24, at: 0.1 });
    s.text('₹30', { id: 'fee30', x: w * 0.5, y: top + h * 0.56, font: 'mono', size: u * 12, color: 'muted', at: 0.2 });
    s.annotate('fee30', { type: 'cross', color: 'red', at: '#fee' });
    s.text('₹80  (1.8X SURGE)', { id: 'fee80', x: w * 0.5, y: top + h * 0.68, font: 'mono', size: u * 10, color: 'red', at: '#fee' });
    s.note('Real-time Spatial Auction', { y: top + h * 0.82, size: u * 6, color: 'yellow', at: '#map' });
  },

  hexagons(s) {
    const { top, h, w } = s.safe;
    const u = Math.min(w, h) / 100;
    s.title('UBER H3 SPATIAL INDEXING', { y: top + h * 0.15, size: u * 7, at: -1 });
    s.box('Hex Bin: #88619A0A4', { id: 'hex', x: w * 0.5, y: top + h * 0.35, icon: 'map-pin', color: 'blue', w: w * 0.8, at: '#hex' });
    s.box('Active Orders: 50', { id: 'orders', x: w * 0.32, y: top + h * 0.55, icon: 'shopping-bag', color: 'red', w: w * 0.42, at: '#imbalance' });
    s.box('Riders Online: 4', { id: 'riders', x: w * 0.68, y: top + h * 0.55, icon: 'bike', color: 'green', w: w * 0.42, at: '#imbalance' });
    s.arrow('orders', 'riders', { at: '#imbalance', label: '12.5x Deficit', color: 'red', dashed: true });
    s.note('Instant Dynamic Surge Triggered', { y: top + h * 0.78, size: u * 6, color: 'red', at: '#imbalance' });
  },

  architecture(s) {
    const { top, h, w } = s.safe;
    const u = Math.min(w, h) / 100;
    s.title('50ms IN-MEMORY ARCHITECTURE', { y: top + h * 0.15, size: u * 7, at: -1 });
    s.box('Postgres DB (1,450ms)', { id: 'db', x: w * 0.5, y: top + h * 0.32, icon: 'database', color: 'red', w: w * 0.75, at: 0.1 });
    s.annotate('db', { type: 'cross', color: 'red', at: '#crash' });
    s.box('Redis In-Memory (4ms)', { id: 'redis', x: w * 0.5, y: top + h * 0.54, icon: 'zap', color: 'green', w: w * 0.75, at: '#redis' });
    s.arrow('db', 'redis', { at: '#redis', label: 'Bypass Database', color: 'green' });
    s.box('Kafka Rider GPS Stream', { id: 'kafka', x: w * 0.5, y: top + h * 0.75, icon: 'activity', color: 'purple', w: w * 0.75, at: '#kafka' });
    s.arrow('kafka', 'redis', { at: '#kafka', label: 'Async Write Stream', color: 'purple' });
  },

  lock(s) {
    const { top, h, w } = s.safe;
    const u = Math.min(w, h) / 100;
    s.title('CONCURRENCY & RACE CONDITIONS', { y: top + h * 0.15, size: u * 7, at: -1 });
    s.icon('cloud-rain', { x: w * 0.5, y: top + h * 0.32, size: u * 20, color: 'blue', at: '#rain' });
    s.box('SET lock:hex token NX EX 5', { id: 'lock', x: w * 0.5, y: top + h * 0.55, icon: 'lock', color: 'yellow', font: 'mono', w: w * 0.85, at: '#lock' });
    s.note('Automatic TTL Expiry Prevents Deadlocks', { y: top + h * 0.76, size: u * 5.5, color: 'green', at: '#lock' });
  },

  tradeoff(s) {
    const { top, h, w } = s.safe;
    const u = Math.min(w, h) / 100;
    s.title('SENIOR SDE TRADEOFF MATRIX', { y: top + h * 0.15, size: u * 7, at: -1 });
    s.box('Micro-Hex (100m)', { id: 'micro', x: w * 0.5, y: top + h * 0.35, icon: 'target', color: 'green', w: w * 0.8, at: '#scale' });
    s.note('High Accuracy • High RAM', { x: w * 0.5, y: top + h * 0.47, size: u * 5, color: 'yellow', at: '#scale' });
    s.box('Macro-Zone (3km)', { id: 'macro', x: w * 0.5, y: top + h * 0.62, icon: 'globe', color: 'blue', w: w * 0.8, at: '#macro' });
    s.note('Low RAM • Border Anomaly', { x: w * 0.5, y: top + h * 0.74, size: u * 5, color: 'yellow', at: '#macro' });
  },

  outro(s) {
    const { top, h, w } = s.safe;
    const u = Math.min(w, h) / 100;
    s.icon('rocket', { x: w * 0.5, y: top + h * 0.35, size: u * 25, color: 'yellow', at: 0.1 });
    s.title('FOLLOW FOR DEEP TECH', { y: top + h * 0.58, size: u * 8, color: 'green', at: 0.3 });
    s.note('Real-World System Design Breakdowns', { y: top + h * 0.72, size: u * 6, at: 0.5 });
  },
};
