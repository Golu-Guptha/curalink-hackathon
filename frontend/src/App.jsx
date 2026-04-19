import { useState, useCallback, useEffect } from 'react';
import AuthPage from './components/AuthPage.jsx';
import SessionSidebar from './components/SessionSidebar.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import ResultsPanel from './components/ResultsPanel.jsx';
import { queryMedicalResearch, authAPI, sessionsAPI, getToken, clearToken } from './services/api.js';
import './index-expanded.css';
import './theme-overrides.css';


const generateSessionId = () =>
    `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/** Build smart, query-aware chat text from AI response */
const buildChatText = (result, query) => {
    const q = (query || '').toLowerCase();
    const isTrial = q.includes('trial') || q.includes('recruit') || q.includes('study') || q.includes('studies');

    const parts = [];

    if (result.condition_overview) parts.push(result.condition_overview);

    if (isTrial && result.clinical_trials?.length > 0) {
        const recruiting = result.clinical_trials.filter(t => t.status === 'RECRUITING');
        parts.push(
            recruiting.length > 0
                ? `📋 Found ${result.clinical_trials.length} clinical trials — ${recruiting.length} currently RECRUITING. See the Trials tab for full eligibility details.`
                : `📋 Found ${result.clinical_trials.length} clinical trials (mostly completed). See the Trials tab for details.`
        );
    }

    if (result.research_insights?.length > 0 && !isTrial) {
        parts.push(`💡 ${result.research_insights[0].finding}`);
    }

    if (result.recommendation) parts.push(result.recommendation);

    return parts.join('\n\n');
};

export default function App() {
    // ── Auth ────────────────────────────────────────────────────────
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);

    // ── Session ─────────────────────────────────────────────────────
    const [sessionId, setSessionId] = useState(() => generateSessionId());
    const [sessionDisease, setSessionDisease] = useState('');
    const [sessionLocation, setSessionLocation] = useState('');
    const [analysisState, setAnalysisState] = useState('hidden'); // 'hidden', 'preview', 'expanded'

    const [pinnedSessions, setPinnedSessions] = useState(() => {
        try { return JSON.parse(localStorage.getItem('curalink_pinned') || '[]'); }
        catch { return []; }
    });
    const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
    const [sidebarOpen, setSidebarOpen] = useState(true); // track sidebar open/collapsed

    // ── Chat ─────────────────────────────────────────────────────────
    const [messages, setMessages] = useState([]);
    const [currentResult, setCurrentResult] = useState(null);
    const [currentQuery, setCurrentQuery] = useState('');
    const [followUps, setFollowUps] = useState([]);
    const [activeTab, setActiveTab] = useState('overview');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // ── Restore user from token ─────────────────────────────────────
    useEffect(() => {
        const token = getToken();
        if (token) {
            authAPI.getMe()
                .then(data => setUser(data.user))
                .catch(() => clearToken())
                .finally(() => setAuthLoading(false));
        } else {
            setAuthLoading(false);
        }
    }, []);

    // ── Auth handlers ───────────────────────────────────────────────
    const handleAuth = (userData) => setUser(userData);
    const handleLogout = () => {
        setUser(null);
        setMessages([]); setCurrentResult(null);
        setSessionId(generateSessionId()); setSessionDisease('');
        setFollowUps([]);
    };

    // ── Session handlers ────────────────────────────────────────────
    const handleNewSession = () => {
        setSessionId(generateSessionId());
        setMessages([]); setCurrentResult(null);
        setActiveTab('overview'); setError(null);
        setSessionDisease(''); setSessionLocation('');
        setCurrentQuery(''); setFollowUps([]);
        setAnalysisState('hidden'); // reset panel instantly
    };

    const handleSelectSession = async (session) => {
        if (session._id === sessionId) return;
        setSessionId(session._id);
        setSessionDisease(session.disease || '');
        setSessionLocation(session.location || '');
        setCurrentResult(null); setActiveTab('overview');
        setError(null); setCurrentQuery(''); setFollowUps([]);

        try {
            const data = await sessionsAPI.getById(session._id);
            const msgs = (data.messages || []).map(m => ({
                id: m._id,
                role: m.role === 'assistant' ? 'ai' : 'user',
                text: m.content,
                time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }));
            setMessages(msgs);

            const lastAI = [...(data.messages || [])].reverse().find(m => m.role === 'assistant');
            if (lastAI?.structuredResponse) {
                setCurrentResult(lastAI.structuredResponse);
                setFollowUps(lastAI.structuredResponse.follow_up_questions || []);
            }
        } catch { setMessages([]); }
    };

    const handleTogglePin = (sessionId) => {
        setPinnedSessions(prev => {
            const next = prev.includes(sessionId)
                ? prev.filter(id => id !== sessionId)
                : [...prev, sessionId];
            localStorage.setItem('curalink_pinned', JSON.stringify(next));
            return next;
        });
    };

    // ── Chat handler ────────────────────────────────────────────────
    const handleQuery = useCallback(async ({ query, disease, location, research_mode, patient_profile }) => {
        if (!query.trim() || !disease.trim() || isLoading) return;

        const activeDis = sessionDisease || disease;
        const activeLoc = sessionLocation || location;
        const activeMode = research_mode || 'thinking';
        if (!sessionDisease) { setSessionDisease(disease); setSessionLocation(location || ''); }

        setCurrentQuery(query);
        setError(null);
        setFollowUps([]);

        const userMsg = {
            id: `msg_${Date.now()}`,
            role: 'user',
            text: query,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);
        setActiveTab('overview');

        try {
            const result = await queryMedicalResearch({
                query,
                session_id: sessionId,
                disease: activeDis,
                location: activeLoc || null,
                research_mode: activeMode,
                patient_profile: patient_profile || null,
            });

            setCurrentResult(result);
            setFollowUps(result.follow_up_questions || []);
            if (analysisState === 'hidden') setAnalysisState('preview');

            const aiMsg = {
                id: `msg_${Date.now()}_ai`,
                role: 'ai',
                text: buildChatText(result, query),
                mode: activeMode,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
            setMessages(prev => [...prev, aiMsg]);
            setSidebarRefreshKey(k => k + 1);

        } catch (err) {
            const errText = err.message || 'Something went wrong. Please try again.';
            setError(errText);
            setMessages(prev => [...prev, {
                id: `msg_${Date.now()}_err`,
                role: 'ai',
                text: `⚠️ ${errText}`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }]);
        } finally {
            setIsLoading(false);
        }
    }, [sessionId, sessionDisease, sessionLocation, isLoading]);

    // ── Render ──────────────────────────────────────────────────────
    if (authLoading) {
        return (
            <div className="auth-overlay">
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Loading…</div>
            </div>
        );
    }

    if (!user) return <AuthPage onAuth={handleAuth} />;

    const hasConversation = messages.length > 0;

    return (
        <div className={`app-shell ${analysisState === 'expanded' ? 'state-expanded' : ''}`}>
            <SessionSidebar
                user={user}
                currentSessionId={sessionId}
                refreshKey={sidebarRefreshKey}
                pinnedSessions={pinnedSessions}
                onSelectSession={handleSelectSession}
                onNewSession={handleNewSession}
                onLogout={handleLogout}
                onTogglePin={handleTogglePin}
                onSidebarToggle={setSidebarOpen}
            />

            <div className="main-layout-wrapper">
                {hasConversation && (
                    <header className={`app-header sticky-header ${!sidebarOpen ? 'sidebar-collapsed' : ''}`}>
                        <div className="header-left">
                            {/* CuraLink wordmark */}
                            <span className="header-logo-mark">CuraLink</span>

                            {/* Divider */}
                            {(sessionDisease || sessionLocation) && (
                                <>
                                    <span className="header-divider" />
                                    <div className="header-context">
                                        {sessionDisease && (
                                            <span className="ctx-item ctx-item-disease">
                                                <span className="ctx-dot ctx-dot-brain" />  {sessionDisease}
                                            </span>
                                        )}
                                        {sessionLocation && (
                                            <span className="ctx-item ctx-item-loc">
                                                <span className="ctx-dot ctx-dot-pin" /> {sessionLocation}
                                            </span>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="header-right">
                            {/* Session & model info pill */}
                            {!isLoading && currentResult && (
                                <span className="header-status-pill">
                                    <span className="header-status-dot" />

                                </span>
                            )}

                            <div className="header-expand-wrapper">
                                <button
                                    className={`header-expand-btn ${isLoading ? 'header-expand-btn-loading' : ''}`}
                                    onClick={() => setAnalysisState(analysisState === 'expanded' ? 'preview' : 'expanded')}
                                    disabled={isLoading}
                                    title={isLoading ? 'Generating analysis…' : analysisState === 'expanded' ? 'Back to Chat' : 'View Full Analysis'}
                                >
                                    {isLoading ? (
                                        <>
                                            <span className="header-expand-spinner" />
                                            Generating…
                                        </>
                                    ) : analysisState === 'expanded' ? (
                                        '← Chat with AI'
                                    ) : (
                                        'View Research Analysis Results →'
                                    )}
                                </button>
                                {!isLoading && currentResult && analysisState !== 'expanded' && (
                                    <span className="header-notify-dot" title="Research results ready" />
                                )}
                            </div>
                        </div>
                    </header>
                )}

                <main className={`content-area ${!hasConversation ? 'content-landing' : ''}`}>
                    {analysisState !== 'expanded' && (
                        <div className={`chat-container ${analysisState === 'expanded' ? 'chat-narrow' : 'chat-wide'}`}>
                            <ChatPanel
                                messages={messages}
                                isLoading={isLoading}
                                onQuery={handleQuery}
                                error={error}
                                lockedDisease={sessionDisease}
                                currentQuery={currentQuery}
                                followUps={followUps}
                            />
                        </div>
                    )}

                    {(hasConversation || isLoading || currentResult) && (
                        <div className={`analysis-container ${analysisState}`}>
                            <ResultsPanel
                                result={currentResult}
                                activeTab={activeTab}
                                onTabChange={setActiveTab}
                                isLoading={isLoading}
                                analysisState={analysisState}
                                onToggleExpand={() => setAnalysisState(analysisState === 'expanded' ? 'preview' : 'expanded')}
                            />
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
