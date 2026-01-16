import { useMemo, useState } from "react";
import "../css/Webhooks.css";

const STORAGE_KEY = "webhooks_v2";

function nowIso() {
    return new Date().toISOString();
}

function loadAll() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveAll(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function makeEmpty() {
    return {
        id: crypto?.randomUUID?.() || `wh_${Date.now()}`,
        name: "",
        url: "",
        method: "POST",
        timeout_ms: 10000,

        auth_type: "NONE", // NONE | API_KEY | BASIC | JWT
        auth_api_key_header: "Authorization",
        auth_api_key_value: "",
        auth_username: "",
        auth_password: "",
        auth_jwt_token: "",

        body_fields: [{ key: "rule_id", value: "{{rule.id}}" }],
        enabled: true,
        description: "",

        created_at: nowIso(),
        updated_at: nowIso()
    };
}

const AUTH_TYPES = [
    { value: "NONE", label: "None" },
    { value: "API_KEY", label: "API Key" },
    { value: "BASIC", label: "Username/Password (Basic)" },
    { value: "JWT", label: "JWT Token" }
];

const HTTP_METHODS = ["POST", "PUT", "PATCH"];

export default function Webhooks() {
    const [rows, setRows] = useState(() => loadAll());
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

    function setField(key, value) {
        setForm((p) => ({ ...p, [key]: value }));
    }

    function setBodyField(idx, patch) {
        setForm((p) => ({
            ...p,
            body_fields: (p.body_fields || []).map((f, i) => (i === idx ? { ...f, ...patch } : f))
        }));
    }

    function addBodyField() {
        setForm((p) => ({
            ...p,
            body_fields: [...(p.body_fields || []), { key: "", value: "" }]
        }));
    }

    function removeBodyField(idx) {
        setForm((p) => ({
            ...p,
            body_fields: (p.body_fields || []).filter((_, i) => i !== idx)
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
        setForm({ ...r });
    }

    function openEdit(r) {
        setErr("");
        setMsg("");
        setMode("edit");
        setSelectedId(r.id);
        setForm({ ...r });
    }

    function closePanel() {
        setMode("view");
        setSelectedId(null);
        setErr("");
    }

    function validate(f) {
        if (!f.name?.trim()) return "Webhook name is required";
        if (!f.url?.trim()) return "Webhook URL is required";
        if (!/^https:\/\//i.test(f.url.trim())) return "Webhook URL must start with https://";
        if (!HTTP_METHODS.includes(f.method)) return "Invalid HTTP method";
        if (!f.timeout_ms || Number.isNaN(Number(f.timeout_ms))) return "Timeout must be a number";

        // auth validation
        if (f.auth_type === "API_KEY") {
            if (!f.auth_api_key_header?.trim()) return "API Key header is required";
            if (!f.auth_api_key_value?.trim()) return "API Key value is required";
        }
        if (f.auth_type === "BASIC") {
            if (!f.auth_username?.trim()) return "Username is required";
            if (!f.auth_password?.trim()) return "Password is required";
        }
        if (f.auth_type === "JWT") {
            if (!f.auth_jwt_token?.trim()) return "JWT token is required";
        }

        // body fields
        const fields = f.body_fields || [];
        if (fields.length === 0) return "Add at least one body field";
        for (const bf of fields) {
            if (!bf.key?.trim()) return "Body field key cannot be empty";
        }

        return "";
    }

    function buildPreviewRequest(f) {
        const headers = { "Content-Type": "application/json" };

        if (f.auth_type === "API_KEY") {
            headers[f.auth_api_key_header || "Authorization"] = f.auth_api_key_value || "";
        } else if (f.auth_type === "BASIC") {
            const token = btoa(`${f.auth_username || ""}:${f.auth_password || ""}`);
            headers["Authorization"] = `Basic ${token}`;
        } else if (f.auth_type === "JWT") {
            headers["Authorization"] = `Bearer ${f.auth_jwt_token || ""}`;
        }

        const body = {};
        (f.body_fields || []).forEach((x) => {
            if (!x.key) return;
            body[x.key] = x.value ?? "";
        });

        return { method: f.method, url: f.url, headers, body, timeout_ms: Number(f.timeout_ms || 0) };
    }

    function onSave() {
        setErr("");
        setMsg("");

        const v = validate(form);
        if (v) {
            setErr(v);
            return;
        }

        const next = { ...form, updated_at: nowIso() };

        if (mode === "create") {
            const updated = [next, ...rows];
            setRows(updated);
            saveAll(updated);
            setMsg("Created.");
            closePanel();
            return;
        }

        const updated = rows.map((r) => (r.id === next.id ? next : r));
        setRows(updated);
        saveAll(updated);
        setMsg("Updated.");
        closePanel();
    }

    function onDelete(id) {
        const r = rows.find((x) => x.id === id);
        const ok = confirm(`Delete webhook "${r?.name || id}"?`);
        if (!ok) return;

        setErr("");
        setMsg("");

        const updated = rows.filter((x) => x.id !== id);
        setRows(updated);
        saveAll(updated);

        if (selectedId === id) closePanel();
        setMsg("Deleted.");
    }

    function onToggleEnabled(r) {
        const next = { ...r, enabled: !r.enabled, updated_at: nowIso() };
        const updated = rows.map((x) => (x.id === r.id ? next : x));
        setRows(updated);
        saveAll(updated);
        setMsg(`Webhook ${next.enabled ? "enabled" : "disabled"}.`);
    }

    function copyJson(r) {
        navigator.clipboard.writeText(JSON.stringify(r, null, 2));
        setMsg("Copied webhook JSON to clipboard.");
    }

    function testRequestPreview() {
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
                    <div className="whSub">
                        Sends REST HTTPS requests on rule execution. Supports API Key, Basic, or JWT auth.
                    </div>
                </div>

                <div className="whHeaderRight">
                    <input
                        className="whSearch"
                        placeholder="Search webhooks"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <button className="btnPrimary" onClick={openCreate}>
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

                {filtered.length === 0 ? (
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
                                <td>{AUTH_TYPES.find((x) => x.value === r.auth_type)?.label || r.auth_type}</td>
                                <td>
                    <span className={`pill ${r.enabled ? "pill--ok" : ""}`}>
                      {r.enabled ? "ENABLED" : "DISABLED"}
                    </span>
                                </td>
                                <td>{new Date(r.updated_at).toLocaleString()}</td>
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

            {/* Form visible on create/edit/view */}
            {panelOpen ? (
                <div className="card panelCard">
                    <div className="cardHead">
                        <div className="cardTitle">{mode === "create" ? "Create Webhook" : "View / Edit Webhook"}</div>
                        <div className="panelHeadRight">
                            {mode !== "create" ? (
                                <button className="btnDanger" onClick={() => onDelete(form.id)}>
                                    Delete
                                </button>
                            ) : null}
                            <button className="btnSecondary" onClick={testRequestPreview}>
                                Copy curl
                            </button>
                            <button className="btnSecondary" onClick={closePanel}>
                                Close
                            </button>
                            <button className="btnPrimary" onClick={onSave}>
                                Save
                            </button>
                        </div>
                    </div>

                    <div className="panelBody">
                        <div className="row2">
                            <label className="field">
                                <span className="label">Webhook name</span>
                                <input
                                    className="input"
                                    value={form.name}
                                    onChange={(e) => setField("name", e.target.value)}
                                    placeholder="Rule Execution Webhook"
                                />
                            </label>

                            <label className="field">
                                <span className="label">HTTP Method</span>
                                <select className="input" value={form.method} onChange={(e) => setField("method", e.target.value)}>
                                    {HTTP_METHODS.map((m) => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
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

                        <div className="row2">
                            <label className="field">
                                <span className="label">Timeout (ms)</span>
                                <input
                                    className="input"
                                    value={form.timeout_ms}
                                    onChange={(e) => setField("timeout_ms", e.target.value)}
                                    inputMode="numeric"
                                />
                            </label>

                            <label className="field">
                                <span className="label">Auth Type</span>
                                <select className="input" value={form.auth_type} onChange={(e) => setField("auth_type", e.target.value)}>
                                    {AUTH_TYPES.map((a) => (
                                        <option key={a.value} value={a.value}>{a.label}</option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        {/* AUTH CONFIG */}
                        {form.auth_type === "API_KEY" ? (
                            <div className="row2">
                                <label className="field">
                                    <span className="label">API Key Header</span>
                                    <input
                                        className="input"
                                        value={form.auth_api_key_header}
                                        onChange={(e) => setField("auth_api_key_header", e.target.value)}
                                        placeholder="Authorization"
                                    />
                                </label>
                                <label className="field">
                                    <span className="label">API Key Value</span>
                                    <div className="pwRow">
                                        <input
                                            className="input"
                                            value={form.auth_api_key_value}
                                            onChange={(e) => setField("auth_api_key_value", e.target.value)}
                                            type={showSecret ? "text" : "password"}
                                            placeholder="ApiKey xxx or Bearer xxx"
                                        />
                                        <button className="btnSecondary" type="button" onClick={() => setShowSecret((s) => !s)} style={{ height: 40 }}>
                                            {showSecret ? "Hide" : "Show"}
                                        </button>
                                    </div>
                                </label>
                            </div>
                        ) : null}

                        {form.auth_type === "BASIC" ? (
                            <div className="row2">
                                <label className="field">
                                    <span className="label">Username</span>
                                    <input
                                        className="input"
                                        value={form.auth_username}
                                        onChange={(e) => setField("auth_username", e.target.value)}
                                        placeholder="username"
                                    />
                                </label>
                                <label className="field">
                                    <span className="label">Password</span>
                                    <div className="pwRow">
                                        <input
                                            className="input"
                                            value={form.auth_password}
                                            onChange={(e) => setField("auth_password", e.target.value)}
                                            type={showSecret ? "text" : "password"}
                                            placeholder="password"
                                        />
                                        <button className="btnSecondary" type="button" onClick={() => setShowSecret((s) => !s)} style={{ height: 40 }}>
                                            {showSecret ? "Hide" : "Show"}
                                        </button>
                                    </div>
                                </label>
                            </div>
                        ) : null}

                        {form.auth_type === "JWT" ? (
                            <label className="field">
                                <span className="label">JWT Token</span>
                                <div className="pwRow">
                                    <input
                                        className="input"
                                        value={form.auth_jwt_token}
                                        onChange={(e) => setField("auth_jwt_token", e.target.value)}
                                        type={showSecret ? "text" : "password"}
                                        placeholder="eyJhbGciOi..."
                                    />
                                    <button className="btnSecondary" type="button" onClick={() => setShowSecret((s) => !s)} style={{ height: 40 }}>
                                        {showSecret ? "Hide" : "Show"}
                                    </button>
                                </div>
                            </label>
                        ) : null}

                        {/* BODY FIELDS */}
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

                            {(form.body_fields || []).map((bf, idx) => (
                                <div key={idx} className="bfRow">
                                    <input
                                        className="input"
                                        value={bf.key}
                                        onChange={(e) => setBodyField(idx, { key: e.target.value })}
                                        placeholder="field_name"
                                    />
                                    <input
                                        className="input"
                                        value={bf.value}
                                        onChange={(e) => setBodyField(idx, { value: e.target.value })}
                                        placeholder='{{rule.id}} or static value'
                                    />
                                    <button className="iconBtn iconBtn--danger" type="button" title="Remove" onClick={() => removeBodyField(idx)}>
                                        🗑
                                    </button>
                                </div>
                            ))}
                        </div>

                        <label className="checkRow">
                            <input
                                type="checkbox"
                                checked={Boolean(form.enabled)}
                                onChange={(e) => setField("enabled", e.target.checked)}
                            />
                            <span>Enabled</span>
                        </label>

                        <label className="field">
                            <span className="label">Description (optional)</span>
                            <textarea
                                className="textarea"
                                rows={3}
                                value={form.description}
                                onChange={(e) => setField("description", e.target.value)}
                                placeholder="What this webhook is used for"
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