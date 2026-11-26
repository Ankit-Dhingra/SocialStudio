import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TimedShot } from '../visual-story.js';
import { IPhoneMockup } from '../PremiumVisuals.js';
import { VideoDesignTokens as design } from '../design-system.js';

const easing = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) } as const;
const mint = '#79f6c2';
const contacts = [['R', '#444e79'], ['A', '#784364'], ['S', '#326154'], ['K', '#725443'], ['M', '#4d5580'], ['P', '#624d80']];

export function MessagingScreen({ shot }: { shot: Extract<TimedShot, { kind: 'device' }> }) {
  const data = shot.messaging!;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timestamp = data.view === 'timestamp';
  const recap = !timestamp && Boolean(data.sent);
  const connected = timestamp || frame >= (data.statusAt ?? 0);
  const showMessages = timestamp || frame >= (data.messagesAt ?? 0);
  const showPeople = !timestamp && frame >= (data.peopleAt ?? 0);
  const showReceived = data.received && frame >= (data.receivedAt ?? 0);
  const showSent = frame >= (data.sentAt ?? 0);
  const arrival = interpolate(frame, [data.messagesAt ?? 0, (data.messagesAt ?? 0) + fps * 0.55], [0, 1], easing);
  const sinceReconnect = frame - (data.statusAt ?? 0);
  const glow = !timestamp && !recap ? interpolate(sinceReconnect, [-3, 0, fps * 0.8], [0, 0.8, 0], easing) : 0;
  return <AbsoluteFill style={{ color: design.colors.ink }}>
    <IPhoneMockup>
      <div style={{ height: '100%', background: '#0b1415', overflow: 'hidden', boxSizing: 'border-box', padding: '48px 34px 33px', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '28px 0 40px', fontSize: 27 }}>
          <span>{shot.appName ?? 'Messaging'}</span>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, color: connected ? mint : '#f7b68a' }}>
            <span aria-hidden style={{ display: 'flex', alignItems: 'end', gap: 3 }}>
              {[10, 16, 22, 28].map((height, index) => <span key={height} style={{ width: 5, height, borderRadius: 2, background: 'currentColor',
                opacity: connected && (timestamp || recap || sinceReconnect > index * 3) ? 1 : 0.22 }} />)}
            </span>
            {connected ? 'Online' : 'Offline'}
            {glow > 0 && <div aria-hidden style={{ position: 'absolute', inset: -12, borderRadius: 25, border: '2px solid currentColor', opacity: glow, scale: 1.2 - glow * 0.2 }} />}
          </div>
        </div>
        <div style={{ fontSize: 70, fontWeight: 780, lineHeight: 1.1, margin: '12px 0 30px' }}>{timestamp && showSent ? (data.sender ?? 'Conversation') : 'Chats'}</div>
        {timestamp ? <>
          {showSent && <><div style={{ color: '#afc8c0', fontSize: 26, margin: '12px 0 22px' }}>{data.sent?.split(' · ')[0]}</div>
          <div style={{ background: '#14342b', border: '1px solid #356b5a', borderRadius: '7px 27px 27px 27px', padding: '24px 28px', width: '75%', fontSize: 38 }}>
            Message from {data.sender ?? 'sender'}<div style={{ color: mint, fontSize: 26, marginTop: 20 }}>{data.sent?.split(' · ')[1]}</div>
          </div>
          <div style={{ marginTop: 47, display: 'grid', gap: 22 }}>
            <div style={{ borderTop: '1px solid #405650', paddingTop: 17, fontSize: 27, color: '#b8d0c7' }}>Sent · {data.sent}</div>
            {showReceived && <div style={{ fontSize: 27, color: '#f3bb93' }}>Received · {data.received}</div>}
          </div></>}
        </> : <>
          {!recap && <div style={{ padding: '22px 24px', background: showMessages ? '#11392e' : '#192723', borderRadius: 23, fontSize: 42, fontWeight: 720, color: showMessages ? mint : '#f1f9f6',
            scale: showMessages ? 1 + Math.sin(arrival * Math.PI) * 0.04 : 1 }}>
            {showMessages ? (data.count ? `${data.count} new messages` : 'New messages') : connected ? 'Receiving messages…' : data.offlineFor ? `Offline for ${data.offlineFor} days` : 'Waiting for connection'}
          </div>}
          {showPeople && data.people && <div style={{ marginTop: 19, fontSize: 27, color: '#a7beb6' }}>{data.people} senders</div>}
          {showPeople && contacts.map(([initial, color], index) => {
            const unread = !recap && showMessages ? interpolate(frame, [(data.messagesAt ?? 0) + index * 3, (data.messagesAt ?? 0) + index * 3 + fps * 0.35], [0, 1], easing) : 0;
            const enter = showMessages ? interpolate(arrival, [0, 1], [10 + index * 3, 0], easing) : 0;
            return <div key={initial} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '13px 0', borderBottom: '1px solid #29413a', transform: `translateY(${enter}px)` }}>
              <div style={{ width: 60, height: 60, borderRadius: 20, background: color, display: 'grid', placeItems: 'center', fontSize: 29 }}>{index === 0 && data.sender ? Array.from(data.sender)[0] : initial}</div>
              <div style={{ flex: 1, fontSize: 30 }}>{index === 0 && data.sender ? data.sender : `Contact ${initial}`}</div>
              {recap && index === 0 && <div style={{ fontSize: 25, color: mint }}>{data.sent}</div>}
              {unread > 0 && <div aria-hidden style={{ width: 14, height: 14, borderRadius: '50%', background: mint, opacity: unread, scale: 0.7 + 0.3 * unread }} />}
            </div>;
          })}
        </>}
      </div>
    </IPhoneMockup>
  </AbsoluteFill>;
}
