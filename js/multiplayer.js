// Multiplayer layer — Supabase Realtime Broadcast + Presence
// No DB tables needed; all state is ephemeral in channels.
//
// Usage:
//   MP.create(roomCode, myNum)   — host creates room
//   MP.join(roomCode, myNum)     — guest joins room
//   MP.send(event, payload)      — broadcast a message
//   MP.onMessage(fn)             — receive messages: fn({ event, payload })
//   MP.onPresence(fn)            — presence changes: fn(count)
//   MP.leave()                   — disconnect

const MP = (() => {
  let client = null;
  let channel = null;
  let _onMessage = null;
  let _onPresence = null;
  let _myId = null;

  // Load Supabase JS on demand so it doesn't block page startup
  function loadSupabase() {
    return new Promise((resolve, reject) => {
      if (window.supabase) { resolve(); return; }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      script.onload = () => { if (window.supabase) resolve(); else reject(new Error('supabase not defined after load')); };
      script.onerror = () => reject(new Error('Failed to load Supabase (check internet connection)'));
      document.head.appendChild(script);
    });
  }

  function getClient() {
    if (!client) {
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return client;
  }

  async function _subscribe(roomCode, myNum) {
    await loadSupabase();
    _myId = `p${myNum}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const sb = getClient();
    channel = sb.channel(`meme-dungeon-${roomCode}`, {
      config: { broadcast: { self: false }, presence: { key: _myId } }
    });

    channel.on('broadcast', { event: '*' }, ({ event, payload }) => {
      if (_onMessage) _onMessage({ event, payload });
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const count = Object.keys(state).length;
      if (_onPresence) _onPresence(count);
    });

    return new Promise((resolve, reject) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.track({ myNum });
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(new Error('Channel subscribe failed: ' + status));
        }
      });
    });
  }

  async function create(roomCode, myNum) {
    await _subscribe(roomCode, myNum);
  }

  async function join(roomCode, myNum) {
    await _subscribe(roomCode, myNum);
  }

  function send(event, payload) {
    if (!channel) return;
    channel.send({ type: 'broadcast', event, payload });
  }

  function onMessage(fn) { _onMessage = fn; }
  function onPresence(fn) { _onPresence = fn; }

  function leave() {
    if (channel) {
      channel.unsubscribe();
      channel = null;
    }
  }

  return { create, join, send, onMessage, onPresence, leave };
})();
