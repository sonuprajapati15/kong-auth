import { rule_server } from "./http";

const BASE = "/admin/v1/api/smtp";

export async function listSmtpConfigsApi() {
    const res = await rule_server.get(BASE);
    return res.data;
}

export async function getSmtpConfigApi(id) {
    const res = await rule_server.get(`${BASE}/${id}`);
    return res.data;
}

export async function createSmtpConfigApi(payload) {
    // payload: { config_name, mail_host, mail_port, mail_username, mail_app_password }
    const res = await rule_server.post(BASE, payload);
    return res.data;
}

export async function updateSmtpConfigApi(payload) {
    // payload: { id, config_name, mail_host, mail_port, mail_username, mail_app_password }
    const res = await rule_server.put(BASE, payload);
    return res.data;
}

export async function deleteSmtpConfigApi(id) {
    const res = await rule_server.delete(`${BASE}/${id}`);
    return res.data;
}