import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import SafetyBadge from '../components/SafetyBadge';
import ConfidenceBar from '../components/ConfidenceBar';
import Spinner from '../components/Spinner';
import ErrorMessage from '../components/ErrorMessage';
import * as api from '../api';

/**
 * Persistent Results page — loads a completed diagnostic session from the DB.
 *
 * Accessible via /results/{sessionId}. Works even after the in-memory
 * session expires. Shareable URL. Verification buttons work indefinitely.
 */
export default function Results() {
  const { sessionId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [verified, setVerified] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Feedback form state
  const [selectedOutcome, setSelectedOutcome] = useState(null);
  const [instructionQuality, setInstructionQuality] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [actualProblem, setActualProblem] = useState('');
  const [userNotes, setUserNotes] = useState('');
  const showFeedbackForm = selectedOutcome === 'not_fixed' || selectedOutcome === 'partially_fixed';

  useEffect(() => {
    async function loadSession() {
      try {
        const result = await api.getSession(sessionId);
        setData(result);
        if (result.verification_outcome) {
          setVerified(true);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadSession();
  }, [sessionId]);

  async function handleVerify() {
    setVerifyLoading(true);
    try {
      await api.verifySession(sessionId, selectedOutcome, {
        notes: userNotes || undefined,
        instruction_quality: instructionQuality || undefined,
        feedback_text: feedbackText || undefined,
        actual_problem: actualProblem || undefined,
      });
      setVerified(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifyLoading(false);
    }
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <Spinner label="Loading your diagnosis..." />;

  if (error) return (
    <div className="py-8">
      <ErrorMessage message={error} />
      <div className="text-center mt-6">
        <Link to="/diagnose" className="inline-flex items-center px-4 py-2 rounded-lg bg-teal-700 text-white font-medium hover:bg-teal-800">
          Start a new diagnosis
        </Link>
      </div>
    </div>
  );

  if (!data || !data.recommendation) return (
    <div className="text-center py-8">
      <p className="text-gray-600 mb-4">This session doesn't have a recommendation yet.</p>
      <Link to="/diagnose" className="inline-flex items-center px-4 py-2 rounded-lg bg-teal-700 text-white font-medium hover:bg-teal-800">
        Start a new diagnosis
      </Link>
    </div>
  );

  const recommendation = data.recommendation;
  const safetyLevel = recommendation.safety_level || 'SAFE';
  const safetyWarnings = recommendation.safety_warnings || [];
  const fms = recommendation.failure_mechanisms || [];
  const fix = recommendation.recommended_fix;
  const parts = recommendation.parts_list || [];
  const videos = recommendation.video_resources || [];
  const isProfessionalOnly = safetyLevel === 'PROFESSIONAL_ONLY';
  const product = data.product;

  return (
    <div>
      {/* Header with product info + share button */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Diagnosis Results</h1>
          {product && (
            <p className="text-gray-500 mt-1">
              {product.brand && <span className="font-medium">{product.brand}</span>}
              {product.brand && ' '}
              {product.name}
            </p>
          )}
          {data.initial_symptom && (
            <p className="text-sm text-gray-400 mt-0.5">{data.initial_symptom}</p>
          )}
        </div>
        <button
          onClick={handleShare}
          className="flex-shrink-0 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          {copied ? 'Copied!' : 'Share'}
        </button>
      </div>

      {/* Research-based diagnosis banner */}
      {data.is_known_product === false && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            This diagnosis was built from web research, not our verified database.
            <span className="font-semibold"> Your feedback is especially valuable.</span>
          </p>
        </div>
      )}

      {/* Safety badge */}
      <div className="mb-6">
        <SafetyBadge level={safetyLevel} warnings={safetyWarnings} />
      </div>

      {/* Failure mechanisms */}
      {fms.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Most likely causes</h2>
          <div className="space-y-3">
            {fms.slice(0, 3).map((fm, i) => (
              <div key={fm.failure_mechanism_id || i} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-gray-900">{fm.name}</h3>
                  <span className="text-sm font-medium text-teal-600 whitespace-nowrap">
                    {Math.round((fm.confidence || 0) * 100)}%
                  </span>
                </div>
                <ConfidenceBar value={fm.confidence || 0} />
                {fm.description && (
                  <p className="text-sm text-gray-500 mt-2">{fm.description}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recommended fix */}
      {fix && !isProfessionalOnly && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Recommended fix</h2>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">{fix.title}</h3>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Difficulty</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5 capitalize">{fix.difficulty || '--'}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Time</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{fix.estimated_time_minutes ? `${fix.estimated_time_minutes} min` : '--'}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Source</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5 capitalize">{(fix.source || '--').replace(/_/g, ' ')}</p>
              </div>
            </div>

            {fix.tools_required?.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-1">Tools needed</p>
                <p className="text-sm text-gray-500">{fix.tools_required.join(', ')}</p>
              </div>
            )}

            {fix.steps && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Step-by-step instructions</p>
                <StepList steps={fix.steps} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Professional only */}
      {isProfessionalOnly && (
        <section className="mb-6">
          <div className="bg-red-50 rounded-lg border border-red-200 p-4 text-center">
            <p className="text-red-700 font-medium">This repair requires professional equipment and training.</p>
            <p className="text-red-600 text-sm mt-1">We recommend contacting a certified repair shop in your area.</p>
          </div>
        </section>
      )}

      {/* Parts list */}
      {parts.length > 0 && !isProfessionalOnly && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Parts you might need</h2>
          <div className="space-y-2">
            {parts.map((part, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900">{part.name}</p>
                    {part.notes && <p className="text-xs text-gray-500 mt-0.5">{part.notes}</p>}
                  </div>
                  <p className="text-sm font-semibold text-gray-700 whitespace-nowrap">{part.estimated_cost_range}</p>
                </div>
                {part.search_url && (
                  <a href={part.search_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-800 mt-2 font-medium">
                    Search for this part
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Video guides */}
      {videos.length > 0 && !isProfessionalOnly && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Watch a repair video</h2>
          <div className="space-y-2">
            {videos.map((video, i) => (
              <a key={i} href={video.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 p-3 hover:border-teal-300 hover:bg-teal-50 transition-colors group">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center group-hover:bg-red-200 transition-colors">
                  <svg className="w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{video.label}</p>
                  <p className="text-xs text-gray-400">YouTube search</p>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Verification */}
      <section className="border-t border-gray-200 pt-6 mb-6">
        {verified ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-900 font-semibold">Feedback received</p>
            <p className="text-sm text-gray-500 mt-1">Thanks for helping improve FIY for everyone.</p>
            <Link to="/diagnose" className="inline-flex items-center px-4 py-2 mt-4 rounded-lg bg-teal-700 text-white font-medium hover:bg-teal-800">
              Diagnose another device
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">How did it go?</h2>
            <p className="text-sm text-gray-500 mb-4">
              Your feedback improves future diagnoses and helps others with the same problem.
            </p>

            {!selectedOutcome ? (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setSelectedOutcome('fixed')}
                  className="py-3 rounded-xl bg-safe text-white font-semibold hover:opacity-90 transition-opacity">
                  Fixed it!
                </button>
                <button onClick={() => setSelectedOutcome('partially_fixed')}
                  className="py-3 rounded-xl bg-caution text-white font-semibold hover:opacity-90 transition-opacity">
                  Partially
                </button>
                <button onClick={() => setSelectedOutcome('not_fixed')}
                  className="py-3 rounded-xl bg-white border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors">
                  Didn't work
                </button>
                <button onClick={() => setSelectedOutcome('not_attempted')}
                  className="py-3 rounded-xl bg-gray-100 border border-gray-200 text-gray-600 font-semibold hover:bg-gray-200 transition-colors">
                  Haven't tried yet
                </button>
              </div>
            ) : (
              <div className="space-y-4 bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900">
                    {selectedOutcome === 'fixed' && 'Great!'}
                    {selectedOutcome === 'partially_fixed' && 'Almost there.'}
                    {selectedOutcome === 'not_fixed' && 'Sorry to hear that.'}
                    {selectedOutcome === 'not_attempted' && 'No worries — you can come back anytime.'}
                  </p>
                  <button onClick={() => { setSelectedOutcome(null); setInstructionQuality(''); setFeedbackText(''); setActualProblem(''); setUserNotes(''); }}
                    className="text-sm text-teal-600 hover:text-teal-800">Change</button>
                </div>

                {showFeedbackForm && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Were the instructions...</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'accurate', label: 'Accurate' },
                          { value: 'inaccurate_to_model', label: 'Wrong for my model' },
                          { value: 'unclear', label: 'Hard to follow' },
                          { value: 'incomplete', label: 'Missing steps' },
                        ].map(opt => (
                          <button key={opt.value} onClick={() => setInstructionQuality(opt.value)}
                            className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                              instructionQuality === opt.value
                                ? 'border-teal-500 bg-teal-50 text-teal-700'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                            }`}>{opt.label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">What would have made them clearer?</label>
                      <input type="text" value={feedbackText} onChange={e => setFeedbackText(e.target.value)}
                        placeholder="e.g. Step 3 said to remove screws, but my model uses clips"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent" maxLength={2000} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">What was actually wrong?</label>
                      <input type="text" value={actualProblem} onChange={e => setActualProblem(e.target.value)}
                        placeholder="e.g. It turned out to be a battery issue, not the screen"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent" maxLength={2000} />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Tips for the next person? <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input type="text" value={userNotes} onChange={e => setUserNotes(e.target.value)}
                    placeholder="e.g. Watch out for the ribbon cable under the cover"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent" maxLength={2000} />
                </div>

                <button onClick={handleVerify} disabled={verifyLoading}
                  className="w-full py-3 rounded-xl bg-teal-700 text-white font-semibold hover:bg-teal-800 transition-colors disabled:opacity-50">
                  {verifyLoading ? 'Submitting...' : 'Submit feedback'}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Back to home */}
      <div className="text-center pb-6">
        <Link to="/diagnose" className="text-sm text-teal-600 hover:text-teal-800 font-medium">
          Diagnose another device
        </Link>
      </div>
    </div>
  );
}


// ─── Step List Component ──────────────────────────────────────────────────────

function StepList({ steps }) {
  if (!steps) return null;

  // Handle both array (new format) and string (legacy) formats
  const stepArray = Array.isArray(steps)
    ? steps
    : steps.split(/\n/).filter(s => s.trim());

  // If we still have one big blob, try splitting on numbered patterns
  if (stepArray.length === 1 && stepArray[0].length > 100) {
    const reSplit = stepArray[0].split(/(?=\d+\.\s)/).filter(s => s.trim());
    if (reSplit.length > 1) {
      return <StepListInner steps={reSplit} />;
    }
  }

  return <StepListInner steps={stepArray} />;
}

function StepListInner({ steps }) {
  return (
    <ol className="space-y-3 text-sm text-gray-600">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3 leading-relaxed">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 text-teal-700 text-xs font-bold flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <span>{step.replace(/^\d+\.\s*/, '')}</span>
        </li>
      ))}
    </ol>
  );
}
