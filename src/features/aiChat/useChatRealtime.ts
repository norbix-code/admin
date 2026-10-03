// Keeps the caller's realtime stream open while the chat knows its channel
// (learned from the first turn response) and the user is signed in. On every
// (re)open it re-reads the open session — events sent while the stream was
// down are not replayed, the entries endpoint is the truth. While a turn runs
// and the stream is not open, it polls the transcript instead.

import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { API_PROXY_BASE } from '@/config/env';
import { ChatStream } from './realtime';
import { realtimeStatusChanged } from './slice';
import { loadOpenSession, routeChatEvent, streamHeaders } from './chatEffects';

const POLL_WHILE_OFFLINE_MS = 2500;

export function useChatRealtime(): void {
  const dispatch = useAppDispatch();
  const channel = useAppSelector((s) => s.aiChat.channel);
  const token = useAppSelector((s) => s.auth.token);
  const isSending = useAppSelector((s) => s.aiChat.isSending);
  const realtime = useAppSelector((s) => s.aiChat.realtime);

  useEffect(() => {
    if (!channel || !token) return;
    const stream = new ChatStream({
      proxyBase: API_PROXY_BASE,
      channel,
      headers: () => streamHeaders(token),
      onEvent: (name, envelope) => routeChatEvent(dispatch, name, envelope),
      onStatus: (status) => {
        dispatch(realtimeStatusChanged(status));
        if (status === 'open') void dispatch(loadOpenSession());
      },
    });
    stream.start();
    return () => {
      stream.close();
      dispatch(realtimeStatusChanged('idle'));
    };
  }, [channel, token, dispatch]);

  useEffect(() => {
    if (!isSending || realtime === 'open') return;
    const timer = setInterval(
      () => void dispatch(loadOpenSession()),
      POLL_WHILE_OFFLINE_MS,
    );
    return () => clearInterval(timer);
  }, [isSending, realtime, dispatch]);
}
