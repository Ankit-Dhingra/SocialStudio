import fs from 'node:fs';

const p = 'media/sessions/session_1794686310227_ao6wl.json';
if (fs.existsSync(p)) {
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));

  s.storyboard.scenes[0].type = 'raceCondition';
  s.storyboard.scenes[0].onScreenText = '1 SEAT • 2 BOOKINGS';
  s.storyboard.scenes[0].technicalKeyPoint = 'Concurrent booking collision';
  s.storyboard.scenes[0].visualProps = {
    type: 'raceCondition',
    title: '1 SEAT • 2 BOOKINGS',
    itemTitle: 'Concert Ticket (Remaining: 1)',
    user1Name: 'You',
    user2Name: 'Friend',
    atomicQuery: 'SET lock:seat_101 token NX EX 10'
  };

  s.storyboard.scenes[1].type = 'comparison';
  s.storyboard.scenes[1].onScreenText = 'THE PARALLEL EXECUTION TRAP';
  s.storyboard.scenes[1].technicalKeyPoint = 'Naive check vs Distributed lock';
  s.storyboard.scenes[1].visualProps = {
    type: 'comparison',
    leftTitle: 'Naive Direct Query',
    leftCode: 'SELECT * FROM seats WHERE id = 1',
    leftPoints: ['Both requests pass simultaneously', 'Seats drop to negative (-1)'],
    rightTitle: 'Redis Distributed Lock',
    rightCode: 'SET lock:seat_1 user_id NX EX 10',
    rightPoints: ['Atomic single-turn guarantee', 'Auto-release on crash (TTL)'],
    verdict: 'Winner: Redis Atomic Lock'
  };

  s.storyboard.scenes[2].type = 'architecturePipeline';
  s.storyboard.scenes[2].onScreenText = 'REDIS DISTRIBUTED LOCK ENGINE';
  s.storyboard.scenes[2].technicalKeyPoint = 'In-memory coordination prevents race condition';
  s.storyboard.scenes[2].visualProps = {
    type: 'architecturePipeline',
    title: 'REDIS DISTRIBUTED LOCK ENGINE',
    subtitle: 'Atomic SET NX EX ensures single-turn execution'
  };

  s.storyboard.scenes[3].type = 'architecturePipeline';
  s.storyboard.scenes[3].onScreenText = 'EDGE CASE: SERVER CRASH & TTL';
  s.storyboard.scenes[3].technicalKeyPoint = 'Automatic expiration prevents permanent deadlock';
  s.storyboard.scenes[3].visualProps = {
    type: 'architecturePipeline',
    title: 'EDGE CASE: SERVER CRASH & TTL',
    subtitle: 'Heartbeat & TTL expiration auto-frees dead client locks'
  };

  s.storyboard.scenes[4].type = 'tradeoffHUD';
  s.storyboard.scenes[4].onScreenText = 'SENIOR SDE TRADEOFF MATRIX';
  s.storyboard.scenes[4].technicalKeyPoint = 'Short TTL vs Long TTL balance';
  s.storyboard.scenes[4].visualProps = {
    type: 'tradeoffHUD',
    title: 'SENIOR SDE TRADEOFF MATRIX',
    subtitle: 'Which architecture strategy would you defend in an interview?',
    optionA_Title: 'OPTION A: SHORT TTL (5-10s)',
    optionA_Pros: 'Quick crash recovery, minimal deadlock time',
    optionA_Cons: 'Premature expiry risk if latency spikes',
    optionB_Title: 'OPTION B: LONG TTL (60s+)',
    optionB_Pros: 'Guaranteed protection for complex transactions',
    optionB_Cons: 'Prolonged deadlocks if server dies'
  };

  if (s.timeline?.segments) {
    s.timeline.segments[0].type = 'raceCondition';
    s.timeline.segments[1].type = 'comparison';
    s.timeline.segments[2].type = 'architecturePipeline';
    s.timeline.segments[3].type = 'architecturePipeline';
    s.timeline.segments[4].type = 'tradeoffHUD';
  }

  fs.writeFileSync(p, JSON.stringify(s, null, 2), 'utf8');
  console.log('Session session_1794686310227_ao6wl updated cleanly!');
}
