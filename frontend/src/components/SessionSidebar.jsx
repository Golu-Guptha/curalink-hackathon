import { useState, useEffect, useRef } from 'react';
import { sessionsAPI, clearToken } from '../services/api.js';

/** Group sessions by date bucket */
function groupByDate(sessions) {
    const now = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);

    const groups = { Today: [], Yesterday: [], 'Last 7 days': [], Older: [] };
    sessions.forEach(s => {
        const d = new Date(s.updatedAt);
        if (d >= today) groups.Today.push(s);
        else if (d >= yesterday) groups.Yesterday.push(s);
        else if (d >= weekAgo) groups['Last 7 days'].push(s);
        else groups.Older.push(s);
    });
    return groups;
}

export default function SessionSidebar({
    user, currentSessionId, refreshKey,
    pinnedSessions = [], onSelectSession, onNewSession, onLogout, onTogglePin, onSidebarToggle,
    isOpen = true, className = '',
}) {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeMenu, setActiveMenu] = useState(null);
    const searchRef = useRef(null);

    // Notify parent when sidebar open state changes
    const toggleOpen = (val) => {
        onSidebarToggle?.(val);
    };

    const loadSessions = async () => {
        setLoading(true);
        try {
            const data = await sessionsAPI.getAll();
            setSessions(data.sessions || []);
        } catch { setSessions([]); }
        finally { setLoading(false); }
    };

    // Only reload sessions when refreshKey changes (after a query), not on every new session click.
    useEffect(() => { loadSessions(); }, [refreshKey]);

    const handleDelete = async (e, sessionId) => {
        e.stopPropagation();
        setActiveMenu(null);
        try {
            await sessionsAPI.delete(sessionId);
            setSessions(prev => prev.filter(s => s._id !== sessionId));
            if (sessionId === currentSessionId) onNewSession();
        } catch { /* */ }
    };

    const handleDeleteAll = async () => {
        if (!window.confirm('Delete all chat history?')) return;
        try {
            await Promise.all(sessions.map(s => sessionsAPI.delete(s._id)));
            setSessions([]);
            onNewSession();
        } catch { /* */ }
    };

    const formatTime = (iso) => {
        if (!iso) return '';
        const d = new Date(iso);
        const now = new Date();
        const diffH = (now - d) / 3600000;
        if (diffH < 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (diffH < 168) return d.toLocaleDateString([], { weekday: 'short' });
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const q = searchQuery.toLowerCase().trim();
    const filtered = q
        ? sessions.filter(s =>
            (s.title || '').toLowerCase().includes(q) ||
            (s.disease || '').toLowerCase().includes(q)
        )
        : sessions;

    const grouped = groupByDate(q ? filtered : sessions.filter(s => !pinnedSessions.includes(s._id)));
    const pinned = sessions.filter(s => pinnedSessions.includes(s._id));

    return (
        <>
            {/* ── Collapsed: floating toggle + new chat ────────────── */}
            {!isOpen && (
                <div className="sb-collapsed-bar">
                    <button className="sb-ham-btn" onClick={() => toggleOpen(true)} title="Open sidebar">
                        <span className="sb-ham" /><span className="sb-ham" /><span className="sb-ham" />
                    </button>
                    <button className="sb-newchat-float" onClick={onNewSession} title="New Chat">
                        💬
                    </button>
                </div>
            )}

            {/* ── Expanded sidebar ─────────────────────────────────── */}
            {isOpen && (
                <aside className={`sb-root ${className || ''}`}>

                    {/* Top: New Chat + Close */}
                    <div className="sb-top">
                        <button className="sb-newchat-btn" onClick={onNewSession}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            </svg>
                            New Chat
                        </button>
                        <button className="sb-close-btn" onClick={() => toggleOpen(false)} title="Close sidebar">
                            ✕
                        </button>
                    </div>

                    {/* Search input */}
                    <div className="sb-search-wrap">
                        <svg className="sb-search-icon" width="13" height="13" viewBox="0 0 13 13" fill="none">
                            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4" />
                            <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                        <input
                            ref={searchRef}
                            className="sb-search-input"
                            placeholder="Search chats..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button className="sb-search-clear" onClick={() => setSearchQuery('')}>✕</button>
                        )}
                        <button className="sb-search-mag-btn" onClick={() => searchRef.current?.focus()}>
                            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                                <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4" />
                                <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                            </svg>
                        </button>
                    </div>

                    {/* Sessions list */}
                    <div className="sb-sessions">
                        {loading && (
                            <div className="sb-loading">
                                {[1, 2, 3].map(i => <div key={i} className="sb-skeleton" />)}
                            </div>
                        )}

                        {/* Search results */}
                        {!loading && q && (
                            <>
                                {filtered.length === 0
                                    ? <div className="sb-empty">No chats match "{q}"</div>
                                    : filtered.map(s => (
                                        <SessionRow key={s._id} session={s}
                                            isActive={s._id === currentSessionId}
                                            isPinned={pinnedSessions.includes(s._id)}
                                            activeMenu={activeMenu} setActiveMenu={setActiveMenu}
                                            onSelect={onSelectSession} onDelete={handleDelete}
                                            onTogglePin={onTogglePin} formatTime={formatTime}
                                        />
                                    ))
                                }
                            </>
                        )}

                        {/* Grouped sessions (no search) */}
                        {!loading && !q && (
                            <>
                                {/* Pinned */}
                                {pinned.length > 0 && (
                                    <div className="sb-group">
                                        <div className="sb-group-label">📌 Pinned</div>
                                        {pinned.map(s => (
                                            <SessionRow key={s._id} session={s}
                                                isActive={s._id === currentSessionId}
                                                isPinned activeMenu={activeMenu} setActiveMenu={setActiveMenu}
                                                onSelect={onSelectSession} onDelete={handleDelete}
                                                onTogglePin={onTogglePin} formatTime={formatTime}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Date groups */}
                                {Object.entries(grouped).map(([label, items]) =>
                                    items.length > 0 ? (
                                        <div key={label} className="sb-group">
                                            <div className="sb-group-label">{label}</div>
                                            {items.map(s => (
                                                <SessionRow key={s._id} session={s}
                                                    isActive={s._id === currentSessionId}
                                                    isPinned={false} activeMenu={activeMenu} setActiveMenu={setActiveMenu}
                                                    onSelect={onSelectSession} onDelete={handleDelete}
                                                    onTogglePin={onTogglePin} formatTime={formatTime}
                                                />
                                            ))}
                                        </div>
                                    ) : null
                                )}

                                {sessions.length === 0 && (
                                    <div className="sb-empty">No chats yet.<br />Start a new research chat!</div>
                                )}
                            </>
                        )}
                    </div>

                    {/* ── Bottom ───────────────────────────────────── */}
                    <div className="sb-bottom">
                        <button className="sb-delete-all-btn" onClick={handleDeleteAll}>
                            🗑 Delete Chat History
                        </button>
                        <div className="sb-user-row">
                            <div className="sb-avatar">{(user?.name || 'U')[0].toUpperCase()}</div>
                            <div className="sb-user-info">
                                <div className="sb-user-name">{user?.name || 'User'}</div>
                                <div className="sb-user-email">{user?.email || ''}</div>
                            </div>
                            <button className="sb-logout-btn" onClick={() => { clearToken(); onLogout(); }} title="Sign out">
                                ↩
                            </button>
                        </div>
                    </div>
                </aside>
            )}
        </>
    );
}

/** Single session row with 3-dot menu */
function SessionRow({ session, isActive, isPinned, onSelect, onDelete, onTogglePin, formatTime, activeMenu, setActiveMenu }) {
    const menuOpen = activeMenu === session._id;

    return (
        <div className={`sb-session-item ${isActive ? 'active' : ''}`} onClick={() => { onSelect(session); setActiveMenu(null); }}>
            <div className="sb-session-title" title={session.title}>
                {session.title || 'Research Session'}
            </div>
            <button
                className="sb-dots-btn"
                title="Options"
                onClick={e => { e.stopPropagation(); setActiveMenu(menuOpen ? null : session._id); }}
            >⋮</button>

            {menuOpen && (
                <div className="sb-dot-menu" onClick={e => e.stopPropagation()}>
                    <button onClick={e => { onTogglePin(session._id); setActiveMenu(null); }}>
                        {isPinned ? '📌 Unpin' : '📍 Pin'}
                    </button>
                    <button className="sb-dot-delete" onClick={e => onDelete(e, session._id)}>
                        🗑 Delete
                    </button>
                </div>
            )}
        </div>
    );
}
