'use client';

import React, { useState } from 'react';
import { ThemeToggle } from '../components/ThemeToggle';
import { HumanVerdict } from '@traceback/shared-types';

export default function HomePage() {
  const [explanation, setExplanation] = useState(
    'This memoization hook was introduced to prevent re-rendering when the active dataset exceeds 500 records during real-time streaming updates.',
  );
  const [selectedVerdict, setSelectedVerdict] = useState<HumanVerdict | null>('SUPPORTED');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation */}
      <header
        style={{
          borderBottom: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          padding: '1rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontWeight: 'bold',
            }}
          >
            T
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>
              Traceback
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
              Human-Supervised Code Rationale Verification (T1.1)
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <ThemeToggle />
        </div>
      </header>

      {/* Development Status Banner */}
      <div
        style={{
          backgroundColor: 'var(--color-card-muted)',
          borderBottom: '1px solid var(--color-border)',
          padding: '0.5rem 2rem',
          fontSize: '0.8125rem',
          color: 'var(--color-text-secondary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>
          <strong>Sprint 2 Development Preview:</strong> Application scaffolding, light-first theme, and API foundation active.
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-success)',
            }}
          />
          Backend API Ready
        </span>
      </div>

      {/* Main Content Area */}
      <main
        style={{
          flex: 1,
          maxWidth: '1200px',
          width: '100%',
          margin: '0 auto',
          padding: '2rem',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '2rem',
        }}
      >
        {/* Left Column: Input & Target Repo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Repository Selector Card */}
          <section
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '1.5rem',
            }}
          >
            <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Target Repository
            </h2>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--color-card-muted)',
                borderRadius: '6px',
                border: '1px solid var(--color-border)',
                fontSize: '0.875rem',
              }}
            >
              <span>📁 Ujjawal-0103/HackFront (Local Testbed)</span>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  backgroundColor: 'var(--color-success)',
                  color: '#FFFFFF',
                  fontWeight: 600,
                }}
              >
                Read-Only
              </span>
            </div>
            <p
              style={{
                fontSize: '0.75rem',
                color: 'var(--color-text-secondary)',
                marginTop: '0.5rem',
              }}
            >
              *Live GitHub App authorization boundary implemented. Automated repository sync scheduled for Sprint 3.
            </p>
          </section>

          {/* Explanation Input Form */}
          <section
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>
              AI Explanation Under Investigation
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
              Paste an explanation generated by an AI assistant (Copilot, Cursor, Claude Code) to extract claims and verify historical provenance.
            </p>
            <textarea
              id="explanation-input"
              rows={5}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Paste explanation here..."
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-background)',
                color: 'var(--color-text)',
                fontFamily: 'inherit',
                fontSize: '0.875rem',
                resize: 'vertical',
              }}
            />
            <button
              type="button"
              id="investigate-btn"
              style={{
                padding: '0.6rem 1.2rem',
                backgroundColor: 'var(--color-primary)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                alignSelf: 'flex-start',
                transition: 'background-color 0.15s',
              }}
            >
              Investigate Claims (Demo)
            </button>
          </section>
        </div>

        {/* Right Column: Claim & Evidence Adjudication Shelf */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <section
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>
                Decomposed Claim #1
              </h2>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  backgroundColor: 'var(--color-primary)',
                  color: '#FFFFFF',
                  fontWeight: 600,
                }}
              >
                AI Grounding: High Match
              </span>
            </div>

            <blockquote
              style={{
                borderLeft: '4px solid var(--color-primary)',
                paddingLeft: '1rem',
                margin: '0 0 1rem 0',
                fontStyle: 'italic',
                fontSize: '0.875rem',
                color: 'var(--color-text)',
              }}
            >
              &ldquo;Memoization was introduced to prevent re-rendering when table size exceeds 500 rows during streaming updates.&rdquo;
            </blockquote>

            {/* Evidence Card */}
            <div
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '1rem',
                backgroundColor: 'var(--color-card-muted)',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8125rem' }}>
                <span style={{ fontWeight: 600 }}>📌 Commit Provenance</span>
                <a
                  href="https://github.com/Ujjawal-0103/HackFront"
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontWeight: 500 }}
                >
                  SHA: 7a8b9c1 • PR #42 ↗
                </a>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                Author: <code>alex@company.com</code> • Committed 18 months ago
              </p>
              <pre
                style={{
                  fontSize: '0.75rem',
                  backgroundColor: 'var(--color-surface)',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border)',
                  overflowX: 'auto',
                }}
              >
                <code>{`+ const memoizedRows = useMemo(() => {\n+   // Buffer streaming chunks when rows > 500\n+   return computeVisibleRows(data);\n+ }, [data]);`}</code>
              </pre>
            </div>

            {/* Human Adjudication Controls */}
            <div>
              <p style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Human Supervised Verdict:
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  id="verdict-supported"
                  onClick={() => setSelectedVerdict('SUPPORTED')}
                  style={{
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid var(--color-success)',
                    backgroundColor: selectedVerdict === 'SUPPORTED' ? 'var(--color-success)' : 'transparent',
                    color: selectedVerdict === 'SUPPORTED' ? '#FFFFFF' : 'var(--color-success)',
                    cursor: 'pointer',
                  }}
                >
                  ✓ Supported
                </button>
                <button
                  type="button"
                  id="verdict-contradicted"
                  onClick={() => setSelectedVerdict('CONTRADICTED')}
                  style={{
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid var(--color-error)',
                    backgroundColor: selectedVerdict === 'CONTRADICTED' ? 'var(--color-error)' : 'transparent',
                    color: selectedVerdict === 'CONTRADICTED' ? '#FFFFFF' : 'var(--color-error)',
                    cursor: 'pointer',
                  }}
                >
                  ✕ Contradicted
                </button>
                <button
                  type="button"
                  id="verdict-unverified"
                  onClick={() => setSelectedVerdict('UNVERIFIED')}
                  style={{
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid var(--color-warning)',
                    backgroundColor: selectedVerdict === 'UNVERIFIED' ? 'var(--color-warning)' : 'transparent',
                    color: selectedVerdict === 'UNVERIFIED' ? '#FFFFFF' : 'var(--color-warning)',
                    cursor: 'pointer',
                  }}
                >
                  ? Unverified
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          padding: '1rem 2rem',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: 'var(--color-text-secondary)',
        }}
      >
        Traceback V1 Foundation • Light-first default theme • WCAG 2.1 AA compliant
      </footer>
    </div>
  );
}
