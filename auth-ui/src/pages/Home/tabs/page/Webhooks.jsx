import { useEffect, useMemo, useState } from "react";
import "../css/Webhooks.css";
import {
    createWebhookApi,
    deleteWebhookApi,
    listWebhooksApi,
    updateWebhookApi
} from "../../../../services/webhookApi";

const AUTH_TYPES = [
    { value: "NONE", label: "None" },
    { value: "API_KEY", label: "API Key" },
    { value: "BASIC", label: "Username/Password (Basic)" },
    { value: "JWT", label: "JWT Token" }
];

const HTTP_METHODS = ["POST", "PUT", "PATCH"];

function formatDate(iso) {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

function makeEmpty() {
    return {
        id: "",
        name: "",
        url: "",
        method: "POST",
        timeout_ms: 5000,

        authType: "NONE",
        authApikeyHeader: "Authorization",
        authApiKeyValue: "",
        authUsername: "",
        authPassword: "",
        authJwtToken: "",

        bodyFields: [{ key: "rule_id", value: "{{rule.id}}" }],
        enabled: true,
        description: ""
    };
}

function mapRow(w) {
    return {
        ...w,
        createdDateTime: w.createdDateTime || w.created_date_time || w.created_at,
        updatedDateTime: w.updatedDateTime || w.updated_date_time || w.updated_at
    };
}

export default function Webhooks() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [rows, setRows] = useState([]);
    const [search, setSearch] = useState("");

    // view | create | edit
    const [mode, setMode] = useState("view");
    const panelOpen = mode !== "view";

    const [selectedId, setSelectedId] = useState(null);
    const [form, setForm] = useState(makeEmpty());
    const [showSecret, setShowSecret] = useState(false);

    const [msg, setMsg] = useState("");
    const [err, setErr] = useState("");

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((r) => {
            return (
                (r.name || "").toLowerCase().includes(q) ||
                (r.url || "").toLowerCase().includes(q) ||
                (r.description || "").toLowerCase().includes(q)
            );
        });
    }, [rows, search]);

    async function refresh() {
        setErr("");
        setMsg("");
        setLoading(true);
        try {
            const data = await listWebhooksApi();
            const list = Array.isArray(data) ? data : data?.data ?? [];
            const mapped = list.map(mapRow);
            setRows(mapped);
            setSelectedId((prev) => (mapped.some((x) => x.id === prev) ? prev : null));
        } catch (e) {
            setErr(e?.response?.data?.message || e.message || "Failed to load webhooks");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        refresh();
    }, []);

    function setField(key, value) {
        setForm((p) => ({ ...p, [key]: value }));
    }

    function setBodyField(idx, patch) {
        setForm((p) => ({
            ...p,
            bodyFields: (p.bodyFields || []).map((f, i) => (i === idx ? { ...f, ...patch } : f))
        }));
    }

    function addBodyField() {
        setForm((p) => ({
            ...p,
            bodyFields: [...(p.bodyFields || []), { key: "", value: "" }]
        }));
    }

    function removeBodyField(idx) {
        setForm((p) => ({
            ...p,
            bodyFields: (p.bodyFields || []).filter((_, i) => i !== idx)
        }));
    }

    function openCreate() {
        setErr("");
        setMsg("");
        setMode("create");
        setSelectedId(null);
        setForm(makeEmpty());
    }

    function openView(r) {
        setErr("");
        setMsg("");
        setMode("edit"); // same panel for view/edit
        setSelectedId(r.id);
        setForm({
            id: r.id || "",
            name: r.name || "",
            url: r.url || "",
            method: r.method || "POST",
            timeout_ms: r.timeout_ms ?? 5000,

            authType: r.authType || "NONE",
            authApikeyHeader: r.authApikeyHeader || "Authorization",
            authApiKeyValue: r.authApiKeyValue || "",
            authUsername: r.authUsername || "",
            authPassword: r.authPassword || "",
            authJwtToken: r.authJwtToken || "",

            bodyFields: Array.isArray(r.bodyFields) && r.bodyFields.length ? r.bodyFields : [{ key: "rule_id", value: "{{rule.id}}" }],
            enabled: Boolean(r.enabled),
            description: r.description || ""
        });
    }

    function openEdit(r) {
        openView(r);
    }

    function closePanel() {
        setMode("view");
        setSelectedId(null);
        setErr("");
    }

    function validate(f) {
        if (!f.id?.trim() && mode === "create") return "Webhook id is required";
        if (!f.name?.trim()) return "Webhook name is required";
        if (!f.url?.trim()) return "Webhook URL is required";
        if (!/^https:\/\//i.test(f.url.trim())) return "Webhook URL must start with https://";
        if (!HTTP_METHODS.includes(f.method)) return "Invalid HTTP method";
        if (!f.timeout_ms || Number.isNaN(Number(f.timeout_ms))) return "timeout_ms must be a number";

        if (f.authType === "API_KEY") {
            if (!f.authApikeyHeader?.trim()) return "authApikeyHeader is required";
            if (!f.authApiKeyValue?.trim()) return "authApiKeyValue is required";
        }
        if (f.authType === "BASIC") {
            if (!f.authUsername?.trim()) return "authUsername is required";
            if (!f.authPassword?.trim()) return "authPassword is required";
        }
        if (f.authType === "JWT") {
            if (!f.authJwtToken?.trim()) return "authJwtToken is required";
        }

        const fields = f.bodyFields || [];
        if (fields.length === 0) return "Add at least one body field";
        for (const bf of fields) {
            if (!bf.key?.trim()) return "Body field key cannot be empty";
        }

        return "";
    }

    function buildPreviewRequest(f) {
        const headers = { "Content-Type": "application/json" };

        if (f.authType === "API_KEY") {
            headers[f.authApikeyHeader || "Authorization"] = f.authApiKeyValue || "";
        } else if (f.authType === "BASIC") {
            const token = btoa(`${f.authUsername || ""}:${f.authPassword || ""}`);
            headers["Authorization"] = `Basic ${token}`;
        } else if (f.authType === "JWT") {
            headers["Authorization"] = `Bearer ${f.authJwtToken || ""}`;
        }

        const body = {};
        (f.bodyFields || []).forEach((x) => {
            if (!x.key) return;
            body[x.key] = x.value ?? "";
        });

        return { method: f.method, url: f.url, headers, body, timeout_ms: Number(f.timeout_ms || 0) };
    }

    async function onSave() {
        setErr("");
        setMsg("");

        const v = validate(form);
        if (v) {
            setErr(v);
            return;
        }

        setSaving(true);
        try {
            const payload = {
                id: form.id.trim(),
                name: form.name.trim(),
                url: form.url.trim(),
                method: form.method,
                timeout_ms: Number(form.timeout_ms),

                authType: form.authType,
                authApikeyHeader: form.authApikeyHeader,
                authApiKeyValue: form.authApiKeyValue,
                authUsername: form.authUsername,
                authPassword: form.authPassword,
                authJwtToken: form.authJwtToken,

                bodyFields: (form.bodyFields || []).map((x) => ({ key: String(x.key || "").trim(), value: x.value })),
                enabled: Boolean(form.enabled),
                description: form.description || ""
            };

            if (mode === "create") {
                await createWebhookApi(payload);
                setMsg("Created.");
            } else {
                await updateWebhookApi(payload);
                setMsg("Updated.");
            }

            closePanel();
            await refresh();
        } catch (e) {
            setErr(e?.response?.data?.message || e.message || "Save failed");
        } finally {
            setSaving(false);
        }
    }

    async function onDelete(id) {
        const r = rows.find((x) => x.id === id);
        const ok = confirm(`Delete webhook "${r?.name || id}"?`);
        if (!ok) return;

        setErr("");
        setMsg("");
        setSaving(true);
        try {
            await deleteWebhookApi(id);
            setMsg("Deleted.");
            closePanel();
            await refresh();
        } catch (e) {
            setErr(e?.response?.data?.message || e.message || "Delete failed");
        } finally {
            setSaving(false);
        }
    }

    async function onToggleEnabled(r) {
        setErr("");
        setMsg("");
        setSaving(true);
        try {
            // update by sending full payload (API design is PUT with full object)
            await updateWebhookApi({
                id: r.id,
                name: r.name,
                url: r.url,
                method: r.method,
                timeout_ms: Number(r.timeout_ms),

                authType: r.authType || "NONE",
                authApikeyHeader: r.authApikeyHeader || "Authorization",
                authApiKeyValue: r.authApiKeyValue || "",
                authUsername: r.authUsername || "",
                authPassword: r.authPassword || "",
                authJwtToken: r.authJwtToken || "",

                bodyFields: r.bodyFields || [],
                enabled: !r.enabled,
                description: r.description || ""
            });
            setMsg(`Webhook ${!r.enabled ? "enabled" : "disabled"}.`);
            await refresh();
        } catch (e) {
            setErr(e?.response?.data?.message || e.message || "Toggle failed");
        } finally {
            setSaving(false);
        }
    }

    function copyJson(r) {
        navigator.clipboard.writeText(JSON.stringify(r, null, 2));
        setMsg("Copied webhook JSON to clipboard.");
    }

    function copyCurlPreview() {
        const req = buildPreviewRequest(form);
        navigator.clipboard.writeText(
            `curl -X ${req.method} '${req.url}' \\\n` +
            Object.entries(req.headers)
                .map(([k, v]) => `  -H '${k}: ${String(v).replaceAll("'", "'\\''")}' \\`)
                .join("\n") +
            `\n  -d '${JSON.stringify(req.body).replaceAll("'", "'\\''")}'`
        );
        setMsg("Copied curl preview to clipboard.");
    }

    return (
        <div className="whPage">
            <div className="whHeader">
                <div>
                    <div className="whTitle">Webhooks</div>
                    <div className="whSub">Sends REST HTTPS requests on rule execution. Supports API Key, Basic, or JWT auth.</div>
                </div>

                <div className="whHeaderRight">
                    <input
                        className="whSearch"
                        placeholder="Search webhooks"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <button className="btnSecondary" onClick={refresh} disabled={loading || saving}>
                        Refresh
                    </button>
                    <button className="btnPrimary" onClick={openCreate} disabled={saving}>
                        Create Webhook
                    </button>
                </div>
            </div>

            {msg ? <div className="info">{msg}</div> : null}
            {err ? <div className="error">{err}</div> : null}

            <div className="card">
                <div className="cardHead">
                    <div className="cardTitle">Webhook list</div>
                    <div className="cardMeta">{filtered.length} items</div>
                </div>

                {loading ? (
                    <div className="empty">Loading…</div>
                ) : filtered.length === 0 ? (
                    <div className="empty">No webhooks.</div>
                ) : (
                    <table className="table">
                        <thead>
                        <tr>
                            <th>Name</th>
                            <th>URL</th>
                            <th>Auth</th>
                            <th>Enabled</th>
                            <th>Updated</th>
                            <th style={{ width: 270 }}>Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {filtered.map((r) => (
                            <tr
                                key={r.id}
                                className={r.id === selectedId ? "rowActive" : ""}
                                onClick={() => setSelectedId(r.id)}
                            >
                                <td className="nameMain">{r.name}</td>
                                <td className="mono">{r.url}</td>
                                <td>{AUTH_TYPES.find((x) => x.value === r.authType)?.label || r.authType}</td>
                                <td>
                    <span className={`pill ${r.enabled ? "pill--ok" : ""}`}>
                      {r.enabled ? "ENABLED" : "DISABLED"}
                    </span>
                                </td>
                                <td>{formatDate(r.updatedDateTime)}</td>
                                <td>
                                    <div className="actions">
                                        <button
                                            className="iconBtn"
                                            title="View"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openView(r);
                                            }}
                                        >
                                            👁
                                        </button>
                                        <button
                                            className="iconBtn"
                                            title="Edit"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openEdit(r);
                                            }}
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            className={`toggle ${r.enabled ? "toggle--on" : ""}`}
                                            title="Toggle enabled"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleEnabled(r);
                                            }}
                                            disabled={saving}
                                        >
                                            <span className="toggleDot" />
                                        </button>
                                        <button
                                            className="iconBtn"
                                            title="Copy JSON"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                copyJson(r);
                                            }}
                                        >
                                            ⧉
                                        </button>
                                        <button
                                            className="iconBtn iconBtn--danger"
                                            title="Delete"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDelete(r.id);
                                            }}
                                            disabled={saving}
                                        >
                                            🗑
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                )}
            </div>

            {panelOpen ? (
                <div className="card panelCard">
                    <div className="cardHead">
                        <div className="cardTitle">{mode === "create" ? "Create Webhook" : "View / Edit Webhook"}</div>
                        <div className="panelHeadRight">
                            {mode !== "create" ? (
                                <button className="btnDanger" onClick={() => onDelete(form.id)} disabled={saving}>
                                    Delete
                                </button>
                            ) : null}
                            <button className="btnSecondary" onClick={copyCurlPreview} disabled={saving}>
                                Copy curl
                            </button>
                            <button className="btnSecondary" onClick={closePanel} disabled={saving}>
                                Close
                            </button>
                            <button className="btnPrimary" onClick={onSave} disabled={saving}>
                                {saving ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </div>

                    <div className="panelBody">
                        <div className="row2">
                            <label className="field">
                                <span className="label">Webhook id</span>
                                <input
                                    className="input"
                                    value={form.id}
                                    onChange={(e) => setField("id", e.target.value)}
                                    placeholder="webhook-001"
                                    disabled={mode !== "create"}
                                />
                            </label>

                            <label className="field">
                                <span className="label">Webhook name</span>
                                <input
                                    className="input"
                                    value={form.name}
                                    onChange={(e) => setField("name", e.target.value)}
                                    placeholder="Sample Webhook"
                                />
                            </label>
                        </div>

                        <div className="row2">
                            <label className="field">
                                <span className="label">HTTP Method</span>
                                <select className="input" value={form.method} onChange={(e) => setField("method", e.target.value)}>
                                    {HTTP_METHODS.map((m) => (
                                        <option key={m} value={m}>
                                            {m}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="field">
                                <span className="label">Timeout (ms)</span>
                                <input
                                    className="input"
                                    value={form.timeout_ms}
                                    onChange={(e) => setField("timeout_ms", e.target.value)}
                                    inputMode="numeric"
                                />
                            </label>
                        </div>

                        <label className="field">
                            <span className="label">HTTPS URL</span>
                            <input
                                className="input"
                                value={form.url}
                                onChange={(e) => setField("url", e.target.value)}
                                placeholder="https://example.com/webhook"
                            />
                        </label>

                        <label className="field">
                            <span className="label">Auth Type</span>
                            <select className="input" value={form.authType} onChange={(e) => setField("authType", e.target.value)}>
                                {AUTH_TYPES.map((a) => (
                                    <option key={a.value} value={a.value}>
                                        {a.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        {form.authType === "API_KEY" ? (
                            <div className="row2">
                                <label className="field">
                                    <span className="label">authApikeyHeader</span>
                                    <input
                                        className="input"
                                        value={form.authApikeyHeader}
                                        onChange={(e) => setField("authApikeyHeader", e.target.value)}
                                        placeholder="X-API-KEY"
                                    />
                                </label>

                                <label className="field">
                                    <span className="label">authApiKeyValue</span>
                                    <div className="pwRow">
                                        <input
                                            className="input"
                                            value={form.authApiKeyValue}
                                            onChange={(e) => setField("authApiKeyValue", e.target.value)}
                                            type={showSecret ? "text" : "password"}
                                        />
                                        <button
                                            className="btnSecondary"
                                            type="button"
                                            onClick={() => setShowSecret((s) => !s)}
                                            style={{ height: 40 }}
                                        >
                                            {showSecret ? "Hide" : "Show"}
                                        </button>
                                    </div>
                                </label>
                            </div>
                        ) : null}

                        {form.authType === "BASIC" ? (
                            <div className="row2">
                                <label className="field">
                                    <span className="label">authUsername</span>
                                    <input className="input" value={form.authUsername} onChange={(e) => setField("authUsername", e.target.value)} />
                                </label>

                                <label className="field">
                                    <span className="label">authPassword</span>
                                    <div className="pwRow">
                                        <input
                                            className="input"
                                            value={form.authPassword}
                                            onChange={(e) => setField("authPassword", e.target.value)}
                                            type={showSecret ? "text" : "password"}
                                        />
                                        <button
                                            className="btnSecondary"
                                            type="button"
                                            onClick={() => setShowSecret((s) => !s)}
                                            style={{ height: 40 }}
                                        >
                                            {showSecret ? "Hide" : "Show"}
                                        </button>
                                    </div>
                                </label>
                            </div>
                        ) : null}

                        {form.authType === "JWT" ? (
                            <label className="field">
                                <span className="label">authJwtToken</span>
                                <div className="pwRow">
                                    <input
                                        className="input"
                                        value={form.authJwtToken}
                                        onChange={(e) => setField("authJwtToken", e.target.value)}
                                        type={showSecret ? "text" : "password"}
                                    />
                                    <button
                                        className="btnSecondary"
                                        type="button"
                                        onClick={() => setShowSecret((s) => !s)}
                                        style={{ height: 40 }}
                                    >
                                        {showSecret ? "Hide" : "Show"}
                                    </button>
                                </div>
                            </label>
                        ) : null}

                        {/* Body fields */}
                        <div className="bodyFieldsHead">
                            <div className="bodyFieldsTitle">Body fields (JSON)</div>
                            <button className="btnSecondary" type="button" onClick={addBodyField} style={{ height: 36 }}>
                                + Add field
                            </button>
                        </div>

                        <div className="bodyFieldsTable">
                            <div className="bfRow bfRow--head">
                                <div>Key</div>
                                <div>Value</div>
                                <div />
                            </div>

                            {(form.bodyFields || []).map((bf, idx) => (
                                <div key={idx} className="bfRow">
                                    <input
                                        className="input"
                                        value={bf.key}
                                        onChange={(e) => setBodyField(idx, { key: e.target.value })}
                                        placeholder="field1"
                                    />
                                    <input
                                        className="input"
                                        value={bf.value}
                                        onChange={(e) => setBodyField(idx, { value: e.target.value })}
                                        placeholder="value1"
                                    />
                                    <button
                                        className="iconBtn iconBtn--danger"
                                        type="button"
                                        title="Remove"
                                        onClick={() => removeBodyField(idx)}
                                    >
                                        🗑
                                    </button>
                                </div>
                            ))}
                        </div>

                        <label className="checkRow">
                            <input type="checkbox" checked={Boolean(form.enabled)} onChange={(e) => setField("enabled", e.target.checked)} />
                            <span>Enabled</span>
                        </label>

                        <label className="field">
                            <span className="label">Description</span>
                            <textarea
                                className="textarea"
                                rows={3}
                                value={form.description}
                                onChange={(e) => setField("description", e.target.value)}
                            />
                        </label>

                        <div className="envBoxWrap">
                            <div className="envLabel">Request preview</div>
                            <pre className="envBox">{JSON.stringify(buildPreviewRequest(form), null, 2)}</pre>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}