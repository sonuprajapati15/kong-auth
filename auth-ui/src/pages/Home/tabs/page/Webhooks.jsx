import { useMemo, useState } from "react";
import "../css/Webhooks.css";

const STORAGE_KEY = "webhooks_v1";

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
        secret: "",
        events: ["rule.created"],
        enabled: true,
        description: "",
        created_at: nowIso(),
        updated_at: nowIso()
    };
}

export default function Webhooks() {
    const [rows, setRows] = useState(() => loadAll());
    const [search, setSearch] = useState("");

    // view | create | edit
    const [mode, setMode] = useState("view");
    const panelOpen = mode !== "view";

    const [selectedId, setSelectedId] = useState(null);
    const selected = useMemo(() => rows.find((r) => r.id === selectedId) || null, [rows, selectedId]);

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
        setMode("edit");
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
        if (!/^https?:\/\//i.test(f.url.trim())) return "Webhook URL must start with http:// or https://";
        if (!Array.isArray(f.events) || f.events.length === 0) return "Select at least one event";
        return "";
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

    function copyWebhook(r) {
        const text =
            `WEBHOOK_NAME=${r.name}\n` +
            `WEBHOOK_URL=${r.url}\n` +
            `WEBHOOK_SECRET=${r.secret}\n` +
            `WEBHOOK_EVENTS=${(r.events || []).join(",")}\n` +
            `WEBHOOK_ENABLED=${String(r.enabled)}\n`;
        navigator.clipboard.writeText(text);
        setMsg("Copied webhook config to clipboard.");
    }

    return (
        <div className="whPage">
            <div className="whHeader">
                <div>
                    <div className="whTitle">Webhooks</div>
                    <div className="whSub">Create webhooks to send events to external systems.</div>
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
                            <th>Events</th>
                            <th>Status</th>
                            <th>Updated</th>
                            <th style={{ width: 240 }}>Actions</th>
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
                                <td>{(r.events || []).join(", ")}</td>
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
                                            title="Copy"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                copyWebhook(r);
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
                            <button className="btnSecondary" onClick={closePanel}>
                                Close
                            </button>
                            <button className="btnPrimary" onClick={onSave}>
                                Save
                            </button>
                        </div>
                    </div>

                    <div className="panelBody">
                        <label className="field">
                            <span className="label">Webhook name</span>
                            <input className="input" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Rule Events" />
                        </label>

                        <label className="field">
                            <span className="label">Webhook URL</span>
                            <input className="input" value={form.url} onChange={(e) => setField("url", e.target.value)} placeholder="https://example.com/webhook" />
                        </label>

                        <label className="field">
                            <span className="label">Secret (optional)</span>
                            <div className="pwRow">
                                <input
                                    className="input"
                                    value={form.secret}
                                    onChange={(e) => setField("secret", e.target.value)}
                                    placeholder="shared secret"
                                    type={showSecret ? "text" : "password"}
                                />
                                <button className="btnSecondary" type="button" onClick={() => setShowSecret((s) => !s)} style={{ height: 40 }}>
                                    {showSecret ? "Hide" : "Show"}
                                </button>
                            </div>
                        </label>

                        <label className="field">
                            <span className="label">Events</span>
                            <div className="checkGrid">
                                {["rule.created", "rule.updated", "rule.deleted", "group.created", "group.updated"].map((ev) => {
                                    const checked = (form.events || []).includes(ev);
                                    return (
                                        <label key={ev} className="checkRow">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={(e) => {
                                                    const on = e.target.checked;
                                                    setField(
                                                        "events",
                                                        on
                                                            ? [...(form.events || []), ev]
                                                            : (form.events || []).filter((x) => x !== ev)
                                                    );
                                                }}
                                            />
                                            <span>{ev}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </label>

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
                                rows={4}
                                value={form.description}
                                onChange={(e) => setField("description", e.target.value)}
                                placeholder="What this webhook is used for"
                            />
                        </label>

                        <div className="envBoxWrap">
                            <div className="envLabel">Preview</div>
                            <pre className="envBox">{JSON.stringify(form, null, 2)}</pre>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}