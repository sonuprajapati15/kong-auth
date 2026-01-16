import {rule_server} from "./http";

const BASE = "/admin/v1/api/default-values";

export async function listDefaultValuesMeta() {
    const res = await rule_server.get(BASE);
    return res.data;
}