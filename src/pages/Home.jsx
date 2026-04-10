import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="flex flex-col items-center text-center pt-8 pb-12">
      {/* Hero */}
      <div className="w-16 h-16 rounded-2xl bg-teal-700 flex items-center justify-center mb-6">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-3">
        Fix it yourself.
      </h1>
      <p className="text-lg text-gray-600 max-w-md mb-8 leading-relaxed">
        AI-powered repair diagnosis for your stuff. Snap a photo of what's broken,
        and we'll tell you what's wrong and how to fix it.
      </p>

      {/* Primary CTA */}
      <Link
        to="/diagnose"
        className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-teal-700 text-white font-semibold text-lg shadow-lg shadow-teal-700/20 hover:bg-teal-800 transition-colors"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        Diagnose a problem
      </Link>

      {/* How it works */}
      <div className="mt-16 w-full max-w-lg">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6">
          How it works
        </h2>
        <div className="grid gap-6 text-left">
          <Step
            number="1"
            title="Snap a photo"
            description="Take a picture of the broken device. Include the whole thing and any visible damage."
          />
          <Step
            number="2"
            title="Describe the problem"
            description="Tell us what's going wrong. The more detail, the better the diagnosis."
          />
          <Step
            number="3"
            title="Answer a few questions"
            description="Our AI narrows down the issue with targeted questions — usually 3 to 5."
          />
          <Step
            number="4"
            title="Get your fix"
            description="Step-by-step repair instructions, tools needed, parts to order, and a safety rating."
          />
        </div>
      </div>

      {/* Trust signals */}
      <div className="mt-16 grid grid-cols-3 gap-4 w-full max-w-lg">
        <TrustSignal
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          }
          label="Safety first"
        />
        <TrustSignal
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          label="Under 2 minutes"
        />
        <TrustSignal
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
          }
          label="Free to try"
        />
      </div>
    </div>
  );
}

function Step({ number, title, description }) {
  return (
    <div className="flex gap-4 items-start">
      <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0 text-sm font-bold">
        {number}
      </div>
      <div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function TrustSignal({ icon, label }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-gray-500">
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}
