import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ProgressSteps from '../components/ProgressSteps';
import Spinner from '../components/Spinner';
import ErrorMessage from '../components/ErrorMessage';
import SafetyBadge from '../components/SafetyBadge';
import ConfidenceBar from '../components/ConfidenceBar';
import * as api from '../api';
import { saveSessionToHistory } from '../sessionHistory';

/**
 * Diagnose page — the core FIY experience.
 *
 * Phases: upload -> identify -> interview -> result -> verify
 *
 * All state is local (no global store needed). The session_id from the
 * API ties everything together on the backend.
 */
export default function Diagnose() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('upload');
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('');
  const [error, setError] = useState(null);

  // Session data
  const [sessionId, setSessionId] = useState(null);
  const [sessionData, setSessionData] = useState(null);

  // Upload form state
  const [imageFiles, setImageFiles] = useState([]);      // [{file, preview}]
  const [symptom, setSymptom] = useState('');

  // Reset everything
  const reset = useCallback(() => {
    setPhase('upload');
    setLoading(false);
    setError(null);
    setSessionId(null);
    setSessionData(null);
    setImageFiles([]);
    setSymptom('');
  }, []);

  // Decide next phase from API response
  function handleResponse(data) {
    setSessionData(data);
    const state = data.state || '';
    if (state === 'complete') {
      // Save to history and redirect to persistent results page
      const sid = data.session_id || sessionId;
      saveSessionToHistory(sid, data.product?.name, data.product?.brand);
      navigate(`/results/${sid}`);
      return;
    } else if (state === 'interviewing') {
      setPhase('interview');
    } else if (data.needs_manual_entry) {
      setPhase('identify-manual');
    } else if (state === 'identified') {
      setPhase('identify');
    } else {
      // Fallback: if there's a recommendation, redirect to results
      if (data.recommendation) {
        const sid = data.session_id || sessionId;
        saveSessionToHistory(sid, data.product?.name, data.product?.brand);
        navigate(`/results/${sid}`);
        return;
      }
    }
  }

  // --- Upload Phase ---
  function handleImageSelect(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageFiles(prev => {
          if (prev.length >= 5) return prev;  // Max 5 photos
          return [...prev, { file, preview: reader.result }];
        });
      };
      reader.readAsDataURL(file);
    });
    // Reset the input so same files can be re-selected
    e.target.value = '';
  }

  function handleRemoveImage(index) {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  }

  async function handleStartDiagnosis() {
    if (imageFiles.length === 0) return;
    setLoading(true);
    setLoadingLabel('Identifying your device...');
    setError(null);
    try {
      // Convert primary image
      const primary = imageFiles[0];
      const b64 = await fileToBase64(primary.file);
      const mediaType = primary.file.type || 'image/jpeg';

      // Convert additional images (if any)
      let additionalImages = null;
      if (imageFiles.length > 1) {
        additionalImages = [];
        for (const img of imageFiles.slice(1)) {
          const extraB64 = await fileToBase64(img.file);
          additionalImages.push({
            image_base64: extraB64,
            media_type: img.file.type || 'image/jpeg',
          });
        }
      }

      const data = await api.startDiagnosis(b64, mediaType, symptom || null, additionalImages);
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
  async function handleVerify(outcome, feedback = {}) {
    setLoading(true);
    setLoadingLabel('Recording your feedback...');
    setError(null);
    try {
      await api.verifyFix(sessionId, outcome, feedback);
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
          imageFiles={imageFiles}
          symptom={symptom}
          onSymptomChange={setSymptom}
          onImageSelect={handleImageSelect}
          onRemoveImage={handleRemoveImage}
          onStart={handleStartDiagnosis}
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
          sessionId={sessionId}
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

function UploadPhase({ imageFiles, symptom, onSymptomChange, onImageSelect, onRemoveImage, onStart }) {
  const hasImages = imageFiles.length > 0;
  const canAddMore = imageFiles.length < 5;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">What needs fixing?</h1>
      <p className="text-gray-500 mb-6">
        Take photos of the broken device. Multiple angles help — include the whole thing, any visible damage, and model/serial labels.
      </p>

      {/* Image grid */}
      <div className="mb-6">
        <div className={`grid gap-3 ${hasImages ? 'grid-cols-2 sm:grid-cols-3' : ''}`}>
          {/* Existing images */}
          {imageFiles.map((img, i) => (
            <div key={i} className="relative group">
              <img
                src={img.preview}
                alt={`Photo ${i + 1}`}
                className="w-full h-32 object-cover rounded-lg border border-gray-200"
              />
              <button
                onClick={() => onRemoveImage(i)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-gray-800/70 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={`Remove photo ${i + 1}`}
              >
                &times;
              </button>
              {i === 0 && (
                <span className="absolute bottom-1 left-1 text-[10px] font-semibold bg-teal-600 text-white px-1.5 py-0.5 rounded">
                  Primary
                </span>
              )}
            </div>
          ))}

          {/* Add photo button */}
          {canAddMore && (
            <label className="block cursor-pointer">
              <div className={`
                border-2 border-dashed rounded-lg text-center transition-colors flex flex-col items-center justify-center
                ${hasImages ? 'h-32 border-gray-300 hover:border-teal-400 hover:bg-gray-50' : 'py-12 border-gray-300 hover:border-teal-400 hover:bg-gray-50'}
              `}>
                <svg className={`${hasImages ? 'w-8 h-8' : 'w-12 h-12'} text-gray-400 mb-2`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
                {hasImages ? (
                  <p className="text-gray-500 text-xs font-medium">Add another angle</p>
                ) : (
                  <>
                    <p className="text-gray-600 font-medium">Tap to take or choose a photo</p>
                    <p className="text-gray-400 text-sm mt-1">JPG, PNG, or WebP — up to 5 photos</p>
                  </>
                )}
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={onImageSelect}
                className="sr-only"
                aria-label="Upload photos of your device"
              />
            </label>
          )}
        </div>
        {hasImages && (
          <p className="text-xs text-gray-400 mt-2">{imageFiles.length}/5 photos — more angles help with identification</p>
        )}
      </div>

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
        disabled={!hasImages}
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
  const photoGuidance = data.photo_guidance || null;
  const confidence = Math.round((vision.confidence || 0) * 100);
  const brand = vision.brand_candidates?.[0] || 'Unknown';
  const model = vision.model_candidates?.[0] || '';

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Is this your device?</h1>
      <p className="text-gray-500 mb-6">{confirmPrompt}</p>

      {/* Photo guidance — shown when model is ambiguous */}
      {photoGuidance && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-800">Want a more precise diagnosis?</p>
              <p className="text-sm text-amber-700 mt-0.5">{photoGuidance}</p>
            </div>
          </div>
        </div>
      )}

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
      {/* Research banner for unknown products */}
      {data.is_known_product === false && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">New product!</span> This isn't in our database yet.
            We researched common failures online to help diagnose it.
          </p>
        </div>
      )}

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


function ResultPhase({ data, sessionId, onVerify }) {
  const [followUps, setFollowUps] = useState([]);
  const [followUpText, setFollowUpText] = useState('');
  const [followUpImage, setFollowUpImage] = useState(null);
  const [followUpPreview, setFollowUpPreview] = useState(null);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpError, setFollowUpError] = useState(null);
  const followUpRef = useRef(null);

  // Feedback form state
  const [selectedOutcome, setSelectedOutcome] = useState(null);
  const [instructionQuality, setInstructionQuality] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [actualProblem, setActualProblem] = useState('');
  const [userNotes, setUserNotes] = useState('');
  const showFeedbackForm = selectedOutcome === 'not_fixed' || selectedOutcome === 'partially_fixed';

  function handleOutcomeClick(outcome) {
    if (outcome === 'fixed' || outcome === 'not_attempted' || outcome === 'scrapped') {
      // For simple outcomes, go straight to notes prompt then submit
      setSelectedOutcome(outcome);
    } else {
      // For not_fixed/partially_fixed, show the detailed feedback form
      setSelectedOutcome(outcome);
    }
  }

  function handleSubmitFeedback() {
    const feedback = {
      notes: userNotes || undefined,
      instruction_quality: instructionQuality || undefined,
      feedback_text: feedbackText || undefined,
      actual_problem: actualProblem || undefined,
    };
    onVerify(selectedOutcome, feedback);
  }

  const recommendation = data.recommendation || {};
  const safetyLevel = recommendation.safety_level || 'SAFE';
  const safetyWarnings = recommendation.safety_warnings || [];
  const fms = recommendation.failure_mechanisms || [];
  const fix = recommendation.recommended_fix;
  const parts = recommendation.parts_list || [];
  const videos = recommendation.video_resources || [];
  const isProfessionalOnly = safetyLevel === 'PROFESSIONAL_ONLY';

  function handleFollowUpImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFollowUpImage(file);
    const reader = new FileReader();
    reader.onload = () => setFollowUpPreview(reader.result);
    reader.readAsDataURL(file);
  }

  function clearFollowUpImage() {
    setFollowUpImage(null);
    setFollowUpPreview(null);
  }

  async function handleAskFollowUp() {
    if (!followUpText.trim()) return;
    setFollowUpLoading(true);
    setFollowUpError(null);

    try {
      let imageBase64 = null;
      let mediaType = 'image/jpeg';
      if (followUpImage) {
        imageBase64 = await fileToBase64(followUpImage);
        mediaType = followUpImage.type || 'image/jpeg';
      }

      const result = await api.askFollowUp(sessionId, followUpText, imageBase64, mediaType);

      setFollowUps(prev => [...prev, {
        question: followUpText,
        imagePreview: followUpPreview,
        response: result.follow_up_response,
      }]);
      setFollowUpText('');
      setFollowUpImage(null);
      setFollowUpPreview(null);
    } catch (err) {
      setFollowUpError(err.message);
    } finally {
      setFollowUpLoading(false);
    }
  }

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

      {/* Research-based diagnosis banner */}
      {data.is_known_product === false && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            This diagnosis was built from web research, not our verified database.
            <span className="font-semibold"> Your feedback is especially valuable</span> for helping future users with this product.
          </p>
        </div>
      )}

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
                <StepList steps={fix.steps} />
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

      {/* Video guides */}
      {videos.length > 0 && !isProfessionalOnly && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Watch a repair video</h2>
          <div className="space-y-2">
            {videos.map((video, i) => (
              <a
                key={i}
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 p-3 hover:border-teal-300 hover:bg-teal-50 transition-colors group"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center group-hover:bg-red-200 transition-colors">
                  <svg className="w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{video.label}</p>
                  <p className="text-xs text-gray-400">YouTube search</p>
                </div>
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Verification */}
      <section className="border-t border-gray-200 pt-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">How's it going?</h2>
        <p className="text-sm text-gray-500 mb-4">
          Your feedback improves future diagnoses and helps others with the same problem.
        </p>

        {!selectedOutcome ? (
          /* Step 1: Outcome selection */
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleOutcomeClick('fixed')}
              className="py-3 rounded-xl bg-safe text-white font-semibold hover:opacity-90 transition-opacity"
            >
              Fixed it!
            </button>
            <button
              onClick={() => handleOutcomeClick('partially_fixed')}
              className="py-3 rounded-xl bg-caution text-white font-semibold hover:opacity-90 transition-opacity"
            >
              Partially
            </button>
            <button
              onClick={() => handleOutcomeClick('not_fixed')}
              className="py-3 rounded-xl bg-white border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
            >
              Didn't work
            </button>
            <button
              onClick={() => {
                followUpRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => {
                  const input = followUpRef.current?.querySelector('input[type="text"]');
                  input?.focus();
                }, 400);
              }}
              className="py-3 rounded-xl bg-teal-50 border border-teal-300 text-teal-700 font-semibold hover:bg-teal-100 transition-colors"
            >
              I need more help
            </button>
          </div>
        ) : (
          /* Step 2: Feedback form */
          <div className="space-y-4 bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium text-gray-900">
                {selectedOutcome === 'fixed' && 'Great!'}
                {selectedOutcome === 'partially_fixed' && 'Almost there.'}
                {selectedOutcome === 'not_fixed' && 'Sorry to hear that.'}
                {selectedOutcome === 'not_attempted' && 'No worries.'}
                {selectedOutcome === 'scrapped' && 'Got it.'}
              </p>
              <button
                onClick={() => {
                  setSelectedOutcome(null);
                  setInstructionQuality('');
                  setFeedbackText('');
                  setActualProblem('');
                  setUserNotes('');
                }}
                className="text-sm text-teal-600 hover:text-teal-800"
              >
                Change
              </button>
            </div>

            {/* Instruction quality — only for not_fixed / partially_fixed */}
            {showFeedbackForm && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Were the instructions...
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'accurate', label: 'Accurate' },
                      { value: 'inaccurate_to_model', label: 'Wrong for my model' },
                      { value: 'unclear', label: 'Hard to follow' },
                      { value: 'incomplete', label: 'Missing steps' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setInstructionQuality(opt.value)}
                        className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                          instructionQuality === opt.value
                            ? 'border-teal-500 bg-teal-50 text-teal-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    What would have made them clearer?
                  </label>
                  <input
                    type="text"
                    value={feedbackText}
                    onChange={e => setFeedbackText(e.target.value)}
                    placeholder="e.g. Step 3 said to remove screws, but my model uses clips"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    maxLength={2000}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    What was actually wrong?
                  </label>
                  <input
                    type="text"
                    value={actualProblem}
                    onChange={e => setActualProblem(e.target.value)}
                    placeholder="e.g. It turned out to be a battery issue, not the screen"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    maxLength={2000}
                  />
                </div>
              </>
            )}

            {/* Tips for the next person — always shown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Tips for the next person? <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={userNotes}
                onChange={e => setUserNotes(e.target.value)}
                placeholder="e.g. Watch out for the ribbon cable under the cover"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                maxLength={2000}
              />
            </div>

            <button
              onClick={handleSubmitFeedback}
              className="w-full py-3 rounded-xl bg-teal-700 text-white font-semibold hover:bg-teal-800 transition-colors"
            >
              Submit feedback
            </button>
          </div>
        )}
      </section>

      {/* Follow-up conversation thread */}
      {followUps.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Follow-up</h2>
          <div className="space-y-4">
            {followUps.map((fu, i) => (
              <div key={i} className="space-y-2">
                {/* User message */}
                <div className="flex justify-end">
                  <div className="bg-teal-50 rounded-lg p-3 max-w-[85%]">
                    {fu.imagePreview && (
                      <img src={fu.imagePreview} alt="Uploaded" className="rounded-md mb-2 max-h-48 w-auto" />
                    )}
                    <p className="text-sm text-gray-900">{fu.question}</p>
                  </div>
                </div>
                {/* FIY response */}
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-lg p-3 max-w-[85%]">
                    <p className="text-xs font-medium text-teal-600 mb-1">FIY</p>
                    <div className="text-sm text-gray-700 prose prose-sm max-w-none whitespace-pre-line">
                      {fu.response}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Follow-up input */}
      <section ref={followUpRef} className="mb-6 border-t border-gray-200 pt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Ask a question</h2>
        <p className="text-sm text-gray-500 mb-3">
          Ask a follow-up question or upload a photo of what you're seeing.
        </p>

        {followUpError && (
          <div className="mb-3">
            <ErrorMessage message={followUpError} onRetry={() => setFollowUpError(null)} />
          </div>
        )}

        {/* Photo preview */}
        {followUpPreview && (
          <div className="relative mb-3 inline-block">
            <img src={followUpPreview} alt="Preview" className="rounded-lg max-h-40 w-auto border border-gray-200" />
            <button
              onClick={clearFollowUpImage}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gray-700 text-white flex items-center justify-center text-xs hover:bg-gray-900"
              aria-label="Remove photo"
            >
              &times;
            </button>
          </div>
        )}

        <div className="flex gap-2">
          {/* Photo upload button */}
          <label className="flex-shrink-0 w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={handleFollowUpImage}
              className="hidden"
            />
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </label>

          {/* Text input */}
          <input
            type="text"
            value={followUpText}
            onChange={(e) => setFollowUpText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !followUpLoading) handleAskFollowUp(); }}
            placeholder={followUpImage ? "What do you want to know about this photo?" : "Ask a follow-up question..."}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            disabled={followUpLoading}
            maxLength={2000}
          />

          {/* Send button */}
          <button
            onClick={handleAskFollowUp}
            disabled={followUpLoading || !followUpText.trim()}
            className="flex-shrink-0 px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {followUpLoading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : 'Ask'}
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


// ─── Step List Component ──────────────────────────────────────────────────────

function StepList({ steps }) {
  if (!steps) return null;
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
