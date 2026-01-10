import { useEffect, useMemo, useState } from "react";
import "../css/Groups.css";
import {
    createGroupApi,
    deleteGroupApi,
    listGroupsApi,
    updateGroupRulesApi
} from "../../../../services/groupApi.js";

function buildTree(groups) {
    const byId = new Map(groups.map((g) => [g.id, { ...g, children: [] }]));
    const roots = [];

    for (const g of byId.values()) {
        const pid = g.parent_group_id ?? g.parentGroupId ?? null;
        if (!pid) {
            roots.push(g);
        } else {
            const parent = byId.get(pid);
            if (parent) parent.children.push(g);
            else roots.push(g); // fallback if parent missing
        }
    }

    // sort optional
    roots.sort((a, b) => String(a.group_name ?? a.groupName).localeCompare(String(b.group_name ?? b.groupName)));
    for (const r of roots) {
        r.children.sort((a, b) => String(a.group_name ?? a.groupName).localeCompare(String(b.group_name ?? b.groupName)));
    }

    return roots;
}

function groupName(g) {
    return g?.group_name ?? g?.groupName ?? "—";
}

export default function Groups() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");

    const [rawGroups, setRawGroups] = useState([]);
    const tree = useMemo(() => buildTree(rawGroups), [rawGroups]);

    const [selectedGroupId, setSelectedGroupId] = useState(null);

    const selectedGroup = useMemo(
        () => rawGroups.find((g) => g.id === selectedGroupId) || null,
        [rawGroups, selectedGroupId]
    );

    // right-side form
    const [panelMode, setPanelMode] = useState("view"); // view | createParent | createChild | editRules
    const panelOpen = panelMode !== "view";

    const [newGroupName, setNewGroupName] = useState("");
    const [rulesText, setRulesText] = useState(""); // comma-separated rule ids

    async function refresh() {
        setErr("");
        setLoading(true);
        try {
            const data = await listGroupsApi();
            const list = Array.isArray(data) ? data : data?.data ?? [];
            setRawGroups(list);

            // auto select first root
            if (!selectedGroupId && list.length) {
                setSelectedGroupId(list[0].id);
            }
        } catch (e) {
            setErr(e?.response?.data?.message || e.message || "Failed to load groups");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function openCreateParent() {
        setPanelMode("createParent");
        setNewGroupName("");
    }

    function openCreateChild() {
        if (!selectedGroupId) return;
        setPanelMode("createChild");
        setNewGroupName("");
    }

    function openEditRules() {
        if (!selectedGroup) return;
        setPanelMode("editRules");
        const ids = selectedGroup.rules_ids ?? selectedGroup.rulesIds ?? [];
        setRulesText(Array.isArray(ids) ? ids.join(", ") : "");
    }

    function closePanel() {
        setPanelMode("view");
        setNewGroupName("");
        setRulesText("");
        setErr("");
    }

    async function onCreate() {
        setErr("");
        setSaving(true);
        try {
            if (!newGroupName.trim()) throw new Error("Group name is required");

            if (panelMode === "createParent") {
                await createGroupApi({ group_name: newGroupName.trim() });
            } else if (panelMode === "createChild") {
                // child group must be attached to selected parent.
                // If selected group is itself a child, you might want to attach to its parent instead — confirm desired behavior.
                await createGroupApi({
                    group_name: newGroupName.trim(),
                    parent_group_id: selectedGroupId
                });
            }

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
            if (!selectedGroupId) throw new Error("Select a group first");

            const payload = {
                id: selectedGroupId,
                groupName: groupName(selectedGroup),
                rules_ids: rulesText
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
            };

            await updateGroupRulesApi(payload);
            await refresh();
            closePanel();
        } catch (e) {
            setErr(e?.response?.data?.message || e.message || "Update failed");
        } finally {
            setSaving(false);
        }
    }

    async function onDeleteGroup() {
        if (!selectedGroupId) return;
        const ok = confirm("Delete this group?");
        if (!ok) return;

        setErr("");
        setSaving(true);
        try {
            await deleteGroupApi(selectedGroupId);
            setSelectedGroupId(null);
            await refresh();
        } catch (e) {
            setErr(e?.response?.data?.message || e.message || "Delete failed");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="grPage">
            {/* LEFT: group tree */}
            <aside className="grLeft">
                <div className="grLeftHead">
                    <div className="grLeftTitle">Groups</div>
                    <button className="btnPrimary" onClick={openCreateParent} disabled={loading || saving}>
                        + Create
                    </button>
                </div>

                {loading ? (
                    <div className="empty">Loading…</div>
                ) : (
                    <div className="tree">
                        {tree.map((p) => (
                            <div key={p.id} className="treeBlock">
                                <button
                                    className={`treeItem ${p.id === selectedGroupId ? "treeItem--active" : ""}`}
                                    onClick={() => setSelectedGroupId(p.id)}
                                >
                                    <div className="treeItem__name">{groupName(p)}</div>
                                    <div className="treeItem__sub">Parent</div>
                                </button>

                                {p.children?.length ? (
                                    <div className="treeChildren">
                                        {p.children.map((c) => (
                                            <button
                                                key={c.id}
                                                className={`treeItem treeItem--child ${c.id === selectedGroupId ? "treeItem--active" : ""}`}
                                                onClick={() => setSelectedGroupId(c.id)}
                                            >
                                                <div className="treeItem__name">{groupName(c)}</div>
                                                <div className="treeItem__sub">Child</div>
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        ))}
                    </div>
                )}

                <div className="grLeftFooter">
                    <button className="btnSecondary" onClick={refresh} disabled={loading || saving}>
                        Refresh
                    </button>
                </div>
            </aside>

            {/* RIGHT: rules + actions */}
            <section className="grRight">
                <div className="grHeader">
                    <div>
                        <div className="crumb">Rules</div>
                        <div className="title">Group: {groupName(selectedGroup)}</div>
                        <div className="subtitle">
                            {selectedGroup?.parent_group_id ? "Child group" : "Parent group"} • ID:{" "}
                            <span className="mono">{selectedGroup?.id || "—"}</span>
                        </div>
                    </div>

                    <div className="grHeaderRight">
                        <button className="btnSecondary" onClick={openCreateChild} disabled={loading || saving || !selectedGroupId}>
                            + Add child
                        </button>
                        <button className="btnSecondary" onClick={openEditRules} disabled={loading || saving || !selectedGroupId}>
                            Edit rules
                        </button>
                        <button className="btnDanger" onClick={onDeleteGroup} disabled={loading || saving || !selectedGroupId}>
                            Delete
                        </button>
                    </div>
                </div>

                {err ? <div className="error">{err}</div> : null}

                <div className={`grGrid ${panelOpen ? "" : "grGrid--single"}`}>
                    {/* Rules list */}
                    <div className="card">
                        <div className="cardHead">
                            <div className="cardTitle">Rules attached</div>
                            <div className="cardMeta">
                                {(selectedGroup?.rules_ids?.length ?? selectedGroup?.rulesIds?.length ?? 0) || 0} rules
                            </div>
                        </div>

                        <div className="list">
                            {(selectedGroup?.rules_ids ?? selectedGroup?.rulesIds ?? []).length === 0 ? (
                                <div className="empty">No rules ids attached yet.</div>
                            ) : (
                                (selectedGroup?.rules_ids ?? selectedGroup?.rulesIds ?? []).map((rid) => (
                                    <div key={rid} className="listItem">
                                        <div className="mono">{rid}</div>
                                        <span className="pill">Rule</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Panel (create child / create parent / edit rules) */}
                    {panelOpen ? (
                        <aside className="card">
                            <div className="cardHead">
                                <div className="cardTitle">
                                    {panelMode === "createParent"
                                        ? "Create parent group"
                                        : panelMode === "createChild"
                                            ? "Create child group"
                                            : "Update rules"}
                                </div>
                                <button className="btnSecondary" onClick={closePanel} disabled={saving}>
                                    Close
                                </button>
                            </div>

                            <div className="panelBody">
                                {panelMode === "editRules" ? (
                                    <>
                                        <label className="field">
                                            <span className="label">Rules IDs (comma separated)</span>
                                            <textarea
                                                className="textarea"
                                                rows={6}
                                                value={rulesText}
                                                onChange={(e) => setRulesText(e.target.value)}
                                                placeholder="ruleId1, ruleId2, ruleId3"
                                            />
                                        </label>

                                        <button className="btnPrimary" onClick={onUpdateRules} disabled={saving}>
                                            {saving ? "Updating..." : "Update"}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <label className="field">
                                            <span className="label">Group name</span>
                                            <input
                                                className="input"
                                                value={newGroupName}
                                                onChange={(e) => setNewGroupName(e.target.value)}
                                                placeholder="Main Group"
                                            />
                                        </label>

                                        <button className="btnPrimary" onClick={onCreate} disabled={saving}>
                                            {saving ? "Creating..." : "Create"}
                                        </button>
                                    </>
                                )}
                            </div>
                        </aside>
                    ) : null}
                </div>
            </section>
        </div>
    );
}