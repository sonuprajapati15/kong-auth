import { useEffect, useMemo, useState } from "react";
import "../css/Rules.css";
import { deleteRuleApi, listRulesApi, updateRuleApi } from "../../../../services/rulesApi";
import { useNavigate } from "react-router-dom";

function formatDate(iso) {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

function mapRow(r) {
    return {
        id: r.id,
        groupId: r.group_id ?? "",
        ruleName: r.rule_name ?? "—",
        priority: r.priority ?? 0,
        logicalOperator: r.logica_Operator ?? r.logical_Operator ?? "AND",
        description: r.description ?? "",
        status: r.status ?? "—",
        version: r.version ?? 0,
        createdAt: r.created_at,
        createdBy: r.created_by,
        updatedAt: r.updated_at,
        updatedBy: r.updated_by,
        raw: r
    };
}

export default function Rules() {
    const nav = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");

    const [rows, setRows] = useState([]);
    const [search, setSearch] = useState("");

    const [selectedId, setSelectedId] = useState(null);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((r) =>
            (r.ruleName || "").toLowerCase().includes(q) ||
            (r.groupId || "").toLowerCase().includes(q) ||
            (r.id || "").toLowerCase().includes(q)
        );
    }, [rows, search]);

    async function refresh() {
        setErr("");
        setLoading(true);
        try {
            const data = await listRulesApi();
            const list = Array.isArray(data) ? data : data?.data ?? [];
            const mapped = list.map(mapRow);
            setRows(mapped);
            setSelectedId((prev) => (mapped.some((x) => x.id === prev) ? prev : null));
        } catch (e) {
            setErr(e?.response?.data?.message || e.message || "Failed to load rules");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        refresh();
    }, []);

    async function onDelete(r) {
        const ok = confirm(`Delete rule "${r.ruleName}"?`);
        if (!ok) return;

        setErr("");
        setSaving(true);
        try {
            await deleteRuleApi(r.id);
            await refresh();
        } catch (e) {
            setErr(e?.response?.data?.message || e.message || "Delete failed");
        } finally {
            setSaving(false);
        }
    }

    async function onToggleStatus(r) {
        setErr("");
        setSaving(true);
        try {
            const next = r.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
            await updateRuleApi({
                ...r.raw,
                status: next
            });
            await refresh();
        } catch (e) {
            setErr(e?.response?.data?.message || e.message || "Status update failed");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="rulesPage">
            <div className="rulesHeader">
                <div>
                    <div className="rulesTitle">Automation Rules</div>
                    <div className="rulesSub">Manage and automate rules based on specific conditions.</div>
                </div>

                <div className="rulesHeaderRight">
                    <input
                        className="rulesSearch"
                        placeholder="Search rule"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />

                    {/* ✅ Create opens Rule Builder page */}
                    <button
                        className="btnPrimary"
                        onClick={() => nav("/home/rules/new")}
                        disabled={loading || saving}
                    >
                        Create Rule
                    </button>
                </div>
            </div>

            {err ? <div className="error">{err}</div> : null}

            <div className="rulesGrid rulesGrid--single">
                <section className="card">
                    <div className="cardHead">
                        <div className="cardTitle">Rules</div>
                        <div className="cardMeta">{filtered.length} items</div>
                    </div>

                    {loading ? (
                        <div className="empty">Loading…</div>
                    ) : filtered.length === 0 ? (
                        <div className="empty">No rules found.</div>
                    ) : (
                        <table className="table">
                            <thead>
                            <tr>
                                <th>Rule</th>
                                <th>Created At</th>
                                <th>Updated At</th>
                                <th>Created By</th>
                                <th>Updated By</th>
                                <th style={{ width: 170 }}>Actions</th>
                            </tr>
                            </thead>
                            <tbody>
                            {filtered.map((r) => (
                                <tr
                                    key={r.id}
                                    className={r.id === selectedId ? "rowActive" : ""}
                                    onClick={() => setSelectedId(r.id)}
                                >
                                    <td>
                                        <div className="ruleCell">
                                            <div className="ruleName">{r.ruleName}</div>
                                            <div className="ruleSub">
                                                (Group {r.groupId}) • Priority {r.priority}
                                            </div>
                                        </div>
                                    </td>
                                    <td>{formatDate(r.createdAt)}</td>
                                    <td>{formatDate(r.updatedAt)}</td>
                                    <td>{r.createdBy || "—"}</td>
                                    <td>{r.updatedBy || "—"}</td>
                                    <td>
                                        <div className="actions">
                                            {/* ✅ View opens same builder page (read/edit as you want) */}
                                            <button
                                                className="iconBtn"
                                                title="View"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    nav(`/home/rules/${r.id}`);
                                                }}
                                            >
                                                👁
                                            </button>

                                            {/* ✅ Edit also opens builder page */}
                                            <button
                                                className="iconBtn"
                                                title="Edit"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    nav(`/home/rules/${r.id}`);
                                                }}
                                            >
                                                ✏️
                                            </button>

                                            <button
                                                className={`toggle ${r.status === "ACTIVE" ? "toggle--on" : ""}`}
                                                title="Toggle status"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onToggleStatus(r);
                                                }}
                                                disabled={saving}
                                            >
                                                <span className="toggleDot" />
                                            </button>

                                            <button
                                                className="iconBtn iconBtn--danger"
                                                title="Delete"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDelete(r);
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

                    <div className="tableFooter">
                        <div className="muted">Showing {filtered.length} rules</div>
                        <button className="btnSecondary" onClick={refresh} disabled={loading || saving}>
                            Refresh
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
}