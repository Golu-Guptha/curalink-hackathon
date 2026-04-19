import { useState } from 'react';

const INITIAL = {
    // Step 1 — Basic Profile
    name: '', age: '', sex: '', weight: '', location: '',
    // Step 2 — Medical Profile
    medical_history: '', current_disease: '', conditions: '',
    medications: '', current_meds: '', allergies: '', lab_values: '',
    // Step 3 — Research Focus
    research_focus: '', detail_level: 'balanced',
};

const SEX_OPTIONS     = ['Male', 'Female', 'Other', 'Prefer not to say'];
const FOCUS_OPTIONS   = [
    { value: 'treatment',  label: '💊 Treatment Options' },
    { value: 'trials',     label: '🧪 Clinical Trials' },
    { value: 'side_effects', label: '⚠️ Side Effects & Safety' },
    { value: 'prevention', label: '🛡️ Prevention & Lifestyle' },
    { value: 'mechanism',  label: '🔬 Disease Mechanism' },
    { value: 'general',    label: '📋 General Overview' },
];
const DETAIL_OPTIONS  = [
    { value: 'patient',    label: '🧑‍⚕️ Patient / Caregiver — plain language' },
    { value: 'balanced',   label: '⚖️ Balanced — mixed clinical + plain' },
    { value: 'clinical',   label: '🏥 Clinical Researcher — technical depth' },
];

export default function DeepResearchModal({ query, onSubmit, onCancel }) {
    const [step, setStep]     = useState(1);
    const [form, setForm]     = useState(INITIAL);
    const [errors, setErrors] = useState({});

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const err = (k) => errors[k] ? <p className="dr-field-error">{errors[k]}</p> : null;

    const validateStep1 = () => {
        const e = {};
        if (!form.age.trim()               ) e.age      = 'Age is required';
        else if (isNaN(form.age) || +form.age < 1 || +form.age > 120) e.age = 'Enter a valid age (1–120)';
        if (!form.sex                      ) e.sex      = 'Please select sex';
        if (!form.location.trim()          ) e.location = 'Location helps find nearby trials';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleNext = () => {
        if (step === 1 && !validateStep1()) return;
        setErrors({});
        setStep(s => s + 1);
    };

    const handleSubmit = () => {
        onSubmit({
            query,
            patient_profile: {
                name:            form.name.trim() || undefined,
                age:             form.age ? +form.age : undefined,
                sex:             form.sex || undefined,
                weight_kg:       form.weight ? +form.weight : undefined,
                location:        form.location.trim() || undefined,
                medical_history: form.medical_history.trim() || undefined,
                current_disease: form.current_disease.trim() || undefined,
                conditions:      form.conditions.trim() || undefined,
                medications:     form.medications.trim() || undefined,
                current_meds:    form.current_meds.trim() || undefined,
                allergies:       form.allergies.trim() || undefined,
                lab_values:      form.lab_values.trim() || undefined,
                research_focus:  form.research_focus || undefined,
                detail_level:    form.detail_level,
            },
        });
    };

    return (
        <div className="dr-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
            <div className="dr-modal">

                {/* ── Header ──────────────────────────────────── */}
                <div className="dr-header">
                    <div className="dr-header-left">
                        <span className="dr-icon">🔬</span>
                        <div>
                            <h2 className="dr-title">Deep Research Profile</h2>
                            <p className="dr-subtitle">Personalizes your research analysis</p>
                        </div>
                    </div>
                    <button className="dr-close" onClick={onCancel}>✕</button>
                </div>

                {/* ── Step indicator ──────────────────────────── */}
                <div className="dr-steps-bar">
                    {[1, 2, 3].map(s => (
                        <div key={s} className={`dr-step-dot ${step === s ? 'active' : ''} ${step > s ? 'done' : ''}`}>
                            {step > s ? '✓' : s}
                        </div>
                    ))}
                    <div className="dr-step-label">Step {step} of 3</div>
                </div>
                <div className="dr-progress-bar">
                    <div className="dr-progress-fill" style={{ width: `${(step / 3) * 100}%` }} />
                </div>

                {/* ── Query preview ───────────────────────────── */}
                <div className="dr-query-preview">
                    <span className="dr-query-label">Your query:</span>
                    <span className="dr-query-text">"{query}"</span>
                </div>

                {/* ── Form content ────────────────────────────── */}
                <div className="dr-body">

                    {step === 1 && (
                        <div className="dr-step-content">
                            <p className="dr-step-title">👤 Basic Profile</p>
                            <p className="dr-step-desc">
                                Helps personalize the research context. All fields optional except age and location.
                            </p>
                            <div className="dr-fields">
                                <div className="dr-field">
                                    <label className="dr-label">Name <span className="dr-optional">(optional)</span></label>
                                    <input className="dr-input" placeholder="e.g. John" value={form.name} onChange={e => set('name', e.target.value)} />
                                </div>
                                <div className="dr-field-row">
                                    <div className="dr-field">
                                        <label className="dr-label">Age <span className="dr-required">*</span></label>
                                        <input className={`dr-input ${errors.age ? 'dr-input-error' : ''}`}
                                            type="number" min="1" max="120" placeholder="e.g. 45"
                                            value={form.age} onChange={e => set('age', e.target.value)} />
                                        {err('age')}
                                    </div>
                                    <div className="dr-field">
                                        <label className="dr-label">Weight (kg) <span className="dr-optional">(optional)</span></label>
                                        <input className="dr-input" type="number" min="1" placeholder="e.g. 70"
                                            value={form.weight} onChange={e => set('weight', e.target.value)} />
                                    </div>
                                </div>
                                <div className="dr-field">
                                    <label className="dr-label">Sex <span className="dr-required">*</span></label>
                                    <div className={`dr-radio-group ${errors.sex ? 'dr-radio-error' : ''}`}>
                                        {SEX_OPTIONS.map(o => (
                                            <button
                                                key={o}
                                                className={`dr-radio-btn ${form.sex === o ? 'active' : ''}`}
                                                onClick={() => set('sex', o)}
                                                type="button"
                                            >{o}</button>
                                        ))}
                                    </div>
                                    {err('sex')}
                                </div>
                                <div className="dr-field">
                                    <label className="dr-label">Location <span className="dr-required">*</span></label>
                                    <input className={`dr-input ${errors.location ? 'dr-input-error' : ''}`}
                                        placeholder="City, Country — used to find nearby clinical trials"
                                        value={form.location} onChange={e => set('location', e.target.value)} />
                                    {err('location')}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="dr-step-content">
                            <p className="dr-step-title">🏥 Medical Profile</p>
                            <p className="dr-step-desc">
                                Help the AI understand your medical context for more relevant results.
                            </p>
                            <div className="dr-fields">
                                <div className="dr-field">
                                    <label className="dr-label">Current Disease / Diagnosis</label>
                                    <input className="dr-input" placeholder="e.g. Parkinson's Disease, Type 2 Diabetes"
                                        value={form.current_disease} onChange={e => set('current_disease', e.target.value)} />
                                </div>
                                <div className="dr-field">
                                    <label className="dr-label">Other Conditions <span className="dr-optional">(optional)</span></label>
                                    <input className="dr-input" placeholder="e.g. Hypertension, Anxiety"
                                        value={form.conditions} onChange={e => set('conditions', e.target.value)} />
                                </div>
                                <div className="dr-field-row">
                                    <div className="dr-field">
                                        <label className="dr-label">Current Medications <span className="dr-optional">(optional)</span></label>
                                        <input className="dr-input" placeholder="e.g. Levodopa, Metformin"
                                            value={form.current_meds} onChange={e => set('current_meds', e.target.value)} />
                                    </div>
                                    <div className="dr-field">
                                        <label className="dr-label">Allergies <span className="dr-optional">(optional)</span></label>
                                        <input className="dr-input" placeholder="e.g. Penicillin"
                                            value={form.allergies} onChange={e => set('allergies', e.target.value)} />
                                    </div>
                                </div>
                                <div className="dr-field">
                                    <label className="dr-label">Medical History <span className="dr-optional">(optional)</span></label>
                                    <textarea className="dr-textarea" rows={3}
                                        placeholder="e.g. Previous surgeries, family history, chronic conditions…"
                                        value={form.medical_history} onChange={e => set('medical_history', e.target.value)} />
                                </div>
                                <div className="dr-field">
                                    <label className="dr-label">Lab Values <span className="dr-optional">(optional)</span></label>
                                    <textarea className="dr-textarea" rows={2}
                                        placeholder="e.g. HbA1c: 7.2%, eGFR: 65, Blood pressure: 130/85…"
                                        value={form.lab_values} onChange={e => set('lab_values', e.target.value)} />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="dr-step-content">
                            <p className="dr-step-title">🎯 Research Preferences</p>
                            <p className="dr-step-desc">
                                What aspect of your condition do you want the AI to focus on?
                            </p>
                            <div className="dr-fields">
                                <div className="dr-field">
                                    <label className="dr-label">Research Focus</label>
                                    <div className="dr-focus-grid">
                                        {FOCUS_OPTIONS.map(o => (
                                            <button
                                                key={o.value}
                                                className={`dr-focus-btn ${form.research_focus === o.value ? 'active' : ''}`}
                                                onClick={() => set('research_focus', o.value)}
                                                type="button"
                                            >{o.label}</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="dr-field">
                                    <label className="dr-label">Preferred Detail Level</label>
                                    <div className="dr-detail-options">
                                        {DETAIL_OPTIONS.map(o => (
                                            <label key={o.value} className={`dr-detail-card ${form.detail_level === o.value ? 'active' : ''}`}>
                                                <input
                                                    type="radio"
                                                    name="detail_level"
                                                    value={o.value}
                                                    checked={form.detail_level === o.value}
                                                    onChange={() => set('detail_level', o.value)}
                                                    className="dr-radio-input"
                                                />
                                                {o.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                {/* Summary */}
                                <div className="dr-summary">
                                    <div className="dr-summary-title">Profile Summary</div>
                                    <div className="dr-summary-grid">
                                        {form.age      && <span className="dr-summary-chip">Age {form.age}</span>}
                                        {form.sex      && <span className="dr-summary-chip">{form.sex}</span>}
                                        {form.location && <span className="dr-summary-chip">📍 {form.location}</span>}
                                        {form.current_disease && <span className="dr-summary-chip">🦠 {form.current_disease}</span>}
                                        {form.allergies && <span className="dr-summary-chip">⚠️ {form.allergies}</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Footer ──────────────────────────────────── */}
                <div className="dr-footer">
                    <button className="dr-btn-secondary" onClick={step === 1 ? onCancel : () => setStep(s => s - 1)}>
                        {step === 1 ? 'Cancel' : '← Back'}
                    </button>
                    <div className="dr-footer-right">
                        <button className="dr-btn-skip" onClick={handleSubmit}>
                            Skip & Search
                        </button>
                        {step < 3
                            ? <button className="dr-btn-primary" onClick={handleNext}>Next →</button>
                            : <button className="dr-btn-primary dr-btn-submit" onClick={handleSubmit}>
                                🔬 Start Deep Research
                              </button>
                        }
                    </div>
                </div>
            </div>
        </div>
    );
}
