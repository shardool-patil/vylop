import React from 'react';
import Avatar from 'react-avatar';

const Client = ({ username }) => {
    return (
        <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            marginBottom: '10px', 
            padding: '8px', 
            borderRadius: '8px', 
            background: 'rgba(255,255,255,0.03)',
            transition: 'background 0.2s'
        }} className="client-item">
            <Avatar name={username} size={32} round="8px" />
            <span style={{ marginLeft: '12px', fontWeight: '500', fontSize: '0.9rem' }}>{username}</span>
            <div style={{ marginLeft: 'auto', width: '8px', height: '8px', background: '#2ea043', borderRadius: '50%' }}></div>
        </div>
    );
};

export default Client;