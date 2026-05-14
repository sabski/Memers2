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

  function getClient() {
    if (!client) {
      client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return client;
  }

  function _subscribe(roomCode, myNum) {
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
