import {useEffect, useMemo, useState} from "react";
import "../css/Groups.css";
import {createGroupApi, deleteGroupApi, listGroupsApi, updateGroupApi} from "../../../../services/groupApi";
import { useNavigate } from "react-router-dom";

function formatDate(iso) {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

function isParent(g) {
    // API doesn't include parent_group_id in sample GET response,
    // so we infer parent if depth === 0 OR if there are child ids.
    return g.depth === 0;
}

export default function Groups() {
    const nav = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");

    const [groups, setGroups] = useState([]);
    const [search, setSearch] = useState("");

    const [panelMode, setPanelMode] = useState("view"); // view | create | editRules | viewDetails
    const panelOpen = panelMode !== "view";

    const [selectedId, setSelectedId] = useState(null);
    const selected = useMemo(() => groups.find((g) => g.id === selectedId) || null, [groups, selectedId]);

    // create form
    const [newName, setNewName] = useState("");
    const [newParentId, setNewParentId] = useState(""); // optional

    // edit rules form
    const [rulesText, setRulesText] = useState("");

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return groups;
        return groups.filter((g) => (g.group_name || "").toLowerCase().includes(q) || (g.id || "").toLowerCase().includes(q));
    }, [groups, search]);

    async function refresh() {
        setErr("");
        setLoading(true);
        try {
            const data = await listGroupsApi();
            const list = Array.isArray(data) ? data : data?.data ?? [];
            setGroups(list);
            setSelectedId((prev) => (list.some((x) => x.id === prev) ? prev : null));
        } catch (e) {
            setErr(e?.response?.data?.message || e.message || "Failed to load groups");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        refresh();
    }, []);

    function closePanel() {
        setPanelMode("view");
        setSelectedId(null);
        setNewName("");
        setNewParentId("");
        setRulesText("");
        setErr("");
    }

    function openCreate() {
        setPanelMode("create");
        setSelectedId(null);
        setNewName("");
        setNewParentId("");
    }

    function openDetails(g) {
        setSelectedId(g.id);
        setPanelMode("viewDetails");
    }

    function openEditRules(g) {
        setSelectedId(g.id);
        setPanelMode("editRules");
        setRulesText((g.rules_ids || []).join(", "));
    }

    async function onCreate() {
        setErr("");
        setSaving(true);
        try {
            if (!newName.trim()) {
                throw new Error("Group name is required");
            }
            const payload = {group_name: newName.trim()};
            if (newParentId.trim()) payload.parent_group_id = newParentId.trim();

            await createGroupApi(payload);
            await refresh();
            closePanel();
        } catch (e) {
            setErr(e?.response?.data?.message || e.message || "Create failed");
        } finally {
            setSaving(false);
        }
    }

    async function onUpdateRules() {
        setErr("");
        setSaving(true);
        try {
            if (!selected) throw new Error("Select a group");
            await updateGroupApi({
                id: selected.id,
                groupName: selected.group_name, // backend expects groupName
                rules_ids: rulesText
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
            });
            await refresh();
            closePanel();
        } catch (e) {
            setErr(e?.response?.data?.message || e.message || "Update failed");
        } finally {
            setSaving(false);
        }
    }

    async function onDelete(g) {
        const ok = confirm(`Delete group "${g.group_name}"?`);
        if (!ok) return;

        setErr("");
        setSaving(true);
        try {
            await deleteGroupApi(g.id);
            await refresh();
            closePanel();
        } catch (e) {
            setErr(e?.response?.data?.message || e.message || "Delete failed");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="agPage">
            <div className="agHeader">
                <div>
                    <div className="agCrumb">Incident Management &nbsp;›&nbsp;Groups</div>
                    <div className="agTitle" style={{paddingTop: "20px"}}>Groups</div>
                </div>

                <div className="agHeaderRight">
                    <input
                        className="agSearch"
                        placeholder="Search Group"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <button className="btnPrimary" onClick={openCreate} disabled={loading || saving}>
                        Create Group
                    </button>
                </div>
            </div>

            {err ? <div className="error">{err}</div> : null}

            <div className={`agGrid ${panelOpen ? "" : "agGrid--single"}`}>
                <section className="card">
                    <div className="cardHead">
                        <div className="cardTitle">All Groups</div>
                        <div className="cardMeta">{filtered.length} items</div>
                    </div>

                    {loading ? (
                        <div className="empty">Loading…</div>
                    ) : filtered.length === 0 ? (
                        <div className="empty">No groups found.</div>
                    ) : (
                        <table className="table">
                            <thead>
                            <tr>
                                <th>Name</th>
                                <th>Group ID</th>
                                <th>Created At</th>
                                <th>Updated At</th>
                                <th>Child Groups</th>
                                <th>Rules</th>
                                <th style={{width: 170}}>Actions</th>
                            </tr>
                            </thead>
                            <tbody>
                            {filtered.map((g) => (
                                <tr key={g.id} className={g.id === selectedId ? "rowActive" : ""}
                                    onClick={() => setSelectedId(g.id)}>
                                    <td>
                                        <div className="nameCell">
                                            <div className="nameMain">{g.group_name}</div>
                                            <div className="nameSub">{isParent(g) ? "Parent" : `Depth ${g.depth}`}</div>
                                        </div>
                                    </td>
                                    <td className="mono">{g.id}</td>
                                    <td>{formatDate(g.created_at)}</td>
                                    <td>{formatDate(g.updated_at)}</td>
                                    <td>{(g.child_group_ids || []).length}</td>
                                    <td>{(g.rules_ids || []).length}</td>
                                    <td>
                                        <div className="actions">
                                            <button
                                                className="iconBtn"
                                                title="View"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    nav(`/home/groupDetails/${g.id}`);
                                                }}
                                            >
                                                👁
                                            </button>
                                            <button
                                                className="iconBtn iconBtn--danger"
                                                title="Delete"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDelete(g);
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

                    <div className="tableFooter">
                        <div className="muted">Showing {filtered.length} groups</div>
                        <button className="btnSecondary" onClick={refresh} disabled={loading || saving}>
                            Refresh
                        </button>
                    </div>
                </section>

                {panelOpen ? (
                    <aside className="card">
                        <div className="cardHead">
                            <div className="cardTitle">
                                {panelMode === "create" ? "Create Group" : panelMode === "editRules" ? "Edit Rules" : "Group Details"}
                            </div>
                            <button className="btnSecondary" onClick={closePanel} disabled={saving}>
                                Close
                            </button>
                        </div>

                        <div className="panelBody">
                            {panelMode === "create" ? (
                                <>
                                    <label className="field">
                                        <span className="label">Group name</span>
                                        <input className="input" value={newName}
                                               onChange={(e) => setNewName(e.target.value)}/>
                                    </label>
                                    <button className="btnPrimary" onClick={onCreate} disabled={saving}>
                                        {saving ? "Creating..." : "Create"}
                                    </button>
                                </>
                            ) : null}

                            {panelMode === "editRules" ? (
                                <>
                                    <div className="muted">
                                        Updating rules for: <b>{selected?.group_name}</b>
                                    </div>

                                    <label className="field">
                                        <span className="label">rules_ids (comma separated)</span>
                                        <textarea
                                            className="textarea"
                                            rows={8}
                                            value={rulesText}
                                            onChange={(e) => setRulesText(e.target.value)}
                                            placeholder="ruleId1, ruleId2"
                                        />
                                    </label>

                                    <button className="btnPrimary" onClick={onUpdateRules} disabled={saving}>
                                        {saving ? "Updating..." : "Update"}
                                    </button>
                                </>
                            ) : null}

                            {panelMode === "viewDetails" ? (
                                <div className="details">
                                    <div><b>Name:</b> {selected?.group_name}</div>
                                    <div><b>ID:</b> <span className="mono">{selected?.id}</span></div>
                                    <div><b>Created:</b> {formatDate(selected?.created_at)} by {selected?.created_by}
                                    </div>
                                    <div><b>Updated:</b> {formatDate(selected?.updated_at)} by {selected?.updated_by}
                                    </div>
                                    <div><b>Depth:</b> {selected?.depth}</div>
                                    <div><b>Child groups:</b> {(selected?.child_group_ids || []).length}</div>
                                    <div><b>Rules:</b> {(selected?.rules_ids || []).length}</div>

                                    <div className="detailsList">
                                        {(selected?.rules_names || []).length ? (
                                            selected.rules_names.map((n) => <div key={n} className="pill">{n}</div>)
                                        ) : (
                                            <div className="muted">No rule names</div>
                                        )}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </aside>
                ) : null}
            </div>
        </div>
    );
}