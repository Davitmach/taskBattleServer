export function parseInitData(initData) {
  const params = new URLSearchParams(initData);
  const json = {};

  for (const [key, value] of params) {
    if (key === 'user') {
      try {
        json.user = JSON.parse(value);
      } catch (e) {
        json.user = null;
      }
    } else {
      json[key] = value;
    }
  }

  return json;
}
