import React from 'react';

const SubmissionReport = ({ isSubmitting, result }) => {
    if (!result && !isSubmitting) {
        return (
            <div style={{color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '40px'}}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{opacity: 0.3, marginBottom: '10px'}}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                <span>Submit your code to see the verdict.</span>
            </div>
        );
    }

    if (isSubmitting) {
        return (
            <div style={{color: '#58a6ff', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '20px'}}>
                <svg className="spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" /></svg>
                Evaluating test cases...
            </div>
        );
    }

    if (result.status === 'ACCEPTED') {
        return (
            <div className="fade-in">
                <h2 style={{ color: '#3fb950', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Accepted
                </h2>
                <p style={{ color: '#e1e4e8', fontSize: '1rem', fontWeight: 'bold' }}>Passed {result.passed}/{result.total} test cases.</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Execution Time: {result.time} ms</p>
            </div>
        );
    }

    if (result.status === 'WRONG_ANSWER') {
        return (
            <div className="fade-in">
                <h2 style={{ color: '#ff6b6b', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    Wrong Answer
                </h2>
                <p style={{ color: '#e1e4e8', fontSize: '1rem', fontWeight: 'bold', marginBottom: '20px' }}>Passed {result.passed}/{result.total} test cases.</p>
                
                <div style={{ backgroundColor: '#161b22', padding: '15px', borderRadius: '8px', border: '1px solid #30363d' }}>
                    <strong style={{ color: '#e1e4e8', fontSize: '0.85rem' }}>Failed on Test Case:</strong>
                    <pre style={{ backgroundColor: '#0d1117', padding: '10px', borderRadius: '6px', color: '#e1e4e8', fontSize: '0.8rem', marginTop: '5px', border: '1px solid rgba(255,255,255,0.05)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {result.failedOn.displayInput}
                    </pre>

                    <strong style={{ color: '#e1e4e8', fontSize: '0.85rem', display: 'block', marginTop: '15px' }}>Expected Output:</strong>
                    <pre style={{ backgroundColor: '#0d1117', padding: '10px', borderRadius: '6px', color: '#3fb950', fontSize: '0.8rem', marginTop: '5px', border: '1px solid rgba(255,255,255,0.05)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {result.failedOn.expectedOutput}
                    </pre>

                    <strong style={{ color: '#e1e4e8', fontSize: '0.85rem', display: 'block', marginTop: '15px' }}>Actual Output:</strong>
                    <pre style={{ backgroundColor: '#0d1117', padding: '10px', borderRadius: '6px', color: '#ff6b6b', fontSize: '0.8rem', marginTop: '5px', border: '1px solid rgba(255,255,255,0.05)', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap' }}>
                        {result.actualOutput}
                    </pre>
                </div>
            </div>
        );
    }

    if (result.status === 'ERROR') {
        return (
            <div className="fade-in">
                <h2 style={{ color: '#d29922', margin: '0 0 10px 0' }}>Execution Error ⚠️</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{result.details}</p>
            </div>
        );
    }

    return null;
};

export default SubmissionReport;