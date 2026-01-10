import { http } from "./http";

function pickToken(data) {
  return data?.token || data?.accessToken || data?.jwt || null;
}

export async function loginApi({ email, password }) {
  const res = await http.post("/auth/login", { email, password });
  const data = res.data;
  return { token: pickToken(data), user: data?.user ?? null, raw: data };
}

export async function signupApi({ email, password }) {
  const res = await http.post("/auth/signup", { email, password });
  const data = res.data;
  return { token: pickToken(data), user: data?.user ?? null, raw: data };
}