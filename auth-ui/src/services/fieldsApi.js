import { rule_server } from "./http";

const BASE = "/admin/v1/api/fields";

export async function listFieldsApi() {
    const res = await rule_server.get(BASE);
    return res.data;
}

export async function createFieldApi(payload) {
    // payload: { id, name, field_type, values, comment }
    const res = await rule_server.post(BASE, payload);
    return res.data;
}

export async function updateFieldApi(payload) {
    // backend PUT takes full object (including id) as per your postman
    const res = await rule_server.put(BASE, payload);
    return res.data;
}

/**
 * DELETE variant guess:
 * Many APIs accept: DELETE /fields?id=xxx
 * If your backend expects different (like /fields/{id} or JSON body), tell me.
 */
export async function deleteFieldApi(id) {
    const res = await rule_server.delete(BASE+"/"+id);
    return res.data;
}

export async function getByid(id) {
    const res = await rule_server.get(BASE+"/"+id);
    return res.data;
}