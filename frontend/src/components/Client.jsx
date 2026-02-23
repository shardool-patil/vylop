import React from 'react';

const Client = ({ username, color }) => {
    return (
        <div style={{
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            padding: '8px 12px', 
            background: 'var(--bg-input)', 
            border: '1px solid var(--border)',
            borderRadius: '8px', 
            marginBottom: '8px'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '6px',
                    backgroundColor: color || '#58a6ff', /* Falls back to blue if no color */
                    display: 'flex', 
                    alignItems: 'center',
                    justifyContent: 'center', 
                    color: '#fff', 
                    fontWeight: 'bold',
                    textTransform: 'uppercase', 
                    fontSize: '0.9rem'
                }}>
                    {username ? username.substring(0, 1) : '?'}
                </div>
                <span style={{ color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: '500' }}>
                    {username}
                </span>
            </div>
            {/* Online Indicator Dot */}
            <div style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                backgroundColor: '#2ea043', 
                boxShadow: '0 0 5px rgba(46, 160, 67, 0.5)' 
            }}></div>
        </div>
    );
};

export default Client;