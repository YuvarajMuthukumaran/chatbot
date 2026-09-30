// localStorage can throw (Safari private mode, storage disabled, quota full)
// — every read and write goes through here so a storage failure degrades to
// "not remembered" instead of breaking the chat.

function store() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readJson(key) {
  try {
    const raw = store()?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeJson(key, value) {
  try {
    store()?.setItem(key, JSON.stringify(value));
  } catch {
    // not remembered — fine
  }
}

export function remove(key) {
  try {
    store()?.removeItem(key);
  } catch {
    // nothing to clean up
  }
}
