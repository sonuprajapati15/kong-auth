import {auth_server} from "./http";

function pickToken(data) {
    return data?.token || data?.access_token || data?.jwt || null;
}

export async function loginApi({email, password}) {
    const encodedPassword = btoa(password); // base64 encode
    const res = await auth_server.post("/auth/login", {email, password: encodedPassword});
    const data = res.data;
    return {token: pickToken(data), user: data?.user ?? null, raw: data};
}

export async function signupApi({email, password}) {
    const encodedPassword = btoa(password); // base64 encode
    const res = await auth_server.post("/auth/signup", {email, password: encodedPassword});
    const data = res.data;
    return {token: pickToken(data), user: data?.user ?? null, raw: data};
}

export async function logOutApi(email) {
    const res = await auth_server.post("/auth/logout", {email: email});
    return res.data['message'];
}