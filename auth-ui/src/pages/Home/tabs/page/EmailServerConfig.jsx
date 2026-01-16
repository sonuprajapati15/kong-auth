import { useMemo, useState } from "react";
import "../css/EmailServerConfig.css";

const STORAGE_KEY = "smtp_configs_v1";

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
        id: crypto?.randomUUID?.() || `smtp_${Date.now()}`,
        name: "",
        mail_sender: "",
        mail_password: "",
        mail_smtp_server: "",
        mail_smtp_port: "",
        created_at: nowIso(),
        updated_at: nowIso()
    };
}

export default function EmailServerConfig() {
    const [rows, setRows] = useState(() => loadAll());
    const [search, setSearch] = useState("");

    // view | create | edit
    const [mode, setMode] = useState("view");
    const [selectedId, setSelectedId] = useState(null);

    const [msg, setMsg] = useState("");
    const [err, setErr] = useState("");

    const selected = useMemo(
        () => rows.find((r) => r.id === selectedId) || null,
        [rows, selectedId]
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((r) => {
            return (
                (r.name || "").toLowerCase().includes(q) ||
                (r.mail_smtp_server || "").toLowerCase().includes(q) ||
                (r.mail_sender || "").toLowerCase().includes(q));
        });
    }, [rows, search]);

    const panelOpen = mode !== "view";

    const [form, setForm] = useState(makeEmpty());
    const [showPassword, setShowPassword] = useState(false);

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
        setMode("edit"); // we use one panel for view/edit; you can lock fields if needed
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

    function setField(key, value) {
        setForm((p) => ({ ...p, [key]: value }));
    }

    function validate(f) {
        const portOk = String(f.mail_smtp_port || "").trim() !== "" && !Number.isNaN(Number(f.mail_smtp_port));
        if (!f.name?.trim()) return "Config name is required";
        if (!f.mail_sender?.trim()) return "mail_sender is required";
        if (!f.mail_password?.trim()) return "mail_password is required";
        if (!f.mail_smtp_server?.trim()) return "mail_smtp_server is required";
        if (!portOk) return "mail_smtp_port must be a number";
        return "";
    }

    function onSave() {
        setMsg("");
        setErr("");

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

        // edit
        const updated = rows.map((r) => (r.id === next.id ? next : r));
        setRows(updated);
        saveAll(updated);
        setMsg("Updated.");
        closePanel();
    }

    function onDelete(id) {
        const r = rows.find((x) => x.id === id);
        const ok = confirm(`Delete SMTP config "${r?.name || id}"?`);
        if (!ok) return;

        setErr("");
        setMsg("");

        const updated = rows.filter((x) => x.id !== id);
        setRows(updated);
        saveAll(updated);

        if (selectedId === id) closePanel();
        setMsg("Deleted.");
    }

    function copyEnv(r) {
        const envText =
            `mail_sender=${r.mail_sender}\n` +
            `mail_password=${r.mail_password}\n` +
            `mail_smtp_server=${r.mail_smtp_server}\n` +
            `mail_smtp_port=${r.mail_smtp_port}\n`;

        navigator.clipboard.writeText(envText);
        setMsg("Copied .env values to clipboard.");
    }

    return (
        <div className="escPage">
            <div className="escHeader">
                <div>
                    <div className="escTitle">SMTP Servers</div>
                    <div className="escSub">Manage SMTP configs. View/Edit shows the form below. Delete is available.</div>
                </div>

                <div className="escHeaderRight">
                    <input
                        className="escSearch"
                        placeholder="Search SMTP server"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <button className="btnPrimary" onClick={openCreate}>
                        Create SMTP
                    </button>
                </div>
            </div>

            {msg ? <div className="info">{msg}</div> : null}
            {err ? <div className="error">{err}</div> : null}

            <div className="card">
                <div className="cardHead">
                    <div className="cardTitle">SMTP list</div>
                    <div className="cardMeta">{filtered.length} items</div>
                </div>

                {filtered.length === 0 ? (
                    <div className="empty">No SMTP servers.</div>
                ) : (
                    <table className="table">
                        <thead>
                        <tr>
                            <th>Name</th>
                            <th>SMTP Server</th>
                            <th>Port</th>
                            <th>Sender</th>
                            <th>Recipient</th>
                            <th>Updated</th>
                            <th style={{ width: 190 }}>Actions</th>
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
                                <td>{r.mail_smtp_server}</td>
                                <td>{r.mail_smtp_port}</td>
                                <td>{r.mail_sender}</td>
                                <td>{r.MAIL_RECIPIENT}</td>
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
                                            className="iconBtn"
                                            title="Copy .env"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                copyEnv(r);
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

            {/* Panel/form visible on view/edit/create */}
            {panelOpen ? (
                <div className="card panelCard">
                    <div className="cardHead">
                        <div className="cardTitle">{mode === "create" ? "Create SMTP Config" : "View / Edit SMTP Config"}</div>
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
                            <span className="label">Config name</span>
                            <input className="input" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Gmail Prod" />
                        </label>

                        <label className="field">
                            <span className="label">mail_sender</span>
                            <input
                                className="input"
                                value={form.mail_sender}
                                onChange={(e) => setField("mail_sender", e.target.value)}
                                placeholder="sender@example.com"
                                type="email"
                            />
                        </label>

                        <label className="field">
                            <span className="label">mail_password</span>
                            <div className="pwRow">
                                <input
                                    className="input"
                                    value={form.mail_password}
                                    onChange={(e) => setField("mail_password", e.target.value)}
                                    placeholder="smtp/app password"
                                    type={showPassword ? "text" : "password"}
                                />
                                <button className="btnSecondary" type="button" onClick={() => setShowPassword((s) => !s)} style={{ height: 40 }}>
                                    {showPassword ? "Hide" : "Show"}
                                </button>
                            </div>
                        </label>

                        <div className="row2">
                            <label className="field">
                                <span className="label">mail_smtp_server</span>
                                <input
                                    className="input"
                                    value={form.mail_smtp_server}
                                    onChange={(e) => setField("mail_smtp_server", e.target.value)}
                                    placeholder="smtp.gmail.com"
                                />
                            </label>

                            <label className="field">
                                <span className="label">mail_smtp_port</span>
                                <input
                                    className="input"
                                    value={form.mail_smtp_port}
                                    onChange={(e) => setField("mail_smtp_port", e.target.value)}
                                    placeholder="587"
                                    inputMode="numeric"
                                />
                            </label>
                        </div>

                        <label className="field">
                            <span className="label">MAIL_RECIPIENT</span>
                            <input
                                className="input"
                                value={form.MAIL_RECIPIENT}
                                onChange={(e) => setField("MAIL_RECIPIENT", e.target.value)}
                                placeholder="alerts@example.com"
                                type="email"
                            />
                        </label>

                        <div className="envBoxWrap">
                            <div className="envLabel">Preview (.env format)</div>
                            <pre className="envBox">
                            {`mail_sender=${form.mail_sender}`}<br/>
                                {`mail_password=${form.mail_password}`}<br/>
                                {`mail_smtp_server=${form.mail_smtp_server}`}<br/>
                                {`mail_smtp_port=${form.mail_smtp_port}`}
                        </pre>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}