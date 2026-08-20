import { COOKIE_NAME } from "@shared/const";

export function getLiveSocketAuth() {
  try {
    const raw = sessionStorage.getItem("manus-cookie");
    if (!raw) return {};
    const prefix = `${COOKIE_NAME}=`;
    const pair = raw.split(";").find(value => value.trim().startsWith(prefix));
    const token = pair?.trim().slice(prefix.length);
    return token ? { token } : {};
  } catch {
    return {};
  }
}
