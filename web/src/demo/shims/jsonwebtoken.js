// The demo runs entirely in one browser, so the "session token" only needs to carry the user id.
export const sign = (payload) => btoa(JSON.stringify(payload));
export const verify = (token) => JSON.parse(atob(token));
export default { sign, verify };
