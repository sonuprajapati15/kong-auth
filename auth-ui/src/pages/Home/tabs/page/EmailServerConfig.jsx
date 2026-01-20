import { useEffect, useMemo, useState } from "react";
import "../css/EmailServerConfig.css";
import {
    createSmtpConfigApi,
    deleteSmtpConfigApi,
    listSmtpConfigsApi,
    updateSmtpConfigApi
} from "../../../../services/smtp.js";

function nowLocal(iso) {
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
        config_name: "",
        mail_host: "",
        mail_port: "",
        mail_username: "",
        mail_app_password: ""
    };
}

function mapRow(x) {
    return {
        id: x.id,
        config_name: x.config_name,
        mail_host: x.mail_host,
        mail_port: x.mail_port,
        mail_username: x.mail_username,
        mail_app_password: x.mail_app_password,
        created_at: x.created_at,
        updated_at: x.updated_at
    };
}

export default function EmailServerConfig() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [rows, setRows] = useState([]);
    const [search, setSearch] = useState("");

    // view | create | edit
    const [mode, setMode] = useState("view");
    const [selectedId, setSelectedId] = useState(null);

    const [msg, setMsg] = useState("");
    const [err, setErr] = useState("");

    const panelOpen = mode !== "view";

    const [form, setForm] = useState(makeEmpty());
    const [showPassword, setShowPassword] = useState(false);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((r) => {
            return (
                (r.config_name || "").toLowerCase().includes(q) ||
                (r.mail_host || "").toLowerCase().includes(q) ||
                (r.mail_username || "").toLowerCase().includes(q)
            );
        });
    }, [rows, search]);

    async function refresh() {
        setErr("");
        setMsg("");
        setLoading(true);
        try {
            const data = await listSmtpConfigsApi();
            const list = Array.isArray(data) ? data : data?.data ?? [];
            const mapped = list.map(mapRow);
            setRows(mapped);

            // keep selection if exists
            setSelectedId((prev) => (mapped.some((x) => x.id === prev) ? prev : null));
        } catch (e) {
            setErr(e?.response?.data?.message || e.message || "Failed to load SMTP configs");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        refresh();
    }, []);

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
        setMode("edit"); // same form for view/edit
        setSelectedId(r.id);
        setForm({
            id: r.id,
            config_name: r.config_name || "",
            mail_host: r.mail_host || "",
            mail_port: r.mail_port ?? "",
            mail_username: r.mail_username || "",
            mail_app_password: r.mail_app_password || ""
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

    function setField(key, value) {
        setForm((p) => ({ ...p, [key]: value }));
    }

    function validate(f) {
        const portOk = String(f.mail_port || "").trim() !== "" && !Number.isNaN(Number(f.mail_port));
        if (!f.config_name?.trim()) return "config_name is required";
        if (!f.mail_host?.trim()) return "mail_host is required";
        if (!portOk) return "mail_port must be a number";
        if (!f.mail_username?.trim()) return "mail_username is required";
        if (!f.mail_app_password?.trim()) return "mail_app_password is required";
        return "";
    }

    async function onSave() {
        setMsg("");
        setErr("");

        const v = validate(form);
        if (v) {
            setErr(v);
            return;
        }

        setSaving(true);
        try {
            const payload = {
                config_name: form.config_name.trim(),
                mail_host: form.mail_host.trim(),
                mail_port: Number(form.mail_port),
                mail_username: form.mail_username.trim(),
                mail_app_password: form.mail_app_password
            };

            if (mode === "create") {
                await createSmtpConfigApi(payload);
                setMsg("Created.");
            } else {
                if (!form.id) throw new Error("Missing id for update");
                await updateSmtpConfigApi({ id: form.id, ...payload });
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
        const ok = confirm(`Delete SMTP config "${r?.config_name || id}"?`);
        if (!ok) return;

        setErr("");
        setMsg("");
        setSaving(true);
        try {
            await deleteSmtpConfigApi(id);
            setMsg("Deleted.");
            closePanel();
            await refresh();
        } catch (e) {
            setErr(e?.response?.data?.message || e.message || "Delete failed");
        } finally {
            setSaving(false);
        }
    }

    function copyEnv(r) {
        const envText =
            `MAIL_HOST=${r.mail_host}\n` +
            `MAIL_PORT=${r.mail_port}\n` +
            `MAIL_USERNAME=${r.mail_username}\n` +
            `MAIL_APP_PASSWORD=${r.mail_app_password}\n`;

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
                    <button className="btnSecondary" onClick={refresh} disabled={loading || saving}>
                        Refresh
                    </button>
                    <button className="btnPrimary" onClick={openCreate} disabled={saving}>
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

                {loading ? (
                    <div className="empty">Loading…</div>
                ) : filtered.length === 0 ? (
                    <div className="empty">No SMTP servers.</div>
                ) : (
                    <table className="table">
                        <thead>
                        <tr>
                            <th>Name</th>
                            <th>SMTP Host</th>
                            <th>Port</th>
                            <th>Username</th>
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
                                <td className="nameMain">{r.config_name}</td>
                                <td>{r.mail_host}</td>
                                <td>{r.mail_port}</td>
                                <td>{r.mail_username}</td>
                                <td>{nowLocal(r.updated_at)}</td>
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

            {/* Panel/form visible on view/edit/create */}
            {panelOpen ? (
                <div className="card panelCard">
                    <div className="cardHead">
                        <div className="cardTitle">{mode === "create" ? "Create SMTP Config" : "View / Edit SMTP Config"}</div>
                        <div className="panelHeadRight">
                            {mode !== "create" ? (
                                <button className="btnDanger" onClick={() => onDelete(form.id)} disabled={saving}>
                                    Delete
                                </button>
                            ) : null}
                            <button className="btnSecondary" onClick={closePanel} disabled={saving}>
                                Close
                            </button>
                            <button className="btnPrimary" onClick={onSave} disabled={saving}>
                                {saving ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </div>

                    <div className="panelBody">
                        <label className="field">
                            <span className="label">config_name</span>
                            <input
                                className="input"
                                value={form.config_name}
                                onChange={(e) => setField("config_name", e.target.value)}
                                placeholder="Default SMTP Config"
                            />
                        </label>

                        <div className="row2">
                            <label className="field">
                                <span className="label">mail_host</span>
                                <input
                                    className="input"
                                    value={form.mail_host}
                                    onChange={(e) => setField("mail_host", e.target.value)}
                                    placeholder="smtp.example.com"
                                />
                            </label>

                            <label className="field">
                                <span className="label">mail_port</span>
                                <input
                                    className="input"
                                    value={form.mail_port}
                                    onChange={(e) => setField("mail_port", e.target.value)}
                                    placeholder="587"
                                    inputMode="numeric"
                                />
                            </label>
                        </div>

                        <label className="field">
                            <span className="label">mail_username</span>
                            <input
                                className="input"
                                value={form.mail_username}
                                onChange={(e) => setField("mail_username", e.target.value)}
                                placeholder="user@example.com"
                                type="email"
                            />
                        </label>

                        <label className="field">
                            <span className="label">mail_app_password</span>
                            <div className="pwRow">
                                <input
                                    className="input"
                                    value={form.mail_app_password}
                                    onChange={(e) => setField("mail_app_password", e.target.value)}
                                    placeholder="your_app_password"
                                    type={showPassword ? "text" : "password"}
                                />
                                <button
                                    className="btnSecondary"
                                    type="button"
                                    onClick={() => setShowPassword((s) => !s)}
                                    style={{ height: 40 }}
                                    disabled={saving}
                                >
                                    {showPassword ? "Hide" : "Show"}
                                </button>
                            </div>
                        </label>

                        <div className="envBoxWrap">
                            <div className="envLabel">Preview (.env format)</div>
                            <pre className="envBox">{`MAIL_HOST=${form.mail_host}
MAIL_PORT=${form.mail_port}
MAIL_USERNAME=${form.mail_username}
MAIL_APP_PASSWORD=${form.mail_app_password}`}</pre>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}