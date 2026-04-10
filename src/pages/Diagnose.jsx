import { useState, useCallback } from 'react';
import ProgressSteps from '../components/ProgressSteps';
import Spinner from '../components/Spinner';
import ErrorMessage from '../components/ErrorMessage';
import SafetyBadge from '../components/SafetyBadge';
import ConfidenceBar from '../components/ConfidenceBar';
import * as api from '../api';

/**
 * Diagnose page — the core FIY experience.
 *
 * Phases: upload -> identify -> interview -> result -> verify
 *
 * All state is local (no global store needed). The session_id from the
 * API ties everything together on the backend.
 */
export default function Diagnose() {
  const [phase, setPhase] = useState('upload');
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('');
  const [error, setError] = useState(null);

  // Session data
  const [sessionId, setSessionId] = useState(null);
  const [sessionData, setSessionData] = useState(null);

  // Upload form state
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [symptom, setSymptom] = useState('');

  // Reset everything
  const reset = useCallback(() => {
    setPhase('upload');
    setLoading(false);
    setError(null);
    setSessionId(null);
    setSessionData(null);
    setImageFile(null);
    setImagePreview(null);
    setSymptom('');
  }, []);

  // Decide next phase from API response
  function handleResponse(data) {
    setSessionData(data);
    const state = data.state || '';
    if (state === 'complete') {
      setPhase('result');
    } else if (state === 'interviewing') {
      setPhase('interview');
    } else if (data.needs_manual_entry) {
      setPhase('identify-manual');
    } else if (state === 'identified') {
      setPhase('identify');
    } else {
      // Fallback: if there's a recommendation, show result
      if (data.recommendation) {
        setPhase('result');
      }
    }
  }

  // --- Upload Phase ---
  function handleImageSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  }

  async function handleStartDiagnosis() {
    if (!imageFile) return;
    setLoading(true);
    setLoadingLabel('Identifying your device...');
    setError(null);
    try {
      // Convert file to base64
      const b64 = await fileToBase64(imageFile);
      const mediaType = imageFile.type || 'image/jpeg';
      const data = await api.startDiagnosis(b64, mediaType, symptom || null);
      setSessionId(data.session_id);
      setSessionData(data);
      setPhase('identify');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // --- Identify Phase ---
  async function handleConfirmProduct(confirmed) {
    setLoading(true);
    setLoadingLabel(confirmed ? 'Loading diagnostic data...' : '');
    setError(null);
    try {
      const data = await api.answerQuestion(sessionId, {
        answer_type: 'confirm_product',
        confirmed,
      });
      if (!confirmed) {
        setSessionData(data);
        setPhase('identify-manual');
      } else {
        handleResponse(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // --- Manual Identify ---
  async function handleManualProduct(productName, brand, modelNumber) {
    setLoading(true);
    setLoadingLabel('Looking up your device...');
    setError(null);
    try {
      const data = await api.answerQuestion(sessionId, {
        answer_type: 'manual_product',
        product_name: productName,
        brand,
        model_number: modelNumber || undefined,
      });
      handleResponse(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // --- Interview Phase ---
  async function handleInterviewAnswer(questionId, answer) {
    setLoading(true);
    setLoadingLabel('Processing...');
    setError(null);
    try {
      const data = await api.answerQuestion(sessionId, {
        answer_type: 'interview',
        question_id: questionId,
        answer,
      });
      handleResponse(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // --- Verify Phase ---
  async function handleVerify(outcome) {
    setLoading(true);
    setLoadingLabel('Recording your feedback...');
    setError(null);
    try {
      await api.verifyFix(sessionId, outcome);
      setPhase('verify');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // --- Render ---
  if (loading) {
    return (
      <>
        <ProgressSteps phase={phase} />
        <Spinner label={loadingLabel} />
      </>
    );
  }

  return (
    <>
      <ProgressSteps phase={phase} />

      {error && (
        <div className="mb-4">
          <ErrorMessage message={error} onRetry={() => setError(null)} />
        </div>
      )}

      {phase === 'upload' && (
        <UploadPhase
          imagePreview={imagePreview}
          symptom={symptom}
          onSymptomChange={setSymptom}
          onImageSelect={handleImageSelect}
          onStart={handleStartDiagnosis}
          hasImage={!!imageFile}
        />
      )}

      {phase === 'identify' && sessionData && (
        <IdentifyPhase
          data={sessionData}
          onConfirm={() => handleConfirmProduct(true)}
          onReject={() => handleConfirmProduct(false)}
        />
      )}

      {phase === 'identify-manual' && (
        <ManualIdentifyPhase onSubmit={handleManualProduct} />
      )}

      {phase === 'interview' && sessionData && (
        <InterviewPhase
          data={sessionData}
          onAnswer={handleInterviewAnswer}
        />
      )}

      {phase === 'result' && sessionData && (
        <ResultPhase
          data={sessionData}
          onVerify={handleVerify}
        />
      )}

      {phase === 'verify' && (
        <VerifyPhase onStartOver={reset} />
      )}
    </>
  );
}

// ─── Phase Components ─────────────────────────────────────────────────────────

function UploadPhase({ imagePreview, symptom, onSymptomChange, onImageSelect, onStart, hasImage }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">What needs fixing?</h1>
      <p className="text-gray-500 mb-6">
        Take a photo of the broken device. Include the whole thing and any visible damage.
      </p>

      {/* Image upload */}
      <label className="block cursor-pointer mb-6">
        <div className={`
          border-2 border-dashed rounded-xl p-6 text-center transition-colors
          ${imagePreview ? 'border-teal-300 bg-teal-50' : 'border-gray-300 hover:border-teal-400 hover:bg-gray-50'}
        `}>
          {imagePreview ? (
            <img
              src={imagePreview}
              alt="Uploaded device"
              className="max-h-64 mx-auto rounded-lg"
            />
          ) : (
            <div className="py-8">
              <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
              <p className="text-gray-600 font-medium">Tap to take or choose a photo</p>
              <p className="text-gray-400 text-sm mt-1">JPG, PNG, or WebP</p>
            </div>
          )}
        </div>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={onImageSelect}
          className="sr-only"
          aria-label="Upload a photo of your device"
        />
      </label>

      {/* Symptom input */}
      <div className="mb-6">
        <label htmlFor="symptom" className="block text-sm font-medium text-gray-700 mb-1.5">
          What's going wrong? <span className="text-gray-400 font-normal">(optional but helps)</span>
        </label>
        <input
          id="symptom"
          type="text"
          value={symptom}
          onChange={(e) => onSymptomChange(e.target.value)}
          placeholder="e.g. left stick drifts up by itself"
          maxLength={500}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
        />
      </div>

      {/* Submit */}
      <button
        onClick={onStart}
        disabled={!hasImage}
        className="w-full py-3.5 rounded-xl bg-teal-700 text-white font-semibold text-lg shadow-lg shadow-teal-700/20 hover:bg-teal-800 disabled:bg-gray-300 disabled:shadow-none disabled:cursor-not-allowed transition-colors"
      >
        Start diagnosis
      </button>
    </div>
  );
}


function IdentifyPhase({ data, onConfirm, onReject }) {
  const vision = data.vision_result || {};
  const confirmPrompt = data.confirm_prompt || 'Is this your device?';
  const confidence = Math.round((vision.confidence || 0) * 100);
  const brand = vision.brand_candidates?.[0] || 'Unknown';
  const model = vision.model_candidates?.[0] || '';

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Is this your device?</h1>
      <p className="text-gray-500 mb-6">{confirmPrompt}</p>

      {/* Product card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Brand</p>
            <p className="text-lg font-semibold text-gray-900">{brand}</p>
            {model && <p className="text-sm text-gray-500 mt-0.5">{model}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Confidence</p>
            <p className="text-lg font-semibold text-teal-700">{confidence}%</p>
          </div>
        </div>

        {vision.visible_damage?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-2">Observations</p>
            <ul className="space-y-1">
              {vision.visible_damage.map((obs, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="mt-1.5 block w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" aria-hidden="true" />
                  {obs}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onConfirm}
          className="py-3 rounded-xl bg-teal-700 text-white font-semibold hover:bg-teal-800 transition-colors"
        >
          Yes, that's right
        </button>
        <button
          onClick={onReject}
          className="py-3 rounded-xl bg-white border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
        >
          No, let me enter it
        </button>
      </div>
    </div>
  );
}


function ManualIdentifyPhase({ onSubmit }) {
  const [productName, setProductName] = useState('');
  const [brand, setBrand] = useState('');
  const [modelNumber, setModelNumber] = useState('');

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Enter your device details</h1>
      <p className="text-gray-500 mb-6">What device are you trying to fix?</p>

      <div className="space-y-4 mb-6">
        <div>
          <label htmlFor="product-name" className="block text-sm font-medium text-gray-700 mb-1">
            Device name <span className="text-red-500">*</span>
          </label>
          <input
            id="product-name"
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="e.g. DualSense Wireless Controller"
            maxLength={300}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
          />
        </div>
        <div>
          <label htmlFor="brand" className="block text-sm font-medium text-gray-700 mb-1">
            Brand <span className="text-red-500">*</span>
          </label>
          <input
            id="brand"
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g. Sony"
            maxLength={200}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
          />
        </div>
        <div>
          <label htmlFor="model-number" className="block text-sm font-medium text-gray-700 mb-1">
            Model number <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            id="model-number"
            type="text"
            value={modelNumber}
            onChange={(e) => setModelNumber(e.target.value)}
            placeholder="e.g. CFI-ZCT1W"
            maxLength={100}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
          />
        </div>
      </div>

      <button
        onClick={() => onSubmit(productName, brand, modelNumber)}
        disabled={!productName.trim() || !brand.trim()}
        className="w-full py-3.5 rounded-xl bg-teal-700 text-white font-semibold hover:bg-teal-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        Continue
      </button>
    </div>
  );
}


function InterviewPhase({ data, onAnswer }) {
  const [textAnswer, setTextAnswer] = useState('');
  const question = data.question;
  const progress = data.progress || {};

  if (!question) return null;

  const qNum = progress.questions_asked || 1;
  const maxQ = progress.max_questions || 10;
  const conf = Math.round((progress.current_confidence || 0) * 100);
  const qType = question.type || 'free_text';

  function submitAnswer(answer) {
    setTextAnswer('');
    onAnswer(question.id, answer);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-lg font-bold text-gray-900">Question {qNum} of {maxQ}</h1>
        {conf > 0 && (
          <span className="text-sm text-teal-600 font-medium">{conf}% confident</span>
        )}
      </div>

      {conf > 0 && (
        <div className="mb-6">
          <ConfidenceBar value={progress.current_confidence || 0} />
        </div>
      )}

      <p className="text-lg text-gray-800 font-medium mb-6">{question.text}</p>

      {/* Multiple choice */}
      {qType === 'multiple_choice' && question.options && (
        <div className="space-y-2 mb-4">
          {question.options.map((option, i) => (
            <button
              key={i}
              onClick={() => submitAnswer(option)}
              className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 bg-white hover:border-teal-400 hover:bg-teal-50 transition-colors text-gray-700"
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {/* Yes / No */}
      {qType === 'yes_no' && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {['Yes', 'No', 'Not sure'].map((label) => (
            <button
              key={label}
              onClick={() => submitAnswer(label)}
              className={`py-3 rounded-xl font-semibold transition-colors ${
                label === 'Yes'
                  ? 'bg-teal-700 text-white hover:bg-teal-800'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Free text */}
      {(qType === 'free_text' || qType === 'scale') && (
        <div className="mb-4">
          <input
            type="text"
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && textAnswer.trim()) submitAnswer(textAnswer.trim());
            }}
            placeholder="Type your answer..."
            maxLength={2000}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
            autoFocus
          />
          <button
            onClick={() => textAnswer.trim() && submitAnswer(textAnswer.trim())}
            disabled={!textAnswer.trim()}
            className="mt-3 w-full py-3 rounded-xl bg-teal-700 text-white font-semibold hover:bg-teal-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200">
        <button
          onClick={() => submitAnswer('skip')}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          Skip to recommendation
        </button>
      </div>
    </div>
  );
}


function ResultPhase({ data, onVerify }) {
  const recommendation = data.recommendation || {};
  const safetyLevel = recommendation.safety_level || 'SAFE';
  const safetyWarnings = recommendation.safety_warnings || [];
  const fms = recommendation.failure_mechanisms || [];
  const fix = recommendation.recommended_fix;
  const parts = recommendation.parts_list || [];
  const isProfessionalOnly = safetyLevel === 'PROFESSIONAL_ONLY';

  if (!recommendation || Object.keys(recommendation).length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 mb-4">
          We couldn't generate a diagnosis for this device. This can happen if
          the product isn't in our database yet.
        </p>
        <a
          href="/"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-teal-700 text-white font-medium hover:bg-teal-800 transition-colors"
        >
          Start over
        </a>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Here's what we found</h1>

      {/* Safety badge — always first, always prominent */}
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

      {/* Recommended fix — ONLY if not PROFESSIONAL_ONLY */}
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
                <div className="text-sm text-gray-600 prose prose-sm max-w-none whitespace-pre-line">
                  {fix.steps}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Professional only message */}
      {isProfessionalOnly && (
        <section className="mb-6">
          <div className="bg-red-50 rounded-lg border border-red-200 p-4 text-center">
            <p className="text-red-700 font-medium">
              This repair requires professional equipment and training.
            </p>
            <p className="text-red-600 text-sm mt-1">
              We recommend contacting a certified repair shop in your area.
            </p>
          </div>
        </section>
      )}

      {/* Parts list — ONLY if not PROFESSIONAL_ONLY */}
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
                  <a
                    href={part.search_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-800 mt-2 font-medium"
                  >
                    Search for this part
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Verification */}
      <section className="border-t border-gray-200 pt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Did this fix it?</h2>
        <p className="text-sm text-gray-500 mb-4">
          Your feedback improves future diagnoses and helps others with the same problem.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => onVerify('fixed')}
            className="py-3 rounded-xl bg-safe text-white font-semibold hover:opacity-90 transition-opacity"
          >
            Yes, fixed!
          </button>
          <button
            onClick={() => onVerify('partially_fixed')}
            className="py-3 rounded-xl bg-caution text-white font-semibold hover:opacity-90 transition-opacity"
          >
            Partially
          </button>
          <button
            onClick={() => onVerify('not_fixed')}
            className="py-3 rounded-xl bg-white border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
          >
            No / Not tried
          </button>
        </div>
      </section>
    </div>
  );
}


function VerifyPhase({ onStartOver }) {
  return (
    <div className="text-center py-8">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-safe" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Thanks for the feedback!</h1>
      <p className="text-gray-500 mb-8 max-w-sm mx-auto">
        Your verification is logged. Every report helps FIY build more accurate
        diagnoses for everyone who comes after you.
      </p>
      <button
        onClick={onStartOver}
        className="inline-flex items-center px-6 py-3 rounded-xl bg-teal-700 text-white font-semibold hover:bg-teal-800 transition-colors"
      >
        Diagnose another device
      </button>
    </div>
  );
}


// ─── Utils ─────────────────────────────────────────────────────────────────────

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Strip data URL prefix: "data:image/jpeg;base64,..."
      const result = reader.result;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
